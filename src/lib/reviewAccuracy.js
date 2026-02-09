/**
 * Review Accuracy Metrics
 *
 * Computes "Observed Model Agreement" by comparing the original extracted
 * values with the final (reviewer-corrected) values on documents that have
 * been through human review.
 *
 * This is NOT model confidence — it is actual agreement measured after a
 * human reviewer accepted, corrected, or marked fields as absent.
 */

import { getMergedExtractionData, NOT_IN_DOCUMENT_VALUE } from "./utils";
import { CRITICAL_FIELDS } from "./documentCategories";

// ============================================================================
// HELPERS
// ============================================================================

/** True when the value is effectively empty (null, undefined, "", empty array/obj). */
function isEmpty(v) {
  if (v == null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

/** True when the final value is the reviewer sentinel for "not in document". */
function isAbsent(v) {
  return v === NOT_IN_DOCUMENT_VALUE;
}

/** Normalise a value for loose comparison. */
function normalize(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") return v.trim().replace(/\s+/g, " ");
  // Arrays & objects — stable JSON string
  try {
    if (Array.isArray(v)) {
      return JSON.stringify(v.map(normalize));
    }
    if (typeof v === "object") {
      const sorted = {};
      for (const k of Object.keys(v).sort()) {
        sorted[k] = normalize(v[k]);
      }
      return JSON.stringify(sorted);
    }
  } catch {
    // fall through
  }
  return String(v).trim();
}

/** Loose equality after normalisation. */
function valuesEqual(a, b) {
  return normalize(a) === normalize(b);
}

// ============================================================================
// ELIGIBILITY & RECLASSIFICATION CHECKS
// ============================================================================

/**
 * A doc is eligible for accuracy evaluation if a reviewer has touched it:
 * either status is "reviewed" or it has at least one editedField.
 */
function isEligible(doc) {
  if (doc?.status === "reviewed") return true;
  if (doc?.editedFields && Object.keys(doc.editedFields).length > 0) return true;
  return false;
}

/**
 * Defensive check: true when the document was reclassified to a different type.
 * Guards every property access so callers never need to worry about shape.
 */
function isReclassified(doc) {
  const overrideId = doc?.categoryOverride?.id;
  const originalCat = doc?.classification?.category;
  if (!overrideId || !originalCat) return false;
  return overrideId !== originalCat;
}

/**
 * Resolve the effective document type (category) for a doc.
 * Uses the override when present (and not a custom schema), otherwise
 * falls back to the original classification.
 */
function resolveDocType(doc) {
  const override = doc?.categoryOverride;
  if (override && !override.isCustom && override.id) return override.id;
  return doc?.classification?.category || null;
}

// ============================================================================
// OUTCOME CLASSIFICATION
// ============================================================================

/** Outcome enum values. */
export const Outcome = Object.freeze({
  CORRECT: "correct",
  WRONG_VALUE: "wrong_value",
  MISS: "miss",
  HALLUCINATION: "hallucination",
  CORRECT_ABSENT: "correct_absent",
});

/**
 * Classify a single field.
 * @param {*} original - value from the raw extraction
 * @param {*} final_ - value from the merged (reviewer-corrected) data
 * @returns {string} One of the Outcome values
 */
function classifyField(original, final_) {
  if (isAbsent(final_)) {
    // Reviewer says "not in document"
    return !isEmpty(original) ? Outcome.HALLUCINATION : Outcome.CORRECT_ABSENT;
  }
  // Field is present in the final data
  if (isEmpty(original) && !isEmpty(final_)) return Outcome.MISS;
  if (valuesEqual(original, final_)) return Outcome.CORRECT;
  return Outcome.WRONG_VALUE;
}

// ============================================================================
// PER-DOCUMENT METRICS
// ============================================================================

function emptyCounts() {
  return {
    correct: 0,
    wrong_value: 0,
    miss: 0,
    hallucination: 0,
    correct_absent: 0,
  };
}

function computeRates(counts) {
  const presentDenom = counts.correct + counts.wrong_value + counts.miss;
  const absentDenom = counts.hallucination + counts.correct_absent;
  return {
    observed_present_accuracy: presentDenom > 0 ? counts.correct / presentDenom : null,
    observed_miss_rate: presentDenom > 0 ? counts.miss / presentDenom : null,
    observed_wrong_rate: presentDenom > 0 ? counts.wrong_value / presentDenom : null,
    observed_hallucination_rate: absentDenom > 0 ? counts.hallucination / absentDenom : null,
  };
}

/**
 * Compute reviewed accuracy for a single document.
 *
 * Iterates over the **schema fields** (not the final data keys) so that
 * fields the model missed entirely are still counted.
 *
 * @param {Object} doc - document object
 * @param {Object} [schemasMap] - schemas map (keys = category ids)
 * @returns {Object|null} metrics, or null if doc is not eligible / reclassified
 */
export function computeReviewedAccuracyMetrics(doc, schemasMap) {
  if (!isEligible(doc)) return null;
  if (isReclassified(doc)) return null;

  const docType = resolveDocType(doc);
  const { data: finalData, originalData } = getMergedExtractionData(doc, schemasMap);

  // Determine which fields to iterate: prefer schema fields
  const schemaProps = schemasMap?.[docType]?.schema?.properties;
  const fieldKeys = schemaProps
    ? Object.keys(schemaProps)
    : Object.keys(finalData || {});

  // Filter out meta-prefix fields
  const evaluableFields = fieldKeys.filter(
    (k) => !k.startsWith("reasoning___") && !k.startsWith("source___")
  );

  const allCounts = emptyCounts();
  const criticalSet = new Set(CRITICAL_FIELDS[docType] || []);
  const criticalCounts = emptyCounts();

  for (const field of evaluableFields) {
    const O = originalData?.[field];
    const F = finalData?.[field];

    // If both original and final are empty AND the field wasn't explicitly
    // edited, there is nothing to evaluate (schema field not extracted, not
    // reviewed).
    if (isEmpty(O) && (F === undefined || isEmpty(F))) continue;

    const outcome = classifyField(O, F);
    allCounts[outcome]++;
    if (criticalSet.has(field)) {
      criticalCounts[outcome]++;
    }
  }

  const evaluatedFieldCount =
    allCounts.correct +
    allCounts.wrong_value +
    allCounts.miss +
    allCounts.hallucination +
    allCounts.correct_absent;

  return {
    docType,
    counts: { ...allCounts },
    rates: computeRates(allCounts),
    criticalCounts: { ...criticalCounts },
    criticalRates: computeRates(criticalCounts),
    evaluatedFieldCount,
  };
}

// ============================================================================
// AGGREGATION
// ============================================================================

/**
 * Aggregate reviewed accuracy across many documents.
 *
 * @param {Array<Object>} docs - array of document objects
 * @param {Object} [schemasMap] - schemas map
 * @returns {Object} aggregated counts, rates, and meta-counts
 */
export function aggregateReviewedAccuracy(docs, schemasMap) {
  const totalCounts = emptyCounts();
  const totalCriticalCounts = emptyCounts();
  let reviewedDocCount = 0;
  let excludedReclassifiedCount = 0;
  let totalEvaluatedFields = 0;

  for (const doc of docs || []) {
    if (!isEligible(doc)) continue;
    if (isReclassified(doc)) {
      excludedReclassifiedCount++;
      continue;
    }

    const result = computeReviewedAccuracyMetrics(doc, schemasMap);
    if (!result) continue;

    reviewedDocCount++;
    totalEvaluatedFields += result.evaluatedFieldCount;
    for (const key of Object.keys(totalCounts)) {
      totalCounts[key] += result.counts[key];
      totalCriticalCounts[key] += result.criticalCounts[key];
    }
  }

  return {
    counts: totalCounts,
    rates: computeRates(totalCounts),
    criticalCounts: totalCriticalCounts,
    criticalRates: computeRates(totalCriticalCounts),
    reviewedDocCount,
    excludedReclassifiedCount,
    totalEvaluatedFields,
  };
}
