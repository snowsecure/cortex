# CORTEX: System Overview, Goals, and Data Quality — A Data Scientist's Guide

This document explains the CORTEX document-processing system, its goals, and the **data quality and extraction-accuracy scoring system** in enough detail for a data scientist to interpret metrics, understand limitations, and reason about how to get **accurate and timely scores** for extracted text from uploaded documents.

---

## 1. System overview and goals

### 1.1 What CORTEX does

CORTEX is a document-processing application for title insurance workflows. It:

1. **Ingests** multi-document PDF "packets" (e.g. a single closing package with deeds, mortgages, affidavits).
2. **Splits** each packet into subdocuments via the Retab API (document-boundary detection).
3. **Classifies** each subdocument into a category (e.g. `recorded_transfer_deed`, `deed_of_trust_mortgage`, `other_recorded`).
4. **Extracts** structured fields from each subdocument using category-specific JSON schemas, again via the Retab API.
5. **Flags** extractions that need human review (low confidence, missing critical fields, "other" type, or API `requires_human_review`).
6. **Stores** packets, documents, extraction data, confidence/review state, and human corrections in SQLite (and/or in-memory when using client-only flow).
7. **Exports** merged data (extraction + human corrections) in CSV, JSON, XML, and domain-specific formats (e.g. RamQuest, Qualia).

So the pipeline is: **Upload → Split → Classify → Extract → [Optional] Human Review → Export.**

### 1.2 High-level goals

- **Throughput**: Process many packets and documents with configurable concurrency and cost/quality presets.
- **Structured output**: Every document ends up with a consistent schema per category (e.g. grantor, grantee, recording_date, legal_description).
- **Quality assurance**: Low-confidence or high-risk extractions are flagged for human review; reviewed or corrected documents are treated as highest trust.
- **Auditability**: Sessions, packets, documents, review state, and history are persisted so you can trace what was extracted, whether it was reviewed, and what was corrected.
- **Actionable scores**: Provide **timely** signals (right after extraction and after review) about how "good" the extracted text is, so operators and downstream systems can prioritize review and trust exports.

The last goal is where the **data quality system** and **extraction-accuracy-related scores** live. The system provides two complementary metrics:

1. **Quality Score v2** — an operational trust score (0–100) computed for every document, whether or not it has been reviewed.
2. **Observed Model Agreement** — actual field-level accuracy measured by comparing original extraction to reviewer-corrected final values, available only for reviewed documents.

---

## 2. Architecture and data flow (where scores come from)

### 2.1 Components

- **Frontend (React)**: Upload UI, processing status, review queue, results view, export. State is held in `useBatchQueue`; processing is in `usePacketPipeline`. Quality metrics are computed in the client from the current set of documents via:
  - `src/lib/utils.js` — `getDocumentQualityTier`, `aggregateDocumentQuality` (v1 tier system, still available)
  - `src/lib/qualityV2.js` — `computeDocQualityV2`, `aggregateQualityV2` (v2 trust score)
  - `src/lib/reviewAccuracy.js` — `computeReviewedAccuracyMetrics`, `aggregateReviewedAccuracy` (observed accuracy)
- **Backend (Express)**: REST API for sessions, packets, documents, history; proxy to Retab API; SQLite for persistence. The server does **not** compute quality scores; it stores and returns document rows that include `extraction_confidence`, `likelihoods`, `needs_review`, `review_reasons`, `edited_fields`, etc.
- **Retab API**: External service that performs split, classification, and extraction. It returns **per-field likelihoods** (0–1 confidence) when **consensus** (multiple extractions per document) is requested; otherwise likelihoods are often omitted. The API can also set `requires_human_review` (e.g. OCR issues).

So: **scores are either computed in the frontend from document state, or are stored/retrieved from the DB.** There is no separate "accuracy service" that compares extractions to gold labels — but the review accuracy module now provides measured agreement between original extraction and reviewer-corrected values.

### 2.2 End-to-end pipeline (where each score is set)

```text
PDF packet
    → Split (Retab) → list of subdocuments (pages, split type)
    → For each subdocument:
          Classify (implicit from split type or explicit classify call)
          → Get schema for category
          → Extract (Retab) with schema, optional n_consensus > 1
          → API returns: { data: { field: value, ... }, likelihoods?: { field: number }, requires_human_review?: bool }
          → Pipeline sets:
                extractionConfidence = mean(likelihoods) if likelihoods present, else null
                needsReview, reviewReasons = checkNeedsReview(extraction, category)
                status = needs_review | completed | failed
    → Aggregate stats (completed, needsReview, failed)
    → [Later] Human reviews/corrects → status = reviewed, editedFields set
    → Quality Score v2 computed per-document (trust weight)
    → Observed accuracy computed for reviewed/edited docs (field-level agreement)
```

- **extractionConfidence**: Set in `usePacketPipeline.js` as the arithmetic mean of all per-field likelihood values returned by the API. If the API does not return likelihoods (e.g. single extraction, no consensus), `extractionConfidence` remains `null`.
- **needsReview / reviewReasons**: Set by `checkNeedsReview()` in `src/lib/documentCategories.js`, using:
  - Document type is `other_recorded` or `other` → flag.
  - `content.requires_human_review === true` → flag.
  - If likelihoods exist: average < `REVIEW_CONFIDENCE_THRESHOLD` (0.75) → flag; any field with likelihood < 0.5 → flag (listed in reasons).
  - Missing **critical fields** (category-specific required fields, e.g. recording_date, grantor) → flag.
- **Human verification**: When a user completes review (seal), the document gets `status = "reviewed"` and optional `editedFields` (key-value of corrected or "not in document" fields). These are persisted and used in both scoring systems.

---

## 3. Data structures (what's stored and where)

### 3.1 Document object (in-memory and API)

A single **document** (one subdocument from a packet) typically has:

| Field | Type | Meaning |
|-------|------|--------|
| `id` | string | Unique document ID |
| `packetId` | string | Parent packet ID |
| `classification` | object | `category`, `confidence`, `splitType`, etc. |
| `categoryOverride` | object \| null | If reclassified: `{ id, name, isCustom }` |
| `extraction` | object | Raw API response: `data`, `likelihoods`, possibly `content.choices`, etc. |
| `extractionConfidence` | number \| null | Mean of per-field likelihoods if present; else `null` |
| `needsReview` | boolean | Set by `checkNeedsReview()` |
| `reviewReasons` | string[] | Human-readable reasons (e.g. "Verify these uncertain fields: grantor (45%)") |
| `status` | string | `pending` \| `processing` \| `completed` \| `needs_review` \| `reviewed` \| `failed` |
| `editedFields` | object | After review: field name → corrected value (or sentinel `"__NOT_IN_DOCUMENT__"`) |
| `error` | string \| null | If extraction failed, error message |

Extraction payload shape (from Retab) is normalized in `getExtractionData()` in `src/lib/utils.js`: it reads `data` from `content.data` or `content.choices[0].message.parsed`, and `likelihoods` from `content.likelihoods` or `content.choices[0].message.likelihoods` or top-level `extraction.likelihoods`.

### 3.2 Database (documents table)

Relevant columns for quality/accuracy:

- `extraction_data` (TEXT/JSON): Stored extraction payload (data + optionally likelihoods).
- `likelihoods` (TEXT/JSON): Per-field confidence; can be stored separately for querying.
- `extraction_confidence` (REAL): Document-level mean confidence.
- `needs_review` (INTEGER 0/1).
- `review_reasons` (TEXT/JSON): Array of reason strings.
- `edited_fields` (TEXT/JSON): Post-review corrections.
- `status`, `reviewed_at`, `reviewed_by`.

---

## 4. Data quality systems (detailed)

CORTEX has two generations of quality scoring. Both are active in the codebase:

| System | Module | Primary metric | Input needed |
|--------|--------|---------------|-------------|
| **v1 (tier-based)** | `src/lib/utils.js` | 0–100 weighted tier average | extractionConfidence, needsReview, editedFields |
| **v2 (trust-based)** | `src/lib/qualityV2.js` | 0–100 continuous trust score | Above + schema field count, critical fields, confidence coverage |
| **Observed accuracy** | `src/lib/reviewAccuracy.js` | Per-field agreement rates | Reviewed or edited docs + schema fields |

The **v2 score** is now the primary metric shown in the AdminDashboard and ExportPage. The v1 system remains available for backward compatibility.

### 4.1 Definitions (important for data scientists)

- **Likelihood (per field)**: A number in [0, 1] returned by the Retab API for that field. It is a **model confidence** (self-assessment), not a validated accuracy. Typically present when `n_consensus > 1`; often absent when `n_consensus === 1`.
- **extractionConfidence (document-level)**: `mean(likelihoods)` over all fields that have a numeric likelihood. If there are no likelihoods, this is `null` (we do not infer a number).
- **needsReview**: Boolean from `checkNeedsReview()`: heuristic based on document type, missing critical fields, average/low likelihoods, and `requires_human_review`. Not a gold label.
- **Verified/reviewed**: Human has either marked the document as reviewed (`status === "reviewed"`) or changed at least one field (`editedFields` non-empty). We treat verified as highest trust.
- **NOT_IN_DOCUMENT_VALUE**: The sentinel `"__NOT_IN_DOCUMENT__"` stored in `editedFields` when a reviewer explicitly marks a field as not present in the document. Treated as **resolved** (not missing) for quality scoring purposes.
- **Reclassified**: A document where `categoryOverride.id` differs from `classification.category`. Reclassified documents are excluded from observed accuracy (counted separately) because the schema changed — original extraction fields don't align with the new schema.

### 4.2 Quality Score v1 — tier-based (legacy, still available)

Each document is assigned **exactly one** tier by `getDocumentQualityTier(doc)`:

| Priority | Tier | Condition | Weight |
|----------|------|-----------|--------|
| 1 | **verified** | `status === "reviewed"` OR `editedFields` has any key | 1.0 |
| 2 | **needs_attention** | `needsReview === true` or `status === "needs_review"` (and not verified) | 0.4 |
| 3 | **high** | `extractionConfidence !== null` and `>= 0.8` and not flagged | 0.9 |
| 4 | **needs_attention** | `extractionConfidence` present and `< 0.8` (and not already flagged) | 0.4 |
| 5 | **unscored** | No `extractionConfidence` and not flagged | 0.7 |

Aggregate: `score = round(mean(tier weights)) * 100`.

Code: `getDocumentQualityTier(doc)` and `aggregateDocumentQuality(documents, schemasMap)` in `src/lib/utils.js`.

### 4.3 Quality Score v2 — continuous trust (primary)

Quality Score v2 replaces the discrete tier weights with a continuous per-document trust value (0–1) that factors in three signals:

**A) Confidence coverage** — what fraction of the *schema* fields have a numeric likelihood score.

```text
confidenceCoverage = min(1, numericLikelihoodCount / schemaFieldCount)
```

The denominator is the **schema's** field count for the document type, not the number of fields in the merged data. This prevents inflated coverage when the model only extracts a subset.

**B) Critical completeness** — how many critical fields are resolved (non-empty or explicitly marked NOT_IN_DOCUMENT).

```text
criticalCompleteness = 1 - criticalMissingCount / max(1, criticalFieldCount)
```

Critical fields are defined per document type in `CRITICAL_FIELDS` in `src/lib/documentCategories.js`.

**C) Per-document trust computation:**

| Condition | Trust |
|-----------|-------|
| `status === "reviewed"` | `1.0` (fully trusted) |
| Unreviewed, has confidence | `(0.35 + 0.65 × conf) × (0.70 + 0.30 × coverage) × (0.60 + 0.40 × completeness)` |
| Unreviewed, no confidence | `0.60 × (0.70 + 0.30 × coverage) × (0.60 + 0.40 × completeness)` |
| If `needsReview` or `status === "needs_review"` | trust capped at `0.55` |

Per-document score: `docQualityV2 = round(trust × 100)`

Aggregate: `qualityScoreV2 = round(mean(docQualityV2))`

**What the v2 score tells you**: It is an operational trust index. A score of 85 means "on average, documents have high confidence coverage, complete critical fields, and/or have been reviewed." It still does **not** measure accuracy vs. ground truth — but it is a better proxy than v1 because it accounts for confidence coverage and critical field completeness rather than just bucketing into four tiers.

**Aggregation also returns:**

- `avgConfidenceCoverage` — mean fraction of schema fields with likelihood scores.
- `avgCriticalCompleteness` — mean fraction of critical fields resolved.
- Counts: `reviewed`, `needsReview`, `unscored`, `total`.

Code: `computeDocQualityV2(doc, schemasMap)` and `aggregateQualityV2(docs, schemasMap)` in `src/lib/qualityV2.js`.

### 4.4 Observed Model Agreement (review accuracy)

This is the first metric in CORTEX that measures **actual field-level accuracy** — by comparing the model's original extraction with the reviewer-corrected final values.

**Important**: This is **not** accuracy vs. external gold labels. It is agreement between the model's original output and the human reviewer's corrections. The reviewer may be wrong, may skip fields, or may accept incorrect values. But it is a much stronger signal than model confidence alone.

#### Eligibility

A document is evaluated if:

- `status === "reviewed"`, OR
- `editedFields` has at least one key (reviewer touched it, even if not fully sealed).

Documents that were **reclassified** (`categoryOverride.id` differs from `classification.category`) are excluded because the schema changed and field comparison is not meaningful. They are counted as `excludedReclassifiedCount`.

#### Field iteration

The module iterates over the **schema's property keys** for the document type, not over the keys in the final merged data. This ensures:

- Fields the model missed entirely (and the reviewer added) are counted as MISS.
- Fields not in the schema are never evaluated.
- Meta-prefix fields (`reasoning___`, `source___`) are filtered out.

#### Outcome classification

For each schema field, let `O` = original extracted value and `F` = final merged value:

| Condition | Outcome | Meaning |
|-----------|---------|---------|
| `F` is NOT_IN_DOCUMENT and `O` is non-empty | **HALLUCINATION** | Model produced a value but reviewer says field is absent |
| `F` is NOT_IN_DOCUMENT and `O` is empty | **CORRECT_ABSENT** | Model correctly left field blank; reviewer confirms absent |
| `F` is present, `O` is empty, `F` is non-empty | **MISS** | Model missed a present value; reviewer filled it in |
| `F` is present, `valuesEqual(O, F)` | **CORRECT** | Model and reviewer agree |
| `F` is present, not equal | **WRONG_VALUE** | Model extracted something but reviewer corrected it |

If both `O` and `F` are empty/undefined and the field wasn't explicitly edited, the field is skipped (nothing to evaluate).

#### Value comparison

- `normalize(v)`: trims strings, collapses whitespace, stringifies numbers, stable-sorts object keys.
- `valuesEqual(a, b)`: `normalize(a) === normalize(b)`.

#### Rates

```text
present_denom      = CORRECT + WRONG_VALUE + MISS
observed_present_accuracy = CORRECT / present_denom    (null if denom = 0)
observed_miss_rate        = MISS / present_denom       (null if denom = 0)
observed_wrong_rate       = WRONG_VALUE / present_denom (null if denom = 0)

absent_denom               = HALLUCINATION + CORRECT_ABSENT
observed_hallucination_rate = HALLUCINATION / absent_denom (null if denom = 0)
```

These rates are also computed restricted to **critical fields** only (`CRITICAL_FIELDS[docType]`).

#### Aggregation

`aggregateReviewedAccuracy(docs, schemasMap)` returns:

- `counts` — total CORRECT, WRONG_VALUE, MISS, HALLUCINATION, CORRECT_ABSENT across all eligible docs.
- `rates` — global rates computed from total counts.
- `criticalCounts` / `criticalRates` — same but restricted to critical fields.
- `reviewedDocCount` — number of docs that were evaluated.
- `excludedReclassifiedCount` — number of eligible docs excluded due to reclassification.
- `totalEvaluatedFields` — total fields evaluated.

Code: `computeReviewedAccuracyMetrics(doc, schemasMap)` and `aggregateReviewedAccuracy(docs, schemasMap)` in `src/lib/reviewAccuracy.js`.

### 4.5 When are likelihoods present?

- **Retab with consensus** (`n_consensus > 1`): The API typically returns per-field likelihoods (often derived from agreement or model confidence). Then `extractionConfidence` is non-null and confidence coverage is meaningful.
- **Single extraction** (`n_consensus === 1`): Likelihoods are often **not** returned. Then `extractionConfidence` is `null`, confidence coverage is 0, and the v2 trust base drops to 0.60 (from potentially up to 1.0 with high confidence).

So for **timely and fine-grained scores**, enabling **consensus** (e.g. Production or Best preset) is necessary. Otherwise you get document-level flags (needs_review) but limited confidence signal in the v2 score.

### 4.6 Schema-aware field counting

Both v2 quality and observed accuracy use the document's schema to determine which fields exist. The schema is resolved via:

1. `schemasMap[docType]?.schema?.properties` — gives the set of field names for the document type.
2. `docType` is resolved as `categoryOverride.id` (if not custom) or `classification.category`.
3. `schemasMap` is the `schemas` object exported from `src/schemas/index.js`.

This means:
- Confidence coverage denominator = number of schema properties (not extracted fields).
- Observed accuracy iterates schema properties (not merged data keys).
- Reclassified documents with a known schema have their merged data restricted to the target schema's fields (handled by `getMergedExtractionData(doc, schemasMap)` in `src/lib/utils.js`).

---

## 5. Getting accurate and timely scores for extracted text

### 5.1 What "accurate" and "timely" mean here

- **Timely**: Quality Score v2 is available **right after extraction** (uses extractionConfidence, critical fields, and confidence coverage). Observed accuracy becomes available **after review**. No nightly batch; all aggregation is on the current set of documents.
- **Accurate**: The system now provides two levels of accuracy signal:
  1. **Quality Score v2** (operational trust): A proxy for "how trustworthy is this extraction" based on model confidence, coverage, and completeness. Not validated against labels but more nuanced than v1.
  2. **Observed Model Agreement** (review accuracy): Actual field-level agreement between original extraction and reviewer corrections. Available only for reviewed/edited docs. This is the closest to "real accuracy" the system provides — but the reviewer is the reference, not an external gold standard.

### 5.2 Where to read the scores (code and API)

- **In-memory (frontend)**:
  - Per-document v2: `computeDocQualityV2(doc, schemasMap)` → `{ trust, score, confidenceCoverage, criticalCompleteness, isReviewed, isNeedsReview, isUnscored }`.
  - Aggregate v2: `aggregateQualityV2(docs, schemasMap)` → `{ qualityScoreV2, avgConfidenceCoverage, avgCriticalCompleteness, reviewed, needsReview, unscored, total }`.
  - Per-document accuracy: `computeReviewedAccuracyMetrics(doc, schemasMap)` → `{ counts, rates, criticalCounts, criticalRates, evaluatedFieldCount }` or `null` if not eligible.
  - Aggregate accuracy: `aggregateReviewedAccuracy(docs, schemasMap)` → `{ counts, rates, criticalCounts, criticalRates, reviewedDocCount, excludedReclassifiedCount, totalEvaluatedFields }`.
  - Legacy v1: `getDocumentQualityTier(doc)` and `aggregateDocumentQuality(docs, schemasMap)` still available.
- **From API/DB**: Document rows include `extraction_confidence`, `needs_review`, `review_reasons`, `edited_fields`, `likelihoods`, `extraction_data`. You can recompute v2 quality and review accuracy in a script using the same module logic.
- **Export**: Export payloads can include confidence, needs_review, and review status so downstream analytics can compute their own metrics.

### 5.3 Where metrics appear in the UI

| Location | What's shown |
|----------|-------------|
| **AdminDashboard → Overview** | Quality Score v2 (primary), observed accuracy subtitle if reviewed docs exist |
| **AdminDashboard → Confidence** | Quality Score v2 + observed accuracy, confidence distribution, field analysis |
| **AdminDashboard → Reviews** | Quality Score v2 + observed accuracy, awaiting review count |
| **ExportPage → Summary panel** | Quality Score v2 bar, reviewed/unscored/needs-review counts, observed accuracy if available |

Observed accuracy is **only shown when at least one document has been reviewed or edited**. When no docs are eligible, the UI falls back to showing the v1 field-level accuracy (if consensus was used) or a "no data" message.

### 5.4 Recommendations for "accurate and timely" use

1. **Enable consensus** where you need numeric confidence and field-level stats (e.g. Production or Best preset). This gives the v2 score meaningful confidence coverage and more accurate trust values.
2. **Review documents** to unlock observed accuracy. Even partial review (editing some fields without fully sealing) contributes — the system evaluates any doc with `editedFields`.
3. **Treat Quality Score v2 as a trust index**, not as accuracy vs. labels. It is "how confident are we in this corpus" factoring in model confidence, coverage, completeness, and review status.
4. **Treat observed accuracy as reviewer agreement**, not ground truth accuracy. It tells you "of the fields the model extracted, how often did the reviewer leave them unchanged?" This is useful for:
   - Tracking model quality over time (does accuracy improve with schema changes?).
   - Identifying problematic document types (which categories have high MISS or HALLUCINATION rates?).
   - Estimating the value of review (how many fields actually get corrected?).
5. **For true accuracy measurement**: Build a labeled eval set and a small pipeline that compares export (or DB) extractions to gold; keep CORTEX's scores for operational use and use your eval for model/preset selection and SLA reporting.
6. **Timeliness**: No change needed; scores are already computed on the current document set. If you need metrics over historical data, query the DB and run the same aggregation over the document rows you care about.

---

## 6. Summary

- **System**: CORTEX splits packets, classifies and extracts via Retab, flags low-confidence extractions for review, stores results and human corrections, and exports merged data. Quality metrics are computed client-side (or reproducible from DB) from document state.
- **Goals**: Throughput, structured output, review prioritization, auditability, and actionable quality scores.
- **Quality Score v2** (primary): Continuous 0–100 trust score per document, factoring in model confidence, confidence coverage (fraction of schema fields with likelihoods), and critical field completeness. Reviewed docs = 100. Aggregated as mean across documents.
- **Observed Model Agreement** (review accuracy): Field-level comparison of original extraction vs. reviewer-corrected values. Iterates schema fields to catch misses. Classifies each field as CORRECT, WRONG_VALUE, MISS, HALLUCINATION, or CORRECT_ABSENT. Available only for reviewed/edited documents. Reclassified documents excluded.
- **Legacy v1**: Tier-based system (verified/high/unscored/needs_attention with fixed weights 1.0/0.9/0.7/0.4) still available in `src/lib/utils.js`.
- **Key insight**: Quality Score v2 is available immediately (no review needed) and is a trust proxy. Observed accuracy requires review but provides actual agreement data. Together they give both **timely** and **accurate** signals about extraction quality.

Code references:
- `src/lib/qualityV2.js` — v2 trust score
- `src/lib/reviewAccuracy.js` — observed model agreement
- `src/lib/utils.js` — v1 tiers, `getMergedExtractionData`, `getExtractionData`, `NOT_IN_DOCUMENT_VALUE`
- `src/lib/documentCategories.js` — `checkNeedsReview`, `CRITICAL_FIELDS`, threshold
- `src/schemas/index.js` — schema definitions (field lists used as iteration basis)
- `src/hooks/usePacketPipeline.js` — extractionConfidence and needsReview assignment
