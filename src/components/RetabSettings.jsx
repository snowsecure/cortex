import React, { useState, useEffect } from "react";
import {
  Settings,
  Zap,
  Gauge,
  Image,
  Target,
  Users,
  DollarSign,
  Info,
  Check,
  AlertTriangle,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import {
  DEFAULT_CONFIG,
  RETAB_MODELS,
  CONSENSUS_OPTIONS,
  DPI_OPTIONS,
  CONFIDENCE_PRESETS,
  loadSettings,
  saveSettings,
  estimateCost,
} from "../lib/retabConfig";

// ============================================================================
// MODEL SELECTOR
// ============================================================================

function ModelSelector({ value, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">AI Model</label>
        <Badge variant="secondary" className="text-xs">
          Credits/page: {RETAB_MODELS[value]?.creditsPerPage || 1}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Object.values(RETAB_MODELS).map((model) => (
          <button
            key={model.id}
            onClick={() => onChange(model.id)}
            className={cn(
              "relative p-4 rounded-lg border-2 text-left transition-all",
              value === model.id
                ? "border-[#9e2339] bg-[#9e2339]/5"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            {model.default && (
              <Badge className="absolute -top-2 -right-2 text-[10px]" variant="secondary">
                Default
              </Badge>
            )}
            <div className="flex items-center gap-2 mb-2">
              <Zap className={cn(
                "h-4 w-4",
                model.color === "blue" && "text-blue-500",
                model.color === "green" && "text-green-500",
                model.color === "purple" && "text-purple-500",
              )} />
              <span className="font-medium">{model.name}</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">{model.description}</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Speed:</span>
              <span className="font-medium">{model.speed}</span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-400">Accuracy:</span>
              <span className="font-medium">{model.accuracy}</span>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              ${model.costPerPage.toFixed(3)}/page
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// CONSENSUS SELECTOR
// ============================================================================

function ConsensusSelector({ value, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Consensus Mode
          <span className="ml-2 text-xs text-gray-400 font-normal">
            (multiple extractions for higher accuracy)
          </span>
        </label>
      </div>
      <div className="space-y-2">
        {CONSENSUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all",
              value === option.value
                ? "border-[#9e2339] bg-[#9e2339]/5"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="flex items-center gap-3">
              {value === option.value && (
                <Check className="h-4 w-4 text-[#9e2339]" />
              )}
              <div>
                <span className="font-medium">{option.label}</span>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>
            </div>
            <Badge variant={option.value === 1 ? "secondary" : "default"} className="text-xs">
              {option.multiplier}x cost
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COST ESTIMATOR
// ============================================================================

function CostEstimator({ config, pageCount = 10 }) {
  const estimate = estimateCost(pageCount, config);
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg border">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Cost Estimate</span>
        <span className="text-xs text-gray-400">({pageCount} pages)</span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {estimate.totalCredits.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500">Credits</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600">
            ${estimate.totalCost.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">Total Cost</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-600">
            ${estimate.perPageCost.toFixed(3)}
          </p>
          <p className="text-xs text-gray-500">Per Page</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// GLOBAL SETTINGS PANEL
// ============================================================================

export function RetabSettingsPanel({ onClose, onSave }) {
  const [settings, setSettings] = useState(loadSettings);
  const [hasChanges, setHasChanges] = useState(false);
  
  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const handleSave = () => {
    saveSettings(settings);
    setHasChanges(false);
    onSave?.(settings);
  };
  
  const handleReset = () => {
    setSettings(DEFAULT_CONFIG);
    setHasChanges(true);
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-gray-400" />
          <div>
            <h2 className="font-semibold text-gray-900">Retab Settings</h2>
            <p className="text-xs text-gray-500">Configure global extraction defaults</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Model Selection */}
        <ModelSelector
          value={settings.model}
          onChange={(v) => handleChange("model", v)}
        />
        
        {/* Consensus */}
        <ConsensusSelector
          value={settings.nConsensus}
          onChange={(v) => handleChange("nConsensus", v)}
        />
        
        {/* DPI */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Image className="h-4 w-4" />
            Image Resolution (DPI)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {DPI_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleChange("imageDpi", option.value)}
                className={cn(
                  "p-3 rounded-lg border-2 text-center transition-all",
                  settings.imageDpi === option.value
                    ? "border-[#9e2339] bg-[#9e2339]/5"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <span className="font-medium">{option.label}</span>
                <p className="text-xs text-gray-500 mt-1">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
        
        {/* Confidence Threshold */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Auto-Approval Threshold
            <span className="text-xs text-gray-400 font-normal">
              (documents below this require human review)
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CONFIDENCE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleChange("confidenceThreshold", preset.value)}
                className={cn(
                  "p-3 rounded-lg border-2 text-left transition-all",
                  settings.confidenceThreshold === preset.value
                    ? "border-[#9e2339] bg-[#9e2339]/5"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <span className="font-medium">{preset.label}</span>
                <p className="text-xs text-gray-500 mt-1">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>
        
        {/* Concurrency */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Processing Concurrency
            <span className="text-xs text-gray-400 font-normal">
              (parallel document processing)
            </span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="10"
              value={settings.concurrency}
              onChange={(e) => handleChange("concurrency", parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="w-12 text-center font-medium">{settings.concurrency}</span>
          </div>
          <p className="text-xs text-gray-500">
            Higher values process faster but may hit API rate limits
          </p>
        </div>
        
        {/* Cost Estimator */}
        <CostEstimator config={settings} pageCount={10} />
        
        {/* Info */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">About Retab Consensus</p>
              <p className="text-blue-700">
                Consensus mode runs multiple parallel extractions and compares results. 
                Higher consensus values improve accuracy but increase cost proportionally.
                Use n_consensus=3+ for critical documents.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t bg-gray-50 shrink-0">
        <Button variant="ghost" onClick={handleReset}>
          Reset to Defaults
        </Button>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Unsaved changes
            </span>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Check className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BATCH CONFIG OVERRIDE (for upload page)
// ============================================================================

export function BatchConfigOverride({ config, onChange, globalConfig }) {
  const [isCustom, setIsCustom] = useState(false);
  
  const currentConfig = isCustom ? config : globalConfig;
  
  const handleToggle = () => {
    if (!isCustom) {
      onChange({ ...globalConfig });
    }
    setIsCustom(!isCustom);
  };
  
  const handleChange = (key, value) => {
    onChange({ ...currentConfig, [key]: value });
  };
  
  return (
    <div className="border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium">Processing Settings</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-500">Custom for this batch</span>
          <div 
            className={cn(
              "relative w-10 h-5 rounded-full transition-colors",
              isCustom ? "bg-[#9e2339]" : "bg-gray-300"
            )}
            onClick={handleToggle}
          >
            <div 
              className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                isCustom ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </div>
        </label>
      </div>
      
      {/* Current Settings Summary */}
      <div className="p-3">
        {!isCustom ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Using global defaults:</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {RETAB_MODELS[globalConfig.model]?.name || "Small"}
              </Badge>
              <Badge variant="secondary">
                {globalConfig.nConsensus === 1 ? "No consensus" : `${globalConfig.nConsensus}x consensus`}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Model */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Model:</span>
              <select
                value={currentConfig.model}
                onChange={(e) => handleChange("model", e.target.value)}
                className="text-sm border rounded px-2 py-1"
              >
                {Object.values(RETAB_MODELS).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} (${model.costPerPage}/pg)
                  </option>
                ))}
              </select>
            </div>
            
            {/* Consensus */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Consensus:</span>
              <select
                value={currentConfig.nConsensus}
                onChange={(e) => handleChange("nConsensus", parseInt(e.target.value))}
                className="text-sm border rounded px-2 py-1"
              >
                {CONSENSUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* DPI */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Image DPI:</span>
              <select
                value={currentConfig.imageDpi}
                onChange={(e) => handleChange("imageDpi", parseInt(e.target.value))}
                className="text-sm border rounded px-2 py-1"
              >
                {DPI_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Estimated cost */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Est. cost per page:</span>
                <span className="font-medium text-green-600">
                  ${(RETAB_MODELS[currentConfig.model].costPerPage * currentConfig.nConsensus * 2).toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// QUICK SETTINGS BADGE (for header)
// ============================================================================

export function QuickSettingsBadge({ config, onClick }) {
  const model = RETAB_MODELS[config?.model] || RETAB_MODELS["retab-small"];
  const consensus = config?.nConsensus || 1;
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
    >
      <Zap className={cn(
        "h-3 w-3",
        model.color === "blue" && "text-blue-500",
        model.color === "green" && "text-green-500",
        model.color === "purple" && "text-purple-500",
      )} />
      <span className="text-xs font-medium">{model.name}</span>
      {consensus > 1 && (
        <>
          <span className="text-gray-300">|</span>
          <span className="text-xs">{consensus}x</span>
        </>
      )}
    </button>
  );
}

export default RetabSettingsPanel;
