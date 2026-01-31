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
} from "../lib/documentCategories";

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
 * Parallel extraction batch size
 */
const EXTRACTION_BATCH_SIZE = 5;

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
      skipSplit = false,
      forcedCategory = null,
    } = options;

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
      // Step 1: Split the packet into subdocuments
      let splits;
      
      if (skipSplit) {
        splits = [{ name: "document", pages: null }];
      } else {
        onStatusChange(packet.id, PipelineStatus.SPLITTING);
        
        try {
          const splitResponse = await splitDocument({
            document: packet.base64,
            filename: packet.name || packet.filename,
            subdocuments: SUBDOCUMENT_TYPES,
          });
          
          splits = splitResponse.splits || [];
          
          // Track split usage (retab-small = 1.0 credit/page)
          const splitPages = splitResponse.usage?.page_count || splits.reduce((acc, s) => acc + (s.pages?.length || 1), 0);
          result.usage.splitCredits = splitPages * 1.0; // retab-small
          result.usage.totalPages = splitPages;
          result.usage.apiCalls++;
          
          // Filter out splits with no pages (empty categories)
          splits = splits.filter(s => s.pages && s.pages.length > 0);
          
          if (splits.length === 0) {
            splits = [{ name: "other", pages: null }];
          }
        } catch (splitError) {
          console.warn("Split failed, treating as single document:", splitError);
          splits = [{ name: "other", pages: null }];
        }
      }

      result.stats.totalDocuments = splits.length;
      onStatusChange(packet.id, PipelineStatus.EXTRACTING, { 
        docIndex: 0, 
        total: splits.length 
      });

      // Step 2: Extract all subdocuments in parallel batches
      const extractSingleDoc = async (split, index) => {
        const docId = generateDocId();
        const category = forcedCategory || mapSplitTypeToCategory(split.name);
        
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
          extractionConfidence: 0.8,
        };

        try {
          const schema = getSchemaForCategory(category);
          
          if (!schema) {
            throw new Error(`No schema found for category: ${category}`);
          }

          const extractionResponse = await extractDocument({
            document: packet.base64,
            filename: packet.name || packet.filename,
            jsonSchema: schema,
            model: "retab-small",
            nConsensus: 1,
          });
          
          documentResult.extraction = extractionResponse;
          
          // Track extraction usage (retab-small = 1.0 credit/page, nConsensus=1)
          const docPages = split.pages?.length || 1;
          documentResult.usage = {
            pages: docPages,
            credits: docPages * 1.0 * 1, // model_credits × pages × n_consensus
          };
          
          // Calculate extraction confidence
          const likelihoods = extractionResponse?.likelihoods || {};
          const likelihoodValues = Object.values(likelihoods).filter(v => typeof v === 'number');
          if (likelihoodValues.length > 0) {
            documentResult.extractionConfidence = likelihoodValues.reduce((sum, v) => sum + v, 0) / likelihoodValues.length;
          }
          
          // Check if needs review
          const reviewCheck = checkNeedsReview(extractionResponse, category);
          documentResult.needsReview = reviewCheck.needsReview;
          documentResult.reviewReasons = reviewCheck.reasons;
          documentResult.status = reviewCheck.needsReview ? "needs_review" : "completed";

        } catch (docError) {
          console.error(`Error extracting document ${index + 1}:`, docError);
          documentResult.status = "failed";
          documentResult.error = docError.message;
        }

        return documentResult;
      };

      // Process in parallel batches
      let processedCount = 0;
      for (let i = 0; i < splits.length; i += EXTRACTION_BATCH_SIZE) {
        const batch = splits.slice(i, i + EXTRACTION_BATCH_SIZE);
        const batchPromises = batch.map((split, batchIndex) => 
          extractSingleDoc(split, i + batchIndex)
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        for (const docResult of batchResults) {
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
      }

      onStatusChange(packet.id, PipelineStatus.COMPLETED);
      
    } catch (error) {
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

    return result;
  }, []);

  /**
   * Process a single document (no splitting)
   */
  const processDocument = useCallback(async (file, category, options = {}) => {
    const { onStatusChange = () => {} } = options;
    
    onStatusChange(file.id, PipelineStatus.EXTRACTING);
    
    const schema = getSchemaForCategory(category);
    
    if (!schema) {
      throw new Error(`No schema found for category: ${category}`);
    }

    const extractionResponse = await extractDocument({
      document: file.base64,
      filename: file.name,
      jsonSchema: schema,
      model: "retab-small",
      nConsensus: 1,
    });

    const reviewCheck = checkNeedsReview(extractionResponse, category);
    
    onStatusChange(file.id, PipelineStatus.COMPLETED);

    return {
      extraction: extractionResponse,
      needsReview: reviewCheck.needsReview,
      reviewReasons: reviewCheck.reasons,
    };
  }, []);

  return {
    processPacket,
    processDocument,
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
 * Get display name for split type
 */
export function getSplitTypeDisplayName(splitType) {
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
  
  const normalized = splitType?.toLowerCase()?.replace(/-/g, '_');
  
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
