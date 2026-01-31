import React, { useState } from "react";
import {
  Settings,
  Zap,
  Image,
  Target,
  Users,
  DollarSign,
  Info,
  Check,
  AlertTriangle,
  Sparkles,
  X,
  ChevronDown,
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
// SECTION WRAPPER
// ============================================================================

function SettingSection({ icon: Icon, title, description, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// MODEL SELECTOR - Compact cards
// ============================================================================

function ModelSelector({ value, onChange }) {
  return (
    <SettingSection icon={Zap} title="AI Model">
      <div className="grid grid-cols-3 gap-2">
        {Object.values(RETAB_MODELS).map((model) => {
          const isSelected = value === model.id;
          return (
            <button
              key={model.id}
              onClick={() => onChange(model.id)}
              className={cn(
                "p-3 rounded-lg border text-left transition-all",
                isSelected
                  ? "border-[#9e2339] bg-[#9e2339]/5"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-[#9e2339]" : "text-gray-900"
                )}>
                  {model.name}
                </span>
                {model.default && (
                  <span className="text-[9px] text-gray-400">★</span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 leading-tight">{model.description}</p>
              <p className={cn(
                "text-xs font-semibold mt-1.5",
                isSelected ? "text-[#9e2339]" : "text-gray-700"
              )}>
                ${model.costPerPage.toFixed(3)}/pg
              </p>
            </button>
          );
        })}
      </div>
    </SettingSection>
  );
}

// ============================================================================
// CONSENSUS SELECTOR - Compact segmented control
// ============================================================================

function ConsensusSelector({ value, onChange }) {
  return (
    <SettingSection icon={Target} title="Consensus">
      <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-md">
        {CONSENSUS_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              title={option.description}
              className={cn(
                "flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all",
                isSelected
                  ? "bg-white text-[#9e2339] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {option.value === 1 ? "Off" : `${option.value}×`}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500">
        Retab: 4× for schema building, 5× for dev. When consensus &gt; 1, temperature is raised slightly (API requirement).
      </p>
    </SettingSection>
  );
}

// ============================================================================
// DPI SELECTOR - Compact pills
// ============================================================================

function DpiSelector({ value, onChange }) {
  return (
    <SettingSection icon={Image} title="DPI">
      <div className="flex items-center gap-1">
        {DPI_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex-1 py-1.5 px-2 rounded border text-xs font-medium transition-all",
                isSelected
                  ? "border-[#9e2339] bg-[#9e2339]/5 text-[#9e2339]"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {option.value}
            </button>
          );
        })}
      </div>
    </SettingSection>
  );
}

// ============================================================================
// CONFIDENCE THRESHOLD - Simple dropdown
// ============================================================================

function ConfidenceSelector({ value, onChange }) {
  return (
    <SettingSection icon={Users} title="Review Threshold">
      <select
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#9e2339]"
      >
        {CONFIDENCE_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
    </SettingSection>
  );
}

// ============================================================================
// CONCURRENCY SLIDER
// ============================================================================

function ConcurrencySelector({ value, onChange }) {
  return (
    <SettingSection icon={Settings} title="Concurrency">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="1"
          max="10"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#9e2339]"
        />
        <span className="w-6 text-center text-sm font-medium text-gray-700">{value}</span>
      </div>
    </SettingSection>
  );
}

// ============================================================================
// COST SUMMARY - Compact inline
// ============================================================================

function CostSummary({ config }) {
  const estimate = estimateCost(10, config);
  
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
      <span className="text-gray-600">Est. cost (10 pages)</span>
      <span className="font-semibold text-green-600">${estimate.totalCost.toFixed(2)}</span>
    </div>
  );
}

// ============================================================================
// MAIN SETTINGS PANEL
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
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Settings</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <ModelSelector
          value={settings.model}
          onChange={(v) => handleChange("model", v)}
        />
        
        <ConsensusSelector
          value={settings.nConsensus}
          onChange={(v) => handleChange("nConsensus", v)}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <DpiSelector
            value={settings.imageDpi}
            onChange={(v) => handleChange("imageDpi", v)}
          />
          <ConfidenceSelector
            value={settings.confidenceThreshold}
            onChange={(v) => handleChange("confidenceThreshold", v)}
          />
        </div>
        
        <ConcurrencySelector
          value={settings.concurrency}
          onChange={(v) => handleChange("concurrency", v)}
        />
        
        <CostSummary config={settings} />
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 shrink-0">
        <button 
          onClick={handleReset}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Reset
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="h-8" onClick={handleSave} disabled={!hasChanges}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROCESSING CONFIG OVERRIDE (for upload page)
// ============================================================================

export function ProcessingConfigOverride({ config, onChange, globalConfig }) {
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
    <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
      {/* Left side - settings info */}
      <div className="flex items-center gap-3">
        <Sparkles className="h-4 w-4 text-purple-500" />
        
        {!isCustom ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Settings:</span>
            <span className="font-medium text-gray-700">
              {RETAB_MODELS[globalConfig.model]?.name}
            </span>
            <span className="text-gray-300">·</span>
            <span className="font-medium text-gray-700">
              {globalConfig.nConsensus === 1 ? "No consensus" : `${globalConfig.nConsensus}× consensus`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <select
              value={currentConfig.model}
              onChange={(e) => handleChange("model", e.target.value)}
              className="text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#9e2339]"
            >
              {Object.values(RETAB_MODELS).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <select
              value={currentConfig.nConsensus}
              onChange={(e) => handleChange("nConsensus", parseInt(e.target.value))}
              className="text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#9e2339]"
            >
              {CONSENSUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value === 1 ? "No consensus" : `${opt.value}× consensus`}
                </option>
              ))}
            </select>
            <select
              value={currentConfig.imageDpi}
              onChange={(e) => handleChange("imageDpi", parseInt(e.target.value))}
              className="text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#9e2339]"
            >
              {DPI_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} DPI
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      {/* Right side - customize toggle */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
      >
        {isCustom ? "Reset" : "Customize"}
      </button>
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
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-xs"
    >
      <Zap className={cn(
        "h-3 w-3",
        model.color === "blue" && "text-blue-500",
        model.color === "green" && "text-green-500",
        model.color === "purple" && "text-purple-500",
      )} />
      <span className="font-medium text-gray-700">{model.name}</span>
      {consensus > 1 && (
        <>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{consensus}×</span>
        </>
      )}
    </button>
  );
}

export default RetabSettingsPanel;
