import { useReducer, useCallback, useRef, useEffect, useState } from "react";
import { usePacketPipeline, PipelineStatus } from "./usePacketPipeline";
import * as api from "../lib/api";
import { loadSettings, DEFAULT_CONFIG as RETAB_DEFAULT_CONFIG } from "../lib/retabConfig";
import { getUsername, getApiKey } from "../lib/retab";

const __DEV__ = import.meta.env.DEV;

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
};

// Legacy localStorage key — cleared on startup so stale data doesn't linger.
// Packet/session persistence is handled entirely by the SQLite database.
// (localStorage is still used for API key, username, settings, and dark mode
//  via their own modules — those are not touched here.)
const LEGACY_STORAGE_KEY = "stewart_ingestion_session";

/**
 * Build initial state — always starts empty.
 * Data is restored asynchronously from the SQLite database on mount.
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
        } else if (doc.needsReview === true) {
          // Use explicit boolean check — needsReview can be true/false/null/undefined
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
      
      // Recalculate global stats across all packets — all counts are DOCUMENT-level
      // so the UI shows consistent numbers (e.g., "10 done · 2 review · 1 failed" = documents).
      const statsUpdate = { ...state.stats };
      let totalNeedsReview = 0;
      let totalCompleted = 0;
      let totalFailed = 0;
      for (const [, p] of newPackets) {
        totalNeedsReview += p.needsReviewDocuments || 0;
        totalCompleted += p.completedDocuments || 0;
        totalFailed += p.failedDocuments || 0;
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
            // File still on server — re-queue for server-side resumption.
            // Server pipeline checks existing docs and skips already-completed ones.
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
            categoryOverride: d.category_override ?? d.categoryOverride ?? null,
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
          // Keep existing documents even for re-queued packets — server-side pipeline
          // resumes from where it left off (skips already-completed docs)
          documents,
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

      // Calculate stats from restored packets — document-level counts for consistency
      let completed = 0, needsReview = 0, failed = 0, queued = 0;
      for (const [, p] of newPackets) {
        completed += p.completedDocuments || 0;
        needsReview += p.needsReviewDocuments || 0;
        failed += p.failedDocuments || 0;
        if (p.status === PacketStatus.QUEUED) queued++;
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
  // processPacket is no longer used (server-side pipeline handles it).
  // retryDocumentExtraction is still used for single-doc retry.
  const { retryDocumentExtraction } = usePacketPipeline();
  
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
  const sseSourcesRef = useRef(new Map()); // Track active SSE EventSource connections per packetId
  const resumeInFlightRef = useRef(false); // Prevent duplicate server resume calls
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
  
  // --- Data loss prevention ---
  // Warn the user if they try to close the page while processing is active.
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const s = stateRef.current;
      const isActive = s.batchStatus === BatchStatus.PROCESSING || s.processing.size > 0;
      if (isActive) {
        e.preventDefault();
        e.returnValue = "Processing is in progress. Leaving may result in data loss.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Keep stateRef in sync — synchronous (not useEffect!) so that
  // runProcessingLoop / processNextPacket always see the latest state
  // immediately after dispatch, without waiting for a React re-render.
  stateRef.current = state;

  // Initialize database session on mount (DB is the sole persistence layer)
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
          if (__DEV__) console.log("Database session initialized:", session.id);

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
                if (__DEV__) console.log(`Found ${resumable.length} interrupted packet(s), auto-resuming...`);

                const waitForStateAndResume = async () => {
                  // Ensure the server queue is unpaused — it likely is after a restart
                  // (pause() was called before stop), so we must unpause before the
                  // client loop tries to submit jobs.
                  try {
                    await api.resumeProcessing();
                  } catch (err) {
                    if (__DEV__) console.warn("Could not unpause server queue on init:", err.message);
                  }

                  // Poll stateRef until the RESTORE_FROM_DB dispatch has propagated,
                  // then start the processing loop.
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

              if (__DEV__) console.log(`Restored ${fullSession.packets.length} packet(s) from database`);
            }
          } catch (restoreError) {
            console.warn("Failed to restore packets from database:", restoreError.message);
          }

          if (!dbRestored) {
            if (__DEV__) console.log("DB session has 0 packets");
          }
        }
      } catch (error) {
        console.warn("Database not available:", error.message);
        // Generate a local session ID so the app is still usable
        dispatch({ 
          type: ActionTypes.SET_SESSION_ID, 
          sessionId: `local_${Date.now()}`,
          dbConnected: false,
        });
      }

      // Signal that init is complete (DB or fallback)
      dispatch({ type: ActionTypes.DB_INIT_COMPLETE });
    }
    
    initDbSession();
  }, []);

  // One-time cleanup: remove legacy localStorage session data.
  // Packet persistence is now handled entirely by the SQLite database.
  useEffect(() => {
    try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch {}
  }, []);

  /**
   * Process a specific packet via the server-side pipeline.
   * Instead of running extraction locally, submits to the server and subscribes
   * to SSE events, mapping them to the same dispatch actions the UI expects.
   */
  const processNextPacket = useCallback(async (targetPacketId) => {
    const currentState = stateRef.current;
    
    if (pausedRef.current) return;
    if (currentState.batchStatus !== BatchStatus.PROCESSING) return;
    
    let packetId = targetPacketId;
    if (!packetId) {
      packetId = currentState.queue.find(id => !claimedRef.current.has(id));
    }
    if (!packetId) return;
    
    const packet = currentState.packets.get(packetId);
    if (!packet) return;
    
    if (claimedRef.current.has(packetId)) return;
    claimedRef.current.add(packetId);
    
    try {
      // Don't pre-set status to SPLITTING — the server will emit "started" or
      // "status" SSE events when actual work begins. Pre-setting causes all
      // queued packets to show "Splitting..." even when they're waiting behind
      // the split semaphore.

      // Submit to server for processing
      const apiKey = getApiKey();
      if (!apiKey) {
        dispatch({ type: ActionTypes.PACKET_FAILED, packetId, error: "API key not configured" });
        return;
      }

      try {
        await api.startProcessing(packetId, apiKey, stateRef.current.retabConfig || {});
      } catch (startErr) {
        // If server rejects (e.g., already processing), that's fine — subscribe to progress
        if (startErr.message?.includes("already being processed")) {
          if (__DEV__) console.log(`Packet ${packetId} already processing on server, subscribing to progress`);
        } else {
          throw startErr;
        }
      }

      // Subscribe to SSE progress — returns a Promise that resolves when processing completes
      await new Promise((resolve, reject) => {
        const eventSource = api.subscribeToProgress(packetId);
        
        // Track this EventSource so we can close it on pause/cancel
        if (!sseSourcesRef.current) sseSourcesRef.current = new Map();
        sseSourcesRef.current.set(packetId, eventSource);

        eventSource.addEventListener("state", (e) => {
          try {
            const data = JSON.parse(e.data);
            // Catch-up: if server already has documents, restore them
            if (data.documents?.length > 0) {
              dispatch({ type: ActionTypes.SET_PENDING_DOCUMENTS, packetId, documents: data.documents });
            }
            if (data.pipelineStage) {
              dispatch({ type: ActionTypes.UPDATE_PACKET_STATUS, packetId, status: data.pipelineStage });
            }
          } catch (_) {}
        });

        eventSource.addEventListener("started", () => {
          // Server picked up the job — don't set SPLITTING yet.
          // The pipeline emits a "status" event with stage=splitting only
          // after acquiring the split semaphore (i.e., when it's actually splitting).
        });

        eventSource.addEventListener("status", (e) => {
          try {
            const data = JSON.parse(e.data);
            dispatch({ type: ActionTypes.UPDATE_PACKET_STATUS, packetId, status: data.stage, progress: data.progress });
          } catch (_) {}
        });

        eventSource.addEventListener("documents_detected", (e) => {
          try {
            const data = JSON.parse(e.data);
            dispatch({ type: ActionTypes.SET_PENDING_DOCUMENTS, packetId, documents: data.documents });
          } catch (_) {}
        });

        eventSource.addEventListener("document_processed", (e) => {
          try {
            const data = JSON.parse(e.data);
            dispatch({ type: ActionTypes.PACKET_DOCUMENT_PROCESSED, packetId, document: data.document });
          } catch (_) {}
        });

        eventSource.addEventListener("progress", (e) => {
          try {
            const data = JSON.parse(e.data);
            dispatch({ type: ActionTypes.UPDATE_PACKET_STATUS, packetId, status: PipelineStatus.EXTRACTING, progress: data });
          } catch (_) {}
        });

        eventSource.addEventListener("completed", (e) => {
          try {
            const data = JSON.parse(e.data);
            dispatch({ type: ActionTypes.PACKET_COMPLETED, packetId, result: data.result });
          } catch (_) {}
        });

        eventSource.addEventListener("error", (e) => {
          try {
            const data = JSON.parse(e.data);
            dispatch({ type: ActionTypes.PACKET_FAILED, packetId, error: data.error });
          } catch (_) {}
        });

        eventSource.addEventListener("paused", () => {
          dispatch({ type: ActionTypes.PACKET_REQUEUE, packetId });
        });

        eventSource.addEventListener("cancelled", () => {
          dispatch({ type: ActionTypes.PACKET_FAILED, packetId, error: "Cancelled" });
        });

        // "done" signals that the SSE stream is complete
        eventSource.addEventListener("done", () => {
          eventSource.close();
          sseSourcesRef.current?.delete(packetId);
          resolve();
        });

        // EventSource error (network issue, server down)
        eventSource.onerror = () => {
          // EventSource auto-reconnects, but if it fails permanently, clean up
          if (eventSource.readyState === EventSource.CLOSED) {
            sseSourcesRef.current?.delete(packetId);
            // Check DB for final state instead of assuming failure
            api.getPacket(packetId).then(pkt => {
              if (pkt && (pkt.status === "completed" || pkt.status === "needs_review")) {
                dispatch({ type: ActionTypes.PACKET_COMPLETED, packetId, result: { documents: [] } });
              } else if (pkt && pkt.status === "failed") {
                dispatch({ type: ActionTypes.PACKET_FAILED, packetId, error: pkt.error || "Processing failed" });
              }
              // If still processing, the SSE just disconnected — server continues
              resolve();
            }).catch(() => resolve());
          }
        };
      });
    } catch (error) {
      if (error.message === "Processing aborted" || error.name === "AbortError") {
        if (__DEV__) console.log(`Packet ${packetId} processing was aborted, re-queuing for resume`);
        dispatch({ type: ActionTypes.PACKET_REQUEUE, packetId });
        return;
      }
      dispatch({ type: ActionTypes.PACKET_FAILED, packetId, error: error.message });
    } finally {
      claimedRef.current.delete(packetId);
    }
  }, [syncWithRetry]);

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
   * Ensure the server-side queue is unpaused (idempotent, deduplicated).
   * Called by both start() and resume() — the server treats resume as a no-op
   * if already running, so this is safe to call unconditionally.
   */
  const ensureServerUnpaused = useCallback(() => {
    if (resumeInFlightRef.current) return; // Already in flight
    resumeInFlightRef.current = true;
    api.resumeProcessing()
      .catch((err) => {
        if (__DEV__) console.warn("Failed to unpause server queue:", err.message);
      })
      .finally(() => {
        resumeInFlightRef.current = false;
      });
  }, []);

  /**
   * Start batch processing.
   * Always tells the server to unpause first — the backend may still be paused
   * from a previous stop/restart cycle, even though the frontend is ready.
   */
  const start = useCallback(() => {
    if (otherTabProcessing) {
      console.warn("Another tab is already processing. Refusing to start.");
      return;
    }
    pausedRef.current = false;
    isProcessingRef.current = false;
    abortControllerRef.current = new AbortController();
    ensureServerUnpaused();
    dispatch({ type: ActionTypes.START_PROCESSING });
    stateRef.current = { ...stateRef.current, batchStatus: BatchStatus.PROCESSING };
    broadcastProcessingState("PROCESSING_STARTED");
    runProcessingLoop();
  }, [runProcessingLoop, otherTabProcessing, broadcastProcessingState, ensureServerUnpaused]);

  /**
   * Pause batch processing.
   * Cancels in-flight packets on the server, closes SSE, and requeues them in the UI.
   */
  const pause = useCallback(() => {
    pausedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Cancel each in-flight packet on the server so jobs actually stop
    const processingIds = Array.from(stateRef.current.processing ?? []);
    for (const packetId of processingIds) {
      api.cancelProcessing(packetId).catch((err) => {
        if (__DEV__) console.warn("Failed to cancel packet", packetId, err.message);
      });
      dispatch({ type: ActionTypes.PACKET_REQUEUE, packetId });
    }
    // Close all SSE connections so client promises resolve
    if (sseSourcesRef.current) {
      for (const [, es] of sseSourcesRef.current) {
        try { es.close(); } catch (_) {}
      }
      sseSourcesRef.current.clear();
    }
    api.pauseProcessing().catch((err) => {
      if (__DEV__) console.warn("Failed to pause server processing:", err.message);
    });
    dispatch({ type: ActionTypes.PAUSE_PROCESSING });
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
    abortControllerRef.current = new AbortController();
    ensureServerUnpaused();
    dispatch({ type: ActionTypes.RESUME_PROCESSING });
    stateRef.current = { ...stateRef.current, batchStatus: BatchStatus.PROCESSING };
    broadcastProcessingState("PROCESSING_STARTED");
    runProcessingLoop();
  }, [runProcessingLoop, otherTabProcessing, broadcastProcessingState, ensureServerUnpaused]);

  /**
   * Add packets to the queue.
   * Includes a memory heuristic warning for very large batches.
   */
  const addPackets = useCallback(async (files) => {
    // Memory heuristic: base64 is ~1.33x the file size.
    // Warn when the cumulative upload could exceed ~500 MB of browser memory.
    const MEMORY_WARN_BYTES = 500 * 1024 * 1024;
    const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
    if (totalBytes > MEMORY_WARN_BYTES) {
      console.warn(
        `[Memory] Large batch: ${files.length} files totaling ${Math.round(totalBytes / 1024 / 1024)} MB. ` +
        `Browser memory usage may spike. Consider uploading via the server endpoint for very large batches.`
      );
    }

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

    // With server-side processing, don't auto-resume when adding new files.
    // The user should configure presets and explicitly click "Start".
    // Just reset status to IDLE so the Upload page stays active.
    const currentStatus = stateRef.current.batchStatus;
    if (currentStatus === BatchStatus.COMPLETED || currentStatus === BatchStatus.PAUSED) {
      dispatch({ type: ActionTypes.PAUSE_PROCESSING });
      stateRef.current = { ...stateRef.current, batchStatus: BatchStatus.PAUSED };
    }
  }, [runProcessingLoop, broadcastProcessingState]);

  /**
   * Retry a failed packet
   */
  const retryPacket = useCallback((packetId) => {
    // Clear this packet from claimedRef so the loop doesn't skip it
    claimedRef.current.delete(packetId);
    dispatch({ type: ActionTypes.RETRY_PACKET, packetId });

    // Force-restart the loop regardless of current status.
    // The old approach of "nudging" the running loop didn't work because
    // isProcessingRef.current blocks re-entry — if the loop was stuck
    // in idle spinning, the nudge was silently ignored.
    isProcessingRef.current = false;
    pausedRef.current = false;
    abortControllerRef.current = new AbortController();
    dispatch({ type: ActionTypes.RESUME_PROCESSING });
    stateRef.current = { ...stateRef.current, batchStatus: BatchStatus.PROCESSING };
    broadcastProcessingState("PROCESSING_STARTED");
    setTimeout(() => runProcessingLoop(), 150);
  }, [runProcessingLoop, broadcastProcessingState]);

  /**
   * Retry all failed packets
   */
  const retryAllFailed = useCallback(() => {
    const failedPackets = Array.from(stateRef.current.packets.values())
      .filter(p => p.status === PacketStatus.FAILED);
    
    for (const packet of failedPackets) {
      claimedRef.current.delete(packet.id);
      dispatch({ type: ActionTypes.RETRY_PACKET, packetId: packet.id });
    }
    
    // Force-restart the loop (same logic as retryPacket)
    isProcessingRef.current = false;
    pausedRef.current = false;
    abortControllerRef.current = new AbortController();
    dispatch({ type: ActionTypes.RESUME_PROCESSING });
    stateRef.current = { ...stateRef.current, batchStatus: BatchStatus.PROCESSING };
    broadcastProcessingState("PROCESSING_STARTED");
    setTimeout(() => runProcessingLoop(), 150);
  }, [runProcessingLoop, broadcastProcessingState]);

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
   * Always tries to delete on the server first so the packet stays gone after refresh;
   * only removes from local state after a successful API delete (or when not using DB).
   * @returns {Promise<boolean>} true if removed (from UI and/or server), false if server delete failed
   */
  const removePacket = useCallback(async (packetId) => {
    // Always attempt server delete when we have a session so refresh doesn't bring the packet back
    if (stateRef.current.dbConnected) {
      try {
        await api.deletePacket(packetId);
      } catch (err) {
        console.warn(`Failed to delete packet ${packetId} from DB:`, err.message);
        return false; // Caller can show toast; keep item in UI
      }
    }
    dispatch({ type: ActionTypes.REMOVE_PACKET, packetId });
    return true;
  }, []);

  /**
   * Clear all packets from state and database.
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
