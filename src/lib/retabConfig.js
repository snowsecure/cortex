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
  confidenceThreshold: 0.7,
  
  // Processing concurrency
  concurrency: 5,
};

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
 * Calculate estimated cost for a run
 */
export function estimateCost(pageCount, config = {}) {
  const model = RETAB_MODELS[config.model || DEFAULT_CONFIG.model];
  const consensus = config.nConsensus || DEFAULT_CONFIG.nConsensus;
  
  // Split cost (1x regardless of consensus)
  const splitCredits = pageCount * model.creditsPerPage;
  
  // Extract cost (multiplied by consensus)
  const extractCredits = pageCount * model.creditsPerPage * consensus;
  
  const totalCredits = splitCredits + extractCredits;
  const totalCost = totalCredits * 0.01;
  
  return {
    splitCredits,
    extractCredits,
    totalCredits,
    totalCost,
    perPageCredits: totalCredits / pageCount,
    perPageCost: totalCost / pageCount,
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

export default {
  DEFAULT_CONFIG,
  RETAB_MODELS,
  CONSENSUS_OPTIONS,
  DPI_OPTIONS,
  CONFIDENCE_PRESETS,
  loadSettings,
  saveSettings,
  estimateCost,
  getConfigSummary,
};
