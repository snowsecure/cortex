import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Download,
  FileText,
  Loader2,
  X,
  Search,
  RotateCcw,
  Upload,
  Palette,
  AlertTriangle,
  Eye,
  Square,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Check,
} from "lucide-react";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { SailboatIcon } from "./ui/sailboat-icon";
import { useToast } from "./ui/toast";
import { PacketStatus } from "../hooks/useBatchQueue";
import { getMergedExtractionData, aggregateDocumentQuality } from "../lib/utils";
import { aggregateQualityV2 } from "../lib/qualityV2";
import { aggregateReviewedAccuracy } from "../lib/reviewAccuracy";
import { EXPORT_PRESETS, executePresetExport, getExportOutcomeDescription } from "../lib/exportPresets";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { schemas } from "../schemas/index";
import { agentFillDocument, fileToBase64 } from "../lib/retab";
import { RETAB_MODELS } from "../lib/retabConfig";

// ============================================================================
// CONSTANTS
// ============================================================================

const LAST_GENERIC_FORMAT_KEY = "cortex_last_generic_export_format";
const LAST_TPS_FORMAT_KEY = "cortex_last_tps_export_format";
const RECENT_EXPORTS_KEY = "cortex_recent_exports";
const MAX_RECENT = 5;

/** Section 1: Generic data (CSV, JSON, XLSX, industry standards) */
const GENERIC_PRESET_IDS = [
  "generic_csv",
  "generic_json",
  "generic_xlsx",
  "mismo",
  "ucd",
  "alta_settlement",
  "summary_report",
];

/** Section 2: Title Production Systems */
const TPS_PRESET_IDS = [
  "tps_stewart",
  "softpro",
  "ramquest",
  "qualia",
  "aim_plus",
  "resware",
  "titleexpress",
];

function getPresetsByIds(ids) {
  return ids.map((id) => EXPORT_PRESETS.find((p) => p.id === id)).filter(Boolean);
}

// ============================================================================
// HELPERS
// ============================================================================

function loadLastGenericFormat() {
  try { return localStorage.getItem(LAST_GENERIC_FORMAT_KEY) || "generic_csv"; } catch { return "generic_csv"; }
}
function saveLastGenericFormat(presetId) {
  try { localStorage.setItem(LAST_GENERIC_FORMAT_KEY, presetId); } catch {}
}
function loadLastTpsFormat() {
  try { return localStorage.getItem(LAST_TPS_FORMAT_KEY) || "tps_stewart"; } catch { return "tps_stewart"; }
}
function saveLastTpsFormat(presetId) {
  try { localStorage.setItem(LAST_TPS_FORMAT_KEY, presetId); } catch {}
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
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ============================================================================
// ELAPSED TIMER (for form fill)
// ============================================================================
function useElapsedTimer(running) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
      return () => clearInterval(id);
    }
    setElapsed(0);
    startRef.current = null;
  }, [running]);
  return elapsed;
}
function formatElapsed(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ============================================================================
// PACKET SELECTOR (checkboxes, search, type filter)
// ============================================================================

const COMPACT_FILE_SELECTOR_THRESHOLD = 8;

function PacketSelector({
  exportablePackets,
  selectedPacketIds,
  setSelectedPacketIds,
  selectedDocTypes,
  setSelectedDocTypes,
  searchQuery,
  setSearchQuery,
}) {
  const [compactOpen, setCompactOpen] = useState(false);
  const compactRef = useRef(null);

  useEffect(() => {
    if (!compactOpen) return;
    const handler = (e) => {
      if (compactRef.current && !compactRef.current.contains(e.target)) setCompactOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [compactOpen]);

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

  const useCompact = exportablePackets.length > COMPACT_FILE_SELECTOR_THRESHOLD;

  const fileListContent = (
    <>
      {/* Search — always in dropdown; when inline only if >3 */}
      {(useCompact || exportablePackets.length > 3) && (
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
            <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      )}

      {/* Select all / Deselect all — both visible so user can fix fat-fingers */}
      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <button type="button" onClick={selectAll} className="text-xs font-medium text-[#9e2339] hover:underline disabled:opacity-50" disabled={allSelected} title="Include all files">
            Select all
          </button>
          <span className="text-gray-300 dark:text-neutral-600">|</span>
          <button type="button" onClick={selectNone} className="text-xs font-medium text-[#9e2339] hover:underline disabled:opacity-50" disabled={noneSelected} title="Exclude all files">
            Deselect all
          </button>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {selectedPacketIds.size} of {exportablePackets.length} file{exportablePackets.length !== 1 ? "s" : ""} selected
        </span>
      </div>

      {/* Packet checkboxes (scrollable for many) */}
      <div className={`space-y-1 ${exportablePackets.length > 6 || useCompact ? "max-h-56 overflow-y-auto pr-1" : ""}`}>
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
    </>
  );

  return (
    <div className={`space-y-3 ${useCompact ? "relative" : ""}`} ref={useCompact ? compactRef : undefined}>
      {useCompact ? (
        <>
          <button
            type="button"
            onClick={() => setCompactOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm border border-gray-200 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 hover:border-gray-300 dark:hover:border-neutral-500 transition-colors text-left"
          >
            <span className="font-medium">
              {selectedPacketIds.size} of {exportablePackets.length} file{exportablePackets.length !== 1 ? "s" : ""} selected
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${compactOpen ? "rotate-180" : ""}`} />
          </button>
          {compactOpen && (
            <div className="absolute left-0 right-0 z-30 mt-1 p-3 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-600 shadow-lg space-y-3">
              {fileListContent}
            </div>
          )}
        </>
      ) : (
        fileListContent
      )}

      {/* Document type chips — visible checked/unchecked; Select all = include all types */}
      {allDocTypes.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Document types</span>
            <button
              type="button"
              onClick={() => setSelectedDocTypes(new Set())}
              className="text-xs font-medium text-[#9e2339] hover:underline disabled:opacity-50"
              disabled={allDocTypesSelected}
              title="Include all document types in export"
            >
              Select all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allDocTypes.map(({ category, count }) => {
              const included = allDocTypesSelected || selectedDocTypes.has(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleDocType(category)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                    included
                      ? "bg-[#9e2339]/10 dark:bg-[#9e2339]/20 border-[#9e2339]/40 text-[#9e2339] dark:text-[#9e2339] font-medium"
                      : "bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-neutral-500"
                  }`}
                  title={included ? "Included in export — click to exclude" : "Excluded — click to include"}
                >
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${included ? "border-[#9e2339]/50 bg-[#9e2339]/20" : "border-gray-300 dark:border-neutral-500"}`}>
                    {included ? <Check className="h-2.5 w-2.5 text-[#9e2339]" strokeWidth={2.5} /> : null}
                  </span>
                  {getCategoryDisplayName(category)}
                  <span className={included ? "text-[#9e2339]/70 dark:text-[#9e2339]/80" : "text-gray-400 dark:text-gray-500"}>{count}</span>
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
  const { docCount, typeBreakdown, quality, qualityV2, reviewedAccuracy, packetCount } = useMemo(() => {
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
    const q = aggregateDocumentQuality(allDocs, schemas);
    const qV2 = aggregateQualityV2(allDocs, schemas);
    const ra = aggregateReviewedAccuracy(allDocs, schemas);

    return {
      docCount: allDocs.length,
      typeBreakdown: sorted,
      quality: q,
      qualityV2: qV2,
      reviewedAccuracy: ra,
      packetCount: packets.length,
    };
  }, [packets]);

  const recentExports = useMemo(() => loadRecentExports(), []);

  // When presets are mixed, show average only over documents with confidence data so the score isn't dragged down
  const displayedScore = qualityV2.unscored > 0 && qualityV2.qualityScoreV2ScoredOnly != null
    ? qualityV2.qualityScoreV2ScoredOnly
    : qualityV2.qualityScoreV2;
  const isMixedPresets = qualityV2.unscored > 0 && qualityV2.scoredCount > 0;
  const v2Score = qualityV2.qualityScoreV2;
  const qualityHint = docCount > 0
    ? (reviewedAccuracy.reviewedDocCount > 0
      ? `Observed accuracy (reviewed): ${Math.round((reviewedAccuracy.rates.observed_present_accuracy ?? 0) * 100)}%`
      : qualityV2.needsReview > 0
        ? `Includes ${qualityV2.needsReview} needing review`
        : "All reviewed")
    : null;

  // Quality score color (for details section) — use displayed score so mixed presets show color for scored-only average
  const scoreColor = displayedScore >= 80
    ? "text-green-600 dark:text-green-400"
    : displayedScore >= 60
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  const barColor = displayedScore >= 80
    ? "bg-green-500"
    : displayedScore >= 60
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

          {docCount > 0 && (() => {
            const hasMeaningfulScore = qualityV2.total > 0 && (qualityV2.unscored / qualityV2.total) < 0.5;
            return (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Quality Score v2</h4>
                {hasMeaningfulScore ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className={`text-xl font-bold tabular-nums ${scoreColor}`}>{displayedScore}%</span>
                      <div className="flex-1">
                        <div className="h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-neutral-700">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, displayedScore)}%` }} />
                        </div>
                      </div>
                    </div>
                    {isMixedPresets && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        From {qualityV2.scoredCount} of {qualityV2.total} documents with confidence data.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-xl font-bold tabular-nums text-gray-300 dark:text-gray-600">N/A</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Use a Production or Best preset for quality scoring.
                    </p>
                  </>
                )}
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  {qualityV2.reviewed > 0 && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />{qualityV2.reviewed} human-verified</div>}
                  {quality.high > 0 && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />{quality.high} high-confidence</div>}
                  {qualityV2.unscored > 0 && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />{qualityV2.unscored} no confidence data</div>}
                  {qualityV2.needsReview > 0 && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />{qualityV2.needsReview} need{qualityV2.needsReview === 1 ? "s" : ""} review</div>}
                </div>
                {reviewedAccuracy.reviewedDocCount > 0 && reviewedAccuracy.rates.observed_present_accuracy != null && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-200 dark:border-neutral-700" title="Observed accuracy is agreement on present fields after review; not computed without review.">
                    Observed accuracy (reviewed): {Math.round(reviewedAccuracy.rates.observed_present_accuracy * 100)}% across {reviewedAccuracy.totalEvaluatedFields} fields
                  </p>
                )}
                {reviewedAccuracy.reviewedDocCount === 0 && quality.fieldAccuracy !== null && quality.scoredFields > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-200 dark:border-neutral-700">
                    {quality.highFields} of {quality.scoredFields} scored fields high-confidence or human-corrected.
                  </p>
                )}
                {reviewedAccuracy.reviewedDocCount === 0 && quality.fieldAccuracy === null && quality.totalFields > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-200 dark:border-neutral-700">
                    {quality.totalFields} fields extracted — enable consensus for per-field scores.
                  </p>
                )}
              </div>
            );
          })()}

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
// SECTION 3: DOCUMENT FILL (upload form, pick packet, AI fill)
// ============================================================================
function DocumentFillSection({ packets, exportablePackets }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
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
  const elapsed = useElapsedTimer(filling);

  const buildInstructions = useCallback(
    (packetId) => {
      const pkt = exportablePackets.find((p) => p.id === packetId);
      if (!pkt) return "";
      const lines = [];
      for (const doc of pkt.documents || []) {
        const { data } = getMergedExtractionData(doc, schemas);
        if (!data) continue;
        for (const [key, value] of Object.entries(data)) {
          if (value != null && value !== "" && !key.startsWith("reasoning___") && !key.startsWith("source___")) {
            lines.push(`${key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: ${value}`);
          }
        }
      }
      return [...new Set(lines)].join("\n");
    },
    [exportablePackets]
  );

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormFile(file);
    setFilledPdfUrl(null);
    setFormData(null);
    setError(null);
    try {
      setFormBase64(await fileToBase64(file));
    } catch {
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
      setFormBase64(await fileToBase64(file));
    } catch {
      toast.error("Failed to read file");
    }
  }, [toast]);

  const handlePacketChange = useCallback(
    (e) => {
      const id = e.target.value;
      setSelectedPacketId(id);
      if (id) setInstructions(buildInstructions(id));
    },
    [buildInstructions]
  );

  const handleFill = useCallback(async () => {
    if (!formBase64 || !instructions.trim()) {
      toast.error("Upload a form and provide instructions");
      return;
    }
    setFilling(true);
    setError(null);
    setFilledPdfUrl(null);
    setFormData(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await agentFillDocument({
        document: formBase64,
        filename: formFile?.name || "form.pdf",
        instructions: instructions.trim(),
        model,
        color,
      });
      if (controller.signal.aborted) return;
      if (result.filled_document?.url) setFilledPdfUrl(result.filled_document.url);
      if (result.form_data) setFormData(result.form_data);
      toast.success("Form filled successfully");
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Fill failed:", err);
      setError(err.message);
      toast.error("Fill failed: " + err.message);
    } finally {
      setFilling(false);
      abortRef.current = null;
    }
  }, [formBase64, formFile, instructions, model, color, toast]);

  const handleCancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setFilling(false);
    toast.info?.("Fill cancelled") ?? toast.success("Fill cancelled");
  }, [toast]);

  const handleDownload = useCallback(() => {
    if (!filledPdfUrl) return;
    const base64Content = filledPdfUrl.split(",")[1];
    if (!base64Content) return;
    const byteCharacters = atob(base64Content);
    const bytes = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) bytes[i] = byteCharacters.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filled-${formFile?.name || "form.pdf"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filledPdfUrl, formFile]);

  const handleFormReset = useCallback(() => {
    setFormFile(null);
    setFormBase64(null);
    setFilledPdfUrl(null);
    setFormData(null);
    setError(null);
    setInstructions("");
    setSelectedPacketId("");
  }, []);

  if (exportablePackets.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Process documents from the Upload tab first. Then you can use their data to fill PDF forms here.
      </p>
    );
  }

  // Progress: 1 = upload form, 2 = choose data + instructions, 3 = fill (or in progress), 4 = done
  const stepUploadDone = !!formFile;
  const stepDataDone = stepUploadDone && !!instructions.trim();
  const stepFilled = !!filledPdfUrl;
  const currentStep = stepFilled ? 4 : filling ? 3 : stepDataDone ? 3 : stepUploadDone ? 2 : 1;
  const steps = [
    { num: 1, label: "Upload form", done: stepUploadDone },
    { num: 2, label: "Choose data", done: stepDataDone },
    { num: 3, label: "Fill document", done: stepFilled || filling },
    { num: 4, label: "Download", done: stepFilled },
  ];

  return (
    <div className="space-y-6">
      {/* Feature intro */}
      <div className="rounded-xl bg-linear-to-br from-[#9e2339]/10 to-[#9e2339]/5 dark:from-[#9e2339]/20 dark:to-[#9e2339]/10 border border-[#9e2339]/20 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#9e2339]/20 text-[#9e2339]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fill any PDF form with your extracted data</h4>
              <span className="rounded-full bg-[#9e2339]/20 px-2 py-0.5 text-xs font-medium text-[#9e2339]">Bonus feature</span>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Upload a blank PDF form (settlement statement, deed, ALTA form, etc.) and we’ll fill it using data from your processed packets. 
              No copy-paste — the AI maps your extracted fields to the form and returns a ready-to-use PDF. Pick a packet to auto-fill from its extractions, or type custom key-value instructions.
            </p>
          </div>
        </div>
      </div>

      {/* Step progress indicator */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-1.5">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                s.done
                  ? "bg-green-500 text-white"
                  : currentStep === s.num
                    ? "bg-[#9e2339] text-white"
                    : "bg-gray-200 dark:bg-neutral-600 text-gray-500 dark:text-gray-400"
              }`}
            >
              {s.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
            </div>
            <span className={`text-xs font-medium ${currentStep === s.num ? "text-gray-900 dark:text-gray-100" : s.done ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="hidden sm:inline text-gray-300 dark:text-neutral-600 mx-0.5" aria-hidden="true">→</span>
            )}
          </div>
        ))}
      </div>

      {/* How it works (always visible, compact) */}
      <details className="group rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/30">
        <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 list-none flex items-center gap-2">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          How it works
        </summary>
        <div className="px-4 pb-3 pt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1.5 border-t border-gray-100 dark:border-neutral-700">
          <p><strong>1. Upload a blank PDF form.</strong> Any fillable or static PDF works; fillable forms often give the best field mapping.</p>
          <p><strong>2. Choose a data source.</strong> Select a processed packet — we’ll turn its extracted fields into “Field: value” instructions. You can edit the text before filling.</p>
          <p><strong>3. Click Fill document.</strong> The AI analyzes the form, matches your data to the right fields, and generates a filled PDF (usually 15–60 seconds).</p>
          <p><strong>4. Download.</strong> Preview the result in the panel and download when you’re happy. You can change instructions and fill again without re-uploading the form.</p>
        </div>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
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
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-neutral-600 rounded-lg p-3 flex items-center justify-between bg-gray-50 dark:bg-neutral-800">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-[#9e2339] shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{formFile.name}</span>
                <span className="text-xs text-gray-400">({(formFile.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button type="button" onClick={handleFormReset} className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded">
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
          )}
          {formFile && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">Data source</label>
                <select
                  value={selectedPacketId}
                  onChange={handlePacketChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200"
                >
                  <option value="">Select a processed packet...</option>
                  {exportablePackets.map((pkt) => (
                    <option key={pkt.id} value={pkt.id}>
                      {pkt.filename || pkt.name} ({pkt.documents?.length || 0} docs)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">
                  Fill instructions
                  {selectedPacketId && <span className="text-gray-400 font-normal"> (auto-generated from packet)</span>}
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder={"Enter field values, e.g.:\nBuyer Name: John Smith\nProperty Address: 123 Main St"}
                  rows={6}
                  className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 resize-y"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200"
                  >
                    {Object.entries(RETAB_MODELS)
                      .filter(([id]) => !id.startsWith("auto"))
                      .map(([id, m]) => (
                        <option key={id} value={id}>
                          {m.name} — ${m.costPerPage.toFixed(3)}/pg
                        </option>
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
              {filling ? (
                <Button onClick={handleCancel} className="w-full bg-gray-600 hover:bg-gray-700 text-white">
                  <Square className="h-4 w-4 mr-2" /> Cancel ({formatElapsed(elapsed)})
                </Button>
              ) : (
                <Button
                  onClick={handleFill}
                  disabled={!instructions.trim()}
                  className="w-full bg-[#9e2339] hover:bg-[#9e2339]/90 text-white"
                >
                  <Sparkles className="h-4 w-4 mr-2" /> Fill document
                </Button>
              )}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          {filledPdfUrl ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Filled document</h4>
                </div>
                <Button size="sm" onClick={handleDownload} className="bg-[#9e2339] hover:bg-[#9e2339]/90 text-white shrink-0">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
                </Button>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">Done! Preview below or download the PDF.</p>
              <div
                className="border border-gray-200 dark:border-neutral-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-900"
                style={{ height: "400px" }}
              >
                <iframe src={filledPdfUrl} title="Filled document preview" className="w-full h-full" />
              </div>
              {formData?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">Fields written ({formData.length})</summary>
                  <div className="max-h-32 overflow-y-auto space-y-1 mt-1.5">
                    {formData.map((field, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-gray-50 dark:bg-neutral-800"
                      >
                        <span className="text-gray-500 dark:text-gray-400 font-mono">{field.key}</span>
                        <span className="text-gray-700 dark:text-gray-200 truncate max-w-[60%]">{field.value || "\u2014"}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl flex flex-col items-center justify-center text-center min-h-[320px] p-6"
            >
              {filling ? (
                <div className="space-y-4 w-full max-w-xs">
                  <Loader2 className="h-10 w-10 mx-auto text-[#9e2339] animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Filling your form</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">The AI is mapping your data to the form fields. This usually takes 15–60 seconds.</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Elapsed: {formatElapsed(elapsed)}</span>
                    <span className="text-[#9e2339]">In progress…</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-neutral-700 overflow-hidden">
                    <div
                      className="h-full bg-[#9e2339] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(90, 20 + (elapsed / 60) * 50)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-700">
                    <Eye className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Filled document preview</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[260px]">
                    Upload a form, choose your data, and click Fill document. Your filled PDF will appear here. Use a blank, fillable PDF for best results.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN EXPORT PAGE
// ============================================================================

export function ExportPage({ packets, stats }) {
  const toast = useToast();
  const [selectedGenericPreset, setSelectedGenericPreset] = useState(loadLastGenericFormat);
  const [selectedTpsPreset, setSelectedTpsPreset] = useState(loadLastTpsFormat);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportTarget, setExportTarget] = useState(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const [selectedPacketIds, setSelectedPacketIds] = useState(new Set());
  const [selectedDocTypes, setSelectedDocTypes] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [formFillOpen, setFormFillOpen] = useState(false);

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

  const currentGenericPreset = useMemo(
    () => EXPORT_PRESETS.find((p) => p.id === selectedGenericPreset) || EXPORT_PRESETS.find((p) => p.id === "generic_csv"),
    [selectedGenericPreset]
  );
  const currentTpsPreset = useMemo(
    () => EXPORT_PRESETS.find((p) => p.id === selectedTpsPreset) || EXPORT_PRESETS.find((p) => p.id === "tps_stewart"),
    [selectedTpsPreset]
  );

  const outcomeGeneric = useMemo(() => {
    if (!currentGenericPreset || filteredPackets.length === 0) return null;
    return getExportOutcomeDescription(currentGenericPreset.id, filteredPackets);
  }, [currentGenericPreset, filteredPackets]);
  const outcomeTps = useMemo(() => {
    if (!currentTpsPreset || filteredPackets.length === 0) return null;
    return getExportOutcomeDescription(currentTpsPreset.id, filteredPackets);
  }, [currentTpsPreset, filteredPackets]);

  const doReset = useCallback(() => {
    setSelectedGenericPreset("generic_csv");
    setSelectedTpsPreset("softpro");
    setSelectedPacketIds(new Set(exportablePackets.map((p) => p.id)));
    setSelectedDocTypes(new Set());
    setSearchQuery("");
    setExportSuccess(false);
    setExportTarget(null);
    try {
      localStorage.removeItem(LAST_GENERIC_FORMAT_KEY);
      localStorage.removeItem(LAST_TPS_FORMAT_KEY);
      localStorage.removeItem(RECENT_EXPORTS_KEY);
    } catch {}
    toast.success("Export settings reset");
  }, [exportablePackets, toast]);

  const handleReset = useCallback(() => setResetConfirmOpen(true), []);

  const runExport = useCallback(
    async (preset, sectionKey) => {
      if (filteredPackets.length === 0 || filteredDocCount === 0) {
        toast.error("No documents selected. Check your file and type selections.");
        return;
      }
      setExporting(true);
      setExportSuccess(false);
      setExportTarget(sectionKey);
      try {
        const filename = await executePresetExport(preset.id, filteredPackets);
        if (sectionKey === "generic") saveLastGenericFormat(preset.id);
        else saveLastTpsFormat(preset.id);
        saveRecentExport({
          presetId: preset.id,
          timestamp: new Date().toISOString(),
          docCount: filteredDocCount,
          filename,
        });
        toast.success(`Exported ${filteredDocCount} documents: ${filename}`);
        setExportSuccess(true);
        setTimeout(() => {
          setExportSuccess(false);
          setExportTarget(null);
        }, 3000);
      } catch (err) {
        console.error("Export failed:", err);
        toast.error("Export failed: " + err.message);
        setExportTarget(null);
      } finally {
        setExporting(false);
      }
    },
    [filteredPackets, filteredDocCount, toast]
  );

  const handleGenericExport = useCallback(() => runExport(currentGenericPreset, "generic"), [runExport, currentGenericPreset]);
  const handleTpsExport = useCallback(() => runExport(currentTpsPreset, "tps"), [runExport, currentTpsPreset]);

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
            </div>

            {/* Right column: Summary (2/5) */}
            <div className="lg:col-span-2">
              <ExportSummaryPanel packets={filteredPackets} formatName={currentGenericPreset?.name} />
            </div>
          </div>

          {/* Section 1: Generic data */}
          <div className="border border-gray-200 dark:border-neutral-700 rounded-xl p-5 bg-white dark:bg-neutral-900/50">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">1. Generic data</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Export as CSV, JSON, XLSX, or industry standards (MISMO, UCD, ALTA).
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[200px] flex-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Format</label>
                <select
                  value={selectedGenericPreset}
                  onChange={(e) => setSelectedGenericPreset(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                >
                  {getPresetsByIds(GENERIC_PRESET_IDS).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.format.toUpperCase()})</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleGenericExport}
                disabled={exporting || filteredDocCount === 0}
                className={`shrink-0 ${exportSuccess && exportTarget === "generic" ? "bg-green-600 hover:bg-green-700" : "bg-[#9e2339] hover:bg-[#9e2339]/90"} text-white`}
              >
                {exporting && exportTarget === "generic" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Exporting...</>
                ) : exportSuccess && exportTarget === "generic" ? (
                  <><SailboatIcon className="h-4 w-4 mr-2" /> Exported!</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" /> Download {currentGenericPreset?.format?.toUpperCase() || currentGenericPreset?.name} (generic)</>
                )}
              </Button>
            </div>
            {outcomeGeneric && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                You'll get: {outcomeGeneric.fileCount} {outcomeGeneric.format.toUpperCase()} file{outcomeGeneric.fileCount !== 1 ? "s" : ""}, {outcomeGeneric.rowOrDocCount} {outcomeGeneric.format === "json" ? "document" : "row"}{outcomeGeneric.rowOrDocCount !== 1 ? "s" : ""}.
              </p>
            )}
            {outcomeGeneric?.columns?.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">Columns in this export ({outcomeGeneric.columns.length})</summary>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono break-all">
                  {outcomeGeneric.columns.slice(0, 12).map((c) => c.replace(/_/g, " ")).join(", ")}{outcomeGeneric.columns.length > 12 ? "…" : ""}
                </p>
              </details>
            )}
          </div>

          {/* Section 2: TPS export */}
          <div className="border border-gray-200 dark:border-neutral-700 rounded-xl p-5 bg-white dark:bg-neutral-900/50">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">2. Title Production Systems</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Export for Stewart STEPS, RamQuest, Qualia, SoftPro, ResWare, TitleExpress, and others.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[200px] flex-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Format</label>
                <select
                  value={selectedTpsPreset}
                  onChange={(e) => setSelectedTpsPreset(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                >
                  {getPresetsByIds(TPS_PRESET_IDS).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.format.toUpperCase()})</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleTpsExport}
                disabled={exporting || filteredDocCount === 0}
                className={`shrink-0 ${exportSuccess && exportTarget === "tps" ? "bg-green-600 hover:bg-green-700" : "bg-[#9e2339] hover:bg-[#9e2339]/90"} text-white`}
              >
                {exporting && exportTarget === "tps" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Exporting...</>
                ) : exportSuccess && exportTarget === "tps" ? (
                  <><SailboatIcon className="h-4 w-4 mr-2" /> Exported!</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" /> Download {currentTpsPreset?.name}</>
                )}
              </Button>
            </div>
            {outcomeTps && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                You'll get: {outcomeTps.fileCount} {outcomeTps.format.toUpperCase()} file{outcomeTps.fileCount !== 1 ? "s" : ""}, {outcomeTps.rowOrDocCount} {outcomeTps.format === "json" ? "document" : "row"}{outcomeTps.rowOrDocCount !== 1 ? "s" : ""}.
              </p>
            )}
          </div>

          {/* Section 3: Form fill (starts collapsed) */}
          <div className="border border-gray-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setFormFillOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 p-5 text-left hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">3. Form fill</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Upload a blank PDF form and fill it with extracted data using AI.
                </p>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${formFillOpen ? "rotate-180" : ""}`} />
            </button>
            {formFillOpen && (
              <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-neutral-800">
                <DocumentFillSection packets={packets} exportablePackets={exportablePackets} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExportPage;
export { DocumentFillSection };
