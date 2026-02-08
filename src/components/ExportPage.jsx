import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Check,
  Loader2,
  Upload,
  Building2,
  Landmark,
  Braces,
  Table,
  Sheet,
  Zap,
  Eye,
  X,
  ChevronDown,
  Palette,
  AlertTriangle,
} from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";
import { PacketStatus } from "../hooks/useBatchQueue";
import { getMergedExtractionData } from "../lib/utils";
import { EXPORT_PRESETS, executePresetExport } from "../lib/exportPresets";
import { agentFillDocument, fileToBase64 } from "../lib/retab";
import { RETAB_MODELS } from "../lib/retabConfig";

// ============================================================================
// ICON MAP for presets
// ============================================================================

const ICON_MAP = {
  building: Building2,
  landmark: Landmark,
  braces: Braces,
  table: Table,
  sheet: FileSpreadsheet,
  zap: Zap,
  fileText: FileText,
};

function PresetIcon({ icon, className }) {
  const Icon = ICON_MAP[icon] || FileText;
  return <Icon className={className} />;
}

// ============================================================================
// SUB-TAB NAVIGATION
// ============================================================================

const TABS = [
  { id: "data", label: "Data Export", icon: Download },
  { id: "fill", label: "Document Fill", icon: Upload },
  { id: "quick", label: "Quick Export", icon: Zap },
];

// ============================================================================
// SECTION 1: DATA EXPORT (TPS Presets)
// ============================================================================

function DataExportSection({ packets, exportablePackets }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(null);
  const [filter, setFilter] = useState("all");

  const filteredPackets = useMemo(() => {
    switch (filter) {
      case "completed":
        return exportablePackets.filter(p => p.status === PacketStatus.COMPLETED);
      case "needs_review":
        return exportablePackets.filter(p => p.status === PacketStatus.NEEDS_REVIEW);
      default:
        return exportablePackets;
    }
  }, [exportablePackets, filter]);

  const tpsPresets = EXPORT_PRESETS.filter(p => p.category === "tps");
  const standardPresets = EXPORT_PRESETS.filter(p => p.category === "standard");
  const genericPresets = EXPORT_PRESETS.filter(p => p.category === "generic");

  const handleExport = useCallback(async (presetId) => {
    if (filteredPackets.length === 0) {
      toast.error("No documents to export. Process some documents first.");
      return;
    }
    setExporting(presetId);
    try {
      const filename = await executePresetExport(presetId, filteredPackets);
      toast.success(`Exported: ${filename}`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(null);
    }
  }, [filteredPackets, toast]);

  const docCount = filteredPackets.reduce((sum, p) => sum + (p.documents?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Export Structured Data</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {filteredPackets.length} packet(s), {docCount} document(s) ready to export
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200"
        >
          <option value="all">All Documents</option>
          <option value="completed">Completed Only</option>
          <option value="needs_review">Needs Review Only</option>
        </select>
      </div>

      {filteredPackets.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Download className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No documents to export</p>
          <p className="text-xs mt-1">Process documents in the Upload tab first</p>
        </div>
      )}

      {/* Title Production Systems */}
      {filteredPackets.length > 0 && (
        <>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Title Production Systems</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {tpsPresets.map(preset => (
                <PresetCard key={preset.id} preset={preset} exporting={exporting} onExport={handleExport} />
              ))}
            </div>
          </div>

          {/* Industry Standards */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Industry Standards</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {standardPresets.map(preset => (
                <PresetCard key={preset.id} preset={preset} exporting={exporting} onExport={handleExport} />
              ))}
            </div>
          </div>

          {/* Generic Formats */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Generic Formats</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {genericPresets.map(preset => (
                <PresetCard key={preset.id} preset={preset} exporting={exporting} onExport={handleExport} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PresetCard({ preset, exporting, onExport }) {
  const isExporting = exporting === preset.id;
  return (
    <button
      type="button"
      onClick={() => onExport(preset.id)}
      disabled={!!exporting}
      className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
        isExporting
          ? "border-[#9e2339]/30 bg-[#9e2339]/5 dark:bg-[#9e2339]/15"
          : "border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-gray-300 dark:hover:border-neutral-500"
      } ${exporting && !isExporting ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <PresetIcon icon={preset.icon} className={`h-4 w-4 mt-0.5 shrink-0 ${isExporting ? "text-[#9e2339]" : "text-gray-400 dark:text-gray-500"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{preset.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-gray-400 uppercase font-mono">
              {preset.format}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{preset.description}</p>
        </div>
        {isExporting && <Loader2 className="h-4 w-4 animate-spin text-[#9e2339] shrink-0" />}
      </div>
    </button>
  );
}

// ============================================================================
// SECTION 2: DOCUMENT FILL (Edit API)
// ============================================================================

function DocumentFillSection({ packets, exportablePackets }) {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [formFile, setFormFile] = useState(null);
  const [formBase64, setFormBase64] = useState(null);
  const [selectedPacketId, setSelectedPacketId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("retab-small");
  const [color, setColor] = useState("#000080");
  const [filling, setFilling] = useState(false);
  const [filledPdfUrl, setFilledPdfUrl] = useState(null);
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState(null);

  // Build instruction text from selected packet's extracted data
  const buildInstructions = useCallback((packetId) => {
    const pkt = exportablePackets.find(p => p.id === packetId);
    if (!pkt) return "";

    const lines = [];
    for (const doc of pkt.documents || []) {
      const { data } = getMergedExtractionData(doc);
      if (!data) continue;
      for (const [key, value] of Object.entries(data)) {
        if (value != null && value !== "" && !key.startsWith("reasoning___") && !key.startsWith("source___")) {
          const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          lines.push(`${label}: ${value}`);
        }
      }
    }
    // Deduplicate
    return [...new Set(lines)].join("\n");
  }, [exportablePackets]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormFile(file);
    setFilledPdfUrl(null);
    setFormData(null);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      setFormBase64(base64);
    } catch (err) {
      toast.error("Failed to read file");
    }
  }, [toast]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.type.includes("pdf")) {
      toast.error("Only PDF files are supported");
      return;
    }
    setFormFile(file);
    setFilledPdfUrl(null);
    setFormData(null);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      setFormBase64(base64);
    } catch (err) {
      toast.error("Failed to read file");
    }
  }, [toast]);

  const handlePacketChange = useCallback((e) => {
    const id = e.target.value;
    setSelectedPacketId(id);
    if (id) {
      setInstructions(buildInstructions(id));
    }
  }, [buildInstructions]);

  const handleFill = useCallback(async () => {
    if (!formBase64 || !instructions.trim()) {
      toast.error("Upload a form and provide instructions");
      return;
    }
    setFilling(true);
    setError(null);
    setFilledPdfUrl(null);
    setFormData(null);
    try {
      const result = await agentFillDocument({
        document: formBase64,
        filename: formFile?.name || "form.pdf",
        instructions: instructions.trim(),
        model,
        color,
      });

      if (result.filled_document?.url) {
        setFilledPdfUrl(result.filled_document.url);
      }
      if (result.form_data) {
        setFormData(result.form_data);
      }
      toast.success("Form filled successfully");
    } catch (err) {
      console.error("Fill failed:", err);
      setError(err.message);
      toast.error("Fill failed: " + err.message);
    } finally {
      setFilling(false);
    }
  }, [formBase64, formFile, instructions, model, color, toast]);

  const handleDownload = useCallback(() => {
    if (!filledPdfUrl) return;
    const base64Content = filledPdfUrl.split(",")[1];
    if (!base64Content) return;
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filled-${formFile?.name || "form.pdf"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filledPdfUrl, formFile]);

  const handleReset = useCallback(() => {
    setFormFile(null);
    setFormBase64(null);
    setFilledPdfUrl(null);
    setFormData(null);
    setError(null);
    setInstructions("");
    setSelectedPacketId("");
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Fill Documents with Extracted Data</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Upload a blank PDF form, select extracted data, and let AI fill it out automatically
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upload + Configure */}
        <div className="space-y-4">
          {/* Step 1: Upload */}
          {!formFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-xl p-8 text-center cursor-pointer hover:border-[#9e2339]/40 hover:bg-[#9e2339]/5 transition-all"
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-gray-400" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Drop a blank PDF form here</p>
              <p className="text-xs text-gray-400 mt-1">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-neutral-600 rounded-lg p-3 flex items-center justify-between bg-gray-50 dark:bg-neutral-800">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-[#9e2339] shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{formFile.name}</span>
                <span className="text-xs text-gray-400">({(formFile.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button onClick={handleReset} className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded">
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
          )}

          {/* Step 2: Configure */}
          {formFile && (
            <div className="space-y-3">
              {/* Packet selector */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">Data Source</label>
                <select
                  value={selectedPacketId}
                  onChange={handlePacketChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200"
                >
                  <option value="">Select a processed packet...</option>
                  {exportablePackets.map(pkt => (
                    <option key={pkt.id} value={pkt.id}>
                      {pkt.filename || pkt.name} ({pkt.documents?.length || 0} docs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Instructions */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">
                  Fill Instructions
                  {selectedPacketId && <span className="text-gray-400 font-normal"> (auto-generated from extracted data)</span>}
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Enter field values, e.g.:\nBuyer Name: John Smith\nProperty Address: 123 Main St\nClosing Date: 2024-03-15"
                  rows={8}
                  className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200 resize-y"
                />
              </div>

              {/* Model + Color */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200"
                  >
                    {Object.entries(RETAB_MODELS).filter(([id]) => !id.startsWith("auto")).map(([id, m]) => (
                      <option key={id} value={id}>{m.name} - ${m.costPerPage.toFixed(3)}/pg</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <Palette className="h-3 w-3" /> Color
                  </label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-[38px] rounded-lg border border-gray-200 dark:border-neutral-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Fill button */}
              <Button
                onClick={handleFill}
                disabled={filling || !instructions.trim()}
                className="w-full bg-[#9e2339] hover:bg-[#9e2339]/90 text-white"
              >
                {filling ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Filling Document...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Fill Document</>
                )}
              </Button>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Preview + Download */}
        <div>
          {filledPdfUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Filled Document</h4>
                <Button size="sm" onClick={handleDownload} className="bg-[#9e2339] hover:bg-[#9e2339]/90 text-white">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
                </Button>
              </div>
              <div className="border border-gray-200 dark:border-neutral-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-900" style={{ height: "500px" }}>
                <iframe
                  src={filledPdfUrl}
                  title="Filled document preview"
                  className="w-full h-full"
                />
              </div>
              {formData && formData.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Detected Fields ({formData.length})</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {formData.map((field, i) => (
                      <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-gray-50 dark:bg-neutral-800">
                        <span className="text-gray-500 dark:text-gray-400 font-mono">{field.key}</span>
                        <span className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[60%] text-right">{field.value || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl flex items-center justify-center text-center" style={{ height: "400px" }}>
              <div>
                <Eye className="h-8 w-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-400 dark:text-gray-500">Filled document preview</p>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Upload a form and fill it to see results here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION 3: QUICK EXPORT
// ============================================================================

const QUICK_EXPORTS = [
  { id: "generic_json", label: "JSON", icon: FileJson, description: "Full hierarchical export" },
  { id: "generic_csv", label: "CSV", icon: FileSpreadsheet, description: "Flat table, all fields" },
  { id: "generic_xlsx", label: "XLSX", icon: FileSpreadsheet, description: "Multi-sheet workbook by doc type" },
  { id: "tps_stewart", label: "Stewart TPS", icon: Zap, description: "Stewart Title production format" },
  { id: "mismo", label: "MISMO XML", icon: Landmark, description: "Industry standard XML" },
  { id: "summary_report", label: "Summary", icon: FileText, description: "Human-readable text report" },
];

function QuickExportSection({ packets, exportablePackets }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(null);
  const [done, setDone] = useState(null);

  const handleExport = useCallback(async (presetId) => {
    if (exportablePackets.length === 0) {
      toast.error("No documents to export. Process some documents first.");
      return;
    }
    setExporting(presetId);
    setDone(null);
    try {
      const filename = await executePresetExport(presetId, exportablePackets);
      toast.success(`Exported: ${filename}`);
      setDone(presetId);
      setTimeout(() => setDone(null), 2000);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(null);
    }
  }, [exportablePackets, toast]);

  const docCount = exportablePackets.reduce((sum, p) => sum + (p.documents?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Quick Export</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          One-click export with default settings -- {exportablePackets.length} packet(s), {docCount} document(s)
        </p>
      </div>

      {exportablePackets.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Download className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No documents to export</p>
          <p className="text-xs mt-1">Process documents in the Upload tab first</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {QUICK_EXPORTS.map(qe => {
            const Icon = qe.icon;
            const isExporting = exporting === qe.id;
            const isDone = done === qe.id;
            return (
              <button
                key={qe.id}
                onClick={() => handleExport(qe.id)}
                disabled={!!exporting}
                className={`p-4 rounded-xl border text-left transition-all hover:shadow-md ${
                  isDone
                    ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
                    : isExporting
                      ? "border-[#9e2339]/30 bg-[#9e2339]/5"
                      : "border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-gray-300 dark:hover:border-neutral-500"
                } ${exporting && !isExporting ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  {isDone ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : isExporting ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#9e2339]" />
                  ) : (
                    <Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{qe.label}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">{qe.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN EXPORT PAGE
// ============================================================================

export function ExportPage({ packets, stats }) {
  const [activeTab, setActiveTab] = useState("data");

  const exportablePackets = useMemo(() => {
    return (packets || []).filter(p =>
      p.status === PacketStatus.COMPLETED ||
      p.status === PacketStatus.NEEDS_REVIEW
    );
  }, [packets]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Page header with sub-tabs */}
      <div className="px-6 pt-4 pb-0 shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Export</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Export extracted data in any format, or fill documents using the Edit API
              </p>
            </div>
          </div>

          {/* Sub-tabs */}
          <nav className="flex gap-1 bg-gray-100 dark:bg-neutral-700 rounded-lg p-1 w-fit">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    isActive
                      ? "bg-white dark:bg-neutral-600 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto">
          {activeTab === "data" && (
            <DataExportSection packets={packets} exportablePackets={exportablePackets} />
          )}
          {activeTab === "fill" && (
            <DocumentFillSection packets={packets} exportablePackets={exportablePackets} />
          )}
          {activeTab === "quick" && (
            <QuickExportSection packets={packets} exportablePackets={exportablePackets} />
          )}
        </div>
      </div>
    </div>
  );
}

export default ExportPage;
