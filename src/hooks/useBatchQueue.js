import { useReducer, useCallback, useRef, useEffect, useState } from "react";
import { usePacketPipeline, PipelineStatus } from "./usePacketPipeline";
import * as api from "../lib/api";
import { loadSettings, DEFAULT_CONFIG as RETAB_DEFAULT_CONFIG } from "../lib/retabConfig";

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
  PACKET_DOCUMENT_PROCESSED: "PACKET_DOCUMENT_PROCESSED",
  PACKET_COMPLETED: "PACKET_COMPLETED",
  PACKET_FAILED: "PACKET_FAILED",
  RETRY_PACKET: "RETRY_PACKET",
  REMOVE_PACKET: "REMOVE_PACKET",
  CLEAR_ALL: "CLEAR_ALL",
  SET_CONFIG: "SET_CONFIG",
  SET_RETAB_CONFIG: "SET_RETAB_CONFIG",
  SET_SESSION_ID: "SET_SESSION_ID",
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
    
    // Check if data is too old (24 hours)
    const savedAt = new Date(data.savedAt);
    const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSave > 24) {
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
 * Build initial state, optionally restoring from storage
 */
function getInitialState() {
  const saved = loadFromStorage();
  
  const baseState = {
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
  };
  
  if (saved && saved.packets && saved.packets.length > 0) {
    // Restore packets
    for (const packet of saved.packets) {
      baseState.packets.set(packet.id, packet);
    }
    
    // Recalculate stats
    baseState.stats = {
      total: saved.packets.length,
      queued: 0,
      processing: 0,
      completed: saved.packets.filter(p => p.status === PacketStatus.COMPLETED).length,
      needsReview: saved.packets.filter(p => p.status === PacketStatus.NEEDS_REVIEW).length,
      failed: saved.packets.filter(p => p.status === PacketStatus.FAILED).length,
    };
    
    // Set status based on what we have
    if (baseState.stats.total > 0) {
      baseState.batchStatus = BatchStatus.COMPLETED;
    }
  }
  
  return baseState;
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
          base64: file.base64,
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
    
    case ActionTypes.PACKET_DOCUMENT_PROCESSED: {
      const packet = state.packets.get(action.packetId);
      if (!packet) return state;
      
      const newPackets = new Map(state.packets);
      const newDocs = [...packet.documents, action.document];
      
      newPackets.set(action.packetId, {
        ...packet,
        documents: newDocs,
        progress: { ...packet.progress, docIndex: newDocs.length },
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
      
      newPackets.set(action.packetId, {
        ...packet,
        status: finalStatus,
        result: action.result,
        documents: action.result.documents,
        usage: action.result.usage,
        completedAt: new Date().toISOString(),
        progress: {
          stage: "completed",
          docIndex: action.result.documents.length,
          totalDocs: action.result.documents.length,
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
        config: state.config,
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
    
    default:
      return state;
  }
}

/**
 * Hook for managing batch processing queue
 */
export function useBatchQueue() {
  const [state, dispatch] = useReducer(batchQueueReducer, initialState);
  const { processPacket } = usePacketPipeline();
  
  // Use refs to track processing state without causing re-renders
  const isProcessingRef = useRef(false);
  const pausedRef = useRef(false);
  const stateRef = useRef(state);
  const dbInitRef = useRef(false);
  
  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Initialize database session on mount
  useEffect(() => {
    if (dbInitRef.current) return;
    dbInitRef.current = true;
    
    async function initDbSession() {
      try {
        const session = await api.getActiveSession();
        if (session?.id) {
          dispatch({ 
            type: ActionTypes.SET_SESSION_ID, 
            sessionId: session.id,
            dbConnected: true,
          });
          console.log("Database session initialized:", session.id);
        }
      } catch (error) {
        console.warn("Database not available, using localStorage fallback:", error.message);
        // Generate a local session ID
        dispatch({ 
          type: ActionTypes.SET_SESSION_ID, 
          sessionId: `local_${Date.now()}`,
          dbConnected: false,
        });
      }
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
   * Process the next available packet from the queue
   */
  const processNextPacket = useCallback(async () => {
    // Get fresh state
    const currentState = stateRef.current;
    
    if (pausedRef.current) return;
    if (currentState.batchStatus !== BatchStatus.PROCESSING) return;
    if (currentState.queue.length === 0) return;
    if (currentState.processing.size >= currentState.config.concurrency) return;
    
    const packetId = currentState.queue[0];
    const packet = currentState.packets.get(packetId);
    
    if (!packet) return;
    
    // Mark as starting
    dispatch({ 
      type: ActionTypes.UPDATE_PACKET_STATUS, 
      packetId, 
      status: PipelineStatus.SPLITTING,
    });
    
    try {
      const result = await processPacket(packet, {
        onStatusChange: (id, status, progress) => {
          dispatch({ type: ActionTypes.UPDATE_PACKET_STATUS, packetId: id, status, progress });
        },
        onDocumentProcessed: (id, document) => {
          dispatch({ type: ActionTypes.PACKET_DOCUMENT_PROCESSED, packetId: id, document });
        },
        retabConfig: stateRef.current.retabConfig,
      });
      
      dispatch({ type: ActionTypes.PACKET_COMPLETED, packetId, result });
      
      // Sync to database if connected
      if (stateRef.current.dbConnected && stateRef.current.sessionId) {
        try {
          await api.syncPacketResult(stateRef.current.sessionId, packetId, result);
        } catch (error) {
          console.warn("Failed to sync packet result to database:", error.message);
        }
      }
    } catch (error) {
      dispatch({ type: ActionTypes.PACKET_FAILED, packetId, error: error.message });
    }
  }, [processPacket]);

  /**
   * Main processing loop
   */
  const runProcessingLoop = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    while (true) {
      const currentState = stateRef.current;
      
      // Check if we should stop
      if (pausedRef.current) break;
      if (currentState.batchStatus !== BatchStatus.PROCESSING) break;
      if (currentState.queue.length === 0 && currentState.processing.size === 0) break;
      
      // Process packets up to concurrency limit
      const availableSlots = currentState.config.concurrency - currentState.processing.size;
      
      if (availableSlots > 0 && currentState.queue.length > 0) {
        // Start multiple packets in parallel
        const promises = [];
        for (let i = 0; i < Math.min(availableSlots, currentState.queue.length); i++) {
          promises.push(processNextPacket());
        }
        await Promise.all(promises);
      } else {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    isProcessingRef.current = false;
  }, [processNextPacket]);

  /**
   * Start batch processing
   */
  const start = useCallback(() => {
    pausedRef.current = false;
    dispatch({ type: ActionTypes.START_PROCESSING });
    // Small delay to let state update
    setTimeout(runProcessingLoop, 100);
  }, [runProcessingLoop]);

  /**
   * Pause batch processing
   */
  const pause = useCallback(() => {
    pausedRef.current = true;
    dispatch({ type: ActionTypes.PAUSE_PROCESSING });
  }, []);

  /**
   * Resume batch processing
   */
  const resume = useCallback(() => {
    pausedRef.current = false;
    dispatch({ type: ActionTypes.RESUME_PROCESSING });
    setTimeout(runProcessingLoop, 100);
  }, [runProcessingLoop]);

  /**
   * Add packets to the queue
   */
  const addPackets = useCallback(async (files) => {
    dispatch({ type: ActionTypes.ADD_PACKETS, files });
    
    // Sync to database if connected
    if (stateRef.current.dbConnected && stateRef.current.sessionId) {
      try {
        await api.createPackets(stateRef.current.sessionId, files);
      } catch (error) {
        console.warn("Failed to sync packets to database:", error.message);
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
   * Remove a packet
   */
  const removePacket = useCallback((packetId) => {
    dispatch({ type: ActionTypes.REMOVE_PACKET, packetId });
  }, []);

  /**
   * Clear all packets
   */
  const clearAll = useCallback(() => {
    pausedRef.current = true;
    dispatch({ type: ActionTypes.CLEAR_ALL });
    // Also clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to clear session storage:", e);
    }
  }, []);

  /**
   * Update configuration
   */
  const setConfig = useCallback((config) => {
    dispatch({ type: ActionTypes.SET_CONFIG, config });
  }, []);
  
  const setRetabConfig = useCallback((retabConfig) => {
    dispatch({ type: ActionTypes.SET_RETAB_CONFIG, retabConfig });
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
    addPackets,
    start,
    pause,
    resume,
    retryPacket,
    retryAllFailed,
    removePacket,
    clearAll,
    setConfig,
    setRetabConfig,
    isProcessing: state.batchStatus === BatchStatus.PROCESSING,
    isPaused: state.batchStatus === BatchStatus.PAUSED,
    isComplete: state.batchStatus === BatchStatus.COMPLETED,
    hasPackets: state.packets.size > 0,
    hasFailed: state.stats.failed > 0,
    hasNeedsReview: state.stats.needsReview > 0,
  };
}

export default useBatchQueue;
