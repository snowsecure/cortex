import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { CheckCircle, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, FileText, Check, Circle, ShieldCheck, Loader2, Tag, Plus, X, Search, SearchSlash, PenLine, Undo2, Sparkles, Filter } from "lucide-react";
import { Button } from "./ui/button";
import { SailboatIcon } from "./ui/sailboat-icon";
import { getMergedExtractionData, NOT_IN_DOCUMENT_VALUE, NOT_IN_DOCUMENT_LABEL, displayValue } from "../lib/utils";
import { getCategoryDisplayName, CRITICAL_FIELDS } from "../lib/documentCategories";
import { schemas } from "../schemas/index";
import { PDFPreview } from "./DocumentDetailModal";
import * as api from "../lib/api";
import { pdfBlobCache } from "../lib/pdfCache";

/**
 * All known category IDs with their display names, for the category picker.
 */
const KNOWN_CATEGORIES = Object.entries(schemas).map(([id, entry]) => ({
  id,
  name: entry.name || getCategoryDisplayName(id),
}));

/** Categories that should trigger the "reclassify" picker */
const UNKNOWN_CATEGORIES = new Set(["other", "other_recorded", "unknown", "Document"]);

/**
 * Compact inline category picker — renders as a small dropdown trigger.
 * Opens a floating popover with search + category list.
 */
function CategoryPicker({ currentCategory, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const wrapperRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return KNOWN_CATEGORIES;
    const q = search.toLowerCase();
    return KNOWN_CATEGORIES.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [search]);

  const pick = (cat) => { onSelect(cat); setOpen(false); setSearch(""); setCustomMode(false); setCustomName(""); };

  const hasSelection = currentCategory && !UNKNOWN_CATEGORIES.has(currentCategory.id);

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
          hasSelection
            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
            : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
        }`}
      >
        <Tag className="h-3 w-3 shrink-0" />
        {hasSelection ? (
          <>
            <span className="truncate max-w-[140px]">{currentCategory.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="ml-0.5 hover:text-red-500"
              title="Reset"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <span>Doc Type</span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </button>

      {/* Dropdown popover */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 z-30 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-lg overflow-hidden">
          {!customMode ? (
            <>
              <div className="p-1.5">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-6 pr-2 py-1 text-[11px] border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {filtered.map((cat) => (
                  <button key={cat.id} type="button" onClick={() => pick({ id: cat.id, name: cat.name, isCustom: false })}
                    className="w-full text-left px-3 py-1 text-[11px] text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300">
                    {cat.name}
                  </button>
                ))}
                {filtered.length === 0 && <p className="text-[11px] text-gray-400 px-3 py-2">No matches</p>}
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-1.5">
                <button type="button" onClick={() => setCustomMode(true)} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600">
                  <Plus className="h-3 w-3" /> Custom name
                </button>
              </div>
            </>
          ) : (
            <div className="p-2 space-y-1.5">
              <input
                type="text" autoFocus
                className="w-full px-2 py-1 text-[11px] border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., Utility Easement..."
                value={customName} onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && customName.trim() && pick({ id: `custom:${customName.trim().toLowerCase().replace(/\s+/g, '_')}`, name: customName.trim(), isCustom: true })}
              />
              <div className="flex gap-1.5">
                <button type="button" onClick={() => { setCustomMode(false); setCustomName(""); }} className="text-[10px] text-gray-500 hover:text-gray-700">Cancel</button>
                <button type="button" disabled={!customName.trim()} onClick={() => pick({ id: `custom:${customName.trim().toLowerCase().replace(/\s+/g, '_')}`, name: customName.trim(), isCustom: true })}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40">Apply</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format a snake_case or camelCase field name into a friendly display name
 * e.g., "surveyor_license_number" -> "Surveyor License Number"
 *       "documentType" -> "Document Type"
 */
function formatFieldName(key) {
  if (!key) return "";
  
  // Handle snake_case: replace underscores with spaces
  let formatted = key.replace(/_/g, " ");
  
  // Handle camelCase: insert space before capital letters
  formatted = formatted.replace(/([a-z])([A-Z])/g, "$1 $2");
  
  // Title case each word
  formatted = formatted
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  
  return formatted;
}

// Stable empty object — avoids creating a new {} reference on every render
// when a document has no in-progress edits yet.
const EMPTY_EDITS = Object.freeze({});

/**
 * Build list of documents needing review from packets
 */
function getReviewItems(packets) {
  const items = [];
  for (const packet of packets || []) {
    const docs = packet.documents || [];
    for (const doc of docs) {
      // Include documents that need review AND haven't already been reviewed/rejected.
      // This guards against race conditions where needsReview is still true but
      // status was already updated to "reviewed" by a concurrent state update.
      if (doc.needsReview && doc.status !== "reviewed" && doc.status !== "rejected") {
        items.push({ document: doc, packet });
      }
    }
  }
  return items;
}

/**
 * Full-screen sealed confirmation overlay. Rendered at the top level of the
 * review UI so it's visible even when the queue empties (last item sealed).
 */
function SealedOverlay({ result }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300 pointer-events-none">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 mb-3">
          <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sealed</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {result.editedCount > 0
            ? `${result.editedCount} field${result.editedCount !== 1 ? "s" : ""} updated and verified`
            : "Approved as-is — no changes needed"}
        </p>
      </div>
    </div>
  );
}

export function ReviewQueue({ packets, onApprove, onClose }) {
  // Track locally sealed document IDs so items are immediately removed from queue
  // regardless of how fast the parent state update propagates back through props.
  const [sealedDocIds, setSealedDocIds] = useState(new Set());

  const reviewItems = useMemo(() => {
    const items = getReviewItems(packets);
    // Filter out docs we've already sealed in this session
    if (sealedDocIds.size === 0) return items;
    return items.filter(item => !sealedDocIds.has(item.document.id));
  }, [packets, sealedDocIds]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Per-document edit buffers — keyed by document ID so switching sidebar items
  // preserves in-progress work instead of blowing it away.
  const [allEdits, setAllEdits] = useState({});

  const [base64ByPacketId, setBase64ByPacketId] = useState({});
  // Trigger re-render when a Blob URL is cached (cache itself is external)
  const [blobCacheVersion, setBlobCacheVersion] = useState(0);

  // Category override — per-document, keyed by document ID
  const [categoryOverrides, setCategoryOverrides] = useState({});

  const current = reviewItems[currentIndex];
  const currentDocId = current?.document?.id;

  // Derive current document's edits (stable reference when no edits exist)
  const editedFields = (currentDocId && allEdits[currentDocId]) || EMPTY_EDITS;

  // Clamp currentIndex when reviewItems changes (e.g., after approval/rejection)
  useEffect(() => {
    if (reviewItems.length > 0 && currentIndex >= reviewItems.length) {
      setCurrentIndex(reviewItems.length - 1);
    }
  }, [reviewItems.length, currentIndex]);

  // Initialize edit buffer for a document when first viewed (seed from saved edits).
  // Keyed by document ID (not index) so list reordering doesn't cause cross-contamination.
  useEffect(() => {
    if (!currentDocId) return;
    setAllEdits(prev => {
      // Already initialized — don't overwrite in-progress edits
      if (currentDocId in prev) return prev;
      const saved = current?.document?.editedFields;
      if (saved && Object.keys(saved).length > 0) {
        return { ...prev, [currentDocId]: { ...saved } };
      }
      return prev; // No saved edits; will use EMPTY_EDITS via fallback
    });
  }, [currentDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // Fetch PDF for display. Uses the shared pdfBlobCache to avoid duplicate fetches
  // and manage memory centrally. Falls back to base64 if available in-memory.
  useEffect(() => {
    if (!current?.packet) return;
    const packet = current.packet;
    const id = packet.id;
    let cancelled = false;
    
    // Already cached in the shared LRU cache, or base64 is available in-memory
    if (pdfBlobCache.has(id) || packet.base64 || base64ByPacketId[id]) {
      setLoadingPdf(false);
      setPdfError(null);
      return;
    }
    
    // Try to read from File object if available (in-memory file) — create Blob URL directly
    if (packet.file instanceof File) {
      setLoadingPdf(true);
      setPdfError(null);
      try {
        const url = URL.createObjectURL(packet.file);
        pdfBlobCache.set(id, url, packet.file.size || 0);
        setBlobCacheVersion(v => v + 1);
        setLoadingPdf(false);
      } catch {
        setPdfError("Failed to read file");
        setLoadingPdf(false);
      }
      return;
    }
    
    // Fetch from server as Blob URL (skips base64 conversion — uses ~50% less memory for display)
    setLoadingPdf(true);
    setPdfError(null);
    api.getPacketFileAsBlobUrl(id)
      .then((url) => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        pdfBlobCache.set(id, url, packet.size || 0);
        setBlobCacheVersion(v => v + 1);
        setPdfError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("PDF fetch failed for packet", id, err.message);
        setPdfError("PDF expired or unavailable. Results are still accessible.");
      })
      .finally(() => { if (!cancelled) setLoadingPdf(false); });

    return () => { cancelled = true; };
  }, [current?.packet?.id, current?.packet?.base64, current?.packet?.file, blobCacheVersion, base64ByPacketId]);

  const packetBase64 = current
    ? (current.packet.base64 || base64ByPacketId[current.packet.id])
    : null;
  const packetBlobUrl = current ? pdfBlobCache.get(current.packet.id) : null;

  // Track individually approved fields (by document id -> field key)
  const [approvedFields, setApprovedFields] = useState({});

  // Get approved fields for current document
  const currentApprovedFields = current ? (approvedFields[current.document.id] || {}) : {};

  const toggleFieldApproval = useCallback((fieldKey) => {
    if (!current) return;
    const docId = current.document.id;
    setApprovedFields((prev) => ({
      ...prev,
      [docId]: {
        ...(prev[docId] || {}),
        [fieldKey]: !(prev[docId]?.[fieldKey]),
      },
    }));
  }, [current]);

  const approveAllFields = useCallback((fieldKeys) => {
    if (!current) return;
    const docId = current.document.id;
    const newApproved = {};
    fieldKeys.forEach((key) => { newApproved[key] = true; });
    setApprovedFields((prev) => ({
      ...prev,
      [docId]: { ...(prev[docId] || {}), ...newApproved },
    }));
  }, [current]);

  // Saving / sealed / error states for async approval flow
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // Synchronous guard against double-click (React batches state)
  const [sealedResult, setSealedResult] = useState(null); // { ok, editedCount, documentName }
  const [saveError, setSaveError] = useState(null);
  const sealTimerRef = useRef(null);
  // Last-document confirmation: show summary before sealing final item in queue
  const [showLastSealConfirm, setShowLastSealConfirm] = useState(false);

  // Clear sealed overlay timer on unmount
  useEffect(() => () => { if (sealTimerRef.current) clearTimeout(sealTimerRef.current); }, []);

  // Auto-clear the sealed overlay after it's been shown
  useEffect(() => {
    if (!sealedResult) return;
    const id = setTimeout(() => setSealedResult(null), 3000);
    return () => clearTimeout(id);
  }, [sealedResult]);

  // --- All hooks MUST be above the early return (Rules of Hooks) ---

  const { data: rawData, likelihoods: rawLikelihoods } = current
    ? getMergedExtractionData(current.document)
    : { data: {}, likelihoods: {} };

  // Baseline data ref — captures the "starting" values for each document so we can
  // detect phantom edits (user typed in a field but didn't actually change the value).
  // Stored per-document, set once on first view. Not a hook — just a persistent ref.
  const baselineRef = useRef({});
  if (currentDocId && !(currentDocId in baselineRef.current)) {
    baselineRef.current[currentDocId] = { ...rawData };
  }

  // Prune stale entries from baselineRef and allEdits when items leave the queue
  // to prevent unbounded memory growth during long review sessions.
  useEffect(() => {
    const activeIds = new Set(reviewItems.map(item => item.document.id));
    // Prune baselineRef
    for (const id of Object.keys(baselineRef.current)) {
      if (!activeIds.has(id)) delete baselineRef.current[id];
    }
    // Prune allEdits
    setAllEdits(prev => {
      const staleKeys = Object.keys(prev).filter(id => !activeIds.has(id));
      if (staleKeys.length === 0) return prev;
      const next = { ...prev };
      for (const id of staleKeys) delete next[id];
      return next;
    });
  }, [reviewItems]);

  // When the reviewer reclassifies a document, swap in the new schema's fields.
  // Existing extraction values carry over where field names match; new fields
  // appear empty so the reviewer can fill them in from the PDF.
  const currentCatOverrideForSchema = categoryOverrides[currentDocId] || null;

  const { data, likelihoods, schemaFields } = useMemo(() => {
    // No override, or override is a custom category (no matching schema) — use raw data as-is
    if (!currentCatOverrideForSchema || currentCatOverrideForSchema.isCustom) {
      return { data: rawData, likelihoods: rawLikelihoods, schemaFields: null };
    }

    // Lookup the target schema
    const targetSchema = schemas[currentCatOverrideForSchema.id];
    if (!targetSchema?.schema?.properties) {
      return { data: rawData, likelihoods: rawLikelihoods, schemaFields: null };
    }

    const targetFields = Object.keys(targetSchema.schema.properties);
    const mergedData = {};
    const mergedLikelihoods = {};

    // First: populate all target schema fields (preserving existing values where they match)
    for (const field of targetFields) {
      if (field in editedFields) {
        mergedData[field] = editedFields[field];
      } else if (field in rawData) {
        mergedData[field] = rawData[field];
      } else {
        mergedData[field] = ""; // Empty — reviewer needs to fill this in
      }
      if (field in rawLikelihoods) {
        mergedLikelihoods[field] = rawLikelihoods[field];
      }
      // New fields from the target schema have no likelihood → will appear as critical
    }

    // Also carry over any extra extracted fields that aren't in the new schema
    // (shown in a separate section so the reviewer can copy values from them)
    for (const [key, value] of Object.entries(rawData)) {
      if (!(key in mergedData)) {
        mergedData[key] = value;
        if (key in rawLikelihoods) {
          mergedLikelihoods[key] = rawLikelihoods[key];
        }
      }
    }

    return { data: mergedData, likelihoods: mergedLikelihoods, schemaFields: new Set(targetFields) };
  }, [rawData, rawLikelihoods, currentCatOverrideForSchema, editedFields]);

  const REVIEW_THRESHOLD = 0.75;
  const LOW_THRESHOLD = 0.5;

  // Categorize fields by confidence level
  const categorizedFields = useMemo(() => {
    const entries = Object.entries(data || {});
    const critical = []; // Very low confidence, empty, or new schema fields
    const warning = [];  // Low confidence
    const ok = [];       // Good confidence
    const extra = [];    // Fields from original schema not in the new one

    entries.forEach(([key, value]) => {
      const likelihood = likelihoods?.[key];
      const isEmpty = value === null || value === undefined || value === "";
      const isVeryLow = typeof likelihood === "number" && likelihood < LOW_THRESHOLD;
      const isLow = typeof likelihood === "number" && likelihood < REVIEW_THRESHOLD;
      // If schema was swapped, fields not in the target schema are "extra"
      const isExtraField = schemaFields && !schemaFields.has(key);
      // New fields from the target schema that had no extraction data
      const isNewSchemaField = schemaFields && schemaFields.has(key) && likelihood === undefined && isEmpty;

      if (isExtraField) {
        extra.push({ key, value, likelihood, isEmpty, isExtra: true });
      } else if (isNewSchemaField || isVeryLow || isEmpty) {
        critical.push({ key, value, likelihood, isEmpty });
      } else if (isLow) {
        warning.push({ key, value, likelihood });
      } else {
        ok.push({ key, value, likelihood });
      }
    });

    // Sort each category by likelihood (lowest first)
    const sortByLikelihood = (a, b) => (a.likelihood ?? 1) - (b.likelihood ?? 1);
    critical.sort(sortByLikelihood);
    warning.sort(sortByLikelihood);

    return { critical, warning, ok, extra };
  }, [data, likelihoods, schemaFields]);

  // Required fields — union of schema "required" array and CRITICAL_FIELDS for the doc type
  const requiredFields = useMemo(() => {
    const category = currentCatOverrideForSchema?.id
      || current?.document?.classification?.category
      || current?.document?.splitType
      || null;
    const set = new Set();
    const schemaRequired = category && schemas[category]?.schema?.required;
    if (Array.isArray(schemaRequired)) schemaRequired.forEach(k => set.add(k));
    const critFields = category && CRITICAL_FIELDS[category];
    if (Array.isArray(critFields)) critFields.forEach(k => set.add(k));
    return set;
  }, [currentCatOverrideForSchema, current?.document?.classification?.category, current?.document?.splitType]);

  // Combine all fields in priority order (moved before early return for Rules of Hooks)
  const allFields = useMemo(() => [
    ...categorizedFields.critical,
    ...categorizedFields.warning,
    ...categorizedFields.ok,
  ], [categorizedFields]);

  const editedCount = Object.keys(editedFields).length;
  const emptyCount = allFields.filter(f => f.isEmpty).length;
  const lowConfCount = categorizedFields.critical.length + categorizedFields.warning.length;

  // Count required fields that are still empty (not filled, not marked N/D)
  const emptyRequiredCount = useMemo(() => {
    return allFields.filter(f => {
      if (!requiredFields.has(f.key)) return false;
      const val = editedFields[f.key] !== undefined ? editedFields[f.key] : (f.value ?? "");
      return val === null || val === undefined || val === "";
    }).length;
  }, [allFields, requiredFields, editedFields]);

  // Per-item readiness for sidebar filtering and status badges
  const itemReadiness = useMemo(() => {
    return reviewItems.map(item => {
      const doc = item.document;
      const catId = categoryOverrides[doc.id]?.id
        || doc.classification?.category
        || doc.splitType
        || null;
      const reqSet = new Set();
      const sr = catId && schemas[catId]?.schema?.required;
      if (Array.isArray(sr)) sr.forEach(k => reqSet.add(k));
      const cf = catId && CRITICAL_FIELDS[catId];
      if (Array.isArray(cf)) cf.forEach(k => reqSet.add(k));
      const { data: docData } = getMergedExtractionData(doc);
      const edits = allEdits[doc.id] || {};
      const merged = { ...docData, ...edits };
      let emptyReq = 0;
      for (const key of reqSet) {
        const val = merged[key];
        if (val === null || val === undefined || val === "") emptyReq++;
      }
      const displayCat = getCategoryDisplayName(catId || "Document");
      return { docId: doc.id, category: displayCat, categoryId: catId, emptyRequired: emptyReq, hasIssues: emptyReq > 0 };
    });
  }, [reviewItems, categoryOverrides, allEdits]);

  // Sidebar filter state
  const [sidebarFilter, setSidebarFilter] = useState("all"); // "all" | "needs_fix" | "ready"
  const [sidebarDocTypeFilter, setSidebarDocTypeFilter] = useState("all");

  // Focused field key for PDF highlighting
  const [focusedFieldKey, setFocusedFieldKey] = useState(null);

  // Debounced highlight text for PDF
  const [highlightText, setHighlightText] = useState("");
  const highlightTimerRef = useRef(null);
  useEffect(() => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    if (!focusedFieldKey) { setHighlightText(""); return; }
    const val = editedFields[focusedFieldKey] !== undefined
      ? editedFields[focusedFieldKey]
      : (data[focusedFieldKey] ?? "");
    const str = (val === NOT_IN_DOCUMENT_VALUE || val === null || val === undefined)
      ? ""
      : (typeof val === "object" ? JSON.stringify(val) : String(val));
    if (str.length < 2) { setHighlightText(""); return; }
    highlightTimerRef.current = setTimeout(() => setHighlightText(str), 300);
    return () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current); };
  }, [focusedFieldKey, editedFields, data]);

  // Undo snapshot for bulk "Mark all empty as N/D"
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const undoTimerRef = useRef(null);
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);
  useEffect(() => {
    setUndoSnapshot(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, [currentDocId]);

  // Required fields warning for seal
  const [showRequiredWarning, setShowRequiredWarning] = useState(false);

  // Bulk action: mark all empty fields as "Not in Document"
  const handleMarkAllEmptyAsNID = useCallback(() => {
    if (!currentDocId) return;
    const currentEdits = allEdits[currentDocId] || {};
    const emptyFieldKeys = allFields.filter(f => {
      const val = currentEdits[f.key] !== undefined ? currentEdits[f.key] : (f.value ?? "");
      return val === null || val === undefined || val === "";
    }).map(f => f.key);
    if (emptyFieldKeys.length === 0) return;
    setUndoSnapshot({ docId: currentDocId, edits: { ...currentEdits }, count: emptyFieldKeys.length });
    const newEdits = { ...currentEdits };
    for (const key of emptyFieldKeys) newEdits[key] = NOT_IN_DOCUMENT_VALUE;
    setAllEdits(prev => ({ ...prev, [currentDocId]: newEdits }));
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoSnapshot(null), 5000);
  }, [currentDocId, allEdits, allFields]);

  const handleUndoMarkAll = useCallback(() => {
    if (!undoSnapshot) return;
    setAllEdits(prev => ({ ...prev, [undoSnapshot.docId]: undoSnapshot.edits }));
    setUndoSnapshot(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, [undoSnapshot]);

  const [expandedSections, setExpandedSections] = useState({
    critical: true,
    warning: true,
    ok: false, // Collapsed by default
    extra: false, // Reference fields from original schema
  });

  // --- performSeal: core seal logic (used directly or after last-document confirmation) ---
  const performSeal = useCallback(async () => {
    if (!current || saving || savingRef.current) return;
    if (!onApprove) {
      setSaveError("Review handler not available. Please reload the page.");
      return;
    }
    savingRef.current = true;
    const docId = current.document.id;
    const catOverride = categoryOverrides[docId] || null;
    setSaving(true);
    setSaveError(null);
    setSealedResult(null);

    try {
      const baseline = baselineRef.current[docId] || {};
      const trueEdits = {};
      for (const [key, value] of Object.entries(editedFields)) {
        if (String(value ?? "") !== String(baseline[key] ?? "")) {
          trueEdits[key] = value;
        }
      }
      const userEditedCount = Object.keys(trueEdits).length;

      let finalEdits;
      if (catOverride && !catOverride.isCustom && catOverride.id) {
        const targetSchema = schemas[catOverride.id];
        if (targetSchema?.schema?.properties) {
          finalEdits = {};
          for (const field of Object.keys(targetSchema.schema.properties)) {
            if (field in trueEdits) {
              finalEdits[field] = trueEdits[field];
            } else if (field in baseline) {
              finalEdits[field] = baseline[field];
            } else {
              finalEdits[field] = "";
            }
          }
        } else {
          finalEdits = trueEdits;
        }
      } else {
        finalEdits = trueEdits;
      }

      const reviewFieldKeys = [...categorizedFields.critical, ...categorizedFields.warning].map(f => f.key);
      for (const key of reviewFieldKeys) {
        const v = finalEdits[key];
        if (v === undefined || v === null || v === "")
          finalEdits[key] = NOT_IN_DOCUMENT_VALUE;
      }

      const result = await onApprove(current.document, current.packet, {
        editedFields: finalEdits,
        approvedFields: { ...currentApprovedFields },
        categoryOverride: catOverride,
        userEditedCount,
      });

      setSealedDocIds(prev => new Set(prev).add(docId));
      setSealedResult(result || { ok: true, editedCount: userEditedCount, documentName: catOverride?.name || "Document" });
      setSaving(false);
      savingRef.current = false;

      setAllEdits(prev => { const u = { ...prev }; delete u[docId]; return u; });
      setCategoryOverrides((prev) => { const u = { ...prev }; delete u[docId]; return u; });
      setApprovedFields((prev) => {
        const updated = { ...prev };
        delete updated[docId];
        return updated;
      });
      delete baselineRef.current[docId];

      const packetId = current.packet.id;
      const remainingFromPacket = reviewItems.filter(
        item => item.packet.id === packetId && item.document.id !== docId
      );
      if (remainingFromPacket.length === 0) {
        setBase64ByPacketId(prev => { const u = { ...prev }; delete u[packetId]; return u; });
        pdfBlobCache.evict(packetId);
      }
      setCurrentIndex((i) => Math.min(i, Math.max(0, reviewItems.length - 2)));
    } catch (error) {
      console.error("Failed to seal review:", error);
      setSaveError(error.message || "Failed to save review");
      setSaving(false);
      savingRef.current = false;
    }
  }, [current, saving, onApprove, editedFields, currentApprovedFields, categoryOverrides, reviewItems, categorizedFields]);

  // "Accept AI" — fast seal when no required fields are empty
  const handleAcceptAI = useCallback(() => {
    if (!current || saving || savingRef.current || emptyRequiredCount > 0) return;
    if (!onApprove) {
      setSaveError("Review handler not available. Please reload the page.");
      return;
    }
    if (reviewItems.length === 1) {
      setShowLastSealConfirm(true);
      return;
    }
    performSeal();
  }, [current, saving, emptyRequiredCount, onApprove, reviewItems.length, performSeal]);

  // --- handleApprove: "Seal & Save" — warn about required fields, then show last-document confirmation or perform seal ---
  const handleApprove = useCallback(() => {
    if (!current || saving || savingRef.current) return;
    if (!onApprove) {
      setSaveError("Review handler not available. Please reload the page.");
      return;
    }
    // Warn if required fields are still empty
    if (emptyRequiredCount > 0) {
      setShowRequiredWarning(true);
      return;
    }
    if (reviewItems.length === 1) {
      setShowLastSealConfirm(true);
      return;
    }
    performSeal();
  }, [current, saving, onApprove, reviewItems.length, performSeal, emptyRequiredCount]);

  // Summary for last-document confirmation modal (only what the user changed: category + trueEdits)
  const lastSealSummary = useMemo(() => {
    if (!showLastSealConfirm || !current) return { categoryLine: null, fieldLines: [], empty: true };
    const docId = current.document.id;
    const catOverride = categoryOverrides[docId] || null;
    const baseline = baselineRef.current[docId] || {};
    const trueEdits = {};
    for (const [key, value] of Object.entries(editedFields)) {
      if (String(value ?? "") !== String(baseline[key] ?? "")) trueEdits[key] = value;
    }
    const categoryLine = catOverride
      ? `Document type: ${getCategoryDisplayName(current.document?.splitType || current.document?.classification?.category || "Document")} → ${catOverride.name}`
      : null;
    const truncate = (s, max) => (s.length <= max ? s : s.slice(0, max) + "…");
    const fieldLines = Object.entries(trueEdits).map(([key, val]) => {
      const raw = typeof val === "object" && val !== null ? JSON.stringify(val) : displayValue(val);
      return { key, label: formatFieldName(key), value: truncate(String(raw ?? ""), 60) };
    });
    return {
      categoryLine,
      fieldLines,
      empty: !categoryLine && fieldLines.length === 0,
    };
  }, [showLastSealConfirm, current, editedFields, categoryOverrides]);

  // --- Early return: empty state (AFTER all hooks) ---

  if (reviewItems.length === 0 || !current) {
    return (
      <div className="h-full relative flex items-center justify-center bg-gray-50 dark:bg-neutral-900 pt-16 pb-16">
        {/* Sealed overlay — persists even after queue empties (last item sealed) */}
        {sealedResult && <SealedOverlay result={sealedResult} />}
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <ShieldCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-neutral-100 mb-2">All clear</h2>
          <p className="text-gray-500 dark:text-neutral-400 mb-6">Every document has been reviewed and sealed. Nothing left to check.</p>
          <Button onClick={onClose}>Return to Results</Button>
        </div>
      </div>
    );
  }

  const rawCategory = current.document?.splitType || current.document?.classification?.category || "Document";
  const currentCategoryOverride = categoryOverrides[current.document?.id] || null;
  const displayName = currentCategoryOverride ? currentCategoryOverride.name : rawCategory;
  const isUnknownType = UNKNOWN_CATEGORIES.has(rawCategory) && !currentCategoryOverride;

  // Render a single field row — always shows inline input for Tab-through editing
  const renderFieldRow = ({ key, value, likelihood, isEmpty }) => {
    const isVeryLow = typeof likelihood === "number" && likelihood < LOW_THRESHOLD;
    const isLow = typeof likelihood === "number" && likelihood < REVIEW_THRESHOLD;
    const displayValue = editedFields[key] !== undefined ? editedFields[key] : (value ?? "");
    const isNotInDocument = displayValue === NOT_IN_DOCUMENT_VALUE;
    const confidencePct = typeof likelihood === "number" ? Math.round(likelihood * 100) : null;
    const wasEdited = editedFields[key] !== undefined;
    const isObject = typeof displayValue === "object" && displayValue !== null;
    const displayStr = isNotInDocument ? NOT_IN_DOCUMENT_LABEL : (isObject ? JSON.stringify(displayValue, null, 2) : String(displayValue));

    // Confidence dot color
    const dotColor = isEmpty || isVeryLow
      ? "bg-red-400 dark:bg-red-500"
      : isLow
        ? "bg-amber-400 dark:bg-amber-500"
        : "bg-green-400 dark:bg-green-500";

    // Left border accent
    const borderAccent = wasEdited
      ? "border-l-2 border-l-blue-400 dark:border-l-blue-500"
      : isEmpty || isVeryLow
        ? "border-l-2 border-l-red-300 dark:border-l-red-600"
        : isLow
          ? "border-l-2 border-l-amber-300 dark:border-l-amber-600"
          : "border-l-2 border-l-transparent";

    const setNotInDocument = () => {
      setAllEdits(prev => ({ ...prev, [currentDocId]: { ...(prev[currentDocId] || {}), [key]: NOT_IN_DOCUMENT_VALUE } }));
    };

    return (
      <div key={key} className={`flex items-start gap-1.5 px-2 py-1 ${borderAccent}`}>
        {/* Confidence dot */}
        <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-[7px] ${dotColor}`}
          title={confidencePct != null ? `${confidencePct}%` : undefined} />

        {/* Label */}
        <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 w-[100px] shrink-0 pt-[5px] truncate cursor-pointer"
          title={formatFieldName(key)} htmlFor={`review-field-${key}`}>
          {formatFieldName(key)}
          {wasEdited && <span className="text-blue-500 ml-0.5">*</span>}
        </label>

        {/* Input — always visible, Tab-navigable */}
        <div className="flex-1 min-w-0">
          {isObject ? (
            <textarea
              id={`review-field-${key}`}
              title={isNotInDocument ? NOT_IN_DOCUMENT_LABEL : undefined}
              className={`w-full px-1.5 py-0.5 text-[11px] leading-tight border rounded resize-none transition-colors
                ${wasEdited ? "border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10" :
                  isEmpty || isVeryLow ? "border-red-200 dark:border-red-800 bg-red-50/20 dark:bg-red-900/10" :
                  "border-gray-200 dark:border-gray-600 bg-transparent"}
                text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-400`}
              rows={2}
              value={displayStr}
              onChange={(e) => {
                let val;
                try { val = JSON.parse(e.target.value); } catch { val = e.target.value; }
                setAllEdits(prev => ({ ...prev, [currentDocId]: { ...(prev[currentDocId] || {}), [key]: val } }));
              }}
            />
          ) : (
            <input
              id={`review-field-${key}`}
              type="text"
              title={isNotInDocument ? NOT_IN_DOCUMENT_LABEL : undefined}
              className={`w-full px-1.5 py-0.5 text-[11px] border rounded transition-colors
                ${wasEdited ? "border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10" :
                  isEmpty || isVeryLow ? "border-red-200 dark:border-red-800 bg-red-50/20 dark:bg-red-900/10" :
                  "border-gray-200 dark:border-gray-600 bg-transparent"}
                text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-400`}
              value={displayStr}
              placeholder={isEmpty && !isNotInDocument ? "—" : ""}
              onChange={(e) => setAllEdits(prev => ({ ...prev, [currentDocId]: { ...(prev[currentDocId] || {}), [key]: e.target.value } }))}
            />
          )}
        </div>

        {/* Confidence % + Not in document — grouped so layout is consistent with or without score */}
        <div className="flex items-center gap-1 shrink-0 pt-[5px]">
          {confidencePct !== null && (
            <span className={`text-[9px] tabular-nums w-6 text-right ${
              isVeryLow ? "text-red-500" : isLow ? "text-amber-500" : "text-gray-400"
            }`}>{confidencePct}%</span>
          )}
          {confidencePct === null && <span className="w-6" aria-hidden />}
          <button
            type="button"
            onClick={setNotInDocument}
            className="p-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 inline-flex items-center justify-center"
            title="Not in document"
            aria-label="Mark as not present in this document"
          >
            <SearchSlash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full relative flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Sealed overlay — covers entire review UI */}
      {sealedResult && <SealedOverlay result={sealedResult} />}
      {/* Last-document confirmation modal */}
      {showLastSealConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="last-seal-modal-title">
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/60"
            onClick={() => setShowLastSealConfirm(false)}
            aria-hidden
          />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full p-6 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 rounded-full shrink-0 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="last-seal-modal-title" className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-1">Confirm sealing — last document</h3>
                <p className="text-sm text-gray-600 dark:text-neutral-400">
                  This is the last document in the review queue. The following changes will be saved. You can seal and complete review now, or go back to make more edits.
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900/50 p-3 mb-4 max-h-[220px]">
              {lastSealSummary.empty ? (
                <p className="text-sm text-gray-500 dark:text-neutral-400">No changes — document will be approved as-is.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {lastSealSummary.categoryLine && (
                    <li className="text-gray-700 dark:text-neutral-200">{lastSealSummary.categoryLine}</li>
                  )}
                  {lastSealSummary.fieldLines.map(({ key, label, value }) => (
                    <li key={key} className="text-gray-700 dark:text-neutral-200">
                      <span className="font-medium text-gray-500 dark:text-neutral-400">{label}:</span>{" "}
                      <span className="wrap-break-word">{value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowLastSealConfirm(false)}>
                Back to review
              </Button>
              <Button
                variant="default"
                className="bg-[#9e2339] hover:bg-[#852030] text-white"
                onClick={() => {
                  setShowLastSealConfirm(false);
                  performSeal();
                }}
              >
                Seal and complete
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Fixed header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Document: {displayName}</h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          Back to Results
        </Button>
      </div>

      {/* Main content using CSS Grid for rigid sizing */}
      <div 
        className="flex-1 min-h-0 grid overflow-hidden"
        style={{ 
          gridTemplateColumns: "176px 1fr 360px", // sidebar, pdf, data panel
          gridTemplateRows: "1fr"
        }}
      >
        {/* Review queue sidebar - column 1 */}
        <div className="border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 overflow-y-auto">
          <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5">Review Queue</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">{currentIndex + 1} of {reviewItems.length}</p>
          <div className="space-y-0.5">
            {reviewItems.map((item, i) => {
              const docPages = item.document.pages;
              const pageLabel = Array.isArray(docPages) && docPages.length > 0
                ? (docPages.length === 1 ? `p${docPages[0]}` : `p${docPages[0]}-${docPages[docPages.length - 1]}`)
                : null;
              return (
                <button
                  key={item.document.id}
                  type="button"
                  onClick={() => setCurrentIndex(i)}
                  className={`w-full text-left px-2 py-1 rounded text-[11px] truncate ${i === currentIndex ? "bg-[#9e2339]/10 dark:bg-[#9e2339]/20 text-[#9e2339] dark:text-[#d45a6a] font-medium" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                >
                  #{i + 1}{pageLabel ? <span className="ml-1 opacity-60">{pageLabel}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* PDF Preview - column 2, fixed by grid, completely independent */}
        <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 overflow-hidden">
          {pdfError && !packetBase64 && !packetBlobUrl ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
              <div className="text-center px-8">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-gray-600 dark:text-gray-300 mb-1">PDF Preview Unavailable</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">{pdfError}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">You can still review and approve the extracted data on the right.</p>
              </div>
            </div>
          ) : (
            <PDFPreview
              base64Data={packetBase64}
              blobUrl={packetBlobUrl}
              pages={current.document.pages}
              filename={current.packet.filename || current.packet.name}
              loading={loadingPdf}
            />
          )}
        </div>

        {/* Extracted data panel - column 3, fixed width by grid */}
        <div className="flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
          {/* Panel header — compact status summary */}
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                {schemaFields ? (currentCatOverrideForSchema?.name || "Extracted Data") : "Extracted Data"}
              </h3>
              {current.document.pages && current.document.pages.length > 0 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  pg {current.document.pages.join(", ")}
                </span>
              )}
            </div>
            {/* Status chips + category picker (always visible) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {allFields.length} fields
              </span>
              {emptyCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  {emptyCount} empty
                </span>
              )}
              {lowConfCount > 0 && emptyCount !== lowConfCount && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  {lowConfCount - emptyCount} low conf
                </span>
              )}
              {editedCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  {editedCount} edited
                </span>
              )}
              {/* Category badge — always visible, reclassify picker for unknown types */}
              {isUnknownType || currentCategoryOverride ? (
                <CategoryPicker
                  currentCategory={currentCategoryOverride}
                  onSelect={(cat) => {
                    const docId = current.document.id;
                    setCategoryOverrides((prev) => {
                      if (!cat) { const u = { ...prev }; delete u[docId]; return u; }
                      return { ...prev, [docId]: cat };
                    });
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const docId = current.document.id;
                    const catId = rawCategory;
                    const catName = getCategoryDisplayName(catId);
                    setCategoryOverrides(prev => ({ ...prev, [docId]: { id: catId, name: catName, isCustom: false } }));
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Reclassify document type"
                >
                  <PenLine className="h-2.5 w-2.5" />
                  <span className="truncate max-w-[100px]">{getCategoryDisplayName(rawCategory)}</span>
                </button>
              )}
            </div>
            {/* Bulk actions */}
            <div className="flex items-center gap-1.5 mt-1.5">
              {emptyCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllEmptyAsNID}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <SearchSlash className="h-3 w-3" />
                  Mark {emptyCount} empty as N/D
                </button>
              )}
              {undoSnapshot && undoSnapshot.docId === currentDocId && (
                <button
                  type="button"
                  onClick={handleUndoMarkAll}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                >
                  <Undo2 className="h-3 w-3" />
                  Undo ({undoSnapshot.count})
                </button>
              )}
            </div>
          </div>

          {/* Flagged fields summary — clickable chips for quick navigation */}
          {(categorizedFields.critical.length > 0 || categorizedFields.warning.length > 0) && (
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10 shrink-0">
              <p className="text-[10px] font-medium text-amber-700 dark:text-amber-300 mb-1">
                <AlertTriangle className="h-3 w-3 inline-block mr-0.5 -mt-px" />
                {categorizedFields.critical.length + categorizedFields.warning.length} fields need attention
              </p>
              <div className="flex flex-wrap gap-1">
                {[...categorizedFields.critical, ...categorizedFields.warning].slice(0, 8).map(f => {
                  const pct = typeof f.likelihood === "number" ? `${Math.round(f.likelihood * 100)}%` : null;
                  const isReq = requiredFields.has(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`review-field-${f.key}`);
                        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); }
                      }}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                        f.isEmpty
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                          : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                      }`}
                    >
                      {isReq && <span className="text-red-500 font-bold">*</span>}
                      {formatFieldName(f.key)}
                      {pct && <span className="opacity-60">({pct})</span>}
                    </button>
                  );
                })}
                {(categorizedFields.critical.length + categorizedFields.warning.length) > 8 && (
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 self-center">
                    +{categorizedFields.critical.length + categorizedFields.warning.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Scrollable content — flat field list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* All fields — flat list, every input visible and Tab-navigable */}
            <div className="py-1 space-y-0">
              {allFields.map((field) => renderFieldRow(field))}
            </div>

            {/* Extra fields from original schema (when reclassified) */}
            {categorizedFields.extra.length > 0 && (
              <>
                <div className="px-3 py-1.5 border-t border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
                  <button
                    type="button"
                    onClick={() => setExpandedSections(p => ({ ...p, extra: !p.extra }))}
                    className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 w-full"
                  >
                    <FileText className="h-3 w-3" />
                    <span className="font-medium">Original extraction — {categorizedFields.extra.length} fields (reference)</span>
                    {expandedSections.extra ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                  </button>
                </div>
                {expandedSections.extra && (
                  <div className="py-1 space-y-0 opacity-60">
                    {categorizedFields.extra.map((field) => renderFieldRow(field))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom bar — save actions */}
          <div className="px-3 py-2.5 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-2 bg-white dark:bg-gray-800">
            {/* Error message from failed save */}
            {saveError && (
              <p className="text-[10px] text-red-600 dark:text-red-400 leading-tight bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5">
                <AlertCircle className="h-3 w-3 inline-block mr-0.5 -mt-px" />
                {saveError} — your edits are still here, try again.
              </p>
            )}
            {/* Required fields warning */}
            {emptyRequiredCount > 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                <AlertTriangle className="h-3 w-3 inline-block mr-0.5 -mt-px" />
                {emptyRequiredCount} required field{emptyRequiredCount !== 1 ? "s" : ""} still empty
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleAcceptAI}
                className="flex-1"
                disabled={saving || emptyRequiredCount > 0}
                title={emptyRequiredCount > 0 ? `${emptyRequiredCount} required fields are empty` : "Accept AI extraction as-is"}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Accept AI
              </Button>
              <Button 
                variant="success" 
                onClick={handleApprove} 
                className="flex-1"
                disabled={saving}
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving...</>
                ) : (
                  <><ShieldCheck className="h-4 w-4 mr-1" /> Seal</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
