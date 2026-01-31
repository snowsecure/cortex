import { useState, useCallback, useEffect } from "react";
import { getExtractionData } from "../lib/utils";
import * as api from "../lib/api";

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
   * Add a completed run to history (localStorage + server when sessionId/usage provided)
   */
  const addToHistory = useCallback((runData) => {
    const totalDocuments = runData.packets.reduce(
      (sum, p) => sum + (p.documents?.length || 0),
      0
    );
    const historyEntry = {
      id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      packets: runData.packets.map(packet => ({
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
        totalPackets: runData.stats.total,
        completed: runData.stats.completed,
        needsReview: runData.stats.needsReview,
        failed: runData.stats.failed,
        totalDocuments,
      },
    };

    setHistory(prev => {
      const updated = [historyEntry, ...prev];
      if (updated.length > MAX_HISTORY_ITEMS) {
        return updated.slice(0, MAX_HISTORY_ITEMS);
      }
      return updated;
    });

    // Persist run summary to server so admin panel has full data (fire-and-forget)
    const sessionId = runData.sessionId ?? null;
    const usage = runData.usage ?? {};
    const fromPackets = runData.packets.reduce(
      (acc, p) => {
        const u = p.result?.usage ?? p.usage ?? {};
        acc.credits += u.totalCredits ?? 0;
        acc.cost += u.totalCost ?? 0;
        return acc;
      },
      { credits: 0, cost: 0 }
    );
    const totalCredits = usage?.totalCredits ?? fromPackets.credits;
    const totalCost = usage?.totalCost ?? fromPackets.cost;
    api.createHistoryEntry({
      id: historyEntry.id,
      session_id: sessionId,
      total_packets: runData.stats.total,
      total_documents: totalDocuments,
      completed: runData.stats.completed,
      needs_review: runData.stats.needsReview,
      failed: runData.stats.failed,
      total_credits: totalCredits ?? 0,
      total_cost: totalCost ?? 0,
      summary: { packets: historyEntry.packets, stats: historyEntry.stats },
    }).catch((err) => console.warn("Failed to save run to server history:", err));

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
