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
  estimateCost,
  getConfigSummary,
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
  return (
    <SettingSection icon={Zap} title="AI Model">
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(RETAB_MODELS).map(([id, model]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange("model", id)}
            className={`p-3 rounded-lg border text-left text-sm transition-colors ${
              value === id
                ? "border-[#9e2339] bg-[#9e2339]/5 text-[#9e2339]"
                : "border-gray-200 hover:border-gray-300"
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
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1">
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
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
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

// Global quality presets (same as ProcessingConfigOverride)
const SETTINGS_PRESETS = [
  { id: "draft", name: "Draft", model: "retab-micro", nConsensus: 1, imageDpi: 150 },
  { id: "standard", name: "Standard", model: "retab-small", nConsensus: 1, imageDpi: 192 },
  { id: "production", name: "Production", model: "retab-small", nConsensus: 3, imageDpi: 192 },
  { id: "best", name: "Best", model: "retab-large", nConsensus: 4, imageDpi: 192 },
];

function getSettingsPreset(config) {
  for (const preset of SETTINGS_PRESETS) {
    if (config.model === preset.model && config.nConsensus === preset.nConsensus && config.imageDpi === preset.imageDpi) {
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
      });
    }
  };
  
  return (
    <SettingSection icon={Zap} title="Quick Presets">
      <div className="grid grid-cols-4 gap-2">
        {SETTINGS_PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={`p-2 rounded-lg text-center text-sm transition-all border ${
                isActive
                  ? "bg-[#9e2339]/5 border-[#9e2339]/30 text-[#9e2339]"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">{preset.name}</div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-1">
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
        <h2 className="text-base font-semibold text-gray-900">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <PresetSelector settings={settings} onBatchChange={handleBatchChange} />
        
        <div className="border-t border-gray-100 pt-4 space-y-6">
          <ModelSelector value={settings.model} onChange={handleChange} />
          <ConsensusSelector value={settings.nConsensus} onChange={handleChange} />
          <DPISelector value={settings.imageDpi} onChange={handleChange} />
        </div>
        
        <div className="border-t border-gray-100 pt-4 space-y-6">
          <ReviewThresholdSelector value={settings.confidenceThreshold} onChange={handleChange} />
          <ConcurrencySelector value={settings.concurrency} onChange={handleChange} />
        </div>

        <div className="text-sm text-gray-600 pt-2">
          Est. cost (10 pages) <span className="font-semibold text-[#9e2339]">${est.totalCost.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 shrink-0">
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

// Quality presets aligned with Retab best practices
// Consensus runs parallel extractions for verification (docs recommend n_consensus=4-5 for testing)
const QUALITY_PRESETS = [
  { id: "draft", name: "Draft", model: "retab-micro", nConsensus: 1, imageDpi: 150 },
  { id: "standard", name: "Standard", model: "retab-small", nConsensus: 1, imageDpi: 192 },
  { id: "production", name: "Production", model: "retab-small", nConsensus: 3, imageDpi: 192 },
  { id: "best", name: "Best", model: "retab-large", nConsensus: 4, imageDpi: 192 },
];

function getActivePreset(config) {
  if (!config) return "standard";
  for (const preset of QUALITY_PRESETS) {
    if (config.model === preset.model && config.nConsensus === preset.nConsensus && config.imageDpi === preset.imageDpi) {
      return preset.id;
    }
  }
  return "custom";
}

export function ProcessingConfigOverride({ config, onChange, globalConfig }) {
  const [showCustom, setShowCustom] = useState(false);
  const currentConfig = config || globalConfig || DEFAULT_CONFIG;
  const activePreset = getActivePreset(currentConfig);
  const isCustom = activePreset === "custom" || showCustom;
  
  const handlePresetChange = (presetId) => {
    const preset = QUALITY_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onChange({ ...currentConfig, model: preset.model, nConsensus: preset.nConsensus, imageDpi: preset.imageDpi });
      setShowCustom(false);
    }
  };
  
  const handleCustomChange = (key, value) => {
    onChange({ ...currentConfig, [key]: value });
  };

  return (
    <div className="pt-6 space-y-3">
      <p className="text-sm font-medium text-gray-600">Extraction Quality</p>
      
      {/* Quality preset boxes */}
      <div className="grid grid-cols-5 gap-2">
        {QUALITY_PRESETS.map((preset) => {
          const isActive = activePreset === preset.id && !showCustom;
          const model = RETAB_MODELS[preset.model]?.name || preset.model;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetChange(preset.id)}
              className={`p-3 rounded-lg transition-all text-left border ${
                isActive
                  ? "bg-[#9e2339]/5 border-[#9e2339]/30"
                  : "bg-white border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className={`font-medium ${isActive ? "text-[#9e2339]" : "text-gray-600"}`}>{preset.name}</div>
              <div className={`text-xs mt-1 space-y-0.5 ${isActive ? "text-[#9e2339]/60" : "text-gray-400"}`}>
                <div>{model} model</div>
                <div>{preset.imageDpi} DPI</div>
                <div>{preset.nConsensus === 1 ? "No consensus" : `${preset.nConsensus}× consensus`}</div>
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={`p-3 rounded-lg transition-all text-left border ${
            isCustom
              ? "bg-[#9e2339]/5 border-[#9e2339]/30"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className={`font-medium ${isCustom ? "text-[#9e2339]" : "text-gray-600"}`}>Custom</div>
          <div className={`text-xs mt-1 ${isCustom ? "text-[#9e2339]/60" : "text-gray-400"}`}>
            Set your own
          </div>
        </button>
      </div>
      
      {/* Custom options panel */}
      {isCustom && (
        <div className="pt-2 space-y-3">
          <p className="text-xs text-gray-400">
            Consensus = parallel extractions for higher accuracy. Model size and DPI also affect quality.
          </p>
          <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-400">
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
                      ? "bg-slate-100 text-slate-900 font-medium" 
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {model.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-400" title="Multiple parallel extractions; higher = better accuracy (Retab best practice)">
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
                      ? "bg-slate-100 text-slate-900 font-medium" 
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {n === 1 ? "Off" : `${n}×`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-400">
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
                      ? "bg-slate-100 text-slate-900 font-medium" 
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {dpi}
                </button>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function QuickSettingsBadge({ config, onClick }) {
  const summary = getConfigSummary(config);
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
    >
      <Zap className="h-4 w-4 text-amber-500" />
      <span>{summary.model}</span>
      <span className="text-gray-400">
        {config?.nConsensus === 1 ? "No consensus" : `${config?.nConsensus}× consensus`}
      </span>
    </button>
  );
}

export default RetabSettingsPanel;
