/**
 * Retab Configuration Management
 * Handles global settings and per-run overrides
 */

// Storage key for persisting settings
const SETTINGS_KEY = "sail_retab_settings";

// Default configuration
export const DEFAULT_CONFIG = {
  // Model selection
  model: "retab-small",
  
  // Consensus (1 = disabled, 2-5 = enabled)
  nConsensus: 1,
  
  // Image resolution (DPI)
  imageDpi: 192,
  
  // Temperature (0 = deterministic, higher = more variation)
  temperature: 0.0,
  
  // Confidence threshold for auto-approval (0-1)
  confidenceThreshold: 0.75,
  
  // Processing concurrency
  concurrency: 5,

  // Advanced features
  chunkingKeys: false,    // Parallel OCR for long lists and tables
  sourceQuotes: false,    // Include verbatim source text for each field (X-SourceQuote)
  reasoningPrompts: false, // Show AI reasoning for complex extractions (X-ReasoningPrompt)

  // Cost optimization: uses retab-micro for splitting and simple doc types,
  // reserves the user-selected model for complex documents only.
  costOptimize: true,
};

/**
 * Category complexity classification for smart model routing.
 * When costOptimize is enabled:
 *   - "simple" categories use retab-micro (cheap) with no consensus
 *   - "complex" categories use the user-configured model + consensus
 * Splitting always uses retab-micro regardless.
 */
export const CATEGORY_COMPLEXITY = {
  // Simple: mostly text/form fields, straightforward schemas
  cover_sheet: "simple",
  transaction_summary: "simple",
  tax_reports: "simple",
  affidavit: "simple",
  other_recorded: "simple",
  notices_agreements: "simple",

  // Complex: signature verification, legal precision, complex layouts
  recorded_transfer_deed: "complex",
  deed_of_trust_mortgage: "complex",
  mortgage_child_docs: "complex",
  tax_lien: "complex",
  mechanics_lien: "complex",
  hoa_lien: "complex",
  judgment_lien: "complex",
  judgments: "complex",
  ucc_filing: "complex",
  easement: "complex",
  ccr_restrictions: "complex",
  lis_pendens: "complex",
  court_order: "complex",
  probate_document: "complex",
  bankruptcy_document: "complex",
  foreclosure_notice: "complex",
  prior_policy: "complex",
  survey_plat: "complex",
  property_details: "complex",
  power_of_attorney: "complex",
  entity_authority: "complex",
  trust_certification: "complex",
  settlement_statement: "complex",
  lease_document: "complex",
};

/**
 * Get the appropriate extraction model for a document category.
 * When costOptimize is on, simple categories use retab-micro.
 */
export function getModelForCategory(category, userModel, costOptimize = false) {
  if (!costOptimize) return userModel || DEFAULT_CONFIG.model;
  const complexity = CATEGORY_COMPLEXITY[category] || "complex";
  if (complexity === "simple") return "retab-micro";
  return userModel || DEFAULT_CONFIG.model;
}

/**
 * Get consensus for a document category under cost optimization.
 * Simple categories skip consensus (nConsensus=1) even when the user has it enabled.
 */
export function getConsensusForCategory(category, userConsensus, costOptimize = false) {
  if (!costOptimize) return userConsensus || DEFAULT_CONFIG.nConsensus;
  const complexity = CATEGORY_COMPLEXITY[category] || "complex";
  if (complexity === "simple") return 1;
  return userConsensus || DEFAULT_CONFIG.nConsensus;
}

// Model definitions with pricing and capabilities
export const RETAB_MODELS = {
  "retab-micro": {
    id: "retab-micro",
    name: "Micro",
    description: "Fast & cheap for simple documents",
    creditsPerPage: 0.2,
    costPerPage: 0.002,
    speed: "Fastest",
    accuracy: "Basic",
    recommended: ["Simple forms", "High volume", "Cost-sensitive"],
    color: "blue",
  },
  "retab-small": {
    id: "retab-small",
    name: "Small",
    description: "Balanced accuracy and cost",
    creditsPerPage: 1.0,
    costPerPage: 0.01,
    speed: "Fast",
    accuracy: "Good",
    recommended: ["Standard documents", "Most use cases", "Production"],
    color: "green",
    default: true,
  },
  "retab-large": {
    id: "retab-large",
    name: "Large",
    description: "Maximum accuracy for complex documents",
    creditsPerPage: 3.0,
    costPerPage: 0.03,
    speed: "Slower",
    accuracy: "Highest",
    recommended: ["Complex layouts", "Handwritten text", "Critical extractions"],
    color: "purple",
  },
  "auto-small": {
    id: "auto-small",
    name: "Auto (Small)",
    description: "Auto-routes to best model (small tier)",
    creditsPerPage: 1.0,
    costPerPage: 0.01,
    speed: "Fast",
    accuracy: "Smart",
    recommended: ["Varied document types", "Automatic optimization"],
    color: "teal",
  },
  "auto-large": {
    id: "auto-large",
    name: "Auto (Large)",
    description: "Auto-routes to best model (large tier)",
    creditsPerPage: 3.0,
    costPerPage: 0.03,
    speed: "Varies",
    accuracy: "Smart",
    recommended: ["Complex mixed documents", "Maximum auto-optimization"],
    color: "indigo",
  },
};

// Consensus options (aligned with Retab docs: docs.retab.com/overview/Build-your-Schema)
export const CONSENSUS_OPTIONS = [
  { value: 1, label: "Disabled", description: "Single extraction (fastest, cheapest)", multiplier: 1 },
  { value: 2, label: "2x Consensus", description: "Compare 2 extractions", multiplier: 2 },
  { value: 3, label: "3x Consensus", description: "Recommended for production", multiplier: 3 },
  { value: 4, label: "4x Consensus", description: "Schema building / high accuracy (Retab)", multiplier: 4 },
  { value: 5, label: "5x Consensus", description: "Dev & testing — max accuracy (Retab)", multiplier: 5 },
];

// DPI options
export const DPI_OPTIONS = [
  { value: 96, label: "96 DPI", description: "Faster, lower quality" },
  { value: 150, label: "150 DPI", description: "Balanced" },
  { value: 192, label: "192 DPI", description: "Default, good quality" },
  { value: 300, label: "300 DPI", description: "High quality, slower" },
];

// Confidence threshold presets (Retab: ≥0.75 production, ≥0.95 production readiness)
export const CONFIDENCE_PRESETS = [
  { value: 0.5, label: "Permissive (50%)", description: "More auto-approvals, more errors" },
  { value: 0.7, label: "Standard (70%)", description: "Balanced" },
  { value: 0.75, label: "Retab production (75%)", description: "Retab recommended for production" },
  { value: 0.8, label: "Strict (80%)", description: "More reviews, fewer errors" },
  { value: 0.9, label: "Very strict (90%)", description: "Most docs need review" },
  { value: 0.95, label: "Retab best (95%)", description: "Production readiness (Retab)" },
];

/**
 * Load settings from localStorage
 */
export function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to load Retab settings:", e);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save Retab settings:", e);
  }
}

/**
 * Calculate estimated cost for a run.
 * When costOptimize is enabled, uses a blended estimate:
 *   - Split always uses retab-micro
 *   - ~30% of pages assumed simple (retab-micro, no consensus)
 *   - ~70% of pages assumed complex (user model + consensus)
 */
export function estimateCost(pageCount, config = {}) {
  const userModel = RETAB_MODELS[config.model || DEFAULT_CONFIG.model];
  const consensus = config.nConsensus || DEFAULT_CONFIG.nConsensus;
  const costOptimize = config.costOptimize ?? DEFAULT_CONFIG.costOptimize;

  if (costOptimize) {
    const microModel = RETAB_MODELS["retab-micro"];

    // Split always uses micro when optimized
    const splitCredits = pageCount * microModel.creditsPerPage;

    // Blended extraction: ~30% simple (micro, no consensus), ~70% complex (user model + consensus)
    const simpleRatio = 0.30;
    const simplePages = Math.round(pageCount * simpleRatio);
    const complexPages = pageCount - simplePages;

    const extractCredits =
      (simplePages * microModel.creditsPerPage * 1) +
      (complexPages * userModel.creditsPerPage * consensus);

    const totalCredits = splitCredits + extractCredits;
    const totalCost = totalCredits * 0.01;

    return {
      splitCredits,
      extractCredits,
      totalCredits,
      totalCost,
      perPageCredits: pageCount > 0 ? totalCredits / pageCount : 0,
      perPageCost: pageCount > 0 ? totalCost / pageCount : 0,
      optimized: true,
    };
  }

  // Non-optimized: uniform model for split + extract
  const splitCredits = pageCount * userModel.creditsPerPage;
  const extractCredits = pageCount * userModel.creditsPerPage * consensus;
  
  const totalCredits = splitCredits + extractCredits;
  const totalCost = totalCredits * 0.01;
  
  return {
    splitCredits,
    extractCredits,
    totalCredits,
    totalCost,
    perPageCredits: pageCount > 0 ? totalCredits / pageCount : 0,
    perPageCost: pageCount > 0 ? totalCost / pageCount : 0,
    optimized: false,
  };
}

/**
 * Get display info for current config
 */
export function getConfigSummary(config = {}) {
  const model = RETAB_MODELS[config.model || DEFAULT_CONFIG.model];
  const consensus = CONSENSUS_OPTIONS.find(c => c.value === (config.nConsensus || DEFAULT_CONFIG.nConsensus));
  
  return {
    model: model.name,
    modelDescription: model.description,
    consensus: consensus.label,
    creditsPerPage: model.creditsPerPage * (config.nConsensus || 1),
    costPerPage: model.costPerPage * (config.nConsensus || 1),
  };
}

// Quality presets aligned with Retab best practices
export const QUALITY_PRESETS = [
  { id: "draft", name: "Draft", model: "retab-micro", nConsensus: 1, imageDpi: 150, costOptimize: false, tooltip: "Quick preview, lowest cost. Good for simple forms." },
  { id: "costopt", name: "Cost Opt.", model: "retab-small", nConsensus: 1, imageDpi: 192, costOptimize: true, tooltip: "Smart routing: simple docs use micro, complex docs use Small. Saves ~40-60%." },
  { id: "standard", name: "Standard", model: "retab-small", nConsensus: 1, imageDpi: 192, costOptimize: false, tooltip: "Balanced accuracy and cost. Good for most documents." },
  { id: "production", name: "Production", model: "retab-small", nConsensus: 3, imageDpi: 192, costOptimize: true, tooltip: "Production-ready with consensus for complex docs. Smart routing saves on simple docs." },
  { id: "best", name: "Best", model: "retab-large", nConsensus: 4, imageDpi: 192, costOptimize: false, tooltip: "Highest accuracy. Retab recommends 4x consensus for production." },
];

/**
 * Match a config object to a named quality preset.
 * Returns the preset id ("draft", "standard", etc.) or "custom" if no match.
 */
export function getActivePreset(config) {
  if (!config) return "standard";
  for (const preset of QUALITY_PRESETS) {
    if (
      config.model === preset.model &&
      config.nConsensus === preset.nConsensus &&
      config.imageDpi === preset.imageDpi &&
      (config.costOptimize ?? false) === preset.costOptimize
    ) {
      return preset.id;
    }
  }
  return "custom";
}

export default {
  DEFAULT_CONFIG,
  RETAB_MODELS,
  CONSENSUS_OPTIONS,
  DPI_OPTIONS,
  CONFIDENCE_PRESETS,
  CATEGORY_COMPLEXITY,
  QUALITY_PRESETS,
  loadSettings,
  saveSettings,
  estimateCost,
  getConfigSummary,
  getModelForCategory,
  getConsensusForCategory,
  getActivePreset,
};
