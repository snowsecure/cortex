/**
 * SAIL-IDP API Client
 * Handles communication with the backend for persistent storage
 */

import { getExtractionData } from "./utils";

// Default to "" (relative / same-origin) so production & Docker work without VITE_API_URL.
// For local dev the Vite proxy forwards /api → localhost:3005 automatically.
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

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

export async function getActiveSession(created_by) {
  const params = created_by ? `?created_by=${encodeURIComponent(created_by)}` : "";
  return apiRequest(`/api/sessions/active${params}`);
}

export async function getSession(id) {
  return apiRequest(`/api/sessions/${id}`);
}

export async function createSession(id, created_by) {
  return apiRequest("/api/sessions", {
    method: "POST",
    body: { id, created_by },
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

export async function getAllPackets(limit = 500) {
  return apiRequest(`/api/packets/all?limit=${limit}`);
}

export async function createPackets(sessionId, packets, created_by) {
  return apiRequest("/api/packets", {
    method: "POST",
    body: {
      session_id: sessionId,
      created_by: created_by || undefined,
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

/**
 * Upload a PDF for a packet (store on server so work continues if user leaves).
 * Returns the created packet { id, filename, temp_file_path, ... }.
 */
export async function uploadPacketFile(sessionId, file, created_by) {
  const url = `${API_BASE}/api/upload`;
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("file", file);
  if (created_by) form.append("created_by", created_by);
  const response = await fetch(url, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Upload failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch stored PDF for a packet as base64 (for processing when file was uploaded to server).
 */
export async function getPacketFileAsBase64(packetId) {
  const url = `${API_BASE}/api/packets/${packetId}/file`;
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "File not found or expired");
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      // Return full data URL (data:application/pdf;base64,...) for Retab API compatibility
      if (dataUrl) resolve(dataUrl);
      else reject(new Error("Failed to read file"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
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
        const likelihoodValues = Object.values(likelihoods || {}).filter(v => typeof v === "number");
        const derivedConfidence =
          likelihoodValues.length > 0
            ? likelihoodValues.reduce((s, v) => s + v, 0) / likelihoodValues.length
            : null;
        return {
          id: d.id,
          packet_id: packetId,
          session_id: sessionId,
          document_type: d.documentType || d.category,
          display_name: d.displayName || d.name,
          status: d.status,
          pages: d.pages,
          extraction_data: data,
          likelihoods: likelihoods || {},
          extraction_confidence: d.extractionConfidence ?? derivedConfidence,
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

/**
 * Sync a retried document's new extraction data to the database.
 */
export async function syncRetryDocumentResult(documentId, result) {
  const { data, likelihoods } = getExtractionData(result.extraction);
  return apiRequest(`/api/documents/${documentId}`, {
    method: "PATCH",
    body: {
      status: result.status,
      extractionData: data,
      likelihoods: likelihoods || {},
      extractionConfidence: result.extractionConfidence,
      needsReview: result.needsReview,
      reviewReasons: result.reviewReasons,
      creditsUsed: result.usage?.credits || 0,
    },
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
// ADMIN METRICS
// ============================================================================

export async function getAdminMetrics() {
  return apiRequest("/api/admin/metrics");
}

export async function clearDatabase(password) {
  try {
    return await apiRequest("/api/admin/clear-database", {
      method: "POST",
      body: { password: password != null ? String(password).trim() : "" },
    });
  } catch (e) {
    const msg = e.message || "";
    if (msg === "Not Found" || msg === "Not found" || msg.includes("404")) {
      throw new Error(
        "Clear database endpoint not available. Restart the backend server and try again. Password is \"stewart\" (lowercase)."
      );
    }
    throw e;
  }
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
 * Sync a completed packet result to the database.
 * Uses the atomic endpoint: packet completion + document creation happen
 * in a single SQLite transaction, preventing data loss on crash.
 */
export async function syncPacketResult(sessionId, packetId, result) {
  // Build document rows for the atomic endpoint
  const documents = (result.documents || []).map(d => {
    const { data, likelihoods } = getExtractionData(d.extraction);
    const likelihoodValues = Object.values(likelihoods || {}).filter(v => typeof v === "number");
    const derivedConfidence =
      likelihoodValues.length > 0
        ? likelihoodValues.reduce((s, v) => s + v, 0) / likelihoodValues.length
        : null;
    return {
      id: d.id,
      packet_id: packetId,
      session_id: sessionId,
      document_type: d.documentType || d.category || d.classification?.category,
      display_name: d.displayName || d.name || d.splitType,
      status: d.status,
      pages: d.pages,
      extraction_data: data,
      likelihoods: likelihoods || {},
      extraction_confidence: d.extractionConfidence ?? derivedConfidence,
      needs_review: d.needsReview,
      review_reasons: d.reviewReasons,
      credits_used: d.usage?.credits || 0,
    };
  });

  // Single request: packet + documents in one transaction
  return apiRequest(`/api/packets/${packetId}/complete`, {
    method: "POST",
    body: {
      stats: result.stats,
      usage: result.usage,
      hasNeedsReview: result.documents?.some(d => d.needsReview),
      hasFailed: result.documents?.some(d => d.status === "failed"),
      documents,
    },
  });
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
  getAllPackets,
  createPackets,
  getPacket,
  getPacketsBySession,
  updatePacket,
  completePacket,
  deletePacket,
  uploadPacketFile,
  getPacketFileAsBase64,
  createDocuments,
  getDocument,
  getDocumentsByPacket,
  getReviewQueue,
  reviewDocument,
  syncRetryDocumentResult,
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
