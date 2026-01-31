import React, { useState } from "react";
import {
  X,
  Zap,
  Target,
  Settings,
  Image,
  Users,
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
        Retab: 4x for schema building, 5x for dev. When consensus &gt; 1, temperature is raised slightly (API requirement).
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

export function RetabSettingsPanel({ onClose, onSave }) {
  const [settings, setSettings] = useState(loadSettings);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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
        <ModelSelector value={settings.model} onChange={handleChange} />
        <ConsensusSelector value={settings.nConsensus} onChange={handleChange} />
        <DPISelector value={settings.imageDpi} onChange={handleChange} />
        <ReviewThresholdSelector value={settings.confidenceThreshold} onChange={handleChange} />
        <ConcurrencySelector value={settings.concurrency} onChange={handleChange} />

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

export function ProcessingConfigOverride({ config, onChange, globalConfig }) {
  const summary = getConfigSummary(config || globalConfig);
  return (
    <div className="pt-4 border-t space-y-3">
      <p className="text-sm font-medium text-gray-700">Processing options for this run</p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        <span>
          <span className="text-gray-500">Model:</span> {summary.model}
        </span>
        <span className="text-gray-300">·</span>
        <span>
          <span className="text-gray-500">Consensus:</span> {summary.consensus}
        </span>
        <span className="text-gray-300">·</span>
        <span>
          <span className="text-gray-500">DPI:</span> {config?.imageDpi ?? globalConfig?.imageDpi ?? 192}
        </span>
        <Button variant="outline" size="sm" onClick={() => onChange(null)} className="ml-2">
          Reset to global
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        To change model, consensus, or DPI for all runs, use Settings (gear) in the header.
      </p>
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
