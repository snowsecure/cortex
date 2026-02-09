import { useCallback } from "react";
import { 
  splitDocument, 
  extractDocument 
} from "../lib/retab";
import {
  SUBDOCUMENT_TYPES,
  SPLIT_TO_CATEGORY_MAP,
  getSchemaForCategory,
  checkNeedsReview,
  getCategoryDisplayName,
} from "../lib/documentCategories";
import {
  RETAB_MODELS,
  DEFAULT_CONFIG,
  getModelForCategory,
  getConsensusForCategory,
} from "../lib/retabConfig";
import { getExtractionData } from "../lib/utils";
import {
  annotateWithSourceQuotes,
  annotateWithReasoningPrompts,
  getArrayFieldKeys,
  schemaFingerprint,
} from "../schemas/index";

/**
 * Generate unique document ID
 */
function generateDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Pipeline status constants
 */
export const PipelineStatus = {
  IDLE: "idle",
  SPLITTING: "splitting",
  CLASSIFYING: "classifying",
  EXTRACTING: "extracting",
  COMPLETED: "completed",
  FAILED: "failed",
};

/**
 * Derive parallel extraction batch size from concurrency setting.
 * Scales with the user's concurrency preference (min 3, max 10).
 */
function getExtractionBatchSize(concurrency = 5) {
  return Math.max(3, Math.min(concurrency, 10));
}

/**
 * Hook for processing a single document packet through the pipeline
 * Pipeline: Split -> Extract (parallel) for each subdocument
 */
export function usePacketPipeline() {
  /**
   * Process a single packet through the full pipeline
   */
  const processPacket = useCallback(async (packet, options = {}) => {
    const {
      onStatusChange = () => {},
      onDocumentProcessed = () => {},
      onDocumentsDetected = () => {},
      skipSplit = false,
      forcedCategory = null,
      retabConfig = {},
      signal = null, // AbortSignal for cancellation (e.g., pause/clear)
    } = options;
    
    // Merge with defaults
    const config = {
      model: retabConfig.model || DEFAULT_CONFIG.model,
      nConsensus: retabConfig.nConsensus || DEFAULT_CONFIG.nConsensus,
      imageDpi: retabConfig.imageDpi || DEFAULT_CONFIG.imageDpi,
      temperature: retabConfig.temperature || DEFAULT_CONFIG.temperature,
      chunkingKeys: retabConfig.chunkingKeys || false,
      sourceQuotes: retabConfig.sourceQuotes || false,
      reasoningPrompts: retabConfig.reasoningPrompts || false,
      costOptimize: retabConfig.costOptimize ?? DEFAULT_CONFIG.costOptimize,
      concurrency: retabConfig.concurrency ?? DEFAULT_CONFIG.concurrency ?? 5,
    };
    
    // Get model info for credit calculation (user-selected model — per-doc overrides tracked individually)
    const modelInfo = RETAB_MODELS[config.model] || RETAB_MODELS["retab-small"];
    const microModelInfo = RETAB_MODELS["retab-micro"];

    const result = {
      packetId: packet.id,
      filename: packet.name || packet.filename,
      documents: [],
      errors: [],
      stats: {
        totalDocuments: 0,
        completed: 0,
        needsReview: 0,
        failed: 0,
      },
      usage: {
        totalPages: 0,
        totalCredits: 0,
        totalCost: 0, // in USD
        splitCredits: 0,
        extractCredits: 0,
        apiCalls: 0,
      },
    };

    try {
      // Check if document data is available
      if (!packet.base64) {
        throw new Error("Document data not available. The file needs to be re-uploaded to process.");
      }
      
      // Step 1: Split the packet into subdocuments
      let splits;
      
      if (skipSplit) {
        splits = [{ name: "document", pages: null }];
      } else {
        onStatusChange(packet.id, PipelineStatus.SPLITTING);
        
        try {
          // Splitting only needs document-boundary detection, not extraction-quality
          // analysis, so retab-micro is always sufficient. Lower DPI also works.
          const splitModel = config.costOptimize ? "retab-micro" : config.model;
          const splitDpi = config.costOptimize ? Math.min(config.imageDpi, 150) : config.imageDpi;

          const splitResponse = await splitDocument({
            document: packet.base64,
            filename: packet.name || packet.filename,
            subdocuments: SUBDOCUMENT_TYPES,
            model: splitModel,
            imageDpi: splitDpi,
            signal,
          });
          
          splits = splitResponse.splits || [];
          
          // Track split usage — use the actual model used for splitting
          const splitModelInfo = RETAB_MODELS[splitModel] || microModelInfo;
          const apiPageCount = splitResponse.usage?.page_count || 0;
          const docPageCount = new Set(splits.flatMap(s => s.pages || [])).size || splits.reduce((acc, s) => acc + (s.pages?.length || 1), 0);
          // Prefer document-derived page count for UI; keep API count for billing
          const splitPages = apiPageCount || docPageCount;
          result.usage.splitCredits = splitPages * splitModelInfo.creditsPerPage;
          result.usage.totalPages = splitPages;
          result.usage.documentPages = docPageCount;
          result.usage.apiCalls++;
          // Log warning if API and document page counts differ
          if (apiPageCount > 0 && docPageCount > 0 && apiPageCount !== docPageCount) {
            console.warn(`[Pipeline] Page count mismatch for ${packet.name || packet.filename}: API reported ${apiPageCount}, documents span ${docPageCount} pages`);
            result.usage.pageCountMismatch = { api: apiPageCount, documents: docPageCount };
          }
          // Also compare with upload-time page count (from getPdfPageCount)
          const uploadPageCount = packet.pageCount;
          if (uploadPageCount && docPageCount > 0 && uploadPageCount !== docPageCount) {
            console.warn(`[Pipeline] Upload vs split mismatch for ${packet.name || packet.filename}: upload detected ${uploadPageCount} pages, splits span ${docPageCount} pages`);
            result.usage.pageCountMismatch = {
              ...(result.usage.pageCountMismatch || {}),
              upload: uploadPageCount,
              api: apiPageCount || undefined,
              documents: docPageCount,
            };
          }
          
          // Filter out splits with no pages (empty categories)
          splits = splits.filter(s => s.pages && s.pages.length > 0);
          
          if (splits.length === 0) {
            splits = [{ name: "other", pages: null }];
          }
        } catch (splitError) {
          // If aborted, propagate immediately instead of degrading to single doc
          if (splitError.name === "AbortError" || splitError.message === "Extraction aborted" || signal?.aborted) {
            throw new Error("Processing aborted");
          }
          console.warn("Split failed, treating as single document:", splitError);
          splits = [{ name: "other", pages: null }];
        }
      }

      result.stats.totalDocuments = splits.length;

      // Pre-generate IDs and build placeholder documents so the UI can show all detected docs immediately
      const docIds = splits.map(() => generateDocId());
      const pendingDocs = splits.map((split, index) => {
        const category = forcedCategory || mapSplitTypeToCategory(split.name);
        return {
          id: docIds[index],
          packetId: packet.id,
          splitIndex: index,
          splitType: split.name,
          pages: split.pages,
          classification: {
            category,
            confidence: 0.9,
            reasoning: `Detected as ${split.name} during packet splitting`,
            splitType: split.name,
          },
          extraction: null,
          status: "pending",
          needsReview: false,
          reviewReasons: [],
          error: null,
          extractionConfidence: undefined,
        };
      });

      // Send all pending documents to the UI at once
      onDocumentsDetected?.(packet.id, pendingDocs);

      onStatusChange(packet.id, PipelineStatus.EXTRACTING, { 
        docIndex: 0, 
        total: splits.length 
      });

      // Check for abort before starting extraction phase
      if (signal?.aborted) throw new Error("Processing aborted");

      // Step 2: Extract all subdocuments in parallel batches
      const extractSingleDoc = async (split, index) => {
        const docId = docIds[index];
        const category = forcedCategory || mapSplitTypeToCategory(split.name);

        // Per-category model & consensus selection for cost optimization
        const docModel = getModelForCategory(category, config.model, config.costOptimize);
        const docConsensus = getConsensusForCategory(category, config.nConsensus, config.costOptimize);
        const docModelInfo = RETAB_MODELS[docModel] || RETAB_MODELS["retab-small"];
        
        const documentResult = {
          id: docId,
          packetId: packet.id,
          splitIndex: index,
          splitType: split.name,
          pages: split.pages,
          classification: {
            category,
            confidence: 0.9,
            reasoning: `Detected as ${split.name} during packet splitting`,
            splitType: split.name,
          },
          extraction: null,
          status: "processing",
          needsReview: false,
          reviewReasons: [],
          error: null,
          extractionConfidence: undefined,
          startedAt: new Date().toISOString(),
          completedAt: null,
        };

        try {
          // Check if we have the document data
          if (!packet.base64) {
            throw new Error("Document data not available. Please re-upload the file to retry.");
          }
          
          let schema = getSchemaForCategory(category);
          
          if (!schema) {
            throw new Error(`No schema found for category: ${category}`);
          }

          // Apply schema annotations for advanced features
          if (config.sourceQuotes) schema = annotateWithSourceQuotes(schema);
          if (config.reasoningPrompts) schema = annotateWithReasoningPrompts(schema);
          const chunkingKeysArray = config.chunkingKeys ? getArrayFieldKeys(schema) : null;

          // Retry extraction on transient network/server errors (including 429 rate limits)
          const DOC_MAX_RETRIES = 3;
          const DOC_RETRY_DELAYS = [2000, 4000, 8000];
          const RETRIABLE_PATTERNS = /fetch failed|network|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|429|50[0-9]|529/i;
          const RATE_LIMIT_PATTERN = /429/;

          let extractionResponse;
          for (let attempt = 0; attempt <= DOC_MAX_RETRIES; attempt++) {
            try {
              extractionResponse = await extractDocument({
                document: packet.base64,
                filename: packet.name || packet.filename,
                jsonSchema: schema,
                model: docModel,
                nConsensus: docConsensus,
                imageDpi: config.imageDpi,
                temperature: config.temperature,
                stream: false, // non-streaming avoids "Unexpected non-whitespace character after JSON" when API returns JSON
                chunkingKeys: chunkingKeysArray,
                signal,
              });
              break; // Success -- exit retry loop
            } catch (retryErr) {
              // Abort errors should not be retried
              if (retryErr.name === "AbortError" || retryErr.message === "Extraction aborted" || signal?.aborted) {
                throw retryErr;
              }
              const isRetriable = RETRIABLE_PATTERNS.test(retryErr.message);
              const isRateLimited = RATE_LIMIT_PATTERN.test(retryErr.message);

              if (isRateLimited) {
                // Longer backoff for rate limits — 5s base, doubling each retry
                const rateLimitDelay = 5000 * Math.pow(2, attempt);
                console.warn(
                  `⚠️ Rate limited (429) on document ${index + 1}, attempt ${attempt + 1}/${DOC_MAX_RETRIES + 1}. ` +
                  `Waiting ${rateLimitDelay / 1000}s before retry. Consider lowering concurrency in Settings if this persists.`
                );
                if (attempt < DOC_MAX_RETRIES) {
                  await new Promise(r => setTimeout(r, rateLimitDelay));
                  continue;
                }
              } else if (isRetriable && attempt < DOC_MAX_RETRIES) {
                console.warn(`Document ${index + 1} extraction attempt ${attempt + 1} failed (${retryErr.message}), retrying in ${DOC_RETRY_DELAYS[attempt]}ms...`);
                await new Promise(r => setTimeout(r, DOC_RETRY_DELAYS[attempt]));
                continue;
              }
              throw retryErr; // Non-retriable or exhausted retries
            }
          }
          
          documentResult.extraction = extractionResponse;
          
          // Stamp with schema version fingerprint for future change detection
          documentResult.schemaFingerprint = schemaFingerprint(category) || null;

          // Track extraction usage — use the actual model/consensus used for this doc
          const docPages = split.pages?.length || 1;
          documentResult.usage = {
            pages: docPages,
            credits: docPages * docModelInfo.creditsPerPage * docConsensus,
            model: docModel,
            nConsensus: docConsensus,
          };
          
          // Calculate extraction confidence only when API returned per-field likelihoods
          const { likelihoods } = getExtractionData(extractionResponse);
          const likelihoodValues = Object.values(likelihoods || {}).filter(v => typeof v === 'number');
          if (likelihoodValues.length > 0) {
            documentResult.extractionConfidence = likelihoodValues.reduce((sum, v) => sum + v, 0) / likelihoodValues.length;
          } else {
            documentResult.extractionConfidence = null;
          }
          
          // Check if needs review
          const reviewCheck = checkNeedsReview(extractionResponse, category);
          documentResult.needsReview = reviewCheck.needsReview;
          documentResult.reviewReasons = reviewCheck.reasons;
          documentResult.status = reviewCheck.needsReview ? "needs_review" : "completed";
          documentResult.completedAt = new Date().toISOString();

        } catch (docError) {
          // Abort errors must propagate up to cancel the entire packet, not be
          // swallowed as a per-document failure
          if (docError.name === "AbortError" || docError.message === "Extraction aborted" || signal?.aborted) {
            throw docError;
          }
          console.error(`Error extracting document ${index + 1}:`, docError);
          documentResult.status = "failed";
          documentResult.error = docError.message;
          documentResult.completedAt = new Date().toISOString();
        }

        return documentResult;
      };

      // Process in parallel batches — batch size scales with concurrency setting
      const batchSize = getExtractionBatchSize(config.concurrency);
      let processedCount = 0;
      for (let i = 0; i < splits.length; i += batchSize) {
        const batch = splits.slice(i, i + batchSize);
        const batchPromises = batch.map((split, batchIndex) => 
          extractSingleDoc(split, i + batchIndex)
        );
        
        // Use Promise.allSettled so one document failure doesn't kill the entire batch.
        // Each extractSingleDoc already catches its own errors and returns a failed result,
        // but an unexpected throw (e.g., abort) could still reject the promise.
        const batchSettled = await Promise.allSettled(batchPromises);
        
        for (const outcome of batchSettled) {
          let docResult;
          if (outcome.status === "fulfilled") {
            docResult = outcome.value;
          } else {
            // Unexpected rejection — create a failed placeholder so the batch continues
            const err = outcome.reason;
            if (err?.name === "AbortError" || err?.message === "Processing aborted" || signal?.aborted) {
              throw err; // Abort should still propagate
            }
            console.error("[Pipeline] Unexpected batch rejection:", err);
            docResult = {
              id: `doc_err_${Date.now()}`,
              status: "failed",
              error: err?.message || "Unknown extraction error",
            };
          }

          result.documents.push(docResult);
          
          // Aggregate usage
          if (docResult.usage) {
            result.usage.extractCredits += docResult.usage.credits || 0;
            result.usage.apiCalls++;
          }
          
          if (docResult.status === "completed") {
            result.stats.completed++;
          } else if (docResult.status === "needs_review") {
            result.stats.needsReview++;
          } else if (docResult.status === "failed") {
            result.stats.failed++;
            result.errors.push({
              docId: docResult.id,
              docIndex: docResult.splitIndex,
              error: docResult.error,
            });
          }
          
          onDocumentProcessed(packet.id, docResult);
        }
        
        processedCount += batch.length;
        onStatusChange(packet.id, PipelineStatus.EXTRACTING, { 
          docIndex: processedCount, 
          total: splits.length 
        });

        // Check for abort between batches
        if (signal?.aborted) throw new Error("Processing aborted");
      }

      onStatusChange(packet.id, PipelineStatus.COMPLETED);
      
    } catch (error) {
      // Abort errors should propagate to the caller (useBatchQueue) which
      // handles them specially (doesn't record as failure, doesn't persist).
      if (error.name === "AbortError" || error.message === "Processing aborted" || signal?.aborted) {
        throw error;
      }
      console.error("Packet processing failed:", error);
      onStatusChange(packet.id, PipelineStatus.FAILED, { error: error.message });
      result.errors.push({
        packetLevel: true,
        error: error.message,
      });
    }

    // Calculate final totals
    result.usage.totalCredits = result.usage.splitCredits + result.usage.extractCredits;
    result.usage.totalCost = result.usage.totalCredits * 0.01; // $0.01 per credit
    // Store run config on result so each packet can display its own model (different runs can use different models)
    result.usage.model = config.model;
    result.usage.nConsensus = config.nConsensus;
    result.usage.costOptimize = config.costOptimize;

    return result;
  }, []);

  /**
   * Process a single document (no splitting)
   */
  const processDocument = useCallback(async (file, category, options = {}) => {
    const { 
      onStatusChange = () => {},
      retabConfig = {},
      signal = null,
    } = options;
    
    // Merge with defaults
    const config = {
      model: retabConfig.model || DEFAULT_CONFIG.model,
      nConsensus: retabConfig.nConsensus || DEFAULT_CONFIG.nConsensus,
      imageDpi: retabConfig.imageDpi || DEFAULT_CONFIG.imageDpi,
      temperature: retabConfig.temperature || DEFAULT_CONFIG.temperature,
      // streaming is always enabled (hardcoded in extractDocument calls)
      chunkingKeys: retabConfig.chunkingKeys || false,
      sourceQuotes: retabConfig.sourceQuotes || false,
      reasoningPrompts: retabConfig.reasoningPrompts || false,
      costOptimize: retabConfig.costOptimize ?? DEFAULT_CONFIG.costOptimize,
    };

    // Per-category model & consensus selection
    const docModel = getModelForCategory(category, config.model, config.costOptimize);
    const docConsensus = getConsensusForCategory(category, config.nConsensus, config.costOptimize);
    
    onStatusChange(file.id, PipelineStatus.EXTRACTING);
    
    let schema = getSchemaForCategory(category);
    
    if (!schema) {
      throw new Error(`No schema found for category: ${category}`);
    }

    // Apply schema annotations for advanced features
    if (config.sourceQuotes) schema = annotateWithSourceQuotes(schema);
    if (config.reasoningPrompts) schema = annotateWithReasoningPrompts(schema);
    const chunkingKeysArray = config.chunkingKeys ? getArrayFieldKeys(schema) : null;

    const extractionResponse = await extractDocument({
      document: file.base64,
      filename: file.name,
      jsonSchema: schema,
      model: docModel,
      nConsensus: docConsensus,
      imageDpi: config.imageDpi,
      temperature: config.temperature,
      stream: false, // non-streaming avoids "Unexpected non-whitespace character after JSON" when API returns JSON
      chunkingKeys: chunkingKeysArray,
      signal,
    });

    const reviewCheck = checkNeedsReview(extractionResponse, category);
    
    onStatusChange(file.id, PipelineStatus.COMPLETED);

    return {
      extraction: extractionResponse,
      needsReview: reviewCheck.needsReview,
      reviewReasons: reviewCheck.reasons,
    };
  }, []);

  /**
   * Retry extraction for a single failed document within a packet.
   * Skips splitting/classification – re-uses the existing split and category info.
   * Returns the updated document result on success, throws on failure.
   *
   * NOTE: Retries always use the user-configured model (not cost-optimized micro)
   * because the user is explicitly requesting a re-extraction — they want the best
   * quality available for this specific document.
   */
  const retryDocumentExtraction = useCallback(async (packet, document, options = {}) => {
    const {
      onStatusChange = () => {},
      retabConfig = {},
      signal = null,
    } = options;

    // Merge with defaults — retries always use the full model (no cost downgrade)
    const config = {
      model: retabConfig.model || DEFAULT_CONFIG.model,
      nConsensus: retabConfig.nConsensus || DEFAULT_CONFIG.nConsensus,
      imageDpi: retabConfig.imageDpi || DEFAULT_CONFIG.imageDpi,
      temperature: retabConfig.temperature || DEFAULT_CONFIG.temperature,
      // streaming is always enabled (hardcoded in extractDocument calls)
      chunkingKeys: retabConfig.chunkingKeys || false,
      sourceQuotes: retabConfig.sourceQuotes || false,
      reasoningPrompts: retabConfig.reasoningPrompts || false,
    };

    const retryModelInfo = RETAB_MODELS[config.model] || RETAB_MODELS["retab-small"];

    if (!packet.base64) {
      throw new Error("Document data not available. Please re-upload the file to retry.");
    }

    const category = document.classification?.category
      || mapSplitTypeToCategory(document.splitType || document.classification?.splitType);
    let schema = getSchemaForCategory(category);

    if (!schema) {
      throw new Error(`No schema found for category: ${category}`);
    }

    // Apply schema annotations for advanced features
    if (config.sourceQuotes) schema = annotateWithSourceQuotes(schema);
    if (config.reasoningPrompts) schema = annotateWithReasoningPrompts(schema);
    const chunkingKeysArray = config.chunkingKeys ? getArrayFieldKeys(schema) : null;

    onStatusChange(document.id, "retrying");
    const retryStartedAt = new Date().toISOString();

    // Retry extraction with exponential backoff (same as initial pipeline)
    const DOC_MAX_RETRIES = 2;
    const DOC_RETRY_DELAYS = [2000, 4000];
    const RETRIABLE_PATTERNS = /fetch failed|network|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|429|50[0-9]|529/i;
    const RATE_LIMIT_PATTERN = /429/;

    let extractionResponse;
    for (let attempt = 0; attempt <= DOC_MAX_RETRIES; attempt++) {
      try {
        extractionResponse = await extractDocument({
          document: packet.base64,
          filename: packet.name || packet.filename,
          jsonSchema: schema,
          model: config.model,
          nConsensus: config.nConsensus,
          imageDpi: config.imageDpi,
          temperature: config.temperature,
          stream: false, // non-streaming avoids "Unexpected non-whitespace character after JSON" when API returns JSON
          chunkingKeys: chunkingKeysArray,
          signal,
        });
        break;
      } catch (retryErr) {
        // Abort errors should not be retried
        if (retryErr.name === "AbortError" || retryErr.message === "Extraction aborted" || signal?.aborted) {
          throw retryErr;
        }
        const isRetriable = RETRIABLE_PATTERNS.test(retryErr.message);
        const isRateLimited = RATE_LIMIT_PATTERN.test(retryErr.message);

        if (isRateLimited) {
          // Longer backoff for rate limits — 5s base, doubling each retry
          const rateLimitDelay = 5000 * Math.pow(2, attempt);
          console.warn(`Rate limited (429) on retry, attempt ${attempt + 1}/${DOC_MAX_RETRIES + 1}. Waiting ${rateLimitDelay / 1000}s...`);
          if (attempt < DOC_MAX_RETRIES) {
            await new Promise(r => setTimeout(r, rateLimitDelay));
            continue;
          }
        } else if (isRetriable && attempt < DOC_MAX_RETRIES) {
          console.warn(`Document retry attempt ${attempt + 1} failed (${retryErr.message}), retrying in ${DOC_RETRY_DELAYS[attempt]}ms...`);
          await new Promise(r => setTimeout(r, DOC_RETRY_DELAYS[attempt]));
          continue;
        }
        throw retryErr;
      }
    }

    // Calculate extraction confidence
    const { likelihoods } = getExtractionData(extractionResponse);
    const likelihoodValues = Object.values(likelihoods || {}).filter(v => typeof v === "number");
    const extractionConfidence = likelihoodValues.length > 0
      ? likelihoodValues.reduce((sum, v) => sum + v, 0) / likelihoodValues.length
      : null;

    // Check if needs review
    const reviewCheck = checkNeedsReview(extractionResponse, category);

    const docPages = document.pages?.length || 1;

    return {
      id: document.id,
      extraction: extractionResponse,
      extractionConfidence,
      schemaFingerprint: schemaFingerprint(category) || null,
      status: reviewCheck.needsReview ? "needs_review" : "completed",
      needsReview: reviewCheck.needsReview,
      reviewReasons: reviewCheck.reasons,
      error: null,
      startedAt: retryStartedAt,
      completedAt: new Date().toISOString(),
      usage: {
        pages: docPages,
        credits: docPages * retryModelInfo.creditsPerPage * config.nConsensus,
        model: config.model,
        nConsensus: config.nConsensus,
      },
    };
  }, []);

  return {
    processPacket,
    processDocument,
    retryDocumentExtraction,
    PipelineStatus,
  };
}

/**
 * Map split type to extraction category using centralized mapping
 */
function mapSplitTypeToCategory(splitType) {
  if (!splitType) return "other_recorded";
  const normalized = splitType.toLowerCase().replace(/-/g, '_');
  return SPLIT_TO_CATEGORY_MAP[normalized] || "other_recorded";
}

/**
 * Get display name for split type. Uses category display name when split type
 * maps to a category (so Results and Export show the same labels, e.g. "Title Policy / Commitment").
 */
export function getSplitTypeDisplayName(splitType) {
  const normalized = splitType?.toLowerCase()?.replace(/-/g, "_");
  const category = normalized && SPLIT_TO_CATEGORY_MAP[normalized];
  if (category) {
    return getCategoryDisplayName(category);
  }

  const names = {
    // Admin
    cover_sheet: "Cover Sheet / Order Form",
    transaction_summary: "Transaction Summary",
    order_form: "Order Form",
    
    // Deeds
    deed: "Transfer Deed",
    
    // Mortgages
    mortgage: "Deed of Trust / Mortgage",
    mortgage_modification: "Mortgage Modification",
    
    // Liens
    tax_lien: "Tax Lien",
    mechanics_lien: "Mechanic's Lien",
    hoa_lien: "HOA / Assessment Lien",
    judgment_lien: "Judgment Lien",
    ucc_filing: "UCC Filing",
    lien: "Lien",
    judgment: "Judgment",
    
    // Easements & Restrictions
    easement: "Easement",
    ccr: "CC&Rs / Restrictions",
    
    // Court Documents
    court_document: "Court Document",
    probate: "Probate Document",
    bankruptcy: "Bankruptcy Document",
    
    // Foreclosure
    foreclosure: "Foreclosure Notice",
    notice: "Notice",
    
    // Tax & Property
    tax_document: "Tax Document",
    title_document: "Title Document",
    survey: "Survey",
    plat: "Plat Map",
    plat_survey: "Survey / Plat",
    
    // Authority
    power_of_attorney: "Power of Attorney",
    entity_document: "Entity Document",
    trust_document: "Trust Document",
    affidavit: "Affidavit",
    
    // Closing & Leases
    closing_document: "Closing Document",
    lease: "Lease",
    
    // Other
    other: "Other Document",
  };

  if (names[normalized]) {
    return names[normalized];
  }
  
  // Format unknown split types nicely (e.g., "weird_doc_type" -> "Weird Doc Type")
  if (splitType) {
    return splitType
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  
  return "Unclassified Document";
}

export default usePacketPipeline;
