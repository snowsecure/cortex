import { useState, useCallback, useEffect } from "react";
import { getExtractionData } from "../lib/utils";
import { getUsername } from "../lib/retab";
import * as api from "../lib/api";

const MAX_HISTORY_ITEMS = 100;

/**
 * Hook for managing processing history
 * All data is read from / written to the server database (global across users).
 */
export function useProcessingHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch history from server on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getHistory(MAX_HISTORY_ITEMS)
      .then((entries) => {
        if (cancelled) return;
        // Server returns rows with { id, session_id, timestamp/created_at, total_packets, total_documents, completed, needs_review, failed, total_credits, total_cost, summary, created_by }
        // Normalise into the shape the UI expects
        const normalised = (entries || []).map(normaliseServerEntry);
        setHistory(normalised);
      })
      .catch((err) => {
        console.warn("Failed to load history from server, starting empty:", err);
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /**
   * Add a completed run to history (server-first)
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
      created_by: getUsername(),
    };

    // Optimistically update local state
    setHistory(prev => {
      const updated = [historyEntry, ...prev];
      if (updated.length > MAX_HISTORY_ITEMS) {
        return updated.slice(0, MAX_HISTORY_ITEMS);
      }
      return updated;
    });

    // Build server payload
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
      created_by: getUsername(),
    }).catch((err) => console.warn("Failed to save run to server history:", err));

    return historyEntry;
  }, []);

  /**
   * Remove a single history entry (server + local)
   */
  const removeFromHistory = useCallback((historyId) => {
    // Optimistic local update
    setHistory(prev => prev.filter(entry => entry.id !== historyId));
    // Delete from server
    api.deleteHistoryEntry(historyId)
      .catch((err) => console.warn("Failed to delete history entry from server:", err));
  }, []);

  /**
   * Clear all history (server + local)
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    api.clearHistory()
      .catch((err) => console.warn("Failed to clear history on server:", err));
  }, []);

  /**
   * Refresh history from server
   */
  const refreshHistory = useCallback(() => {
    api.getHistory(MAX_HISTORY_ITEMS)
      .then((entries) => {
        const normalised = (entries || []).map(normaliseServerEntry);
        setHistory(normalised);
      })
      .catch((err) => console.warn("Failed to refresh history:", err));
  }, []);

  /**
   * Get a specific history entry
   */
  const getHistoryEntry = useCallback((historyId) => {
    return history.find(entry => entry.id === historyId);
  }, [history]);

  return {
    history,
    loading,
    addToHistory,
    removeFromHistory,
    clearHistory,
    refreshHistory,
    getHistoryEntry,
    hasHistory: history.length > 0,
  };
}

/**
 * Normalise a server history row into the shape the UI expects.
 * Server rows have: id, session_id, created_at, total_packets, total_documents,
 * completed, needs_review, failed, total_credits, total_cost, summary (JSON string), created_by
 */
function normaliseServerEntry(row) {
  let summary = {};
  if (typeof row.summary === "string") {
    try { summary = JSON.parse(row.summary); } catch { /* ignore */ }
  } else if (row.summary && typeof row.summary === "object") {
    summary = row.summary;
  }

  return {
    id: row.id,
    timestamp: row.created_at || row.timestamp,
    packets: summary.packets || [],
    stats: summary.stats || {
      totalPackets: row.total_packets ?? 0,
      completed: row.completed ?? 0,
      needsReview: row.needs_review ?? 0,
      failed: row.failed ?? 0,
      totalDocuments: row.total_documents ?? 0,
    },
    total_credits: row.total_credits,
    total_cost: row.total_cost,
    created_by: row.created_by || "",
  };
}

export default useProcessingHistory;
