/**
 * Server-Side Document Processing Pipeline
 *
 * Port of src/hooks/usePacketPipeline.js `processPacket` to run on the
 * Express server. Key differences from the client-side version:
 *   - Calls the Retab API directly (no proxy hop)
 *   - Saves results to SQLite incrementally (split data, each document)
 *   - Emits events via an EventEmitter so SSE endpoints can relay them
 *   - Accepts an AbortSignal for cancellation
 */

import { EventEmitter } from "node:events";
import {
  SUBDOCUMENT_TYPES,
  SPLIT_TO_CATEGORY_MAP,
  getSchemaForCategory,
  checkNeedsReview,
  getCategoryDisplayName,
} from "../src/lib/documentCategories.js";
import {
  RETAB_MODELS,
  DEFAULT_CONFIG,
  getModelForCategory,
  getConsensusForCategory,
} from "../src/lib/retabConfig.js";
import {
  annotateWithSourceQuotes,
  annotateWithReasoningPrompts,
  getArrayFieldKeys,
  schemaFingerprint,
} from "../src/schemas/index.js";
import * as db from "../db/database.js";

const RETAB_API_BASE = "https://api.retab.com/v1";

// ============================================================================
// GLOBAL RETAB API THROTTLE — limit concurrent outbound API calls
// ============================================================================
// Retab rate-limits aggressive concurrency. With multiple packets processing
// simultaneously (each spawning split + extraction calls), we easily exceed
// their threshold. This semaphore caps ALL outbound Retab requests (splits +
// extractions) to avoid 429 "Too many requests" failures.

const MAX_CONCURRENT_API_CALLS = 3;
let activeApiCalls = 0;
const apiWaiters = [];

async function acquireApiSlot() {
  if (activeApiCalls < MAX_CONCURRENT_API_CALLS) {
    activeApiCalls++;
    return;
  }
  await new Promise(resolve => apiWaiters.push(resolve));
  activeApiCalls++;
}

function releaseApiSlot() {
  activeApiCalls = Math.max(0, activeApiCalls - 1);
  if (apiWaiters.length > 0) {
    const next = apiWaiters.shift();
    next();
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function generateDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract data/likelihoods from a Retab API extraction response.
 * Mirrors src/lib/utils.js getExtractionData (cannot import — depends on clsx/tailwind).
 */
function getExtractionData(extraction) {
  if (!extraction) return { data: {}, likelihoods: {} };
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

function mapSplitTypeToCategory(splitType) {
  if (!splitType) return "other_recorded";
  const normalized = splitType.toLowerCase().replace(/-/g, "_");
  return SPLIT_TO_CATEGORY_MAP[normalized] || "other_recorded";
}

function getExtractionBatchSize(concurrency = 5) {
  return Math.max(3, Math.min(concurrency, 10));
}

/**
 * Fetch with retry + exponential backoff, used for Retab API calls.
 * 429 (rate limit) gets a longer, more patient backoff (5s base, up to 60s).
 */
async function fetchWithRetry(url, options, { maxRetries = 4, baseDelay = 1000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const attemptOptions = { ...options };
      // Create a fresh timeout signal per attempt (old ones may already be aborted)
      if (options?.signal?.aborted && attempt > 0) {
        attemptOptions.signal = AbortSignal.timeout(600000);
      }
      const response = await fetch(url, attemptOptions);
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }
      if (attempt < maxRetries) {
        let delay;
        if (response.status === 429) {
          // Patient backoff for rate limits: honor Retry-After or use 5s base doubling
          const retryAfter = response.headers.get("retry-after");
          delay = retryAfter
            ? Math.min(parseInt(retryAfter, 10) * 1000, 60000)
            : Math.min(5000 * Math.pow(2, attempt), 60000);
          console.warn(`[Pipeline] Rate limited by Retab API, backing off ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries + 1})`);
        } else {
          delay = baseDelay * Math.pow(2, attempt);
          console.warn(`[Pipeline] Retab API ${response.status}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        }
        delay += Math.random() * delay * 0.25; // jitter
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * baseDelay * 0.25;
        console.warn(`[Pipeline] Network error attempt ${attempt + 1}: ${error.message}, retrying in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}

// ============================================================================
// DIRECT RETAB API CALLS (no proxy)
// ============================================================================

async function retabSplitDocument({ base64, filename, subdocuments, model, imageDpi, apiKey, signal }) {
  const body = {
    document: { filename, url: base64 },
    subdocuments,
    model,
    image_resolution_dpi: imageDpi,
  };

  const response = await fetchWithRetry(`${RETAB_API_BASE}/documents/split`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Key": apiKey },
    body: JSON.stringify(body),
    signal: signal || undefined,
  }, { maxRetries: 3, baseDelay: 2000 });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || errData.message || `Split API error: ${response.status}`);
  }
  return response.json();
}

async function retabExtractDocument({ base64, filename, jsonSchema, model, nConsensus, imageDpi, temperature, chunkingKeys, apiKey, signal }) {
  const t = Number(temperature);
  const needNonZeroTemp = nConsensus > 1 && (t === 0 || Number.isNaN(t) || t < 0.01);
  const effectiveTemperature = needNonZeroTemp ? 0.1 : (typeof temperature === "number" ? temperature : (Number.isNaN(t) ? 0 : t));

  const requestBody = {
    document: { filename, url: base64 },
    model,
    json_schema: jsonSchema,
    temperature: effectiveTemperature,
    image_resolution_dpi: imageDpi,
  };
  if (nConsensus > 1) requestBody.n_consensus = nConsensus;
  if (chunkingKeys?.length) requestBody.chunking_keys = chunkingKeys;

  const response = await fetchWithRetry(`${RETAB_API_BASE}/documents/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Key": apiKey },
    body: JSON.stringify(requestBody),
    signal: signal || undefined,
  });

  const text = await response.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("<") || trimmed.toLowerCase().startsWith("<!doctype")) {
    throw new Error("Server returned HTML instead of JSON. The extraction service may be unavailable.");
  }
  let data;
  try { data = JSON.parse(trimmed); } catch (e) {
    throw new Error(response.ok
      ? "Server returned invalid JSON."
      : `API error: ${response.status}. Invalid response.`);
  }
  if (!response.ok) {
    throw new Error(data.detail || data.error || data.message || `Extract API error: ${response.status}`);
  }
  return data;
}

// ============================================================================
// PIPELINE STATUS
// ============================================================================

export const PipelineStatus = {
  IDLE: "idle",
  SPLITTING: "splitting",
  CLASSIFYING: "classifying",
  EXTRACTING: "extracting",
  COMPLETED: "completed",
  FAILED: "failed",
};

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * Process a single packet through the full server-side pipeline.
 *
 * @param {Object}       packet          - Packet row from DB (must include id, filename, session_id)
 * @param {string}       base64          - PDF data URL (data:application/pdf;base64,...)
 * @param {string}       apiKey          - Retab API key
 * @param {Object}       userConfig      - Processing config from client
 * @param {AbortSignal}  signal          - For cancellation
 * @param {EventEmitter} emitter         - Emits SSE-ready events
 * @returns {Object} Result object (same shape as client-side processPacket)
 */
export async function processPacket(packet, base64, apiKey, userConfig = {}, signal = null, emitter = new EventEmitter()) {
  const config = {
    model: userConfig.model || DEFAULT_CONFIG.model,
    nConsensus: userConfig.nConsensus || DEFAULT_CONFIG.nConsensus,
    imageDpi: userConfig.imageDpi || DEFAULT_CONFIG.imageDpi,
    temperature: userConfig.temperature || DEFAULT_CONFIG.temperature,
    chunkingKeys: userConfig.chunkingKeys || false,
    sourceQuotes: userConfig.sourceQuotes || false,
    reasoningPrompts: userConfig.reasoningPrompts || false,
    costOptimize: userConfig.costOptimize ?? DEFAULT_CONFIG.costOptimize,
    concurrency: userConfig.concurrency ?? DEFAULT_CONFIG.concurrency ?? 5,
  };

  const microModelInfo = RETAB_MODELS["retab-micro"];

  const result = {
    packetId: packet.id,
    filename: packet.filename,
    documents: [],
    errors: [],
    stats: { totalDocuments: 0, completed: 0, needsReview: 0, failed: 0 },
    usage: { totalPages: 0, totalCredits: 0, totalCost: 0, splitCredits: 0, extractCredits: 0, apiCalls: 0 },
  };

  // Helper: emit and save pipeline_stage to DB
  const setStage = (stage, progress) => {
    db.updatePacket(packet.id, { pipeline_stage: stage });
    emitter.emit("status", { packetId: packet.id, stage, progress });
  };

  try {
    if (!base64) throw new Error("Document data not available. The file needs to be re-uploaded.");

    // ── Step 1: Split ──
    let splits;
    const existingSplitData = packet.split_data ? JSON.parse(packet.split_data) : null;

    if (existingSplitData && existingSplitData.length > 0) {
      // Resume: skip splitting, re-use persisted splits
      console.log(`[Pipeline] Resuming packet ${packet.id} with ${existingSplitData.length} existing splits`);
      splits = existingSplitData;
    } else {
      // Acquire a global API slot before splitting — concurrent API calls
      // overwhelm the Retab API. Don't emit SPLITTING until we actually own
      // the slot; otherwise every queued packet shows "Splitting..." while waiting.
      await acquireApiSlot();
      setStage(PipelineStatus.SPLITTING);
      try {
        const splitModel = config.costOptimize ? "retab-micro" : config.model;
        const splitDpi = config.costOptimize ? Math.min(config.imageDpi, 150) : config.imageDpi;

        const splitResponse = await retabSplitDocument({
          base64, filename: packet.filename, subdocuments: SUBDOCUMENT_TYPES,
          model: splitModel, imageDpi: splitDpi, apiKey, signal,
        });

        splits = splitResponse.splits || [];
        const splitModelInfo = RETAB_MODELS[splitModel] || microModelInfo;
        const apiPageCount = splitResponse.usage?.page_count || 0;
        const docPageCount = new Set(splits.flatMap(s => s.pages || [])).size || splits.reduce((a, s) => a + (s.pages?.length || 1), 0);
        const splitPages = apiPageCount || docPageCount;
        result.usage.splitCredits = splitPages * splitModelInfo.creditsPerPage;
        result.usage.totalPages = splitPages;
        result.usage.documentPages = docPageCount;
        result.usage.apiCalls++;

        splits = splits.filter(s => s.pages && s.pages.length > 0);
        if (splits.length === 0) splits = [{ name: "other", pages: null }];
      } catch (splitError) {
        if (splitError.name === "AbortError" || splitError.message === "Extraction aborted" || signal?.aborted) {
          throw new Error("Processing aborted");
        }
        console.warn("[Pipeline] Split failed, treating as single document:", splitError.message);
        splits = [{ name: "other", pages: null }];
      } finally {
        releaseApiSlot();
      }

      // Persist split results to DB so resume can skip this step
      db.updatePacket(packet.id, { split_data: JSON.stringify(splits) });
    }

    result.stats.totalDocuments = splits.length;

    // ── Step 2: Detect documents ──
    const docIds = splits.map(() => generateDocId());
    const pendingDocs = splits.map((split, index) => {
      const category = mapSplitTypeToCategory(split.name);
      return {
        id: docIds[index],
        packetId: packet.id,
        splitIndex: index,
        splitType: split.name,
        pages: split.pages,
        classification: { category, confidence: 0.9, reasoning: `Detected as ${split.name} during packet splitting`, splitType: split.name },
        extraction: null,
        status: "pending",
        needsReview: false,
        reviewReasons: [],
        error: null,
        extractionConfidence: undefined,
      };
    });

    // Persist all pending documents to DB (so resume knows about them)
    for (const doc of pendingDocs) {
      db.upsertDocument({
        id: doc.id,
        packet_id: packet.id,
        session_id: packet.session_id,
        document_type: doc.classification?.category || doc.splitType,
        display_name: getCategoryDisplayName(doc.classification?.category) || doc.splitType,
        status: "pending",
        pages: doc.pages,
        extraction_data: {},
        likelihoods: {},
        extraction_confidence: null,
        needs_review: false,
        review_reasons: [],
        credits_used: 0,
      });
    }

    db.updatePacket(packet.id, { total_documents: splits.length });
    emitter.emit("documents_detected", { packetId: packet.id, documents: pendingDocs });

    // ── Step 3: Check which documents are already extracted (resume case) ──
    const existingDocs = db.getDocumentsByPacket(packet.id);
    const completedDocIds = new Set();
    for (const d of existingDocs) {
      if (d.status === "completed" || d.status === "needs_review") {
        completedDocIds.add(d.id);
      }
    }

    setStage(PipelineStatus.EXTRACTING, { docIndex: completedDocIds.size, total: splits.length });
    if (signal?.aborted) throw new Error("Processing aborted");

    // ── Step 4: Extract remaining documents in parallel batches ──
    const extractSingleDoc = async (split, index) => {
      const docId = docIds[index];

      // Skip already-completed documents (resume path)
      if (completedDocIds.has(docId)) {
        const existing = existingDocs.find(d => d.id === docId);
        return {
          id: docId, packetId: packet.id, splitIndex: index, splitType: split.name, pages: split.pages,
          classification: { category: existing?.document_type || mapSplitTypeToCategory(split.name), confidence: 0.9, splitType: split.name },
          extraction: existing?.extraction_data ? { data: existing.extraction_data, likelihoods: existing.likelihoods } : null,
          status: existing?.status || "completed",
          needsReview: existing?.needs_review || false,
          reviewReasons: existing?.review_reasons || [],
          error: null,
          extractionConfidence: existing?.extraction_confidence || null,
          usage: { pages: split.pages?.length || 1, credits: existing?.credits_used || 0 },
          skipped: true,
        };
      }

      const category = mapSplitTypeToCategory(split.name);
      const docModel = getModelForCategory(category, config.model, config.costOptimize);
      const docConsensus = getConsensusForCategory(category, config.nConsensus, config.costOptimize);
      const docModelInfo = RETAB_MODELS[docModel] || RETAB_MODELS["retab-small"];

      const documentResult = {
        id: docId, packetId: packet.id, splitIndex: index, splitType: split.name, pages: split.pages,
        classification: { category, confidence: 0.9, reasoning: `Detected as ${split.name} during packet splitting`, splitType: split.name },
        extraction: null, status: "processing", needsReview: false, reviewReasons: [], error: null,
        extractionConfidence: undefined, startedAt: new Date().toISOString(), completedAt: null,
      };

      try {
        let schema = getSchemaForCategory(category);
        if (!schema) throw new Error(`No schema found for category: ${category}`);
        if (config.sourceQuotes) schema = annotateWithSourceQuotes(schema);
        if (config.reasoningPrompts) schema = annotateWithReasoningPrompts(schema);
        const chunkingKeysArray = config.chunkingKeys ? getArrayFieldKeys(schema) : null;

        // Retry logic
        const DOC_MAX_RETRIES = 3;
        const DOC_RETRY_DELAYS = [2000, 4000, 8000];
        const RETRIABLE_PATTERNS = /fetch failed|network|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|429|50[0-9]|529/i;
        const RATE_LIMIT_PATTERN = /429/;

        let extractionResponse;
        for (let attempt = 0; attempt <= DOC_MAX_RETRIES; attempt++) {
          try {
            await acquireApiSlot();
            try {
              extractionResponse = await retabExtractDocument({
                base64, filename: packet.filename, jsonSchema: schema, model: docModel,
                nConsensus: docConsensus, imageDpi: config.imageDpi, temperature: config.temperature,
                chunkingKeys: chunkingKeysArray, apiKey, signal,
              });
            } finally {
              releaseApiSlot();
            }
            break;
          } catch (retryErr) {
            if (retryErr.name === "AbortError" || retryErr.message === "Extraction aborted" || signal?.aborted) throw retryErr;
            const isRetriable = RETRIABLE_PATTERNS.test(retryErr.message);
            const isRateLimited = RATE_LIMIT_PATTERN.test(retryErr.message);
            if (isRateLimited && attempt < DOC_MAX_RETRIES) {
              const d = 5000 * Math.pow(2, attempt);
              console.warn(`[Pipeline] Rate limited (429) doc ${index + 1}, retrying in ${d / 1000}s`);
              await new Promise(r => setTimeout(r, d));
              continue;
            } else if (isRetriable && attempt < DOC_MAX_RETRIES) {
              console.warn(`[Pipeline] Doc ${index + 1} attempt ${attempt + 1} failed (${retryErr.message}), retrying`);
              await new Promise(r => setTimeout(r, DOC_RETRY_DELAYS[attempt]));
              continue;
            }
            throw retryErr;
          }
        }

        documentResult.extraction = extractionResponse;
        documentResult.schemaFingerprint = schemaFingerprint(category) || null;

        const docPages = split.pages?.length || 1;
        documentResult.usage = { pages: docPages, credits: docPages * docModelInfo.creditsPerPage * docConsensus, model: docModel, nConsensus: docConsensus };

        const { likelihoods } = getExtractionData(extractionResponse);
        const likelihoodValues = Object.values(likelihoods || {}).filter(v => typeof v === "number");
        documentResult.extractionConfidence = likelihoodValues.length > 0
          ? likelihoodValues.reduce((s, v) => s + v, 0) / likelihoodValues.length
          : null;

        const reviewCheck = checkNeedsReview(extractionResponse, category);
        documentResult.needsReview = reviewCheck.needsReview;
        documentResult.reviewReasons = reviewCheck.reasons;
        documentResult.status = reviewCheck.needsReview ? "needs_review" : "completed";
        documentResult.completedAt = new Date().toISOString();
      } catch (docError) {
        if (docError.name === "AbortError" || docError.message === "Extraction aborted" || signal?.aborted) throw docError;
        console.error(`[Pipeline] Error extracting doc ${index + 1}:`, docError.message);
        documentResult.status = "failed";
        documentResult.error = docError.message;
        documentResult.completedAt = new Date().toISOString();
      }

      // ── Incremental save to DB ──
      const { data: exData, likelihoods: exLikelihoods } = getExtractionData(documentResult.extraction);
      db.upsertDocument({
        id: docId,
        packet_id: packet.id,
        session_id: packet.session_id,
        document_type: documentResult.classification?.category || documentResult.splitType,
        display_name: getCategoryDisplayName(documentResult.classification?.category) || documentResult.splitType,
        status: documentResult.status,
        pages: documentResult.pages,
        extraction_data: exData,
        likelihoods: exLikelihoods,
        extraction_confidence: documentResult.extractionConfidence ?? null,
        needs_review: documentResult.needsReview,
        review_reasons: documentResult.reviewReasons,
        credits_used: documentResult.usage?.credits || 0,
      });

      return documentResult;
    };

    // Parallel batch extraction
    const batchSize = getExtractionBatchSize(config.concurrency);
    let processedCount = completedDocIds.size;

    for (let i = 0; i < splits.length; i += batchSize) {
      const batch = splits.slice(i, i + batchSize);
      const batchPromises = batch.map((split, bi) => extractSingleDoc(split, i + bi));
      const batchSettled = await Promise.allSettled(batchPromises);

      for (const outcome of batchSettled) {
        let docResult;
        if (outcome.status === "fulfilled") {
          docResult = outcome.value;
        } else {
          const err = outcome.reason;
          if (err?.name === "AbortError" || err?.message === "Processing aborted" || signal?.aborted) throw err;
          console.error("[Pipeline] Unexpected batch rejection:", err);
          docResult = { id: `doc_err_${Date.now()}`, status: "failed", error: err?.message || "Unknown extraction error" };
        }

        result.documents.push(docResult);

        if (!docResult.skipped && docResult.usage) {
          result.usage.extractCredits += docResult.usage.credits || 0;
          result.usage.apiCalls++;
        }

        if (docResult.status === "completed") result.stats.completed++;
        else if (docResult.status === "needs_review") result.stats.needsReview++;
        else if (docResult.status === "failed") {
          result.stats.failed++;
          result.errors.push({ docId: docResult.id, docIndex: docResult.splitIndex, error: docResult.error });
        }

        if (!docResult.skipped) {
          emitter.emit("document_processed", { packetId: packet.id, document: docResult });
        }
      }

      processedCount += batch.length;
      emitter.emit("progress", { packetId: packet.id, docIndex: processedCount, total: splits.length });

      if (signal?.aborted) throw new Error("Processing aborted");
    }

    setStage(PipelineStatus.COMPLETED);

  } catch (error) {
    if (error.name === "AbortError" || error.message === "Processing aborted" || signal?.aborted) {
      throw error; // Propagate to queue manager
    }
    console.error("[Pipeline] Packet processing failed:", error.message);
    setStage(PipelineStatus.FAILED, { error: error.message });
    result.errors.push({ packetLevel: true, error: error.message });
  }

  // Final totals
  result.usage.totalCredits = result.usage.splitCredits + result.usage.extractCredits;
  result.usage.totalCost = result.usage.totalCredits * 0.01;
  result.usage.model = config.model;
  result.usage.nConsensus = config.nConsensus;
  result.usage.costOptimize = config.costOptimize;

  // Mark has-review / has-failed flags for the completion DB function
  result.hasNeedsReview = result.stats.needsReview > 0;
  result.hasFailed = result.stats.failed > 0 && result.stats.completed === 0 && result.stats.needsReview === 0;

  return result;
}
