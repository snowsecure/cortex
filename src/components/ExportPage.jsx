import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Download,
  FileText,
  Loader2,
  X,
  Search,
  RotateCcw,
  FileEdit,
} from "lucide-react";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { SailboatIcon } from "./ui/sailboat-icon";
import { useToast } from "./ui/toast";
import { PacketStatus } from "../hooks/useBatchQueue";
import { getMergedExtractionData, aggregateDocumentQuality } from "../lib/utils";
import { EXPORT_PRESETS, executePresetExport, getExportOutcomeDescription } from "../lib/exportPresets";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { schemas } from "../schemas/index";

// ============================================================================
// CONSTANTS
// ============================================================================

const LAST_FORMAT_KEY = "cortex_last_export_format";
const RECENT_EXPORTS_KEY = "cortex_recent_exports";
const MAX_RECENT = 5;

const PRESET_GROUPS = [
  { label: "Title Production Systems", category: "tps" },
  { label: "Industry Standards", category: "standard" },
  { label: "Raw Data", category: "generic", filter: (p) => ["generic_json", "generic_csv", "generic_xlsx"].includes(p.id) },
  { label: "Other", category: "generic", filter: (p) => !["generic_json", "generic_csv", "generic_xlsx"].includes(p.id) },
];

/** Default recommended format and 2–3 primary options shown first; rest under "More formats…" */
const PRIMARY_PRESET_IDS = ["generic_csv", "generic_json", "softpro"];

function getPresetsForGroup(group) {
  let presets = EXPORT_PRESETS.filter((p) => p.category === group.category);
  if (group.filter) presets = presets.filter(group.filter);
  return presets;
}

function getPrimaryPresets() {
  return PRIMARY_PRESET_IDS.map((id) => EXPORT_PRESETS.find((p) => p.id === id)).filter(Boolean);
}

// ============================================================================
// HELPERS
// ============================================================================

function loadLastFormat() {
  try { return localStorage.getItem(LAST_FORMAT_KEY) || "generic_csv"; } catch { return "generic_csv"; }
}
function saveLastFormat(presetId) {
  try { localStorage.setItem(LAST_FORMAT_KEY, presetId); } catch {}
}
function loadRecentExports() {
  try { return JSON.parse(localStorage.getItem(RECENT_EXPORTS_KEY) || "[]"); } catch { return []; }
}
function saveRecentExport(entry) {
  try {
    const updated = [entry, ...loadRecentExports()].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_EXPORTS_KEY, JSON.stringify(updated));
  } catch {}
}
function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ============================================================================
// PACKET SELECTOR (checkboxes, search, type filter)
// ============================================================================

function PacketSelector({
  exportablePackets,
  selectedPacketIds,
  setSelectedPacketIds,
  selectedDocTypes,
  setSelectedDocTypes,
  searchQuery,
  setSearchQuery,
}) {
  // All unique document types across all exportable packets
  const allDocTypes = useMemo(() => {
    const types = {};
    for (const pkt of exportablePackets) {
      for (const doc of pkt.documents || []) {
        const cat = doc.categoryOverride?.name || doc.classification?.category || "other";
        types[cat] = (types[cat] || 0) + 1;
      }
    }
    return Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ category: cat, count }));
  }, [exportablePackets]);

  // Filtered packet list (by search)
  const visiblePackets = useMemo(() => {
    if (!searchQuery.trim()) return exportablePackets;
    const q = searchQuery.toLowerCase();
    return exportablePackets.filter((p) =>
      (p.filename || p.name || "").toLowerCase().includes(q)
    );
  }, [exportablePackets, searchQuery]);

  const allSelected = selectedPacketIds.size === exportablePackets.length && exportablePackets.length > 0;
  const noneSelected = selectedPacketIds.size === 0;

  const togglePacket = useCallback((id) => {
    setSelectedPacketIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setSelectedPacketIds]);

  const selectAll = useCallback(() => {
    setSelectedPacketIds(new Set(exportablePackets.map((p) => p.id)));
  }, [exportablePackets, setSelectedPacketIds]);

  const selectNone = useCallback(() => {
    setSelectedPacketIds(new Set());
  }, [setSelectedPacketIds]);

  const toggleDocType = useCallback((cat) => {
    setSelectedDocTypes((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, [setSelectedDocTypes]);

  const allDocTypesSelected = selectedDocTypes.size === 0; // empty = "all types"

  return (
    <div className="space-y-3">
      {/* Search (only show when >3 packets) */}
      {exportablePackets.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      )}

      {/* Select all/none */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? selectNone : selectAll}
            className="text-xs font-medium text-[#9e2339] hover:underline"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {selectedPacketIds.size} of {exportablePackets.length} file{exportablePackets.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Packet checkboxes (scrollable for many) */}
      <div className={`space-y-1 ${exportablePackets.length > 6 ? "max-h-48 overflow-y-auto pr-1" : ""}`}>
        {visiblePackets.map((pkt) => {
          const checked = selectedPacketIds.has(pkt.id);
          const docCount = pkt.documents?.length || 0;
          const isReview = pkt.status === PacketStatus.NEEDS_REVIEW;
          return (
            <label
              key={pkt.id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                checked
                  ? "bg-[#9e2339]/5 dark:bg-[#9e2339]/10 border border-[#9e2339]/20 dark:border-[#9e2339]/30"
                  : "bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePacket(pkt.id)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-[#9e2339] focus:ring-[#9e2339]/30 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{pkt.filename || pkt.name || "Unknown"}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {docCount} doc{docCount !== 1 ? "s" : ""}
                  {isReview && <span className="text-amber-500 ml-1">&#183; needs review</span>}
                </p>
              </div>
            </label>
          );
        })}
        {visiblePackets.length === 0 && searchQuery && (
          <p className="text-xs text-gray-400 text-center py-3">No files match "{searchQuery}"</p>
        )}
      </div>

      {/* Document type filter pills */}
      {allDocTypes.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Document types</span>
            {!allDocTypesSelected && (
              <button onClick={() => setSelectedDocTypes(new Set())} className="text-xs text-[#9e2339] hover:underline">
                Clear filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allDocTypes.map(({ category, count }) => {
              const active = selectedDocTypes.has(category);
              return (
                <button
                  key={category}
                  onClick={() => toggleDocType(category)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    active
                      ? "bg-[#9e2339]/10 dark:bg-[#9e2339]/20 border-[#9e2339]/30 text-[#9e2339] dark:text-[#9e2339] font-medium"
                      : "bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {getCategoryDisplayName(category)}
                  <span className="ml-1 text-gray-400 dark:text-gray-500">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXPORT SUMMARY PANEL (right column)
// ============================================================================

function ExportSummaryPanel({ packets, formatName }) {
  const [showDetails, setShowDetails] = useState(false);
  const { docCount, typeBreakdown, quality, packetCount } = useMemo(() => {
    const types = {};
    const allDocs = [];

    for (const pkt of packets) {
      for (const doc of pkt.documents || []) {
        allDocs.push(doc);
        const cat = doc.categoryOverride?.name || doc.classification?.category || "other";
        types[cat] = (types[cat] || 0) + 1;
      }
    }

    const sorted = Object.entries(types).sort((a, b) => b[1] - a[1]).map(([cat, count]) => ({ category: cat, count }));
    const q = aggregateDocumentQuality(allDocs);

    return {
      docCount: allDocs.length,
      typeBreakdown: sorted,
      quality: q,
      packetCount: packets.length,
    };
  }, [packets]);

  const recentExports = useMemo(() => loadRecentExports(), []);

  const qualityHint = docCount > 0
    ? quality.needsAttention > 0
      ? `Includes ${quality.needsAttention} needing review`
      : "All reviewed"
    : null;

  // Quality score color (for details section)
  const scoreColor = quality.score >= 80
    ? "text-green-600 dark:text-green-400"
    : quality.score >= 60
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  const barColor = quality.score >= 80
    ? "bg-green-500"
    : quality.score >= 60
      ? "bg-amber-400"
      : "bg-red-400";

  return (
    <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 space-y-4">
      <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Summary</h4>

      <div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{docCount}</div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          document{docCount !== 1 ? "s" : ""} from {packetCount} file{packetCount !== 1 ? "s" : ""}
        </p>
      </div>

      {formatName && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Format: <span className="font-medium">{formatName}</span>
        </p>
      )}

      {qualityHint && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{qualityHint}</p>
      )}

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="text-xs font-medium text-[#9e2339] hover:underline"
      >
        {showDetails ? "Hide details" : "Show details"}
      </button>

      {showDetails && (
        <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-neutral-700">
          {typeBreakdown.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Document Types</h4>
              <div className="space-y-1">
                {typeBreakdown.slice(0, 6).map(({ category, count }) => (
                  <div key={category} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{getCategoryDisplayName(category)}</span>
                    <span className="text-gray-400 dark:text-gray-500 tabular-nums ml-2 shrink-0">{count}</span>
                  </div>
                ))}
                {typeBreakdown.length > 6 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">+{typeBreakdown.length - 6} more types</p>
                )}
              </div>
            </div>
          )}

          {docCount > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Data Quality</h4>
              <div className="flex items-center gap-3">
                <span className={`text-xl font-bold tabular-nums ${scoreColor}`}>{quality.score}%</span>
                <div className="flex-1">
                  <div className="h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-neutral-700">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${quality.score}%` }} />
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {quality.verified > 0 && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />{quality.verified} human-verified</div>}
                {quality.high > 0 && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />{quality.high} high-confidence</div>}
                {quality.unscored > 0 && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />{quality.unscored} awaiting scores</div>}
                {quality.needsAttention > 0 && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />{quality.needsAttention} need{quality.needsAttention === 1 ? "s" : ""} review</div>}
              </div>
              {quality.fieldAccuracy !== null && quality.scoredFields > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-200 dark:border-neutral-700">
                  {quality.highFields} of {quality.scoredFields} scored fields high-confidence or human-corrected.
                </p>
              )}
              {quality.fieldAccuracy === null && quality.totalFields > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-200 dark:border-neutral-700">
                  {quality.totalFields} fields extracted — enable consensus for per-field scores.
                </p>
              )}
            </div>
          )}

          {recentExports.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Recent Exports</h4>
              <div className="space-y-1">
                {recentExports.slice(0, 3).map((entry, i) => {
                  const preset = EXPORT_PRESETS.find((p) => p.id === entry.presetId);
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400 truncate">{preset?.name || entry.presetId}</span>
                      <span className="text-gray-400 dark:text-gray-500 shrink-0 ml-2">{timeAgo(entry.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN EXPORT PAGE
// ============================================================================

export function ExportPage({ packets, stats, onNavigateToFillForms }) {
  const toast = useToast();
  const [selectedPreset, setSelectedPreset] = useState(loadLastFormat);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showMoreFormats, setShowMoreFormats] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Packet & doc type selection state
  const [selectedPacketIds, setSelectedPacketIds] = useState(new Set());
  const [selectedDocTypes, setSelectedDocTypes] = useState(new Set()); // empty = all types
  const [searchQuery, setSearchQuery] = useState("");

  // Exportable packets
  const exportablePackets = useMemo(() => {
    return (packets || []).filter((p) => p.status === PacketStatus.COMPLETED || p.status === PacketStatus.NEEDS_REVIEW);
  }, [packets]);

  // Auto-select all packets on first load or when exportable set changes
  useEffect(() => {
    setSelectedPacketIds((prev) => {
      const exportableIds = new Set(exportablePackets.map((p) => p.id));
      // If user hasn't deselected anything yet (all were selected or it's first load), select all
      if (prev.size === 0 || [...prev].every((id) => !exportableIds.has(id))) {
        return exportableIds;
      }
      // Otherwise keep their selection, but remove IDs that no longer exist
      const next = new Set([...prev].filter((id) => exportableIds.has(id)));
      return next;
    });
  }, [exportablePackets]);

  // Build the final filtered packets with doc-type filtering applied
  const filteredPackets = useMemo(() => {
    // Start with selected packets
    let pkts = exportablePackets.filter((p) => selectedPacketIds.has(p.id));

    // If doc types are selected, create virtual packets with only matching docs
    if (selectedDocTypes.size > 0) {
      pkts = pkts.map((pkt) => ({
        ...pkt,
        documents: (pkt.documents || []).filter((doc) => {
          const cat = doc.categoryOverride?.name || doc.classification?.category || "other";
          return selectedDocTypes.has(cat);
        }),
      })).filter((pkt) => pkt.documents.length > 0); // remove packets with 0 matching docs
    }

    return pkts;
  }, [exportablePackets, selectedPacketIds, selectedDocTypes]);

  // Filtered doc count for the button
  const filteredDocCount = useMemo(() => {
    return filteredPackets.reduce((sum, p) => sum + (p.documents?.length || 0), 0);
  }, [filteredPackets]);

  const currentPreset = useMemo(() => {
    return EXPORT_PRESETS.find((p) => p.id === selectedPreset) || EXPORT_PRESETS.find((p) => p.id === "generic_json");
  }, [selectedPreset]);

  const outcomeDescription = useMemo(() => {
    if (!currentPreset || filteredPackets.length === 0) return null;
    return getExportOutcomeDescription(currentPreset.id, filteredPackets);
  }, [currentPreset, filteredPackets]);

  const handleFormatChange = useCallback((e) => {
    setSelectedPreset(e.target.value);
    setExportSuccess(false);
  }, []);

  const doReset = useCallback(() => {
    setSelectedPreset("generic_csv");
    setSelectedPacketIds(new Set(exportablePackets.map((p) => p.id)));
    setSelectedDocTypes(new Set());
    setSearchQuery("");
    setExportSuccess(false);
    try { localStorage.removeItem(LAST_FORMAT_KEY); localStorage.removeItem(RECENT_EXPORTS_KEY); } catch {}
    toast.success("Export settings reset");
  }, [exportablePackets, toast]);

  const handleReset = useCallback(() => {
    setResetConfirmOpen(true);
  }, []);

  const handleExport = useCallback(async () => {
    if (filteredPackets.length === 0 || filteredDocCount === 0) {
      toast.error("No documents selected. Check your file and type selections.");
      return;
    }
    setExporting(true);
    setExportSuccess(false);
    try {
      const filename = await executePresetExport(currentPreset.id, filteredPackets);
      saveLastFormat(currentPreset.id);
      saveRecentExport({ presetId: currentPreset.id, timestamp: new Date().toISOString(), docCount: filteredDocCount, filename });
      toast.success(`Exported ${filteredDocCount} documents: ${filename}`);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  }, [filteredPackets, filteredDocCount, currentPreset, toast]);

  // Empty state
  if (exportablePackets.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-6 pt-4 pb-0 shrink-0">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Export data</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Choose files and document types, pick a format, and download.</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 dark:bg-neutral-700 mb-4">
              <SailboatIcon className="h-7 w-7 text-gray-400 dark:text-neutral-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-neutral-100 mb-2">No documents ready to export</h2>
            <p className="text-gray-500 dark:text-neutral-400 mb-6">
              Process documents from the Upload tab first. Once complete, you can export them here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Page header */}
      <div className="px-6 pt-4 pb-0 shrink-0">
        <div className="max-w-5xl mx-auto flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Export data</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Choose files and document types, pick a format, and download.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 shrink-0 mt-0.5"
            title="Reset selections"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={doReset}
        title="Reset export settings"
        message="Reset all file and format selections? Recent exports list will also be cleared."
        confirmText="Reset"
        cancelText="Cancel"
        variant="warning"
      />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* ====== SECTION 1: DATA EXPORT ====== */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left column: Export config (3/5) */}
            <div className="lg:col-span-3 space-y-5">
              {/* Step 1: What to export */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                  What to export
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Include documents from these files. For document types below, only include the selected types—leave all unchecked for all types.
                </p>
                <PacketSelector
                  exportablePackets={exportablePackets}
                  selectedPacketIds={selectedPacketIds}
                  setSelectedPacketIds={setSelectedPacketIds}
                  selectedDocTypes={selectedDocTypes}
                  setSelectedDocTypes={setSelectedDocTypes}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />
              </div>

              {/* Step 2: Format — primary options + More formats… */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                  2. Format
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Choose a format for the export. Use “More formats…” for other systems.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {getPrimaryPresets().map((preset) => {
                    const isSelected = selectedPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleFormatChange({ target: { value: preset.id } })}
                        className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-[#9e2339]/10 dark:bg-[#9e2339]/20 border-[#9e2339]/40 text-[#9e2339] dark:text-[#9e2339]"
                            : "bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:border-[#9e2339]/30"
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                  {currentPreset && !PRIMARY_PRESET_IDS.includes(selectedPreset) && (
                    <span className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[#9e2339]/30 bg-[#9e2339]/10 dark:bg-[#9e2339]/20 text-[#9e2339] dark:text-[#9e2339]">
                      {currentPreset.name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowMoreFormats((v) => !v)}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-neutral-500"
                  >
                    {showMoreFormats ? "Fewer formats" : "More formats…"}
                  </button>
                </div>
                {showMoreFormats && (
                  <select
                    value={selectedPreset}
                    onChange={(e) => { handleFormatChange(e); setShowMoreFormats(false); }}
                    className="mt-3 w-full px-4 py-3 text-sm font-medium border border-gray-200 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[#9e2339]/30 focus:border-[#9e2339] transition-colors cursor-pointer appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                      paddingRight: "40px",
                    }}
                  >
                    {PRESET_GROUPS.map((group) => {
                      const presets = getPresetsForGroup(group);
                      if (presets.length === 0) return null;
                      return (
                        <optgroup key={group.label} label={group.label}>
                          {presets.map((preset) => (
                            <option key={preset.id} value={preset.id}>{preset.name} ({preset.format.toUpperCase()})</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                )}
                {/* Format description */}
                {currentPreset && (
                  <div className="flex items-center gap-3 px-4 py-3 mt-2 bg-gray-50 dark:bg-neutral-800/50 rounded-lg border border-gray-100 dark:border-neutral-700">
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{currentPreset.description}</p>
                    <span className="text-[10px] px-2 py-1 rounded-md bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-gray-400 uppercase font-mono tracking-wider shrink-0">
                      {currentPreset.format}
                    </span>
                  </div>
                )}
              </div>

              {/* Step 3: Download */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                  3. Download
                </label>
                {outcomeDescription && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    You'll get: {outcomeDescription.fileCount} {outcomeDescription.format.toUpperCase()} file{outcomeDescription.fileCount !== 1 ? "s" : ""}, {outcomeDescription.rowOrDocCount} {outcomeDescription.format === "json" ? "document" : "row"}{outcomeDescription.rowOrDocCount !== 1 ? "s" : ""}{outcomeDescription.columns?.length ? `. Columns: ${outcomeDescription.columns.slice(0, 6).map((c) => c.replace(/_/g, " ")).join(", ")}${outcomeDescription.columns.length > 6 ? "…" : ""}` : ""}
                  </p>
                )}
                <Button
                  onClick={handleExport}
                  disabled={exporting || filteredDocCount === 0}
                  className={`w-full py-3 text-sm font-semibold rounded-xl transition-all ${
                    exportSuccess
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-[#9e2339] hover:bg-[#9e2339]/90 text-white"
                  }`}
                >
                  {exporting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Exporting...</>
                  ) : exportSuccess ? (
                    <><SailboatIcon className="h-4 w-4 mr-2" /> Exported!</>
                  ) : filteredDocCount === 0 ? (
                    <>No documents selected</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" /> Export {filteredDocCount} doc{filteredDocCount !== 1 ? "s" : ""} as {currentPreset?.name}</>
                  )}
                </Button>
              </div>
            </div>

            {/* Right column: Summary (2/5) */}
            <div className="lg:col-span-2">
              <ExportSummaryPanel packets={filteredPackets} formatName={currentPreset?.name} />
            </div>
          </div>

          {onNavigateToFillForms && (
            <div className="border-t border-gray-200 dark:border-neutral-700 pt-6">
              <button
                type="button"
                onClick={onNavigateToFillForms}
                className="flex items-center gap-2 text-sm text-[#9e2339] hover:text-[#9e2339]/80 dark:text-[#9e2339] dark:hover:text-[#9e2339]/80 font-medium transition-colors"
              >
                <FileEdit className="h-4 w-4" />
                Fill a form with extracted data
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExportPage;
