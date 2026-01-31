import { useState, useCallback, useEffect } from "react";
import { getExtractionData } from "../lib/utils";

const STORAGE_KEY = "stewart_processing_history";
const MAX_HISTORY_ITEMS = 100;

/**
 * Get history from localStorage
 */
function loadHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load history:", e);
  }
  return [];
}

/**
 * Save history to localStorage
 */
function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save history:", e);
  }
}

/**
 * Hook for managing processing history
 */
export function useProcessingHistory() {
  const [history, setHistory] = useState(() => loadHistory());

  // Save to localStorage when history changes
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  /**
   * Add a completed batch to history
   */
  const addToHistory = useCallback((batchData) => {
    const historyEntry = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      packets: batchData.packets.map(packet => ({
        id: packet.id,
        filename: packet.filename,
        status: packet.status,
        processedAt: packet.completedAt,
        documentCount: packet.documents?.length || 0,
        documents: packet.documents?.map(doc => {
          const { data, likelihoods } = getExtractionData(doc.extraction);
          return {
            id: doc.id,
            documentType: doc.classification?.category,
            confidence: doc.classification?.confidence,
            needsReview: doc.needsReview,
            reviewReasons: doc.reviewReasons,
            extractedData: data,
            likelihoods,
          };
        }) || [],
      })),
      stats: {
        totalPackets: batchData.stats.total,
        completed: batchData.stats.completed,
        needsReview: batchData.stats.needsReview,
        failed: batchData.stats.failed,
        totalDocuments: batchData.packets.reduce(
          (sum, p) => sum + (p.documents?.length || 0), 
          0
        ),
      },
    };

    setHistory(prev => {
      const updated = [historyEntry, ...prev];
      // Limit history size
      if (updated.length > MAX_HISTORY_ITEMS) {
        return updated.slice(0, MAX_HISTORY_ITEMS);
      }
      return updated;
    });

    return historyEntry;
  }, []);

  /**
   * Remove a single history entry
   */
  const removeFromHistory = useCallback((historyId) => {
    setHistory(prev => prev.filter(entry => entry.id !== historyId));
  }, []);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  /**
   * Get a specific history entry
   */
  const getHistoryEntry = useCallback((historyId) => {
    return history.find(entry => entry.id === historyId);
  }, [history]);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getHistoryEntry,
    hasHistory: history.length > 0,
  };
}

export default useProcessingHistory;
