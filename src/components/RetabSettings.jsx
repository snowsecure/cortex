import React, { useState } from "react";
import {
  X,
  Zap,
  Target,
  Settings,
  Image,
  Users,
  Cpu,
  Layers,
  ScanLine,
  FlaskConical,
  Quote,
  BrainCircuit,
  TableProperties,
  TrendingDown,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  loadSettings,
  saveSettings,
  DEFAULT_CONFIG,
  RETAB_MODELS,
  CONSENSUS_OPTIONS,
  DPI_OPTIONS,
  CONFIDENCE_PRESETS,
  QUALITY_PRESETS,
  estimateCost,
  getConfigSummary,
  getActivePreset,
} from "../lib/retabConfig";

function SettingSection({ icon: Icon, title, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {Icon && <Icon className="h-4 w-4 text-gray-500" />}
        {title}
      </div>
      {children}
    </div>
  );
}

function ModelSelector({ value, onChange }) {
  const modelEntries = Object.entries(RETAB_MODELS);
  return (
    <SettingSection icon={Zap} title="AI Model">
      <div className="grid grid-cols-3 gap-2">
        {modelEntries.slice(0, 3).map(([id, model]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange("model", id)}
            className={`p-3 rounded-lg border text-left text-sm transition-colors ${
              value === id
                ? "border-[#9e2339] bg-[#9e2339]/5 text-[#9e2339]"
                : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
            }`}
          >
            <div className="font-medium">{model.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{model.description}</div>
            <div className="text-xs font-medium text-gray-600 mt-1">
              ${model.costPerPage.toFixed(3)}/pg
            </div>
          </button>
        ))}
      </div>
      {modelEntries.length > 3 && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {modelEntries.slice(3).map(([id, model]) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange("model", id)}
              className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                value === id
                  ? "border-[#9e2339] bg-[#9e2339]/5 text-[#9e2339]"
                  : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
              }`}
            >
              <div className="font-medium">{model.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{model.description}</div>
              <div className="text-xs font-medium text-gray-600 mt-1">
                ~${model.costPerPage.toFixed(3)}/pg
              </div>
            </button>
          ))}
        </div>
      )}
    </SettingSection>
  );
}

function ConsensusSelector({ value, onChange }) {
  const options = [
    { value: 1, label: "Off" },
    ...CONSENSUS_OPTIONS.filter((c) => c.value > 1).map((c) => ({ value: c.value, label: `${c.value}x` })),
  ];
  return (
    <SettingSection icon={Target} title="Consensus">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange("nConsensus", opt.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              value === opt.value
                ? "bg-[#9e2339] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Higher consensus = better accuracy. Retab recommends 4x for production, 5x for testing.
      </p>
    </SettingSection>
  );
}

function DPISelector({ value, onChange }) {
  return (
    <SettingSection icon={Image} title="DPI">
      <div className="flex flex-wrap gap-2">
        {DPI_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange("imageDpi", opt.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              value === opt.value
                ? "bg-[#9e2339] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {opt.value}
          </button>
        ))}
      </div>
    </SettingSection>
  );
}

function ReviewThresholdSelector({ value, onChange }) {
  return (
    <SettingSection icon={Users} title="Review Threshold">
      <select
        value={value}
        onChange={(e) => onChange("confidenceThreshold", parseFloat(e.target.value))}
        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-sm"
      >
        {CONFIDENCE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </SettingSection>
  );
}

function ConcurrencySelector({ value, onChange }) {
  return (
    <SettingSection icon={Settings} title="Concurrency">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange("concurrency", parseInt(e.target.value, 10))}
          className="flex-1 h-2 rounded-full appearance-none bg-gray-200 accent-[#9e2339]"
        />
        <span className="text-sm font-medium w-6">{value}</span>
      </div>
    </SettingSection>
  );
}

// Advanced feature toggle definitions
const ADVANCED_FEATURES = [
  {
    key: "costOptimize",
    label: "Smart Routing",
    icon: TrendingDown,
    description: "Use cheap model for simple docs, full model for complex",
    tooltip: "Splits always use retab-micro. Simple document types (cover sheets, tax reports, affidavits) are extracted with retab-micro at no consensus. Complex types (deeds, mortgages, liens) use your selected model + consensus. Saves ~40-60% on typical batches with minimal accuracy trade-off.",
  },
  {
    key: "sourceQuotes",
    label: "Source Quotes",
    icon: Quote,
    description: "Include verbatim source text for each extracted field",
    tooltip: "Adds X-SourceQuote annotations to schema fields. Retab returns source___fieldname fields with the exact text from the document that supports each value. Useful for audit trails and compliance.",
  },
  {
    key: "reasoningPrompts",
    label: "Reasoning",
    icon: BrainCircuit,
    description: "Show AI reasoning for numeric/complex extractions",
    tooltip: "Adds X-ReasoningPrompt annotations to numeric fields. The AI shows its work (calculations, unit conversions) before providing the final answer, improving accuracy.",
  },
  {
    key: "chunkingKeys",
    label: "Chunking Keys",
    icon: TableProperties,
    description: "Parallel OCR for long lists and tables",
    tooltip: "Automatically detects array fields in the schema and tells Retab to parallelize OCR on long lists/tables for faster extraction.",
  },
];

function FeatureToggle({ feature, enabled, onChange }) {
  const Icon = feature.icon;
  return (
    <button
      type="button"
      onClick={() => onChange(feature.key, !enabled)}
      title={feature.tooltip}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-sm transition-all ${
        enabled
          ? "bg-[#9e2339]/5 dark:bg-[#9e2339]/15 border-[#9e2339]/30 text-[#9e2339] dark:text-[#d45a6a]"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${enabled ? "text-[#9e2339] dark:text-[#d45a6a]" : "text-gray-400 dark:text-gray-500"}`} />
      <div className="min-w-0">
        <div className="font-medium text-xs">{feature.label}</div>
        <div className={`text-[10px] leading-tight mt-0.5 ${enabled ? "text-[#9e2339]/60 dark:text-[#d45a6a]/70" : "text-gray-400 dark:text-gray-500"}`}>
          {feature.description}
        </div>
      </div>
      <div className={`ml-auto shrink-0 w-8 h-[18px] rounded-full transition-colors ${
        enabled ? "bg-[#9e2339]" : "bg-gray-300 dark:bg-gray-600"
      }`}>
        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform mt-[2px] ${
          enabled ? "translate-x-[18px]" : "translate-x-[2px]"
        }`} />
      </div>
    </button>
  );
}

function AdvancedFeaturesSection({ config, onChange }) {
  return (
    <SettingSection icon={FlaskConical} title="Advanced Features">
      <div className="grid grid-cols-2 gap-2">
        {ADVANCED_FEATURES.map((feature) => (
          <FeatureToggle
            key={feature.key}
            feature={feature}
            enabled={!!config[feature.key]}
            onChange={onChange}
          />
        ))}
      </div>
    </SettingSection>
  );
}

// Global quality presets (same as ProcessingConfigOverride)
const SETTINGS_PRESETS = [
  { id: "draft", name: "Draft", model: "retab-micro", nConsensus: 1, imageDpi: 150, costOptimize: false },
  { id: "costopt", name: "Cost Opt.", model: "retab-small", nConsensus: 1, imageDpi: 192, costOptimize: true },
  { id: "standard", name: "Standard", model: "retab-small", nConsensus: 1, imageDpi: 192, costOptimize: false },
  { id: "production", name: "Production", model: "retab-small", nConsensus: 3, imageDpi: 192, costOptimize: true },
  { id: "best", name: "Best", model: "retab-large", nConsensus: 4, imageDpi: 192, costOptimize: false },
];

function getSettingsPreset(config) {
  for (const preset of SETTINGS_PRESETS) {
    if (
      config.model === preset.model &&
      config.nConsensus === preset.nConsensus &&
      config.imageDpi === preset.imageDpi &&
      (config.costOptimize ?? false) === preset.costOptimize
    ) {
      return preset.id;
    }
  }
  return null;
}

function PresetSelector({ settings, onBatchChange }) {
  const activePreset = getSettingsPreset(settings);
  
  const applyPreset = (presetId) => {
    const preset = SETTINGS_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onBatchChange({
        model: preset.model,
        nConsensus: preset.nConsensus,
        imageDpi: preset.imageDpi,
        costOptimize: preset.costOptimize,
      });
    }
  };
  
  return (
    <SettingSection icon={Zap} title="Quick Presets">
      <div className="grid grid-cols-5 gap-2">
        {SETTINGS_PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={`p-2 rounded-lg text-center text-sm transition-all border ${
                isActive
                  ? "bg-[#9e2339]/5 dark:bg-[#9e2339]/20 border-[#9e2339]/30 text-[#9e2339] dark:text-[#d45a6a]"
                  : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
              }`}
            >
              <div className="font-medium text-xs">{preset.name}</div>
              {preset.costOptimize && (
                <div className="text-[10px] mt-0.5 text-teal-600 dark:text-teal-400">Smart</div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Or customize individual settings below
      </p>
    </SettingSection>
  );
}

export function RetabSettingsPanel({ onClose, onSave }) {
  const [settings, setSettings] = useState(loadSettings);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };
  
  const handleBatchChange = (changes) => {
    setSettings((prev) => ({ ...prev, ...changes }));
  };

  const handleSave = () => {
    saveSettings(settings);
    onSave?.(settings);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_CONFIG });
  };

  const est = estimateCost(10, settings);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <PresetSelector settings={settings} onBatchChange={handleBatchChange} />
        
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-6">
          <ModelSelector value={settings.model} onChange={handleChange} />
          <ConsensusSelector value={settings.nConsensus} onChange={handleChange} />
          <DPISelector value={settings.imageDpi} onChange={handleChange} />
        </div>
        
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-6">
          <AdvancedFeaturesSection config={settings} onChange={handleChange} />
        </div>
        
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-6">
          <ReviewThresholdSelector value={settings.confidenceThreshold} onChange={handleChange} />
          <ConcurrencySelector value={settings.concurrency} onChange={handleChange} />
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-300 pt-2 space-y-1">
          <div>
            Est. cost (10 pages){" "}
            <span className="font-semibold text-[#9e2339]">${est.totalCost.toFixed(2)}</span>
            {est.optimized && (
              <span className="ml-1.5 text-xs text-teal-600 dark:text-teal-400 font-medium">
                Smart routing on
              </span>
            )}
          </div>
          {settings.costOptimize && (
            <p className="text-xs text-teal-600/70 dark:text-teal-400/60">
              Simple docs use retab-micro; complex docs use {RETAB_MODELS[settings.model]?.name || settings.model}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 shrink-0">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Reset
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-[#9e2339] hover:bg-[#9e2339]/90">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// QUALITY_PRESETS and getActivePreset imported from retabConfig.js

export function ProcessingConfigOverride({ config, onChange, globalConfig }) {
  const [showCustom, setShowCustom] = useState(false);
  const currentConfig = config || globalConfig || DEFAULT_CONFIG;
  const activePreset = getActivePreset(currentConfig);
  const isCustom = activePreset === "custom" || showCustom;
  
  const handlePresetChange = (presetId) => {
    const preset = QUALITY_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onChange({ ...currentConfig, model: preset.model, nConsensus: preset.nConsensus, imageDpi: preset.imageDpi, costOptimize: preset.costOptimize });
      setShowCustom(false);
    }
  };
  
  const handleCustomChange = (key, value) => {
    onChange({ ...currentConfig, [key]: value });
  };

  return (
    <div className="pt-6 space-y-3">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Extraction Quality</p>
      
      {/* Quality preset boxes */}
      <div className="grid grid-cols-3 gap-2">
        {QUALITY_PRESETS.map((preset) => {
          const isActive = activePreset === preset.id && !showCustom;
          const model = RETAB_MODELS[preset.model]?.name || preset.model;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetChange(preset.id)}
              title={preset.tooltip}
              className={`p-3 rounded-lg transition-all text-left border ${
                isActive
                  ? "bg-[#9e2339]/5 dark:bg-[#9e2339]/20 border-[#9e2339]/30"
                  : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className={`font-medium ${isActive ? "text-[#9e2339] dark:text-[#d45a6a]" : "text-gray-600 dark:text-gray-300"}`}>{preset.name}</span>
                {preset.costOptimize && <TrendingDown className="h-3 w-3 text-teal-500" />}
              </div>
              <div className={`text-xs mt-1 space-y-0.5 ${isActive ? "text-[#9e2339]/60 dark:text-[#d45a6a]/70" : "text-gray-400 dark:text-gray-500"}`}>
                <div>{model} model</div>
                <div>{preset.nConsensus === 1 ? "No consensus" : `${preset.nConsensus}× consensus`}</div>
                {preset.costOptimize && <div className="text-teal-600 dark:text-teal-400">Smart routing</div>}
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          title="Fine-tune model, consensus, DPI, and other settings manually."
          className={`p-3 rounded-lg transition-all text-left border ${
            isCustom
              ? "bg-[#9e2339]/5 dark:bg-[#9e2339]/20 border-[#9e2339]/30"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
          }`}
        >
          <div className={`font-medium ${isCustom ? "text-[#9e2339] dark:text-[#d45a6a]" : "text-gray-600 dark:text-gray-300"}`}>Custom</div>
          <div className={`text-xs mt-1 ${isCustom ? "text-[#9e2339]/60 dark:text-[#d45a6a]/70" : "text-gray-400 dark:text-gray-500"}`}>
            Set your own
          </div>
        </button>
      </div>
      
      {/* Custom options panel */}
      {isCustom && (
        <div className="pt-2 space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Consensus = parallel extractions for higher accuracy. Model size and DPI also affect quality.
          </p>
          <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 cursor-help" title="Micro: fast & cheap for simple docs. Small: balanced (default). Large: highest accuracy for complex documents.">
              <Cpu className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Model</p>
            </div>
            <div className="space-y-1">
              {Object.entries(RETAB_MODELS).map(([id, model]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleCustomChange("model", id)}
                  className={`w-full px-3 py-2 text-sm rounded-lg transition-all ${
                    currentConfig.model === id 
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium" 
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {model.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 cursor-help" title="Runs multiple extractions in parallel and compares results. Higher = better accuracy. Retab recommends 4× for production, 5× for testing.">
              <Layers className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Consensus</p>
            </div>
            <div className="space-y-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleCustomChange("nConsensus", n)}
                  className={`w-full px-3 py-2 text-sm rounded-lg transition-all ${
                    currentConfig.nConsensus === n 
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium" 
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {n === 1 ? "Off" : `${n}×`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 cursor-help" title="Image resolution for PDF rendering. Higher DPI = sharper text but larger files. 192 is recommended for most documents.">
              <ScanLine className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">DPI</p>
            </div>
            <div className="space-y-1">
              {[150, 192, 300].map((dpi) => (
                <button
                  key={dpi}
                  type="button"
                  onClick={() => handleCustomChange("imageDpi", dpi)}
                  className={`w-full px-3 py-2 text-sm rounded-lg transition-all ${
                    currentConfig.imageDpi === dpi 
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium" 
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {dpi}
                </button>
              ))}
            </div>
          </div>
          </div>
          
          {/* Additional settings row */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 cursor-help" title="Documents with extraction confidence below this threshold are flagged for manual review. Retab recommends ≥75% for production.">
                <Users className="h-3.5 w-3.5" />
                <p className="text-xs font-medium">Review Threshold</p>
              </div>
              <select
                value={currentConfig.confidenceThreshold ?? 0.7}
                onChange={(e) => handleCustomChange("confidenceThreshold", parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {CONFIDENCE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 cursor-help" title="Number of documents to process in parallel. Higher = faster but uses more API quota.">
                <Settings className="h-3.5 w-3.5" />
                <p className="text-xs font-medium">Concurrency</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={currentConfig.concurrency ?? 5}
                  onChange={(e) => handleCustomChange("concurrency", parseInt(e.target.value, 10))}
                  className="flex-1 h-2 rounded-full appearance-none bg-gray-200 dark:bg-gray-600 accent-[#9e2339]"
                />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-4">{currentConfig.concurrency ?? 5}</span>
              </div>
            </div>
          </div>
          
          {/* Advanced features toggles */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
            <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
              <FlaskConical className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Advanced Features</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ADVANCED_FEATURES.map((feature) => (
                <FeatureToggle
                  key={feature.key}
                  feature={feature}
                  enabled={!!currentConfig[feature.key]}
                  onChange={handleCustomChange}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function QuickSettingsBadge({ config, onClick }) {
  const summary = getConfigSummary(config);
  const isCostOpt = config?.costOptimize;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
    >
      {isCostOpt ? (
        <TrendingDown className="h-4 w-4 text-teal-500" />
      ) : (
        <Zap className="h-4 w-4 text-amber-500" />
      )}
      <span>{summary.model}</span>
      <span className="text-gray-400 dark:text-gray-500">
        {config?.nConsensus === 1 ? "No consensus" : `${config?.nConsensus}× consensus`}
      </span>
      {isCostOpt && (
        <span className="text-teal-600 dark:text-teal-400 text-xs">Smart</span>
      )}
    </button>
  );
}

export default RetabSettingsPanel;
