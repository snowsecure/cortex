/**
 * Quality Score v2 — Operational Trust
 *
 * Improves on the v1 tier-based score by incorporating:
 *   A) Confidence coverage — what fraction of schema fields have a likelihood
 *   B) Critical completeness — how many critical fields are resolved
 *
 * Per-document trust is a continuous 0-1 value (rendered as 0-100 score).
 * Reviewed documents are automatically trust = 1.0.
 */

import { getMergedExtractionData, NOT_IN_DOCUMENT_VALUE } from "./utils";
import { CRITICAL_FIELDS } from "./documentCategories";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolve the effective category for a document.
 * Prefers categoryOverride.id (unless custom), falls back to classification.
 */
function resolveDocType(doc) {
  const override = doc?.categoryOverride;
  if (override && !override.isCustom && override.id) return override.id;
  return doc?.classification?.category || null;
}

/** True when a value is effectively empty. NOT_IN_DOCUMENT_VALUE is NOT empty — it means the reviewer explicitly resolved the field. */
function isFieldEmpty(v) {
  if (v == null || v === "") return true;
  if (v === NOT_IN_DOCUMENT_VALUE) return false; // explicitly resolved
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

// ============================================================================
// PER-DOCUMENT QUALITY v2
// ============================================================================

/**
 * Compute Quality v2 trust weight and score for a single document.
 *
 * @param {Object} doc - document object
 * @param {Object} [schemasMap] - schemas map (keys = category ids)
 * @returns {{ trust: number, score: number, confidenceCoverage: number, criticalCompleteness: number, isReviewed: boolean, isNeedsReview: boolean, isUnscored: boolean }}
 */
export function computeDocQualityV2(doc, schemasMap) {
  const isReviewed = doc?.status === "reviewed";
  const isNeedsReview = doc?.needsReview === true || doc?.status === "needs_review";

  const docType = resolveDocType(doc);
  const { data: mergedData, likelihoods } = getMergedExtractionData(doc, schemasMap);

  // ---- Confidence coverage ----
  // Denominator = number of schema fields for this doc type (not merged-data fields)
  const schemaProps = schemasMap?.[docType]?.schema?.properties;
  const schemaFieldCount = schemaProps ? Object.keys(schemaProps).length : 0;

  const likelihoodValues = likelihoods
    ? Object.values(likelihoods).filter((v) => typeof v === "number")
    : [];
  const numericLikelihoodCount = likelihoodValues.length;

  const confidenceCoverage =
    schemaFieldCount > 0 ? Math.min(1, numericLikelihoodCount / schemaFieldCount) : 0;

  // ---- Critical completeness ----
  const criticalFields = CRITICAL_FIELDS[docType] || [];
  const criticalFieldCount = criticalFields.length;
  let criticalMissingCount = 0;
  for (const field of criticalFields) {
    const val = mergedData?.[field];
    if (isFieldEmpty(val)) {
      criticalMissingCount++;
    }
  }
  const criticalCompleteness =
    criticalFieldCount > 0 ? 1 - criticalMissingCount / criticalFieldCount : 1;

  // ---- Extraction confidence ----
  const conf = doc?.extractionConfidence;
  const hasConf = conf !== null && conf !== undefined && typeof conf === "number";

  // ---- Trust computation ----
  let trust;

  if (isReviewed) {
    trust = 1.0;
  } else {
    const base = hasConf ? 0.35 + 0.65 * conf : 0.60;
    const coverageFactor = 0.70 + 0.30 * confidenceCoverage;
    const completenessFactor =
      0.60 + 0.40 * (1 - criticalMissingCount / Math.max(1, criticalFieldCount));
    trust = base * coverageFactor * completenessFactor;

    // Cap trust for needs-review docs to preserve routing semantics
    if (isNeedsReview && trust > 0.55) {
      trust = 0.55;
    }
  }

  const score = Math.round(trust * 100);

  return {
    trust,
    score,
    confidenceCoverage,
    criticalCompleteness,
    isReviewed,
    isNeedsReview,
    isUnscored: !hasConf && !isReviewed,
  };
}

// ============================================================================
// AGGREGATION
// ============================================================================

/**
 * Aggregate Quality v2 across a set of documents.
 *
 * @param {Array<Object>} docs - array of document objects
 * @param {Object} [schemasMap] - schemas map
 * @returns {{ qualityScoreV2: number, qualityScoreV2ScoredOnly: number | null, scoredCount: number, avgConfidenceCoverage: number, avgCriticalCompleteness: number, reviewed: number, needsReview: number, unscored: number, total: number }}
 */
export function aggregateQualityV2(docs, schemasMap) {
  let sumScore = 0;
  let sumScoreScoredOnly = 0;
  let scoredCount = 0;
  let sumCoverage = 0;
  let sumCompleteness = 0;
  let reviewed = 0;
  let needsReview = 0;
  let unscored = 0;
  const total = (docs || []).length;

  for (const doc of docs || []) {
    const result = computeDocQualityV2(doc, schemasMap);
    sumScore += result.score;
    sumCoverage += result.confidenceCoverage;
    sumCompleteness += result.criticalCompleteness;
    if (result.isReviewed) reviewed++;
    else if (result.isNeedsReview) needsReview++;
    if (result.isUnscored) {
      unscored++;
    } else {
      scoredCount++;
      sumScoreScoredOnly += result.score;
    }
  }

  return {
    qualityScoreV2: total > 0 ? Math.round(sumScore / total) : 0,
    qualityScoreV2ScoredOnly: scoredCount > 0 ? Math.round(sumScoreScoredOnly / scoredCount) : null,
    scoredCount,
    avgConfidenceCoverage: total > 0 ? sumCoverage / total : 0,
    avgCriticalCompleteness: total > 0 ? sumCompleteness / total : 0,
    reviewed,
    needsReview,
    unscored,
    total,
  };
}
