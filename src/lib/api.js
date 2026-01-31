/**
 * SAIL-IDP API Client
 * Handles communication with the backend for persistent storage
 */

import { getExtractionData } from "./utils";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };
  
  if (options.body && typeof options.body === "object") {
    config.body = JSON.stringify(options.body);
  }
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `API Error: ${response.status}`);
    }
    
    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// ============================================================================
// STATUS & HEALTH
// ============================================================================

export async function getHealth() {
  return apiRequest("/health");
}

export async function getStatus() {
  return apiRequest("/api/status");
}

export async function getUsageStats(days = 30) {
  return apiRequest(`/api/usage?days=${days}`);
}

// ============================================================================
// SESSIONS
// ============================================================================

export async function getActiveSession() {
  return apiRequest("/api/sessions/active");
}

export async function getSession(id) {
  return apiRequest(`/api/sessions/${id}`);
}

export async function createSession(id) {
  return apiRequest("/api/sessions", {
    method: "POST",
    body: { id },
  });
}

export async function updateSession(id, data) {
  return apiRequest(`/api/sessions/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export async function closeSession(id) {
  return apiRequest(`/api/sessions/${id}/close`, {
    method: "POST",
  });
}

export async function getFullSession(id) {
  return apiRequest(`/api/sessions/${id}/full`);
}

// ============================================================================
// PACKETS
// ============================================================================

export async function createPackets(sessionId, packets) {
  return apiRequest("/api/packets", {
    method: "POST",
    body: {
      session_id: sessionId,
      packets: packets.map(p => ({
        id: p.id,
        filename: p.filename || p.name,
        status: p.status || "queued",
      })),
    },
  });
}

export async function getPacket(id) {
  return apiRequest(`/api/packets/${id}`);
}

export async function getPacketsBySession(sessionId) {
  return apiRequest(`/api/sessions/${sessionId}/packets`);
}

export async function updatePacket(id, data) {
  return apiRequest(`/api/packets/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export async function completePacket(id, result) {
  return apiRequest(`/api/packets/${id}/complete`, {
    method: "POST",
    body: {
      stats: result.stats,
      usage: result.usage,
      hasNeedsReview: result.documents?.some(d => d.needsReview),
      hasFailed: result.documents?.some(d => d.status === "failed"),
    },
  });
}

export async function deletePacket(id) {
  return apiRequest(`/api/packets/${id}`, {
    method: "DELETE",
  });
}

// ============================================================================
// DOCUMENTS
// ============================================================================

export async function createDocuments(sessionId, packetId, documents) {
  return apiRequest("/api/documents", {
    method: "POST",
    body: {
      documents: documents.map(d => {
        const { data, likelihoods } = getExtractionData(d.extraction);
        return {
          id: d.id,
          packet_id: packetId,
          session_id: sessionId,
          document_type: d.documentType || d.category,
          display_name: d.displayName || d.name,
          status: d.status,
          pages: d.pages,
          extraction_data: data,
          likelihoods: likelihoods,
          extraction_confidence: d.extractionConfidence,
          needs_review: d.needsReview,
          review_reasons: d.reviewReasons,
          credits_used: d.usage?.credits || 0,
        };
      }),
    },
  });
}

export async function getDocument(id) {
  return apiRequest(`/api/documents/${id}`);
}

export async function getDocumentsByPacket(packetId) {
  return apiRequest(`/api/packets/${packetId}/documents`);
}

export async function getReviewQueue(sessionId) {
  return apiRequest(`/api/sessions/${sessionId}/review-queue`);
}

export async function reviewDocument(id, data) {
  return apiRequest(`/api/documents/${id}/review`, {
    method: "POST",
    body: data,
  });
}

// ============================================================================
// HISTORY
// ============================================================================

export async function getHistory(limit = 50) {
  return apiRequest(`/api/history?limit=${limit}`);
}

export async function createHistoryEntry(entry) {
  return apiRequest("/api/history", {
    method: "POST",
    body: entry,
  });
}

export async function deleteHistoryEntry(id) {
  return apiRequest(`/api/history/${id}`, {
    method: "DELETE",
  });
}

export async function clearHistory() {
  return apiRequest("/api/history", {
    method: "DELETE",
  });
}

// ============================================================================
// EXPORT TEMPLATES
// ============================================================================

export async function getExportTemplates() {
  return apiRequest("/api/export-templates");
}

export async function saveExportTemplate(template) {
  return apiRequest("/api/export-templates", {
    method: "POST",
    body: template,
  });
}

export async function deleteExportTemplate(name) {
  return apiRequest(`/api/export-templates/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Sync a completed packet result to the database
 */
export async function syncPacketResult(sessionId, packetId, result) {
  // First, complete the packet
  await completePacket(packetId, result);
  
  // Then, create all documents
  if (result.documents && result.documents.length > 0) {
    await createDocuments(sessionId, packetId, result.documents);
  }
  
  return true;
}

/**
 * Check if backend is available
 */
export async function isBackendAvailable() {
  try {
    const health = await getHealth();
    return health?.status === "ok";
  } catch {
    return false;
  }
}

export default {
  getHealth,
  getStatus,
  getUsageStats,
  getActiveSession,
  getSession,
  createSession,
  updateSession,
  closeSession,
  getFullSession,
  createPackets,
  getPacket,
  getPacketsBySession,
  updatePacket,
  completePacket,
  deletePacket,
  createDocuments,
  getDocument,
  getDocumentsByPacket,
  getReviewQueue,
  reviewDocument,
  getHistory,
  createHistoryEntry,
  deleteHistoryEntry,
  clearHistory,
  getExportTemplates,
  saveExportTemplate,
  deleteExportTemplate,
  syncPacketResult,
  isBackendAvailable,
};
