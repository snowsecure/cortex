import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * CST/CDT timezone identifier (handles daylight saving automatically)
 */
const CST_TIMEZONE = "America/Chicago";

/**
 * Format a date/time in Central Time (CST/CDT)
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options (optional)
 * @returns {string} Formatted date/time string in Central Time
 */
export function formatDateTimeCST(date, options = {}) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  
  const defaultOptions = {
    timeZone: CST_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  
  return d.toLocaleString("en-US", { ...defaultOptions, ...options });
}

/**
 * Format just the time in Central Time (CST/CDT)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted time string in Central Time
 */
export function formatTimeCST(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  
  return d.toLocaleTimeString("en-US", {
    timeZone: CST_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format just the date in Central Time (CST/CDT)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string in Central Time
 */
export function formatDateCST(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  
  return d.toLocaleDateString("en-US", {
    timeZone: CST_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/**
 * Get relative time string (e.g., "2h ago", "3d ago") in Central Time
 * @param {Date|string|number} date - Date to compare
 * @returns {string} Relative time string
 */
export function formatRelativeTimeCST(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDateCST(d);
}

/**
 * Extract data from a Retab API extraction response
 * Handles wrapped, unwrapped, and top-level likelihoods formats
 * @param {Object} extraction - The extraction response from the API
 * @returns {{ data: Object, likelihoods: Object }} Extracted data and likelihoods
 */
export function getExtractionData(extraction) {
  if (!extraction) {
    return { data: {}, likelihoods: {} };
  }

  const content = extraction.content || extraction;

  const data =
    content?.choices?.[0]?.message?.parsed ||
    content?.data ||
    content?.result ||
    {};

  const likelihoods =
    content?.likelihoods ||
    content?.choices?.[0]?.message?.likelihoods ||
    extraction?.likelihoods ||
    {};

  return { data, likelihoods };
}

/** Sentinel stored in editedFields when the reviewer marks a field as "not in document". */
export const NOT_IN_DOCUMENT_VALUE = "__NOT_IN_DOCUMENT__";

/** UI label for the not-in-document sentinel (single source of truth for display). */
export const NOT_IN_DOCUMENT_LABEL = "Not Found / Not Present";

/**
 * For export: replace sentinel with "N/A" so the raw value never appears in CSV/JSON etc.
 */
export function valueForExport(value) {
  return value === NOT_IN_DOCUMENT_VALUE ? "N/A" : value;
}

/**
 * For UI display: show NOT_IN_DOCUMENT_LABEL when the value is the not-in-document sentinel.
 */
export function displayValue(value) {
  return value === NOT_IN_DOCUMENT_VALUE ? NOT_IN_DOCUMENT_LABEL : (value ?? "");
}

/**
 * Get extraction data with user corrections (editedFields) merged in.
 * This is the single source of truth for "final data" after human review.
 *
 * When a document has been reclassified (categoryOverride with a known schema),
 * the editedFields contain the COMPLETE new-schema field set (saved by
 * ReviewQueue.handleApprove). To prevent old-schema extraction fields from
 * leaking through, we restrict the output to only new-schema fields.
 *
 * @param {Object} document - A document object with .extraction and optional .editedFields
 * @param {Object} [schemasMap] - Optional schemas map; pass to enable schema-aware filtering
 * @returns {{ data: Object, likelihoods: Object, originalData: Object, editedFields: Object }}
 */
export function getMergedExtractionData(document, schemasMap) {
  const { data, likelihoods } = getExtractionData(document?.extraction);
  const editedFields = document?.editedFields || {};
  let mergedData = { ...data, ...editedFields };

  // For reclassified documents with a known schema, restrict output to the
  // target schema's fields so old-schema extraction data doesn't leak through.
  const catOverride = document?.categoryOverride;
  if (catOverride && !catOverride.isCustom && catOverride.id && schemasMap) {
    const targetSchema = schemasMap[catOverride.id];
    if (targetSchema?.schema?.properties) {
      const allowedKeys = new Set(Object.keys(targetSchema.schema.properties));
      const filtered = {};
      for (const key of allowedKeys) {
        if (key in mergedData) {
          filtered[key] = mergedData[key];
        }
      }
      mergedData = filtered;
    }
  }

  return { data: mergedData, likelihoods, originalData: data, editedFields };
}

// ============================================================================
// HOLISTIC DATA QUALITY
// ============================================================================

/**
 * Quality tier for a single document, factoring in human review.
 *  - "verified"        : human-reviewed or has corrections → highest trust
 *  - "high"            : extractionConfidence >= 0.8, no review needed
 *  - "unscored"        : no confidence scores AND not flagged for review (neutral)
 *  - "needs_attention"  : flagged for review but not yet reviewed, OR low confidence
 *
 * @param {Object} doc - a document object
 * @returns {{ tier: string, label: string, weight: number, color: string }}
 */
export function getDocumentQualityTier(doc) {
  const isReviewed = doc?.status === "reviewed";
  const hasCorrected = doc?.editedFields && Object.keys(doc.editedFields).length > 0;
  const isFlaggedForReview = doc?.needsReview === true || doc?.status === "needs_review";
  const conf = doc?.extractionConfidence;
  const hasConfidence = conf !== null && conf !== undefined && typeof conf === "number";

  // 1. Human has actually reviewed or corrected → highest trust
  if (isReviewed || hasCorrected) {
    return { tier: "verified", label: "Verified", weight: 1.0, color: "green" };
  }
  // 2. Flagged for review but NOT yet reviewed → needs attention regardless of scores
  if (isFlaggedForReview) {
    return { tier: "needs_attention", label: "Needs Review", weight: 0.4, color: "amber" };
  }
  // 3. High extraction confidence, not flagged
  if (hasConfidence && conf >= 0.8) {
    return { tier: "high", label: "High Confidence", weight: 0.9, color: "green" };
  }
  // 4. Has confidence but it's low (wasn't flagged, but still below threshold)
  if (hasConfidence) {
    return { tier: "needs_attention", label: "Low Confidence", weight: 0.4, color: "amber" };
  }
  // 5. No confidence data and not flagged — scores may not be available for this doc type
  return { tier: "unscored", label: "Unscored", weight: 0.7, color: "gray" };
}

/**
 * Aggregate quality across a set of documents.
 * Returns a holistic score (0-100), per-tier counts, and a field-level accuracy stat.
 *
 * Field accuracy only counts fields where we have actual evidence:
 *  - human-corrected field → counts as accurate
 *  - likelihood >= 0.7     → counts as accurate
 *  - likelihood < 0.7      → counts as NOT accurate
 *  - no likelihood at all  → excluded from both numerator AND denominator (no data to judge)
 *
 * @param {Array<Object>} documents - array of document objects
 * @returns {{ score: number, verified: number, high: number, unscored: number, needsAttention: number, total: number, fieldAccuracy: number|null, totalFields: number, scoredFields: number, highFields: number }}
 */
export function aggregateDocumentQuality(documents, schemasMap) {
  let verified = 0, high = 0, unscored = 0, needsAttention = 0;
  let totalFields = 0;   // all extracted fields (for display context)
  let scoredFields = 0;  // fields with actual confidence data or human corrections
  let highFields = 0;    // fields that are high-confidence or human-corrected

  for (const doc of documents) {
    const { tier } = getDocumentQualityTier(doc);
    if (tier === "verified") verified++;
    else if (tier === "high") high++;
    else if (tier === "unscored") unscored++;
    else needsAttention++;

    // Field-level accuracy — only count fields where we have evidence
    const hasCorrected = doc?.editedFields && Object.keys(doc.editedFields).length > 0;
    const { data, likelihoods } = getMergedExtractionData(doc, schemasMap);
    if (data) {
      const fields = Object.keys(data).filter((k) => !k.startsWith("reasoning___") && !k.startsWith("source___"));
      totalFields += fields.length;
      for (const f of fields) {
        const wasHumanCorrected = hasCorrected && doc.editedFields?.[f] !== undefined;
        const l = likelihoods?.[f];
        const hasScore = l !== undefined && l !== null;

        if (wasHumanCorrected) {
          // Human corrected this field — counts as scored AND accurate
          scoredFields++;
          highFields++;
        } else if (hasScore) {
          // We have an AI confidence score — include in accuracy calculation
          scoredFields++;
          if (l >= 0.7) highFields++;
        }
        // else: no data at all — skip this field entirely (don't inflate accuracy)
      }
    }
  }

  const total = documents.length;
  const score = total > 0
    ? Math.round(((verified * 1.0 + high * 0.9 + unscored * 0.7 + needsAttention * 0.4) / total) * 100)
    : 0;
  // fieldAccuracy is null when we have zero scored fields (nothing to measure)
  const fieldAccuracy = scoredFields > 0 ? Math.round((highFields / scoredFields) * 100) : null;

  return { score, verified, high, unscored, needsAttention, total, fieldAccuracy, totalFields, scoredFields, highFields };
}
