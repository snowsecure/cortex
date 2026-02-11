/**
 * Server-Side Processing Queue
 *
 * In-memory queue backed by SQLite. Manages concurrency, pause/resume,
 * cancellation, and auto-resume on server restart.
 *
 * Each job holds:
 *   - packetId
 *   - apiKey (in memory only — never persisted)
 *   - config  (processing settings)
 *   - AbortController (for cancellation)
 *   - EventEmitter (for SSE subscribers)
 */

import { EventEmitter } from "node:events";
import * as db from "../db/database.js";
import { processPacket } from "./pipeline.js";
import path from "path";
import fs from "fs";

// ============================================================================
// QUEUE STATE
// ============================================================================

/** @type {Map<string, Job>} packetId → active job */
const activeJobs = new Map();

/** @type {Array<QueueEntry>} FIFO queue of pending jobs */
const pendingQueue = [];

/** @type {Map<string, EventEmitter>} packetId → emitter (persists across job lifecycle for SSE reconnection) */
const emitters = new Map();

let paused = false;
let maxConcurrency = 5;
let loopRunning = false;

/**
 * @typedef {Object} QueueEntry
 * @property {string}   packetId
 * @property {string}   apiKey
 * @property {Object}   config
 */

/**
 * @typedef {Object} Job
 * @property {string}          packetId
 * @property {string}          apiKey
 * @property {Object}          config
 * @property {AbortController} controller
 * @property {EventEmitter}    emitter
 * @property {Promise}         promise
 */

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Enqueue a packet for processing.
 * Returns the EventEmitter for this packet (subscribe for SSE events).
 */
export function enqueue(packetId, apiKey, config = {}) {
  // Don't double-enqueue
  if (activeJobs.has(packetId) || pendingQueue.some(e => e.packetId === packetId)) {
    return getOrCreateEmitter(packetId);
  }

  pendingQueue.push({ packetId, apiKey, config });

  // Update DB status
  db.updatePacket(packetId, {
    status: "queued",
    processing_config: JSON.stringify(config),
  });

  // Ensure loop is running
  if (!loopRunning && !paused) {
    runLoop();
  }

  return getOrCreateEmitter(packetId);
}

/**
 * Cancel a specific packet's processing.
 */
export function cancel(packetId) {
  // Remove from pending queue
  const idx = pendingQueue.findIndex(e => e.packetId === packetId);
  if (idx !== -1) pendingQueue.splice(idx, 1);

  // Abort active job
  const job = activeJobs.get(packetId);
  if (job) {
    job.controller.abort();
    // Job cleanup happens in runJob's finally block
  }

  db.updatePacket(packetId, { status: "failed", error: "Cancelled by user", pipeline_stage: null });

  const emitter = emitters.get(packetId);
  if (emitter) emitter.emit("cancelled", { packetId });
}

/**
 * Pause all processing. Active jobs finish their current API call then stop.
 */
export function pause() {
  paused = true;
  // Abort all active jobs so they re-queue
  for (const [, job] of activeJobs) {
    job.controller.abort();
  }
}

/**
 * Resume processing after a pause.
 */
export function resume() {
  paused = false;
  if (!loopRunning) runLoop();
}

/**
 * Get the EventEmitter for a packet (for SSE subscription).
 * Creates one if it doesn't exist.
 *
 * IMPORTANT: Every emitter gets a default `error` listener to prevent
 * Node.js from crashing when `error` events are emitted with no SSE
 * client subscribed (e.g., packet fails before a client connects).
 */
export function getOrCreateEmitter(packetId) {
  if (!emitters.has(packetId)) {
    const emitter = new EventEmitter();
    // Prevent ERR_UNHANDLED_ERROR crashes — log instead of crashing
    emitter.on("error", (data) => {
      console.warn(`[Queue] Unhandled error event for packet ${packetId}:`, data?.error || data);
    });
    emitters.set(packetId, emitter);
  }
  return emitters.get(packetId);
}

/**
 * Check if a packet is currently being processed or queued.
 */
export function isProcessing(packetId) {
  return activeJobs.has(packetId) || pendingQueue.some(e => e.packetId === packetId);
}

/**
 * Get overall queue status.
 */
export function getStatus() {
  return {
    paused,
    activeCount: activeJobs.size,
    pendingCount: pendingQueue.length,
    activePacketIds: [...activeJobs.keys()],
    pendingPacketIds: pendingQueue.map(e => e.packetId),
    maxConcurrency,
  };
}

/**
 * Set max concurrency.
 */
export function setConcurrency(n) {
  maxConcurrency = Math.max(1, Math.min(n, 20));
}

/**
 * Clean up emitter for a packet (call after SSE clients disconnect and packet is done).
 */
export function cleanupEmitter(packetId) {
  const emitter = emitters.get(packetId);
  if (emitter) {
    emitter.removeAllListeners();
    emitters.delete(packetId);
  }
}

// ============================================================================
// INTERNAL LOOP
// ============================================================================

async function runLoop() {
  if (loopRunning) return;
  loopRunning = true;

  try {
    while (!paused) {
      // Fill available concurrency slots
      while (activeJobs.size < maxConcurrency && pendingQueue.length > 0) {
        const entry = pendingQueue.shift();
        runJob(entry); // Don't await — runs concurrently
      }

      // Nothing to process and nothing in flight → done
      if (pendingQueue.length === 0 && activeJobs.size === 0) break;

      // Wait for an active job to finish before checking again
      if (activeJobs.size >= maxConcurrency || pendingQueue.length === 0) {
        const promises = [...activeJobs.values()].map(j => j.promise);
        if (promises.length === 0) break; // Safety: no active jobs left
        await Promise.race(promises);
      }
    }
  } finally {
    loopRunning = false;
  }
}

async function runJob(entry) {
  const { packetId, apiKey, config } = entry;
  const controller = new AbortController();
  const emitter = getOrCreateEmitter(packetId);

  const jobPromise = (async () => {
    try {
      // Resolve base64 from server temp file
      const packet = db.getPacket(packetId);
      if (!packet) throw new Error("Packet not found in database");

      let base64 = null;
      if (packet.temp_file_path) {
        // Server stores path as e.g. "data/temp-pdfs/pkt_xxx.pdf" — resolve from cwd
        const absolutePath = path.isAbsolute(packet.temp_file_path)
          ? packet.temp_file_path
          : path.resolve(process.cwd(), packet.temp_file_path);

        if (fs.existsSync(absolutePath)) {
          const fileBuffer = fs.readFileSync(absolutePath);
          base64 = `data:application/pdf;base64,${fileBuffer.toString("base64")}`;
        }
      }

      if (!base64) throw new Error("File not found or expired. Re-upload to retry.");

      // Update DB
      db.updatePacket(packetId, {
        status: "processing",
        started_at: new Date().toISOString(),
        pipeline_stage: "splitting",
      });

      emitter.emit("started", { packetId });

      const result = await processPacket(packet, base64, apiKey, config, controller.signal, emitter);

      // Complete in DB (atomically update packet + session + usage)
      db.completePacket(packetId, result);
      emitter.emit("completed", { packetId, result });

    } catch (error) {
      if (error.name === "AbortError" || error.message === "Processing aborted") {
        if (paused) {
          // Re-queue for resume
          console.log(`[Queue] Packet ${packetId} paused, re-queuing`);
          db.updatePacket(packetId, { status: "queued", pipeline_stage: null });
          pendingQueue.push(entry);
          emitter.emit("paused", { packetId });
        } else {
          // Cancelled
          console.log(`[Queue] Packet ${packetId} cancelled`);
          emitter.emit("cancelled", { packetId });
        }
      } else {
        console.error(`[Queue] Packet ${packetId} failed:`, error.message);
        db.updatePacket(packetId, {
          status: "failed",
          error: error.message,
          completed_at: new Date().toISOString(),
          pipeline_stage: null,
        });
        emitter.emit("error", { packetId, error: error.message });
      }
    } finally {
      activeJobs.delete(packetId);
    }
  })();

  activeJobs.set(packetId, { packetId, apiKey, config, controller, emitter, promise: jobPromise });
}

// ============================================================================
// SERVER STARTUP: auto-resume zombie packets
// ============================================================================

/**
 * Call on server startup after db.initializeDatabase() and db.resetZombiePackets().
 * Zombie packets are already set to 'queued' — this picks them up if an API key
 * is provided (the client must re-submit keys for zombies since keys are never persisted).
 *
 * For now, zombies wait until a client reconnects and re-submits the processing
 * request with their API key.
 */
export function initializeQueue() {
  console.log("[Queue] Processing queue initialized");
  console.log(`[Queue] Max concurrency: ${maxConcurrency}`);
  const queued = db.getQueuedPackets();
  if (queued.length > 0) {
    console.log(`[Queue] ${queued.length} queued packet(s) waiting for client to re-submit API key`);
  }
}
