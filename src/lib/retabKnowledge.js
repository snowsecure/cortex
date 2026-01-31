/**
 * Retab API Knowledge Base
 * Comprehensive documentation and best practices for the AI Assistant
 */

// ============================================================================
// CORE CONCEPTS
// ============================================================================

export const RETAB_CONCEPTS = {
  overview: {
    title: "What is Retab?",
    content: `Retab is a document intelligence API that extracts structured data from documents using AI. Key capabilities:

• **Document Extraction**: Extract JSON data from PDFs using your schema
• **Document Splitting**: Split multi-document PDFs into individual documents
• **Document Classification**: Identify document types automatically
• **Schema Generation**: Generate extraction schemas from document samples

The API uses vision-language models optimized for document understanding, providing field-level confidence scores for quality assessment.`,
  },
  
  confidenceScoring: {
    title: "Confidence Scoring (Likelihoods)",
    content: `Retab returns per-field likelihood scores (0.0 to 1.0) indicating extraction confidence:

**Score Interpretation:**
• 0.9 - 1.0: Very high confidence, likely correct
• 0.75 - 0.9: High confidence, usually reliable
• 0.5 - 0.75: Moderate confidence, may need verification
• 0.25 - 0.5: Low confidence, likely needs human review
• 0.0 - 0.25: Very low/no confidence, field unclear or missing

**How It Works:**
The API runs multiple internal samplings and measures agreement:
- High agreement = high confidence (models consistently extract same value)
- Low agreement = low confidence (models disagree or are uncertain)

**Best Practice Thresholds:**
• Auto-approve: confidence ≥ 0.75
• Flag for review: confidence < 0.75
• Reject/manual entry: confidence < 0.5`,
  },
  
  consensus: {
    title: "Consensus Mode (n_consensus)",
    content: `Consensus mode runs multiple parallel extractions and aggregates results for improved accuracy.

**How n_consensus Works:**
• n_consensus=1: Single extraction (fastest, cheapest, default)
• n_consensus=2: Two extractions compared
• n_consensus=3: Three extractions - recommended for production
• n_consensus=5: Maximum accuracy (development/testing)

**Aggregation Strategy by Type:**
• **Boolean**: Majority voting (if 2/3 say true, result is true)
• **Number**: Cluster analysis (groups similar values, picks consensus cluster)
• **String**: Semantic clustering (groups semantically similar answers)
• **Enum**: Mode selection (most common value wins)

**Cost Impact:**
Each consensus level multiplies extraction cost:
- n_consensus=1: 1× cost
- n_consensus=3: 3× cost
- n_consensus=5: 5× cost

**Recommendation:**
Use n_consensus=3 for production workloads. The accuracy improvement typically justifies the 3× cost increase for critical extractions.`,
  },
};

// ============================================================================
// MODELS
// ============================================================================

export const RETAB_MODELS_DOCS = {
  overview: {
    title: "Retab Model Selection",
    content: `Retab offers three model tiers optimized for different use cases:

**retab-micro** (0.2 credits/page, ~$0.002/page)
• Fastest processing speed
• Best for: Simple forms, high volume, cost-sensitive workflows
• Limitations: May struggle with complex layouts, handwriting

**retab-small** (1.0 credits/page, ~$0.01/page) [DEFAULT]
• Balanced accuracy and speed
• Best for: Standard documents, most production use cases
• Good general-purpose choice for title industry documents

**retab-large** (3.0 credits/page, ~$0.03/page)
• Highest accuracy, slower processing
• Best for: Complex multi-column layouts, handwritten text, critical extractions
• Use when accuracy is paramount and cost is secondary`,
  },
  
  selection: {
    title: "Model Selection Guide",
    content: `**When to use retab-micro:**
• Simple, standardized forms
• High-volume processing (10,000+ pages/day)
• Non-critical data extraction
• Budget-constrained projects
• Documents with clear, typed text

**When to use retab-small:**
• General title documents (deeds, mortgages, liens)
• Mixed document types
• Standard production workloads
• Balance of cost and accuracy needed

**When to use retab-large:**
• Complex legal documents with dense text
• Documents with handwritten annotations
• Poor quality scans or faxes
• Multi-column layouts (newspapers, historical records)
• When any extraction error is costly`,
  },
};

// ============================================================================
// OPTIMIZATION STRATEGIES
// ============================================================================

export const OPTIMIZATION_STRATEGIES = {
  confidence: {
    title: "Improving Confidence Scores",
    strategies: [
      {
        name: "Use Consensus Mode",
        description: "Set n_consensus=3 or higher for critical fields. Multiple extractions reduce random errors.",
        impact: "High",
        cost: "3× base cost",
      },
      {
        name: "Improve Schema Descriptions",
        description: "Add detailed descriptions to schema fields explaining exactly what data to extract and in what format.",
        impact: "High",
        cost: "Free",
      },
      {
        name: "Use Explicit Formats",
        description: "Specify date formats (YYYY-MM-DD), number formats, enum values explicitly in your schema.",
        impact: "Medium",
        cost: "Free",
      },
      {
        name: "Break Complex Fields",
        description: "Split compound fields into atomic parts. Instead of 'full_address', use 'street', 'city', 'state', 'zip'.",
        impact: "Medium",
        cost: "Free",
      },
      {
        name: "Upgrade Model",
        description: "Use retab-large for documents with poor scan quality or complex layouts.",
        impact: "Medium",
        cost: "3× vs retab-small",
      },
      {
        name: "Increase DPI",
        description: "Raise image_resolution_dpi from 192 to 300 for small text or detailed documents.",
        impact: "Low-Medium",
        cost: "Slower processing",
      },
    ],
  },
  
  speed: {
    title: "Improving Processing Speed",
    strategies: [
      {
        name: "Use Faster Model",
        description: "Switch from retab-large to retab-small, or retab-small to retab-micro for simple documents.",
        impact: "High",
        cost: "Lower cost but may reduce accuracy",
      },
      {
        name: "Reduce DPI",
        description: "Lower image_resolution_dpi from 192 to 150 or 96 if text is clear.",
        impact: "Medium",
        cost: "May reduce accuracy on small text",
      },
      {
        name: "Disable Consensus",
        description: "Use n_consensus=1 for non-critical extractions.",
        impact: "High",
        cost: "Lower accuracy",
      },
      {
        name: "Increase Concurrency",
        description: "Process multiple documents in parallel (up to API rate limits).",
        impact: "High",
        cost: "Same total cost, faster throughput",
      },
      {
        name: "Pre-split Documents",
        description: "Split large packets before uploading to enable parallel processing.",
        impact: "Medium",
        cost: "Additional split API call",
      },
    ],
  },
  
  cost: {
    title: "Reducing API Costs",
    strategies: [
      {
        name: "Use Appropriate Model",
        description: "Don't use retab-large for simple forms. Match model to document complexity.",
        impact: "High",
        cost: "May reduce accuracy",
      },
      {
        name: "Optimize Consensus",
        description: "Use n_consensus=1 for low-risk documents, n_consensus=3 only for critical ones.",
        impact: "High",
        cost: "Variable accuracy impact",
      },
      {
        name: "Filter Before Processing",
        description: "Pre-filter documents to skip blank pages, duplicates, or irrelevant documents.",
        impact: "Medium",
        cost: "Requires preprocessing logic",
      },
      {
        name: "Batch Similar Documents",
        description: "Group similar document types together for consistent model selection.",
        impact: "Low",
        cost: "Requires workflow changes",
      },
    ],
  },
  
  reviews: {
    title: "Reducing Human Reviews",
    strategies: [
      {
        name: "Analyze Review Patterns",
        description: "Track which fields and document types consistently need review, then improve those schemas.",
        impact: "High",
        cost: "Requires analysis",
      },
      {
        name: "Enable Consensus",
        description: "Higher consensus modes produce more reliable extractions with fewer uncertain fields.",
        impact: "High",
        cost: "Higher API cost",
      },
      {
        name: "Improve Schema Definitions",
        description: "Add examples, constraints, and detailed descriptions to frequently-problematic fields.",
        impact: "High",
        cost: "Free",
      },
      {
        name: "Adjust Thresholds",
        description: "If too many documents need review, consider lowering confidence threshold (with validation).",
        impact: "Medium",
        cost: "Risk of more errors",
      },
      {
        name: "Use Field-Level Rules",
        description: "Apply different confidence thresholds per field based on criticality.",
        impact: "Medium",
        cost: "Requires implementation",
      },
    ],
  },
};

// ============================================================================
// SCHEMA BEST PRACTICES
// ============================================================================

export const SCHEMA_BEST_PRACTICES = {
  title: "Schema Design Best Practices",
  practices: [
    {
      name: "Use Descriptive Names",
      good: "grantor_full_legal_name",
      bad: "name1",
      explanation: "Field names help the model understand what to extract.",
    },
    {
      name: "Add Field Descriptions",
      good: '{ "description": "The full legal name of the property seller as it appears on the deed" }',
      bad: '{ }',
      explanation: "Descriptions significantly improve extraction accuracy.",
    },
    {
      name: "Specify Formats",
      good: '{ "format": "date", "description": "Recording date in YYYY-MM-DD format" }',
      bad: '{ "type": "string" }',
      explanation: "Explicit formats reduce ambiguity.",
    },
    {
      name: "Use Enums for Known Values",
      good: '{ "enum": ["Warranty Deed", "Quitclaim Deed", "Trust Deed"] }',
      bad: '{ "type": "string" }',
      explanation: "Enums constrain output to valid values.",
    },
    {
      name: "Make Fields Optional When Appropriate",
      good: '{ "required": ["document_type", "recording_date"], "optional": ["legal_description"] }',
      bad: "Making everything required",
      explanation: "Not all fields appear in all documents.",
    },
    {
      name: "Nest Related Fields",
      good: '{ "property": { "address": {...}, "legal_description": {...} } }',
      bad: "Flat structure with 50 top-level fields",
      explanation: "Logical grouping improves extraction context.",
    },
  ],
};

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

export const TROUBLESHOOTING = {
  lowConfidence: {
    issue: "Low confidence scores across all documents",
    causes: [
      "Poor document scan quality",
      "Model mismatch (using micro for complex docs)",
      "Vague schema descriptions",
      "Documents in unexpected languages",
    ],
    solutions: [
      "Upgrade to retab-large for complex documents",
      "Enable n_consensus=3 or higher",
      "Add detailed field descriptions to schema",
      "Increase image_resolution_dpi to 300",
      "Check if documents are properly oriented",
    ],
  },
  
  slowProcessing: {
    issue: "Processing takes too long",
    causes: [
      "Using retab-large unnecessarily",
      "High DPI settings",
      "Large document file sizes",
      "Low concurrency settings",
    ],
    solutions: [
      "Switch to retab-small or retab-micro",
      "Reduce image_resolution_dpi to 150",
      "Compress PDFs before upload",
      "Increase parallel processing concurrency",
    ],
  },
  
  highReviewRate: {
    issue: "Too many documents need human review",
    causes: [
      "Confidence threshold set too high",
      "Schema doesn't match document variations",
      "Critical fields have low confidence",
      "Document types not in training data",
    ],
    solutions: [
      "Analyze which fields trigger reviews most",
      "Lower confidence threshold with validation checks",
      "Use n_consensus=3+ for critical fields",
      "Improve schema descriptions for problem fields",
    ],
  },
  
  extractionErrors: {
    issue: "Incorrect extractions or errors",
    causes: [
      "Schema field names don't match document content",
      "Documents rotated or poorly scanned",
      "Mixed document types in single file",
      "Unsupported document format",
    ],
    solutions: [
      "Review schema field descriptions",
      "Pre-process documents (rotate, enhance)",
      "Split multi-document files before extraction",
      "Ensure PDF is text-based or high-quality scan",
    ],
  },
};

// ============================================================================
// API PARAMETERS REFERENCE
// ============================================================================

export const API_PARAMETERS = {
  extract: {
    endpoint: "/documents/extract",
    parameters: [
      {
        name: "model",
        type: "string",
        default: "retab-small",
        description: "AI model to use: retab-micro, retab-small, or retab-large",
      },
      {
        name: "n_consensus",
        type: "integer",
        default: 1,
        range: "1-5",
        description: "Number of parallel extractions for consensus. Higher = more accurate, more expensive.",
      },
      {
        name: "temperature",
        type: "float",
        default: 0,
        range: "0-1",
        description: "Randomness in extraction. 0 = deterministic, higher = more variation. Usually keep at 0.",
      },
      {
        name: "image_resolution_dpi",
        type: "integer",
        default: 192,
        options: [96, 150, 192, 300],
        description: "Resolution for rendering PDF pages. Higher = better quality, slower processing.",
      },
      {
        name: "json_schema",
        type: "object",
        description: "JSON Schema defining the structure to extract. Include descriptions for best results.",
      },
    ],
  },
  
  split: {
    endpoint: "/documents/split",
    parameters: [
      {
        name: "model",
        type: "string",
        default: "retab-small",
        description: "AI model for document splitting",
      },
      {
        name: "subdocuments",
        type: "array",
        description: "Array of document types to split into, with name and description",
      },
      {
        name: "image_resolution_dpi",
        type: "integer",
        default: 192,
        description: "Resolution for rendering PDF pages",
      },
    ],
  },
};

// ============================================================================
// PRICING REFERENCE
// ============================================================================

export const PRICING = {
  models: {
    "retab-micro": { credits: 0.2, usd: 0.002 },
    "retab-small": { credits: 1.0, usd: 0.01 },
    "retab-large": { credits: 3.0, usd: 0.03 },
  },
  
  formula: "Total Cost = (pages × model_credits × (1 + n_consensus)) × $0.01",
  
  examples: [
    {
      description: "10 pages, retab-small, no consensus",
      calculation: "10 × 1.0 × 2 = 20 credits = $0.20",
    },
    {
      description: "10 pages, retab-small, n_consensus=3",
      calculation: "10 × 1.0 × 4 = 40 credits = $0.40",
    },
    {
      description: "100 pages, retab-micro, no consensus",
      calculation: "100 × 0.2 × 2 = 40 credits = $0.40",
    },
  ],
};

// ============================================================================
// AI ASSISTANT RESPONSE GENERATOR
// ============================================================================

export function generateRetabResponse(query, metrics, currentConfig = {}) {
  const lowerQuery = query.toLowerCase();
  
  // Confidence/accuracy questions
  if (lowerQuery.includes("confidence") || lowerQuery.includes("accuracy") || lowerQuery.includes("likelihood")) {
    const strategies = OPTIMIZATION_STRATEGIES.confidence.strategies;
    return {
      title: "Confidence Score Analysis",
      content: `**Current Metrics:**
• Average confidence: ${(metrics.avgConfidence * 100).toFixed(1)}%
• Fields below 70%: ${metrics.lowConfidenceFields || "N/A"}
• Current model: ${currentConfig.model || "retab-small"}
• Consensus: ${currentConfig.nConsensus || 1}x

**How Retab Confidence Works:**
${RETAB_CONCEPTS.confidenceScoring.content}

**Recommended Actions:**
${strategies.slice(0, 4).map((s, i) => `${i + 1}. **${s.name}** (${s.impact} impact)\n   ${s.description}`).join("\n\n")}`,
      suggestions: metrics.avgConfidence < 0.75 ? [
        { action: "Enable n_consensus=3", impact: "High" },
        { action: "Review schema descriptions", impact: "High" },
      ] : [],
    };
  }
  
  // Consensus questions
  if (lowerQuery.includes("consensus") || lowerQuery.includes("n_consensus")) {
    return {
      title: "Consensus Mode Explained",
      content: RETAB_CONCEPTS.consensus.content + `

**Your Current Settings:**
• n_consensus: ${currentConfig.nConsensus || 1}
• Effective cost multiplier: ${(currentConfig.nConsensus || 1) + 1}×

**Recommendation:**
${(currentConfig.nConsensus || 1) < 3 
  ? "Consider increasing to n_consensus=3 for production workloads. The accuracy improvement typically justifies the cost."
  : "You're using consensus mode effectively. Monitor confidence scores to ensure it's providing value."}`,
    };
  }
  
  // Model selection questions
  if (lowerQuery.includes("model") || lowerQuery.includes("micro") || lowerQuery.includes("small") || lowerQuery.includes("large")) {
    return {
      title: "Model Selection Guide",
      content: `${RETAB_MODELS_DOCS.overview.content}

**Your Current Model:** ${currentConfig.model || "retab-small"}

${RETAB_MODELS_DOCS.selection.content}

**Based on your metrics:**
${metrics.avgConfidence < 0.7 
  ? "Your confidence scores suggest you might benefit from upgrading to retab-large."
  : metrics.avgConfidence > 0.9
    ? "Your high confidence scores suggest you could potentially use retab-micro for cost savings on simple documents."
    : "Your current model choice appears well-balanced for your document types."}`,
    };
  }
  
  // Speed/performance questions
  if (lowerQuery.includes("speed") || lowerQuery.includes("slow") || lowerQuery.includes("fast") || lowerQuery.includes("performance")) {
    const strategies = OPTIMIZATION_STRATEGIES.speed.strategies;
    return {
      title: "Processing Speed Optimization",
      content: `**Current Performance:**
• Average processing time: ${metrics.avgProcessingTime?.toFixed(1) || "N/A"}s per document
• Model: ${currentConfig.model || "retab-small"}
• DPI: ${currentConfig.imageDpi || 192}
• Concurrency: ${currentConfig.concurrency || 5}

**Speed Optimization Strategies:**
${strategies.map((s, i) => `${i + 1}. **${s.name}** (${s.impact} impact)\n   ${s.description}\n   Trade-off: ${s.cost}`).join("\n\n")}

**Quick Wins:**
• Lower DPI to 150 if documents are clear
• Use retab-micro for simple forms
• Increase concurrency to process in parallel`,
    };
  }
  
  // Cost questions
  if (lowerQuery.includes("cost") || lowerQuery.includes("credit") || lowerQuery.includes("price") || lowerQuery.includes("expensive") || lowerQuery.includes("cheap")) {
    const strategies = OPTIMIZATION_STRATEGIES.cost.strategies;
    return {
      title: "Cost Optimization Guide",
      content: `**Your Cost Metrics:**
• Total credits used: ${metrics.totalCredits?.toFixed(1) || 0}
• Total cost: $${metrics.totalCost?.toFixed(2) || "0.00"}
• Average per document: ${metrics.avgCreditsPerDoc?.toFixed(2) || "N/A"} credits
• Current model: ${currentConfig.model || "retab-small"} (${PRICING.models[currentConfig.model || "retab-small"].credits} credits/page)

**Retab Pricing:**
${Object.entries(PRICING.models).map(([model, price]) => `• ${model}: ${price.credits} credits/page ($${price.usd}/page)`).join("\n")}

**Cost Formula:**
${PRICING.formula}

**Cost Reduction Strategies:**
${strategies.map((s, i) => `${i + 1}. **${s.name}** (${s.impact} impact)\n   ${s.description}`).join("\n\n")}`,
    };
  }
  
  // Review questions
  if (lowerQuery.includes("review") || lowerQuery.includes("human") || lowerQuery.includes("manual")) {
    const strategies = OPTIMIZATION_STRATEGIES.reviews.strategies;
    return {
      title: "Reducing Human Reviews",
      content: `**Review Metrics:**
• Review rate: ${(metrics.reviewRate * 100).toFixed(1)}%
• Documents needing review: ${metrics.documentsNeedingReview || "N/A"}
• Top review reasons: ${metrics.topReviewReasons?.slice(0, 3).join(", ") || "N/A"}

**Why Documents Need Review:**
1. Confidence score below threshold (${((currentConfig.confidenceThreshold || 0.7) * 100).toFixed(0)}%)
2. Critical fields missing or uncertain
3. Document type unrecognized
4. Extraction conflicts or anomalies

**Strategies to Reduce Reviews:**
${strategies.map((s, i) => `${i + 1}. **${s.name}** (${s.impact} impact)\n   ${s.description}`).join("\n\n")}`,
    };
  }
  
  // Schema questions
  if (lowerQuery.includes("schema") || lowerQuery.includes("field") || lowerQuery.includes("definition")) {
    return {
      title: "Schema Best Practices",
      content: `${SCHEMA_BEST_PRACTICES.title}

${SCHEMA_BEST_PRACTICES.practices.map((p, i) => `**${i + 1}. ${p.name}**
✅ Good: \`${p.good}\`
❌ Bad: \`${p.bad}\`
Why: ${p.explanation}`).join("\n\n")}

**Pro Tips:**
• Use the Schema Generator API to create initial schemas from sample documents
• Test schemas with diverse document samples before production
• Monitor field-level confidence to identify problem areas`,
    };
  }
  
  // DPI questions
  if (lowerQuery.includes("dpi") || lowerQuery.includes("resolution") || lowerQuery.includes("quality")) {
    return {
      title: "Image Resolution (DPI) Settings",
      content: `**Current DPI:** ${currentConfig.imageDpi || 192}

**DPI Options:**
• **96 DPI**: Fastest processing, lower quality. Use for clear, modern documents.
• **150 DPI**: Good balance. Suitable for most typed documents.
• **192 DPI** (default): Standard quality. Works well for most use cases.
• **300 DPI**: Highest quality, slowest. Use for small text or handwriting.

**When to Increase DPI:**
• Documents with small font sizes
• Handwritten annotations
• Low-quality scans or faxes
• Dense legal text

**When to Decrease DPI:**
• Modern, clear PDFs
• Simple forms with large text
• High-volume processing where speed matters
• When confidence scores are already high`,
    };
  }
  
  // Error/troubleshooting questions
  if (lowerQuery.includes("error") || lowerQuery.includes("fail") || lowerQuery.includes("wrong") || lowerQuery.includes("problem")) {
    return {
      title: "Troubleshooting Guide",
      content: `**Common Issues & Solutions:**

${Object.entries(TROUBLESHOOTING).map(([key, issue]) => `**${issue.issue}**
Causes: ${issue.causes.slice(0, 2).join(", ")}
Solutions:
${issue.solutions.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join("\n")}`).join("\n\n")}

**Your Error Rate:** ${(metrics.errorRate * 100).toFixed(1)}%

${metrics.errorRate > 0.05 
  ? "⚠️ Your error rate is elevated. Review the logs tab for specific error patterns."
  : "✅ Your error rate is within acceptable limits."}`,
    };
  }
  
  // Default response with capabilities
  return {
    title: "Retab AI Assistant",
    content: `I can help you optimize your document extraction workflow. Ask me about:

**📊 Metrics & Analysis**
• "Why are my confidence scores low?"
• "How can I improve extraction accuracy?"
• "What's causing high error rates?"

**⚙️ Configuration**
• "Which model should I use?"
• "What is consensus mode?"
• "What DPI setting is best?"

**💰 Cost Optimization**
• "How can I reduce API costs?"
• "Is my current setup cost-effective?"

**📝 Schema Design**
• "How do I write better schemas?"
• "Why are certain fields always uncertain?"

**🔧 Troubleshooting**
• "Why are documents failing?"
• "How do I reduce human reviews?"

**Current Configuration:**
• Model: ${currentConfig.model || "retab-small"}
• Consensus: ${currentConfig.nConsensus || 1}x
• DPI: ${currentConfig.imageDpi || 192}
• Confidence Threshold: ${((currentConfig.confidenceThreshold || 0.7) * 100).toFixed(0)}%`,
  };
}

export default {
  RETAB_CONCEPTS,
  RETAB_MODELS_DOCS,
  OPTIMIZATION_STRATEGIES,
  SCHEMA_BEST_PRACTICES,
  TROUBLESHOOTING,
  API_PARAMETERS,
  PRICING,
  generateRetabResponse,
};
