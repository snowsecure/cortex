import { useReducer, useCallback, useRef, useEffect, useState } from "react";
import { usePacketPipeline, PipelineStatus } from "./usePacketPipeline";
import * as api from "../lib/api";
import { loadSettings, DEFAULT_CONFIG as RETAB_DEFAULT_CONFIG } from "../lib/retabConfig";
import { getUsername } from "../lib/retab";

/**
 * Batch processing status constants
 */
export const BatchStatus = {
  IDLE: "idle",
  PROCESSING: "processing",
  PAUSED: "paused",
  COMPLETED: "completed",
};

/**
 * Packet status constants
 */
export const PacketStatus = {
  QUEUED: "queued",
  SPLITTING: "splitting",
  CLASSIFYING: "classifying",
  EXTRACTING: "extracting",
  COMPLETED: "completed",
  NEEDS_REVIEW: "needs_review",
  FAILED: "failed",
  RETRYING: "retrying",
};

/**
 * Action types for reducer
 */
const ActionTypes = {
  ADD_PACKETS: "ADD_PACKETS",
  START_PROCESSING: "START_PROCESSING",
  PAUSE_PROCESSING: "PAUSE_PROCESSING",
  RESUME_PROCESSING: "RESUME_PROCESSING",
  UPDATE_PACKET_STATUS: "UPDATE_PACKET_STATUS",
  UPDATE_DOCUMENT: "UPDATE_DOCUMENT",
  SET_PENDING_DOCUMENTS: "SET_PENDING_DOCUMENTS",
  PACKET_DOCUMENT_PROCESSED: "PACKET_DOCUMENT_PROCESSED",
  PACKET_COMPLETED: "PACKET_COMPLETED",
  PACKET_FAILED: "PACKET_FAILED",
  PACKET_REQUEUE: "PACKET_REQUEUE", // Move aborted packet back to queue
  RETRY_PACKET: "RETRY_PACKET",
  RETRY_DOCUMENT_START: "RETRY_DOCUMENT_START",
  RETRY_DOCUMENT_SUCCESS: "RETRY_DOCUMENT_SUCCESS",
  RETRY_DOCUMENT_FAIL: "RETRY_DOCUMENT_FAIL",
  REMOVE_PACKET: "REMOVE_PACKET",
  CLEAR_ALL: "CLEAR_ALL",
  SET_CONFIG: "SET_CONFIG",
  SET_RETAB_CONFIG: "SET_RETAB_CONFIG",
  SET_SESSION_ID: "SET_SESSION_ID",
  DB_INIT_COMPLETE: "DB_INIT_COMPLETE",
  RESTORE_FROM_DB: "RESTORE_FROM_DB",
  RESTORE_FROM_STORAGE: "RESTORE_FROM_STORAGE",
};

// Storage key for persistence (fallback)
const STORAGE_KEY = "stewart_ingestion_session";

/**
 * Save state to localStorage (excluding large base64 data)
 */
function saveToStorage(state) {
  try {
    const packetsToSave = [];
    for (const [id, packet] of state.packets) {
      // Only save completed/needs_review packets
      if (packet.status === PacketStatus.COMPLETED || 
          packet.status === PacketStatus.NEEDS_REVIEW ||
          packet.status === PacketStatus.FAILED) {
        packetsToSave.push({
          ...packet,
          base64: null, // Don't save base64 - too large
        });
      }
    }
    
    const saveData = {
      savedAt: new Date().toISOString(),
      packets: packetsToSave,
      stats: state.stats,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  } catch (e) {
    console.warn("Failed to save session state:", e);
  }
}

/**
 * Load state from localStorage
 */
function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const data = JSON.parse(saved);
    
    // Check if data is too old (14 days)
    const savedAt = new Date(data.savedAt);
    const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSave > 336) { // 14 days
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return data;
  } catch (e) {
    console.warn("Failed to load session state:", e);
    return null;
  }
}

/**
 * Build initial state — always starts empty.
 * Data is restored asynchronously: DB first (authoritative), localStorage as fallback.
 */
function getInitialState() {
  return {
    sessionId: null, // Will be set by database on init
    packets: new Map(),
    queue: [],
    processing: new Set(),
    batchStatus: BatchStatus.IDLE,
    stats: {
      total: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      needsReview: 0,
      failed: 0,
    },
    usage: {
      totalCredits: 0,
      totalCost: 0,
      totalPages: 0,
      apiCalls: 0,
    },
    config: {
      concurrency: 5,
      maxRetries: 3,
    },
    retabConfig: loadSettings(), // Retab API settings (model, consensus, etc.)
    dbConnected: false, // Track if database is available
    dbInitComplete: false, // Track if database initialization has finished
  };
}

/**
 * Initial state
 */
const initialState = getInitialState();

/**
 * Reducer for batch queue state
 */
function batchQueueReducer(state, action) {
  switch (action.type) {
    case ActionTypes.ADD_PACKETS: {
      const newPackets = new Map(state.packets);
      const newQueue = [...state.queue];
      
      for (const file of action.files) {
        const packetData = {
          id: file.id,
          filename: file.name,
          path: file.path,
          size: file.size,
          pageCount: file.pageCount ?? null,
          base64: file.base64 ?? null,
          hasServerFile: file.hasServerFile ?? false,
          createdBy: file.createdBy ?? null,
          status: PacketStatus.QUEUED,
          progress: { stage: null, docIndex: 0, totalDocs: 0 },
          documents: [],
          result: null,
          error: null,
          retryCount: 0,
          addedAt: file.addedAt || new Date().toISOString(),
          startedAt: null,
          completedAt: null,
        };
        newPackets.set(file.id, packetData);
        newQueue.push(file.id);
      }
      
      return {
        ...state,
        packets: newPackets,
        queue: newQueue,
        stats: {
          ...state.stats,
          total: state.stats.total + action.files.length,
          queued: state.stats.queued + action.files.length,
        },
      };
    }
    
    case ActionTypes.START_PROCESSING: {
      return { ...state, batchStatus: BatchStatus.PROCESSING };
    }
    
    case ActionTypes.PAUSE_PROCESSING: {
      return { ...state, batchStatus: BatchStatus.PAUSED };
    }
    
    case ActionTypes.RESUME_PROCESSING: {
      return { ...state, batchStatus: BatchStatus.PROCESSING };
    }
    
    case ActionTypes.UPDATE_PACKET_STATUS: {
      const packet = state.packets.get(action.packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      const newProcessing = new Set(state.processing);
      const newQueue = [...state.queue];
      
      let newStatus = packet.status;
      switch (action.status) {
        case PipelineStatus.SPLITTING:
          newStatus = PacketStatus.SPLITTING;
          break;
        case PipelineStatus.CLASSIFYING:
          newStatus = PacketStatus.CLASSIFYING;
          break;
        case PipelineStatus.EXTRACTING:
          newStatus = PacketStatus.EXTRACTING;
          break;
        case PipelineStatus.COMPLETED:
          newStatus = PacketStatus.COMPLETED;
          break;
        case PipelineStatus.FAILED:
          newStatus = PacketStatus.FAILED;
          break;
      }
      
      // Move from queue to processing if starting
      if (packet.status === PacketStatus.QUEUED && 
          [PacketStatus.SPLITTING, PacketStatus.CLASSIFYING, PacketStatus.EXTRACTING].includes(newStatus)) {
        const queueIndex = newQueue.indexOf(action.packetId);
        if (queueIndex > -1) newQueue.splice(queueIndex, 1);
        newProcessing.add(action.packetId);
      }
      
      newPackets.set(action.packetId, {
        ...packet,
        status: newStatus,
        startedAt: packet.startedAt || (newStatus !== PacketStatus.QUEUED ? new Date().toISOString() : null),
        progress: action.progress ? {
          ...packet.progress,
          stage: newStatus,
          docIndex: action.progress.docIndex || 0,
          totalDocs: action.progress.total || packet.progress.totalDocs,
        } : packet.progress,
      });
      
      const statsUpdate = { ...state.stats };
      if (packet.status === PacketStatus.QUEUED && newStatus !== PacketStatus.QUEUED) {
        statsUpdate.queued = Math.max(0, statsUpdate.queued - 1);
        statsUpdate.processing = statsUpdate.processing + 1;
      }
      
      return {
        ...state,
        packets: newPackets,
        queue: newQueue,
        processing: newProcessing,
        stats: statsUpdate,
      };
    }
    
    case ActionTypes.SET_PENDING_DOCUMENTS: {
      const packet = state.packets.get(action.packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      newPackets.set(action.packetId, {
        ...packet,
        documents: action.documents,
        progress: { ...packet.progress, totalDocs: action.documents.length },
      });
      
      return { ...state, packets: newPackets };
    }

    case ActionTypes.PACKET_DOCUMENT_PROCESSED: {
      const packet = state.packets.get(action.packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      // Replace the pending placeholder with the completed document (matched by ID)
      const existingIndex = packet.documents.findIndex(d => d.id === action.document.id);
      let newDocs;
      if (existingIndex >= 0) {
        newDocs = [...packet.documents];
        newDocs[existingIndex] = action.document;
      } else {
        newDocs = [...packet.documents, action.document];
      }
      
      const completedCount = newDocs.filter(d => d.status !== "pending" && d.status !== "processing").length;
      
      newPackets.set(action.packetId, {
        ...packet,
        documents: newDocs,
        progress: { ...packet.progress, docIndex: completedCount },
      });
      
      return { ...state, packets: newPackets };
    }
    
    case ActionTypes.PACKET_COMPLETED: {
      const packet = state.packets.get(action.packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      const newProcessing = new Set(state.processing);
      newProcessing.delete(action.packetId);
      
      const hasNeedsReview = action.result.documents.some(d => d.needsReview);
      const hasFailed = action.result.documents.some(d => d.status === "failed");
      
      let finalStatus = PacketStatus.COMPLETED;
      if (hasFailed && action.result.stats.completed === 0) {
        finalStatus = PacketStatus.FAILED;
      } else if (hasNeedsReview) {
        finalStatus = PacketStatus.NEEDS_REVIEW;
      }
      
      const resultDocs = action.result.documents || [];
      newPackets.set(action.packetId, {
        ...packet,
        status: finalStatus,
        result: action.result,
        documents: resultDocs,
        usage: action.result.usage,
        // Track document-level stats so global recalculation in UPDATE_DOCUMENT is accurate
        completedDocuments: resultDocs.filter(d => d.status === "completed" || d.status === "reviewed").length,
        needsReviewDocuments: resultDocs.filter(d => d.needsReview).length,
        failedDocuments: resultDocs.filter(d => d.status === "failed").length,
        // Free memory: base64 data can be huge (75MB+). The file is either
        // on the server (hasServerFile) or processing is done — no need to
        // hold it in browser memory. It can be re-fetched for retries.
        base64: null,
        completedAt: new Date().toISOString(),
        progress: {
          stage: "completed",
          docIndex: resultDocs.length,
          totalDocs: resultDocs.length,
        },
      });
      
      const statsUpdate = { ...state.stats };
      statsUpdate.processing = Math.max(0, statsUpdate.processing - 1);
      
      if (finalStatus === PacketStatus.COMPLETED) {
        statsUpdate.completed = statsUpdate.completed + 1;
      } else if (finalStatus === PacketStatus.NEEDS_REVIEW) {
        statsUpdate.needsReview = statsUpdate.needsReview + 1;
      } else if (finalStatus === PacketStatus.FAILED) {
        statsUpdate.failed = statsUpdate.failed + 1;
      }
      
      // Aggregate usage
      const packetUsage = action.result.usage || {};
      const usageUpdate = {
        totalCredits: state.usage.totalCredits + (packetUsage.totalCredits || 0),
        totalCost: state.usage.totalCost + (packetUsage.totalCost || 0),
        totalPages: state.usage.totalPages + (packetUsage.totalPages || 0),
        apiCalls: state.usage.apiCalls + (packetUsage.apiCalls || 0),
      };
      
      const allDone = newProcessing.size === 0 && state.queue.length === 0;
      
      return {
        ...state,
        packets: newPackets,
        processing: newProcessing,
        stats: statsUpdate,
        usage: usageUpdate,
        batchStatus: allDone ? BatchStatus.COMPLETED : state.batchStatus,
      };
    }
    
    case ActionTypes.PACKET_FAILED: {
      const packet = state.packets.get(action.packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      const newProcessing = new Set(state.processing);
      newProcessing.delete(action.packetId);
      
      newPackets.set(action.packetId, {
        ...packet,
        status: PacketStatus.FAILED,
        error: action.error,
        // Free memory: base64 can be re-fetched from server on retry
        base64: null,
        completedAt: new Date().toISOString(),
      });
      
      const statsUpdate = { ...state.stats };
      statsUpdate.processing = Math.max(0, statsUpdate.processing - 1);
      statsUpdate.failed = statsUpdate.failed + 1;
      
      const allDone = newProcessing.size === 0 && state.queue.length === 0;
      
      return {
        ...state,
        packets: newPackets,
        processing: newProcessing,
        stats: statsUpdate,
        batchStatus: allDone ? BatchStatus.COMPLETED : state.batchStatus,
      };
    }
    
    case ActionTypes.PACKET_REQUEUE: {
      // Move an aborted/interrupted packet back to the queue so it can be
      // processed again on resume. Unlike RETRY_PACKET, this preserves the
      // retry count and doesn't clear partial results.
      const packet = state.packets.get(action.packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      const newProcessing = new Set(state.processing);
      newProcessing.delete(action.packetId);
      
      const newQueue = [...state.queue];
      if (!newQueue.includes(action.packetId)) {
        newQueue.push(action.packetId);
      }
      
      newPackets.set(action.packetId, {
        ...packet,
        status: PacketStatus.QUEUED,
        // Keep documents/result — partial progress may be useful for diagnostics
        startedAt: null,
      });
      
      const statsUpdate = { ...state.stats };
      // Adjust stats: was processing, now queued
      statsUpdate.processing = Math.max(0, statsUpdate.processing - 1);
      statsUpdate.queued = statsUpdate.queued + 1;
      
      return {
        ...state,
        packets: newPackets,
        queue: newQueue,
        processing: newProcessing,
        stats: statsUpdate,
      };
    }
    
    case ActionTypes.RETRY_PACKET: {
      const packet = state.packets.get(action.packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      const newQueue = [...state.queue, action.packetId];
      
      newPackets.set(action.packetId, {
        ...packet,
        status: PacketStatus.QUEUED,
        retryCount: packet.retryCount + 1,
        error: null,
        documents: [],
        result: null,
        startedAt: null,
        completedAt: null,
      });
      
      const statsUpdate = { ...state.stats };
      if (packet.status === PacketStatus.FAILED) {
        statsUpdate.failed = Math.max(0, statsUpdate.failed - 1);
      } else if (packet.status === PacketStatus.NEEDS_REVIEW) {
        statsUpdate.needsReview = Math.max(0, statsUpdate.needsReview - 1);
      }
      statsUpdate.queued = statsUpdate.queued + 1;
      
      return {
        ...state,
        packets: newPackets,
        queue: newQueue,
        stats: statsUpdate,
        batchStatus: state.batchStatus === BatchStatus.COMPLETED ? BatchStatus.PROCESSING : state.batchStatus,
      };
    }
    
    case ActionTypes.REMOVE_PACKET: {
      const packet = state.packets.get(action.packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      newPackets.delete(action.packetId);
      
      const newQueue = state.queue.filter(id => id !== action.packetId);
      const newProcessing = new Set(state.processing);
      newProcessing.delete(action.packetId);
      
      const statsUpdate = { ...state.stats };
      statsUpdate.total = Math.max(0, statsUpdate.total - 1);
      
      switch (packet.status) {
        case PacketStatus.QUEUED:
          statsUpdate.queued = Math.max(0, statsUpdate.queued - 1);
          break;
        case PacketStatus.SPLITTING:
        case PacketStatus.CLASSIFYING:
        case PacketStatus.EXTRACTING:
          statsUpdate.processing = Math.max(0, statsUpdate.processing - 1);
          break;
        case PacketStatus.COMPLETED:
          statsUpdate.completed = Math.max(0, statsUpdate.completed - 1);
          break;
        case PacketStatus.NEEDS_REVIEW:
          statsUpdate.needsReview = Math.max(0, statsUpdate.needsReview - 1);
          break;
        case PacketStatus.FAILED:
          statsUpdate.failed = Math.max(0, statsUpdate.failed - 1);
          break;
      }
      
      return {
        ...state,
        packets: newPackets,
        queue: newQueue,
        processing: newProcessing,
        stats: statsUpdate,
      };
    }
    
    case ActionTypes.CLEAR_ALL: {
      return {
        ...state, // Preserve sessionId, dbConnected, dbInitComplete, retabConfig
        packets: new Map(),
        queue: [],
        processing: new Set(),
        batchStatus: BatchStatus.IDLE,
        stats: {
          total: 0,
          queued: 0,
          processing: 0,
          completed: 0,
          needsReview: 0,
          failed: 0,
        },
        usage: {
          totalCredits: 0,
          totalCost: 0,
          totalPages: 0,
          apiCalls: 0,
        },
      };
    }
    
    case ActionTypes.SET_CONFIG: {
      return { ...state, config: { ...state.config, ...action.config } };
    }
    
    case ActionTypes.SET_RETAB_CONFIG: {
      return { ...state, retabConfig: { ...state.retabConfig, ...action.retabConfig } };
    }
    
    case ActionTypes.SET_SESSION_ID: {
      return { 
        ...state, 
        sessionId: action.sessionId,
        dbConnected: action.dbConnected ?? state.dbConnected,
      };
    }

    case ActionTypes.DB_INIT_COMPLETE: {
      return { ...state, dbInitComplete: true };
    }
    
    case ActionTypes.UPDATE_DOCUMENT: {
      const { packetId, documentId, updates } = action;
      const packet = state.packets.get(packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      const updatedDocs = packet.documents?.map(d => {
        if (d.id !== documentId) return d;
        return { ...d, ...updates };
      });
      
      // Recalculate packet stats based on document statuses
      const docStats = {
        completed: 0,
        needsReview: 0,
        failed: 0,
      };
      
      for (const doc of updatedDocs || []) {
        if (doc.status === "reviewed" || doc.status === "completed") {
          docStats.completed++;
        } else if (doc.status === "needs_review" && doc.needsReview !== false) {
          docStats.needsReview++;
        } else if (doc.status === "failed" || doc.status === "rejected") {
          docStats.failed++;
        }
      }
      
      // Promote packet status when no more docs need human review
      let packetStatus = packet.status;
      const totalDocs = updatedDocs?.length || 0;
      if (totalDocs > 0 && docStats.needsReview === 0) {
        // No docs need review: mark COMPLETED (even if some failed — those are final)
        packetStatus = PacketStatus.COMPLETED;
      }

      newPackets.set(packetId, {
        ...packet,
        status: packetStatus,
        documents: updatedDocs,
        completedDocuments: docStats.completed,
        needsReviewDocuments: docStats.needsReview,
        failedDocuments: docStats.failed,
      });
      
      // Recalculate global stats across all packets
      const statsUpdate = { ...state.stats };
      let totalNeedsReview = 0;
      let totalCompleted = 0;
      let totalFailed = 0;
      for (const [, p] of newPackets) {
        totalNeedsReview += p.needsReviewDocuments || 0;
        if (p.status === PacketStatus.COMPLETED || p.status === "completed") totalCompleted++;
        else if (p.status === PacketStatus.FAILED || p.status === "failed") totalFailed++;
      }
      statsUpdate.needsReview = totalNeedsReview;
      statsUpdate.completed = totalCompleted;
      statsUpdate.failed = totalFailed;
      
      return { ...state, packets: newPackets, stats: statsUpdate };
    }
    
    case ActionTypes.RETRY_DOCUMENT_START: {
      // Mark a single document as "retrying" within its packet
      const { packetId, documentId } = action;
      const pkt = state.packets.get(packetId);
      if (!pkt) return state;

      const newPackets = new Map(state.packets);
      const updatedDocs = pkt.documents.map(d =>
        d.id === documentId ? { ...d, status: "retrying", error: null } : d
      );
      newPackets.set(packetId, { ...pkt, documents: updatedDocs });
      return { ...state, packets: newPackets };
    }

    case ActionTypes.RETRY_DOCUMENT_SUCCESS: {
      // Replace the retried document with the successful result
      const { packetId, documentId, result } = action;
      const pkt = state.packets.get(packetId);
      if (!pkt) return state;

      const newPackets = new Map(state.packets);
      const updatedDocs = pkt.documents.map(d => {
        if (d.id !== documentId) return d;
        return {
          ...d,
          extraction: result.extraction,
          extractionConfidence: result.extractionConfidence,
          status: result.status,
          needsReview: result.needsReview,
          reviewReasons: result.reviewReasons,
          error: null,
          usage: result.usage,
        };
      });

      // Recalculate packet status from updated documents
      let completed = 0, needsReview = 0, failed = 0;
      for (const doc of updatedDocs) {
        if (doc.status === "completed" || doc.status === "reviewed") completed++;
        else if (doc.status === "needs_review" && doc.needsReview !== false) needsReview++;
        else if (doc.status === "failed" || doc.status === "rejected") failed++;
      }

      let packetStatus = pkt.status;
      if (needsReview > 0) {
        packetStatus = PacketStatus.NEEDS_REVIEW;
      } else if (failed === 0) {
        packetStatus = PacketStatus.COMPLETED;
      }

      newPackets.set(packetId, {
        ...pkt,
        status: packetStatus,
        documents: updatedDocs,
        completedDocuments: completed,
        needsReviewDocuments: needsReview,
        failedDocuments: failed,
      });

      // Recalculate global stats
      const statsUpdate = { ...state.stats };
      let totalCompleted = 0, totalFailed = 0, totalNR = 0;
      for (const [, p] of newPackets) {
        if (p.status === PacketStatus.COMPLETED || p.status === "completed") totalCompleted++;
        else if (p.status === PacketStatus.FAILED || p.status === "failed") totalFailed++;
        else if (p.status === PacketStatus.NEEDS_REVIEW || p.status === "needs_review") totalNR++;
      }
      statsUpdate.completed = totalCompleted;
      statsUpdate.failed = totalFailed;
      statsUpdate.needsReview = totalNR;

      // Add usage from the retry
      const retryUsage = result.usage || {};
      const usageUpdate = {
        totalCredits: state.usage.totalCredits + (retryUsage.credits || 0),
        totalCost: state.usage.totalCost + ((retryUsage.credits || 0) * 0.01),
        totalPages: state.usage.totalPages + (retryUsage.pages || 0),
        apiCalls: state.usage.apiCalls + 1,
      };

      return { ...state, packets: newPackets, stats: statsUpdate, usage: usageUpdate };
    }

    case ActionTypes.RETRY_DOCUMENT_FAIL: {
      // Mark the document as failed again with the new error
      const { packetId, documentId, error } = action;
      const pkt = state.packets.get(packetId);
      if (!pkt) return state;

      const newPackets = new Map(state.packets);
      const updatedDocs = pkt.documents.map(d =>
        d.id === documentId ? { ...d, status: "failed", error } : d
      );
      newPackets.set(packetId, { ...pkt, documents: updatedDocs });
      return { ...state, packets: newPackets };
    }

    case ActionTypes.RESTORE_FROM_STORAGE: {
      // Restore from localStorage — only used when DB is unavailable or empty.
      const saved = action.saved;
      if (!saved?.packets?.length) return state;

      const restoredPackets = new Map();
      for (const packet of saved.packets) {
        restoredPackets.set(packet.id, packet);
      }

      return {
        ...state,
        packets: restoredPackets,
        queue: [],
        processing: new Set(),
        batchStatus: BatchStatus.COMPLETED,
        stats: {
          total: saved.packets.length,
          queued: 0,
          processing: 0,
          completed: saved.packets.filter(p => p.status === PacketStatus.COMPLETED).length,
          needsReview: saved.packets.filter(p => p.status === PacketStatus.NEEDS_REVIEW).length,
          failed: saved.packets.filter(p => p.status === PacketStatus.FAILED).length,
        },
      };
    }

    case ActionTypes.RESTORE_FROM_DB: {
      // DB is authoritative — always replaces any existing state.
      const newPackets = new Map();
      const resumeQueue = []; // Interrupted packets to auto-resume
      const dbPackets = action.packets || [];

      // Non-terminal statuses that indicate interrupted processing
      const interruptedStatuses = ["queued", "splitting", "classifying", "extracting", "processing"];

      for (const dbPkt of dbPackets) {
        // Map DB status to internal PacketStatus
        let status = dbPkt.status;
        let error = dbPkt.error || null;
        const hasServerFile = dbPkt.hasServerFile ?? !!dbPkt.temp_file_path;

        if (interruptedStatuses.includes(status)) {
          if (hasServerFile) {
            // File still on server — re-queue for automatic resumption
            status = PacketStatus.QUEUED;
            error = null;
            resumeQueue.push(dbPkt.id);
          } else {
            // No file available — can't recover
            status = PacketStatus.FAILED;
            error = "Processing interrupted and file no longer available. Re-upload to retry.";
          }
        } else if (status === "completed") {
          status = PacketStatus.COMPLETED;
        } else if (status === "needs_review") {
          status = PacketStatus.NEEDS_REVIEW;
        } else if (status === "failed") {
          status = PacketStatus.FAILED;
        }

        const documents = (dbPkt.documents || []).map(d => {
          // Parse JSON fields that may come as strings from the DB.
          // DB column is `extraction_data` (snake_case) — NOT `extracted_data`.
          const rawExtractionData = d.extraction_data ?? d.extracted_data ?? d.extractionData ?? null;
          const extractedData = rawExtractionData
            ? (typeof rawExtractionData === "string" ? JSON.parse(rawExtractionData) : rawExtractionData)
            : null;
          const rawLikelihoods = d.likelihoods ?? null;
          const likelihoods = rawLikelihoods
            ? (typeof rawLikelihoods === "string" ? JSON.parse(rawLikelihoods) : rawLikelihoods)
            : null;
          const rawEditedFields = d.edited_fields ?? d.editedFields ?? null;
          const editedFields = rawEditedFields
            ? (typeof rawEditedFields === "string" ? JSON.parse(rawEditedFields) : rawEditedFields)
            : null;
          const rawReviewReasons = d.review_reasons ?? d.reviewReasons ?? [];
          const reviewReasons = Array.isArray(rawReviewReasons)
            ? rawReviewReasons
            : (typeof rawReviewReasons === "string" ? JSON.parse(rawReviewReasons) : []);
          
          return {
            ...d,
            // Map snake_case DB fields to camelCase for frontend consistency
            extractedData,
            likelihoods,
            editedFields,
            reviewReasons,
            needsReview: d.needs_review ?? d.needsReview ?? false,
            extractionConfidence: d.extraction_confidence ?? d.extractionConfidence ?? null,
            reviewedAt: d.reviewed_at ?? d.reviewedAt ?? null,
            reviewedBy: d.reviewed_by ?? d.reviewedBy ?? null,
            reviewerNotes: d.reviewer_notes ?? d.reviewerNotes ?? null,
            splitType: d.split_type ?? d.splitType ?? d.document_type ?? null,
            // Build an extraction object so getMergedExtractionData works correctly
            extraction: d.extraction || (extractedData ? { data: extractedData, likelihoods: likelihoods || {} } : null),
            classification: d.classification || (d.document_type ? {
              category: d.document_type,
              confidence: d.classification_confidence ?? null,
            } : null),
            pages: d.pages ? (typeof d.pages === "string" ? JSON.parse(d.pages) : d.pages) : [],
          };
        });

        // Verify packet status against actual document flags:
        // If DB says needs_review but no documents actually need review, promote to COMPLETED
        if (status === PacketStatus.NEEDS_REVIEW && documents.length > 0) {
          const anyNeedsReview = documents.some(d => d.needsReview === true);
          if (!anyNeedsReview) {
            status = PacketStatus.COMPLETED;
          }
        }

        newPackets.set(dbPkt.id, {
          id: dbPkt.id,
          filename: dbPkt.filename,
          path: null,
          size: dbPkt.file_size || null,
          pageCount: dbPkt.page_count || null,
          base64: null, // Will be fetched from server on demand
          hasServerFile,
          createdBy: dbPkt.created_by || null,
          status,
          progress: {
            stage: status === PacketStatus.COMPLETED || status === PacketStatus.NEEDS_REVIEW ? "completed" : null,
            docIndex: documents.length,
            totalDocs: documents.length,
          },
          documents: status === PacketStatus.QUEUED ? [] : documents, // Clear docs for re-processing
          result: status === PacketStatus.COMPLETED || status === PacketStatus.NEEDS_REVIEW
            ? { documents, stats: { completed: documents.length } }
            : null,
          error,
          retryCount: 0,
          addedAt: dbPkt.created_at || new Date().toISOString(),
          startedAt: dbPkt.created_at || null,
          completedAt: dbPkt.completed_at || null,
        });
      }

      if (newPackets.size === 0) return state;

      // Calculate stats from restored packets
      let completed = 0, needsReview = 0, failed = 0, queued = 0;
      for (const [, p] of newPackets) {
        if (p.status === PacketStatus.COMPLETED) completed++;
        else if (p.status === PacketStatus.NEEDS_REVIEW) needsReview++;
        else if (p.status === PacketStatus.FAILED) failed++;
        else if (p.status === PacketStatus.QUEUED) queued++;
      }

      // If there are packets to resume, set status to PROCESSING so the loop picks them up
      const hasPendingWork = resumeQueue.length > 0;

      return {
        ...state,
        packets: newPackets,
        queue: resumeQueue,
        processing: new Set(),
        batchStatus: hasPendingWork ? BatchStatus.PROCESSING : BatchStatus.COMPLETED,
        stats: {
          total: newPackets.size,
          queued,
          processing: 0,
          completed,
          needsReview,
          failed,
        },
      };
    }

    default:
      return state;
  }
}

/**
 * Concurrent tab detection.
 * Uses BroadcastChannel to prevent two tabs from processing the same queue.
 * When a tab starts processing, it broadcasts a "PROCESSING_STARTED" message.
 * Other tabs receive it and know to avoid starting their own processing loops.
 */
const TAB_CHANNEL_NAME = "cortex_processing_lock";
let processingTabId = null; // The tab ID that currently owns processing

function generateTabId() {
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Hook for managing batch processing queue
 */
export function useBatchQueue() {
  const [state, dispatch] = useReducer(batchQueueReducer, initialState);
  const { processPacket, retryDocumentExtraction } = usePacketPipeline();
  
  /**
   * Retry an async DB sync operation once before giving up.
   * Prevents silent data loss when a single network hiccup occurs.
   */
  const syncWithRetry = useCallback(async (fn, label) => {
    try {
      return await fn();
    } catch (firstErr) {
      console.warn(`${label} failed (attempt 1): ${firstErr.message}, retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      try {
        return await fn();
      } catch (secondErr) {
        console.error(`${label} failed (attempt 2): ${secondErr.message} — data may be out of sync`);
        throw secondErr;
      }
    }
  }, []);

  // Use refs to track processing state without causing re-renders
  const isProcessingRef = useRef(false);
  const pausedRef = useRef(false);
  const stateRef = useRef(state);
  const dbInitRef = useRef(false);
  const runProcessingLoopRef = useRef(null); // Set once runProcessingLoop is created
  const claimedRef = useRef(new Set()); // Track in-flight packet IDs synchronously to prevent race conditions
  const abortControllerRef = useRef(null); // AbortController for cancelling in-flight API calls on pause/clear
  const tabIdRef = useRef(generateTabId());
  const tabChannelRef = useRef(null);
  const [otherTabProcessing, setOtherTabProcessing] = useState(false);

  // Set up BroadcastChannel for tab coordination
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return; // SSR / unsupported
    const channel = new BroadcastChannel(TAB_CHANNEL_NAME);
    tabChannelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, tabId } = event.data || {};
      if (tabId === tabIdRef.current) return; // Ignore own messages

      if (type === "PROCESSING_STARTED") {
        processingTabId = tabId;
        setOtherTabProcessing(true);
        console.warn(`Another tab (${tabId}) is processing. This tab will not start processing.`);
      } else if (type === "PROCESSING_STOPPED") {
        if (processingTabId === tabId) {
          processingTabId = null;
          setOtherTabProcessing(false);
        }
      }
    };

    // Announce stop when this tab unloads
    const handleUnload = () => {
      channel.postMessage({ type: "PROCESSING_STOPPED", tabId: tabIdRef.current });
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      handleUnload();
      channel.close();
      tabChannelRef.current = null;
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);
  
  // Keep stateRef in sync — synchronous (not useEffect!) so that
  // runProcessingLoop / processNextPacket always see the latest state
  // immediately after dispatch, without waiting for a React re-render.
  stateRef.current = state;

  // Initialize database session on mount
  // Priority: DB (authoritative) → localStorage (fallback)
  useEffect(() => {
    if (dbInitRef.current) return;
    dbInitRef.current = true;
    
    async function initDbSession() {
      let dbRestored = false;

      try {
        const session = await api.getActiveSession(getUsername());
        if (session?.id) {
          dispatch({ 
            type: ActionTypes.SET_SESSION_ID, 
            sessionId: session.id,
            dbConnected: true,
          });
          console.log("Database session initialized:", session.id);

          // Always try to restore from database (authoritative source)
          try {
            const fullSession = await api.getFullSession(session.id);
            if (fullSession?.packets?.length > 0) {
              dispatch({
                type: ActionTypes.RESTORE_FROM_DB,
                packets: fullSession.packets,
              });
              dbRestored = true;

              // Check if any interrupted packets were re-queued for auto-resume
              const interruptedStatuses = ["queued", "splitting", "classifying", "extracting", "processing"];
              const resumable = fullSession.packets.filter(p =>
                interruptedStatuses.includes(p.status) && (p.hasServerFile ?? !!p.temp_file_path)
              );
              if (resumable.length > 0) {
                console.log(`Auto-resuming ${resumable.length} interrupted packet(s)...`);
                // Poll stateRef until the RESTORE_FROM_DB dispatch has propagated,
                // then start the processing loop. This replaces the old fixed 500ms
                // timeout which was fragile — if React hadn't re-rendered by then,
                // stateRef still showed IDLE and the loop exited immediately.
                const waitForStateAndResume = async () => {
                  const MAX_WAIT_MS = 5000;
                  const POLL_MS = 100;
                  let waited = 0;
                  while (waited < MAX_WAIT_MS) {
                    await new Promise(r => setTimeout(r, POLL_MS));
                    waited += POLL_MS;
                    const s = stateRef.current;
                    if (s.batchStatus === BatchStatus.PROCESSING && s.queue.length > 0) {
                      break;
                    }
                  }
                  pausedRef.current = false;
                  abortControllerRef.current = new AbortController();
                  if (runProcessingLoopRef.current) {
                    runProcessingLoopRef.current();
                  }
                };
                waitForStateAndResume();
              }

              console.log(`Restored ${fullSession.packets.length} packet(s) from database`);
            }
          } catch (restoreError) {
            console.warn("Failed to restore packets from database:", restoreError.message);
          }

          // If DB had no packets, fall back to localStorage
          if (!dbRestored) {
            const saved = loadFromStorage();
            if (saved?.packets?.length > 0) {
              dispatch({ type: ActionTypes.RESTORE_FROM_STORAGE, saved });
              console.log(`Restored ${saved.packets.length} packet(s) from localStorage (DB empty)`);
            }
          }
        }
      } catch (error) {
        console.warn("Database not available, using localStorage fallback:", error.message);
        // Generate a local session ID
        dispatch({ 
          type: ActionTypes.SET_SESSION_ID, 
          sessionId: `local_${Date.now()}`,
          dbConnected: false,
        });

        // Fall back to localStorage when DB is unavailable
        const saved = loadFromStorage();
        if (saved?.packets?.length > 0) {
          dispatch({ type: ActionTypes.RESTORE_FROM_STORAGE, saved });
          console.log(`Restored ${saved.packets.length} packet(s) from localStorage (DB unavailable)`);
        }
      }

      // Signal that init is complete (DB or fallback)
      dispatch({ type: ActionTypes.DB_INIT_COMPLETE });
    }
    
    initDbSession();
  }, []);

  // Persist state to localStorage when packets change (fallback)
  useEffect(() => {
    // Only save if we have completed/review/failed packets
    const hasCompletedPackets = Array.from(state.packets.values()).some(
      p => p.status === PacketStatus.COMPLETED || 
           p.status === PacketStatus.NEEDS_REVIEW ||
           p.status === PacketStatus.FAILED
    );
    
    if (hasCompletedPackets) {
      saveToStorage(state);
    }
  }, [state.packets, state.stats]);

  /**
   * Process a specific packet from the queue.
   * Accepts an explicit packetId to avoid the race condition where multiple
   * concurrent calls all read the same stale queue[0] from stateRef.
   * Uses claimedRef (a synchronous Set) to guarantee each packet is only
   * processed once, even if stateRef hasn't caught up with dispatches yet.
   */
  const processNextPacket = useCallback(async (targetPacketId) => {
    const currentState = stateRef.current;
    
    if (pausedRef.current) return;
    if (currentState.batchStatus !== BatchStatus.PROCESSING) return;
    
    // Determine which packet to process
    let packetId = targetPacketId;
    if (!packetId) {
      // Fallback: find first unclaimed packet in queue
      packetId = currentState.queue.find(id => !claimedRef.current.has(id));
    }
    if (!packetId) return;
    
    const packet = currentState.packets.get(packetId);
    if (!packet) return;
    
    // Claim this packet synchronously BEFORE any await to prevent duplicates.
    // This is the critical fix: claimedRef is a plain Set (not React state),
    // so it updates immediately and is visible to all concurrent callers.
    if (claimedRef.current.has(packetId)) return;
    claimedRef.current.add(packetId);
    
    try {
      // Resolve base64 from server if file was uploaded (so work continues if user left)
      let packetWithData = packet;
      if (!packet.base64 && packet.hasServerFile) {
        try {
          const base64 = await api.getPacketFileAsBase64(packet.id);
          packetWithData = { ...packet, base64 };
        } catch (err) {
          dispatch({ type: ActionTypes.PACKET_FAILED, packetId, error: err.message || "File not found or expired" });
          if (stateRef.current.dbConnected && stateRef.current.sessionId) {
            try {
              await syncWithRetry(
                () => api.updatePacket(packetId, { status: "failed", error: err.message }),
                "syncFileNotFoundPacket"
              );
            } catch (_) {
              // Already logged by syncWithRetry
            }
          }
          return;
        }
      }
      
      // Mark as starting
      dispatch({ 
        type: ActionTypes.UPDATE_PACKET_STATUS, 
        packetId, 
        status: PipelineStatus.SPLITTING,
      });
      
      // Sync processing status to DB so admin/monitoring dashboards show accurate state
      if (stateRef.current.dbConnected) {
        api.updatePacket(packetId, {
          status: "processing",
          started_at: new Date().toISOString(),
        }).catch(() => {}); // Best-effort, don't block processing
      }
      
      // Get abort signal for this run (allows pause to cancel in-flight work)
      const signal = abortControllerRef.current?.signal || null;
      
      try {
        const result = await processPacket(packetWithData, {
          onStatusChange: (id, status, progress) => {
            dispatch({ type: ActionTypes.UPDATE_PACKET_STATUS, packetId: id, status, progress });
          },
          onDocumentsDetected: (id, documents) => {
            dispatch({ type: ActionTypes.SET_PENDING_DOCUMENTS, packetId: id, documents });
          },
          onDocumentProcessed: (id, document) => {
            dispatch({ type: ActionTypes.PACKET_DOCUMENT_PROCESSED, packetId: id, document });
          },
          retabConfig: stateRef.current.retabConfig,
          signal,
        });
        
        dispatch({ type: ActionTypes.PACKET_COMPLETED, packetId, result });
        
        // Sync to database if connected (with retry).
        // DB sync failures don't fail the packet (extraction succeeded) but
        // we surface them so the user knows data may not be fully persisted.
        if (stateRef.current.dbConnected && stateRef.current.sessionId) {
          try {
            await syncWithRetry(
              () => api.syncPacketResult(stateRef.current.sessionId, packetId, result),
              "syncPacketResult"
            );
          } catch (syncErr) {
            console.error(`[WARN] Packet ${packetId} processed OK but DB sync failed: ${syncErr.message}. Data is in browser only until next successful sync.`);
          }
        }
      } catch (error) {
        // Aborted operations are intentionally cancelled (pause/clear) — re-queue
        // the packet so it can be picked up again on resume, instead of leaving
        // it orphaned in the processing set.
        if (error.message === "Processing aborted" || error.name === "AbortError") {
          console.log(`Packet ${packetId} processing was aborted, re-queuing for resume`);
          dispatch({ type: ActionTypes.PACKET_REQUEUE, packetId });
          return;
        }
        dispatch({ type: ActionTypes.PACKET_FAILED, packetId, error: error.message });
        // Persist failed packet to DB so debug/errors and logs show it (with retry)
        if (stateRef.current.dbConnected && stateRef.current.sessionId) {
          try {
            await syncWithRetry(
              () => api.updatePacket(packetId, {
                status: "failed",
                error: error.message,
                completed_at: new Date().toISOString(),
              }),
              "syncFailedPacket"
            );
          } catch (syncErr) {
            console.error(`[WARN] Failed packet ${packetId} DB sync also failed: ${syncErr.message}`);
          }
        }
      }
    } finally {
      // Always unclaim when done, regardless of success/failure/abort
      claimedRef.current.delete(packetId);
    }
  }, [processPacket, syncWithRetry]);

  /**
   * Main processing loop.
   * Uses claimedRef to track which packets are in-flight so we never launch
   * duplicate work, and includes a safety valve to prevent infinite spinning
   * if state becomes corrupted.
   */
  const runProcessingLoop = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    try {
      let idleIterations = 0;
      const MAX_IDLE_ITERATIONS = 60; // 60 × 500ms = 30s safety valve
      
      while (true) {
        const currentState = stateRef.current;
        
        // Check if we should stop
        if (pausedRef.current) break;
        if (currentState.batchStatus !== BatchStatus.PROCESSING) break;
        
        // Use claimedRef (synchronous) alongside reducer state for accurate counts.
        // claimedRef tracks packets we've started but that haven't yet been reflected
        // in the reducer's processing set (due to React's async batched renders).
        const unclaimedQueue = currentState.queue.filter(id => !claimedRef.current.has(id));
        const inFlightCount = claimedRef.current.size;
        
        // Exit when no work remains: nothing in the queue and nothing in-flight
        if (unclaimedQueue.length === 0 && inFlightCount === 0 && currentState.processing.size === 0) break;
        
        // Safety valve: if we're just spinning with no actionable queue items
        // but state claims something is still in-flight, eventually give up.
        // This catches corrupted state from prior bugs.
        if (unclaimedQueue.length === 0) {
          idleIterations++;
          if (idleIterations > MAX_IDLE_ITERATIONS) {
            console.warn("Processing loop safety valve triggered: no progress for 30s, forcing completion");
            // Clear claimed refs for any stuck packets so they can be retried
            if (claimedRef.current.size > 0) {
              console.warn(`Releasing ${claimedRef.current.size} stuck claimed packet(s):`, [...claimedRef.current]);
              claimedRef.current.clear();
            }
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        
        // Reset idle counter when there's actual work to do
        idleIterations = 0;
        
        // Process unclaimed packets up to concurrency limit.
        // Use claimedRef.size (not processing.size which may be stale) for slot math.
        const availableSlots = currentState.config.concurrency - inFlightCount;
        
        if (availableSlots > 0) {
          // Pass specific packet IDs instead of letting each worker read queue[0].
          // This is the key fix: each promise gets a DIFFERENT packet ID.
          const toProcess = unclaimedQueue.slice(0, availableSlots);
          const promises = toProcess.map(pid => processNextPacket(pid));
          await Promise.all(promises);
        } else {
          // All slots occupied, wait before checking again
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (loopErr) {
      console.error("Processing loop crashed:", loopErr);
    } finally {
      // ALWAYS reset — without this, a crash permanently blocks the loop
      isProcessingRef.current = false;
    }
  }, [processNextPacket]);

  // Keep the ref in sync so initDbSession can trigger the loop
  runProcessingLoopRef.current = runProcessingLoop;

  /**
   * Broadcast a processing state change to other tabs
   */
  const broadcastProcessingState = useCallback((type) => {
    try {
      tabChannelRef.current?.postMessage({ type, tabId: tabIdRef.current });
    } catch (_) {
      // Channel may be closed
    }
  }, []);

  /**
   * Start batch processing
   */
  const start = useCallback(() => {
    if (otherTabProcessing) {
      console.warn("Another tab is already processing. Refusing to start.");
      return;
    }
    pausedRef.current = false;
    // Reset in case a previous run crashed and left isProcessingRef stuck
    isProcessingRef.current = false;
    // Create a fresh AbortController for this processing run
    abortControllerRef.current = new AbortController();
    dispatch({ type: ActionTypes.START_PROCESSING });
    // Eagerly update stateRef so runProcessingLoop sees PROCESSING immediately,
    // even before React re-renders and propagates the reducer state.
    stateRef.current = { ...stateRef.current, batchStatus: BatchStatus.PROCESSING };
    broadcastProcessingState("PROCESSING_STARTED");
    // Start loop directly — stateRef is already in sync, no setTimeout needed.
    runProcessingLoop();
  }, [runProcessingLoop, otherTabProcessing, broadcastProcessingState]);

  /**
   * Pause batch processing.
   * Aborts in-flight API calls so processing actually stops instead of
   * silently continuing in the background.
   */
  const pause = useCallback(() => {
    pausedRef.current = true;
    // Signal all in-flight fetch calls to abort
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: ActionTypes.PAUSE_PROCESSING });
    // Eagerly update stateRef so the processing loop sees PAUSED immediately
    stateRef.current = { ...stateRef.current, batchStatus: BatchStatus.PAUSED };
    broadcastProcessingState("PROCESSING_STOPPED");
  }, [broadcastProcessingState]);

  /**
   * Resume batch processing
   */
  const resume = useCallback(() => {
    if (otherTabProcessing) {
      console.warn("Another tab is already processing. Refusing to resume.");
      return;
    }
    pausedRef.current = false;
    isProcessingRef.current = false;
    // Create a fresh AbortController for the resumed run
    abortControllerRef.current = new AbortController();
    dispatch({ type: ActionTypes.RESUME_PROCESSING });
    stateRef.current = { ...stateRef.current, batchStatus: BatchStatus.PROCESSING };
    broadcastProcessingState("PROCESSING_STARTED");
    runProcessingLoop();
  }, [runProcessingLoop, otherTabProcessing, broadcastProcessingState]);

  /**
   * Add packets to the queue
   */
  const addPackets = useCallback(async (files) => {
    dispatch({ type: ActionTypes.ADD_PACKETS, files });
    
    // Sync to database if connected.
    // Server-uploaded packets already have DB records (created by /api/upload),
    // so only create records for base64-only packets to avoid PRIMARY KEY conflicts.
    if (stateRef.current.dbConnected && stateRef.current.sessionId) {
      const localOnly = files.filter((f) => !f.hasServerFile);
      if (localOnly.length > 0) {
        try {
          await syncWithRetry(
            () => api.createPackets(stateRef.current.sessionId, localOnly, getUsername()),
            "syncCreatePackets"
          );
        } catch (err) {
          console.warn("Failed to sync local packets to DB:", err.message);
        }
      }
    }
  }, []);

  /**
   * Retry a failed packet
   */
  const retryPacket = useCallback((packetId) => {
    dispatch({ type: ActionTypes.RETRY_PACKET, packetId });
    if (stateRef.current.batchStatus === BatchStatus.PROCESSING) {
      setTimeout(runProcessingLoop, 100);
    }
  }, [runProcessingLoop]);

  /**
   * Retry all failed packets
   */
  const retryAllFailed = useCallback(() => {
    const failedPackets = Array.from(stateRef.current.packets.values())
      .filter(p => p.status === PacketStatus.FAILED);
    
    for (const packet of failedPackets) {
      dispatch({ type: ActionTypes.RETRY_PACKET, packetId: packet.id });
    }
    
    if (stateRef.current.batchStatus !== BatchStatus.PROCESSING) {
      start();
    } else {
      setTimeout(runProcessingLoop, 100);
    }
  }, [start, runProcessingLoop]);

  /**
   * Retry a single failed document within a packet (no re-split, no re-classify)
   */
  const retryDocument = useCallback(async (packetId, documentId) => {
    const packet = stateRef.current.packets.get(packetId);
    if (!packet) return;

    const document = packet.documents?.find(d => d.id === documentId);
    if (!document) return;

    // Resolve base64 from server if needed
    let packetWithData = packet;
    if (!packet.base64 && packet.hasServerFile) {
      try {
        const base64 = await api.getPacketFileAsBase64(packet.id);
        packetWithData = { ...packet, base64 };
      } catch (err) {
        dispatch({ type: ActionTypes.RETRY_DOCUMENT_FAIL, packetId, documentId, error: err.message || "File not found" });
        return;
      }
    }

    if (!packetWithData.base64) {
      dispatch({ type: ActionTypes.RETRY_DOCUMENT_FAIL, packetId, documentId, error: "Document data not available. Re-upload the file to retry." });
      return;
    }

    dispatch({ type: ActionTypes.RETRY_DOCUMENT_START, packetId, documentId });

    try {
      const result = await retryDocumentExtraction(packetWithData, document, {
        retabConfig: stateRef.current.retabConfig,
      });

      dispatch({ type: ActionTypes.RETRY_DOCUMENT_SUCCESS, packetId, documentId, result });

      // Sync updated document extraction to database (with retry)
      if (stateRef.current.dbConnected) {
        try {
          await syncWithRetry(
            () => api.syncRetryDocumentResult(documentId, result),
            "syncRetryDocumentResult"
          );
        } catch (_) {
          // Already logged by syncWithRetry
        }
      }
    } catch (error) {
      dispatch({ type: ActionTypes.RETRY_DOCUMENT_FAIL, packetId, documentId, error: error.message });
    }
  }, [retryDocumentExtraction]);

  /**
   * Remove a packet from the queue and database.
   * Also deletes the server-side temp file so it doesn't waste storage.
   */
  const removePacket = useCallback(async (packetId) => {
    dispatch({ type: ActionTypes.REMOVE_PACKET, packetId });

    // Sync deletion to database so the packet doesn't reappear on refresh
    if (stateRef.current.dbConnected) {
      try {
        await api.deletePacket(packetId);
      } catch (err) {
        console.warn(`Failed to delete packet ${packetId} from DB:`, err.message);
      }
    }
  }, []);

  /**
   * Clear all packets from state, localStorage, and database.
   */
  const clearAll = useCallback(async () => {
    // Capture packet IDs before clearing state so we can delete from DB
    const packetIds = Array.from(stateRef.current.packets.keys());

    pausedRef.current = true;
    // Abort any in-flight work
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    claimedRef.current.clear();
    dispatch({ type: ActionTypes.CLEAR_ALL });
    broadcastProcessingState("PROCESSING_STOPPED");

    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to clear session storage:", e);
    }

    // Delete all packets from DB so they don't reappear on refresh
    if (stateRef.current.dbConnected && packetIds.length > 0) {
      for (const id of packetIds) {
        api.deletePacket(id).catch(() => {}); // Best-effort, fire and forget
      }
    }
  }, [broadcastProcessingState]);

  /**
   * Update configuration
   */
  const setConfig = useCallback((config) => {
    dispatch({ type: ActionTypes.SET_CONFIG, config });
  }, []);
  
  const setRetabConfig = useCallback((retabConfig) => {
    dispatch({ type: ActionTypes.SET_RETAB_CONFIG, retabConfig });
  }, []);

  /**
   * Update a document within a packet (e.g., after review)
   */
  const updateDocument = useCallback((packetId, documentId, updates) => {
    dispatch({ type: ActionTypes.UPDATE_DOCUMENT, packetId, documentId, updates });
  }, []);

  // Get packets as sorted array
  const packetsArray = Array.from(state.packets.values()).sort((a, b) => {
    const statusOrder = {
      [PacketStatus.SPLITTING]: 0,
      [PacketStatus.CLASSIFYING]: 0,
      [PacketStatus.EXTRACTING]: 0,
      [PacketStatus.RETRYING]: 1,
      [PacketStatus.NEEDS_REVIEW]: 2,
      [PacketStatus.QUEUED]: 3,
      [PacketStatus.COMPLETED]: 4,
      [PacketStatus.FAILED]: 5,
    };
    const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.addedAt) - new Date(a.addedAt);
  });

  return {
    packets: packetsArray,
    packetsMap: state.packets,
    queue: state.queue,
    processing: state.processing,
    batchStatus: state.batchStatus,
    stats: state.stats,
    usage: state.usage,
    config: state.config,
    retabConfig: state.retabConfig,
    sessionId: state.sessionId,
    dbConnected: state.dbConnected,
    dbInitComplete: state.dbInitComplete,
    addPackets,
    start,
    pause,
    resume,
    retryPacket,
    retryAllFailed,
    retryDocument,
    removePacket,
    clearAll,
    setConfig,
    setRetabConfig,
    updateDocument,
    isProcessing: state.batchStatus === BatchStatus.PROCESSING,
    isPaused: state.batchStatus === BatchStatus.PAUSED,
    isComplete: state.batchStatus === BatchStatus.COMPLETED,
    hasPackets: state.packets.size > 0,
    hasFailed: state.stats.failed > 0,
    hasNeedsReview: state.stats.needsReview > 0,
    otherTabProcessing,
  };
}

export default useBatchQueue;
