import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { CheckCircle, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, FileText, Check, Circle, ShieldCheck, Loader2, Tag, Plus, X, Search } from "lucide-react";
import { Button } from "./ui/button";
import { SailboatIcon } from "./ui/sailboat-icon";
import { getMergedExtractionData } from "../lib/utils";
import { getCategoryDisplayName } from "../lib/documentCategories";
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

  const [expandedSections, setExpandedSections] = useState({
    critical: true,
    warning: true,
    ok: false, // Collapsed by default
    extra: false, // Reference fields from original schema
  });

  // --- handleApprove: the main "Seal & Save" action ---
  const handleApprove = useCallback(async () => {
    // Synchronous ref guard — prevents double-click race where two clicks both
    // pass the `saving` state check before the first setSaving(true) takes effect.
    if (!current || saving || savingRef.current) return;
    savingRef.current = true;

    // Guard: onApprove must be provided — fail loudly instead of silently doing nothing
    if (!onApprove) {
      setSaveError("Review handler not available. Please reload the page.");
      savingRef.current = false;
      return;
    }

    const docId = current.document.id;
    const catOverride = categoryOverrides[docId] || null;
    setSaving(true);
    setSaveError(null);
    setSealedResult(null);

    try {
      // --- Filter phantom edits: only include fields whose value actually changed ---
      const baseline = baselineRef.current[docId] || {};
      const trueEdits = {};
      for (const [key, value] of Object.entries(editedFields)) {
        // Compare as strings since input values are always strings
        if (String(value ?? "") !== String(baseline[key] ?? "")) {
          trueEdits[key] = value;
        }
      }
      const userEditedCount = Object.keys(trueEdits).length;

      // --- For reclassified documents, save ALL target schema fields ---
      // This ensures the complete new-schema data set is persisted, not just
      // the sparse edits. Without this, getMergedExtractionData would mix
      // old-schema extraction fields with new-schema edits on export/reload.
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

      const result = await onApprove(current.document, current.packet, {
        editedFields: finalEdits,
        approvedFields: { ...currentApprovedFields },
        categoryOverride: catOverride,
        userEditedCount, // how many fields the reviewer actually typed into
      });

      // Immediately mark this document as sealed locally — removes it from the queue
      // without waiting for the parent state update to propagate back through props.
      setSealedDocIds(prev => new Set(prev).add(docId));

      // Show "Sealed" confirmation overlay
      setSealedResult(result || { ok: true, editedCount: userEditedCount, documentName: catOverride?.name || "Document" });
      setSaving(false);
      savingRef.current = false;

      // Clean up local state for this document
      setAllEdits(prev => { const u = { ...prev }; delete u[docId]; return u; });
      setCategoryOverrides((prev) => { const u = { ...prev }; delete u[docId]; return u; });
      setApprovedFields((prev) => {
        const updated = { ...prev };
        delete updated[docId];
        return updated;
      });
      delete baselineRef.current[docId]; // free baseline memory

      // Free cached PDF data for this packet if no other documents from it remain in the queue
      const packetId = current.packet.id;
      const remainingFromPacket = reviewItems.filter(
        item => item.packet.id === packetId && item.document.id !== docId && !sealedDocIds.has(item.document.id)
      );
      if (remainingFromPacket.length === 0) {
        setBase64ByPacketId(prev => { const u = { ...prev }; delete u[packetId]; return u; });
        pdfBlobCache.evict(packetId);
      }
      // Clamp index — the item was just removed so the list is now shorter
      setCurrentIndex((i) => Math.min(i, Math.max(0, reviewItems.length - 2)));
    } catch (error) {
      console.error("Failed to seal review:", error);
      setSaveError(error.message || "Failed to save review");
      setSaving(false);
      savingRef.current = false;
      // Stay on current document so the user can retry
    }
  }, [current, saving, onApprove, editedFields, currentApprovedFields, categoryOverrides, reviewItems.length]);

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

  // --- Flat field list: all fields visible with inline inputs for Tab navigation ---

  // Combine all fields in priority order: critical first, then warning, then ok
  const allFields = useMemo(() => [
    ...categorizedFields.critical,
    ...categorizedFields.warning,
    ...categorizedFields.ok,
  ], [categorizedFields]);

  const editedCount = Object.keys(editedFields).length;
  const emptyCount = allFields.filter(f => f.isEmpty).length;
  const lowConfCount = categorizedFields.critical.length + categorizedFields.warning.length;

  // Render a single field row — always shows inline input for Tab-through editing
  const renderFieldRow = ({ key, value, likelihood, isEmpty }) => {
    const isVeryLow = typeof likelihood === "number" && likelihood < LOW_THRESHOLD;
    const isLow = typeof likelihood === "number" && likelihood < REVIEW_THRESHOLD;
    const displayValue = editedFields[key] !== undefined ? editedFields[key] : (value ?? "");
    const confidencePct = typeof likelihood === "number" ? Math.round(likelihood * 100) : null;
    const wasEdited = editedFields[key] !== undefined;
    const isObject = typeof displayValue === "object" && displayValue !== null;
    const displayStr = isObject ? JSON.stringify(displayValue, null, 2) : String(displayValue);

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
              className={`w-full px-1.5 py-0.5 text-[11px] border rounded transition-colors
                ${wasEdited ? "border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10" :
                  isEmpty || isVeryLow ? "border-red-200 dark:border-red-800 bg-red-50/20 dark:bg-red-900/10" :
                  "border-gray-200 dark:border-gray-600 bg-transparent"}
                text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-400`}
              value={displayStr}
              placeholder={isEmpty ? "—" : ""}
              onChange={(e) => setAllEdits(prev => ({ ...prev, [currentDocId]: { ...(prev[currentDocId] || {}), [key]: e.target.value } }))}
            />
          )}
        </div>

        {/* Confidence % */}
        {confidencePct !== null && (
          <span className={`text-[9px] tabular-nums shrink-0 pt-[5px] w-6 text-right ${
            isVeryLow ? "text-red-500" : isLow ? "text-amber-500" : "text-gray-400"
          }`}>{confidencePct}%</span>
        )}
        {confidencePct === null && <span className="w-6 shrink-0" />}
      </div>
    );
  };

  return (
    <div className="h-full relative flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Sealed overlay — covers entire review UI */}
      {sealedResult && <SealedOverlay result={sealedResult} />}
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
            }
            ))}
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
            {/* Status chips + category picker */}
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
              {/* Inline category reclassify — only for "other" / unknown docs */}
              {(isUnknownType || currentCategoryOverride) && (
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
              )}
            </div>
          </div>

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

          {/* Bottom bar — save action */}
          <div className="px-3 py-2.5 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-2 bg-white dark:bg-gray-800">
            {/* Error message from failed save */}
            {saveError && (
              <p className="text-[10px] text-red-600 dark:text-red-400 leading-tight bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5">
                <AlertCircle className="h-3 w-3 inline-block mr-0.5 -mt-px" />
                {saveError} — your edits are still here, try again.
              </p>
            )}
            <Button 
              variant="success" 
              onClick={handleApprove} 
              className="w-full"
              disabled={saving}
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving &amp; verifying...</>
              ) : (
                <><ShieldCheck className="h-4 w-4 mr-1.5" /> Seal &amp; Save</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
