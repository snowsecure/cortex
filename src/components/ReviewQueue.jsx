import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { CheckCircle, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, FileText, Check, Circle, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { SailboatIcon } from "./ui/sailboat-icon";
import { getMergedExtractionData } from "../lib/utils";
import { PDFPreview } from "./DocumentDetailModal";
import * as api from "../lib/api";

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

/**
 * Build list of documents needing review from packets
 */
function getReviewItems(packets) {
  const items = [];
  for (const packet of packets || []) {
    const docs = packet.documents || [];
    for (const doc of docs) {
      if (doc.needsReview) {
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
  const [editedFields, setEditedFields] = useState({});
  const [base64ByPacketId, setBase64ByPacketId] = useState({});

  const current = reviewItems[currentIndex];

  // Clamp currentIndex when reviewItems changes (e.g., after approval/rejection)
  useEffect(() => {
    if (reviewItems.length > 0 && currentIndex >= reviewItems.length) {
      setCurrentIndex(reviewItems.length - 1);
    }
  }, [reviewItems.length, currentIndex]);

  // Initialize editedFields from existing document corrections when switching items
  useEffect(() => {
    setEditedFields(current?.document?.editedFields || {});
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // Fetch PDF from server or read from file object
  useEffect(() => {
    if (!current?.packet) return;
    const packet = current.packet;
    const id = packet.id;
    
    // Already have base64 cached
    if (packet.base64 || base64ByPacketId[id]) {
      setLoadingPdf(false);
      setPdfError(null);
      return;
    }
    
    // Try to read from File object if available (in-memory file)
    if (packet.file instanceof File) {
      setLoadingPdf(true);
      setPdfError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result;
        if (typeof dataUrl === "string") {
          const b64 = dataUrl.split(",")[1];
          if (b64) {
            setBase64ByPacketId((prev) => ({ ...prev, [id]: b64 }));
          }
        }
        setLoadingPdf(false);
      };
      reader.onerror = () => {
        setPdfError("Failed to read file");
        setLoadingPdf(false);
      };
      reader.readAsDataURL(packet.file);
      return;
    }
    
    // Try to fetch from server (hasServerFile or as fallback attempt)
    setLoadingPdf(true);
    setPdfError(null);
    api.getPacketFileAsBase64(id)
      .then((b64) => {
        setBase64ByPacketId((prev) => ({ ...prev, [id]: b64 }));
        setPdfError(null);
      })
      .catch((err) => {
        console.warn("PDF fetch failed for packet", id, err.message);
        setPdfError("PDF expired or unavailable. Results are still accessible.");
      })
      .finally(() => setLoadingPdf(false));
  }, [current?.packet?.id, current?.packet?.base64, current?.packet?.file, base64ByPacketId]);

  const packetBase64 = current
    ? (current.packet.base64 || base64ByPacketId[current.packet.id])
    : null;

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

  const handleApprove = useCallback(async () => {
    if (!current || saving) return;
    const docId = current.document.id;
    setSaving(true);
    setSaveError(null);
    setSealedResult(null);

    try {
      const result = await onApprove?.(current.document, current.packet, {
        editedFields: { ...editedFields },
        approvedFields: { ...currentApprovedFields },
      });

      // Immediately mark this document as sealed locally — removes it from the queue
      // without waiting for the parent state update to propagate back through props.
      setSealedDocIds(prev => new Set(prev).add(docId));

      // Show "Sealed" confirmation overlay
      setSealedResult(result || { ok: true, editedCount: Object.keys(editedFields).length, documentName: "Document" });
      setSaving(false);

      // Clean up local state for this document
      setEditedFields({});
      setApprovedFields((prev) => {
        const updated = { ...prev };
        delete updated[docId];
        return updated;
      });
      // Clamp index — the item was just removed so the list is now shorter
      setCurrentIndex((i) => Math.min(i, Math.max(0, reviewItems.length - 2)));
    } catch (error) {
      console.error("Failed to seal review:", error);
      setSaveError(error.message || "Failed to save review");
      setSaving(false);
      // Stay on current document so the user can retry
    }
  }, [current, saving, onApprove, editedFields, currentApprovedFields, reviewItems.length]);

  // --- All hooks MUST be above the early return (Rules of Hooks) ---

  const { data, likelihoods } = current
    ? getMergedExtractionData(current.document)
    : { data: {}, likelihoods: {} };

  const REVIEW_THRESHOLD = 0.75;
  const LOW_THRESHOLD = 0.5;

  // Categorize fields by confidence level
  const categorizedFields = useMemo(() => {
    const entries = Object.entries(data || {});
    const critical = []; // Very low confidence or empty required
    const warning = [];  // Low confidence
    const ok = [];       // Good confidence

    entries.forEach(([key, value]) => {
      const likelihood = likelihoods?.[key];
      const isEmpty = value === null || value === undefined || value === "";
      const isVeryLow = typeof likelihood === "number" && likelihood < LOW_THRESHOLD;
      const isLow = typeof likelihood === "number" && likelihood < REVIEW_THRESHOLD;

      if (isVeryLow || isEmpty) {
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

    return { critical, warning, ok };
  }, [data, likelihoods]);

  const [expandedSections, setExpandedSections] = useState({
    critical: true,
    warning: true,
    ok: false, // Collapsed by default
  });

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

  const displayName = current.document?.splitType || current.document?.classification?.category || "Document";

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Render a field input with individual approval
  const renderField = ({ key, value, likelihood, isEmpty }, needsApproval = false) => {
    const isVeryLow = typeof likelihood === "number" && likelihood < LOW_THRESHOLD;
    const isLow = typeof likelihood === "number" && likelihood < REVIEW_THRESHOLD;
    const displayValue = editedFields[key] !== undefined ? editedFields[key] : (value ?? "");
    const confidencePct = typeof likelihood === "number" ? Math.round(likelihood * 100) : null;
    const isApproved = currentApprovedFields[key] === true;
    const wasEdited = editedFields[key] !== undefined;
    const originalValue = value ?? "";
    const valueChanged = wasEdited && editedFields[key] !== originalValue;

    return (
      <div key={key} className={`p-2 rounded-lg border transition-all ${isApproved ? "bg-green-50/50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"}`}>
        <div className="flex items-start gap-2">
          {/* Approval checkbox */}
          {needsApproval && (
            <button
              type="button"
              onClick={() => toggleFieldApproval(key)}
              className={`mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all ${
                isApproved 
                  ? "bg-green-500 text-white" 
                  : "border-2 border-gray-300 hover:border-green-400"
              }`}
              title={isApproved ? "Confirmed - click to undo" : "Click to confirm this field"}
            >
              {isApproved && <Check className="h-3 w-3" />}
            </button>
          )}
          
          {/* Field content */}
          <div className="flex-1 min-w-0 space-y-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center justify-between gap-1">
              <span className="flex items-center gap-1">
                {formatFieldName(key)}
                {isEmpty && <span className="text-red-500 dark:text-red-400 text-[10px]">(empty)</span>}
                {wasEdited && <span className="text-blue-500 dark:text-blue-400 text-[10px]">(edited)</span>}
              </span>
              {confidencePct !== null && (
                <span className={`text-[10px] ${isVeryLow ? "text-red-500 dark:text-red-400" : isLow ? "text-amber-500 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                  {confidencePct}%
                </span>
              )}
            </label>
            {typeof displayValue === "object" && displayValue !== null ? (
              <textarea
                className={`w-full px-2 py-1.5 text-sm border rounded min-h-[60px] transition-colors ${
                  isApproved ? "border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-900/20" :
                  wasEdited ? "border-blue-300 dark:border-blue-600 bg-blue-50/30 dark:bg-blue-900/20" :
                  isVeryLow || isEmpty ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20" : 
                  isLow ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20" : 
                  "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                } text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                value={JSON.stringify(displayValue, null, 2)}
                onChange={(e) => {
                  try {
                    setEditedFields((prev) => ({ ...prev, [key]: JSON.parse(e.target.value) }));
                  } catch {
                    setEditedFields((prev) => ({ ...prev, [key]: e.target.value }));
                  }
                }}
              />
            ) : (
              <input
                type="text"
                className={`w-full px-2 py-1.5 text-sm border rounded transition-colors ${
                  isApproved ? "border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-900/20" :
                  wasEdited ? "border-blue-300 dark:border-blue-600 bg-blue-50/30 dark:bg-blue-900/20" :
                  isVeryLow || isEmpty ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20" : 
                  isLow ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20" : 
                  "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                } text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                value={displayValue}
                placeholder={isEmpty ? "Enter value..." : ""}
                onChange={(e) => setEditedFields((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            )}
            {/* Show original value if edited */}
            {valueChanged && (
              <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <span className="line-through">{typeof originalValue === "object" ? JSON.stringify(originalValue) : String(originalValue || "(empty)")}</span>
                <span className="text-blue-500 dark:text-blue-400">→ corrected</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Count approved fields across ALL sections (every field can be confirmed)
  const allFields = [...categorizedFields.critical, ...categorizedFields.warning, ...categorizedFields.ok];
  const approvedCount = allFields.filter(f => currentApprovedFields[f.key]).length;
  const allFieldsApproved = allFields.length === 0 || approvedCount === allFields.length;

  // Render collapsible section
  const renderSection = (title, icon, fields, sectionKey, variant, needsApproval = false) => {
    if (fields.length === 0) return null;
    const isExpanded = expandedSections[sectionKey];
    const colors = {
      critical: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300", icon: "text-red-500 dark:text-red-400" },
      warning: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", icon: "text-amber-500 dark:text-amber-400" },
      ok: { bg: "bg-gray-50 dark:bg-gray-800", border: "border-gray-200 dark:border-gray-700", text: "text-gray-700 dark:text-gray-300", icon: "text-gray-400 dark:text-gray-500" },
    }[variant];

    const sectionApprovedCount = needsApproval ? fields.filter(f => currentApprovedFields[f.key]).length : 0;
    const allSectionApproved = sectionApprovedCount === fields.length;

    return (
      <div className={`rounded-lg border ${colors.border} overflow-hidden`}>
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className={`w-full flex items-center justify-between px-3 py-2 ${colors.bg} hover:opacity-90`}
        >
          <div className="flex items-center gap-2">
            <span className={colors.icon}>{icon}</span>
            <span className={`text-xs font-medium ${colors.text}`}>{title}</span>
            {needsApproval ? (
              <span className={`text-[10px] ${allSectionApproved ? "text-green-600" : colors.text} opacity-70`}>
                ({sectionApprovedCount}/{fields.length} confirmed)
              </span>
            ) : (
              <span className={`text-[10px] ${colors.text} opacity-70`}>({fields.length})</span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className={`h-3.5 w-3.5 ${colors.icon}`} />
          ) : (
            <ChevronDown className={`h-3.5 w-3.5 ${colors.icon}`} />
          )}
        </button>
        {isExpanded && (
          <div className="p-2 space-y-2 bg-white dark:bg-gray-800">
            {needsApproval && (
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Verify each field against PDF
                </p>
                {!allSectionApproved && (
                  <button
                    type="button"
                    onClick={() => approveAllFields(fields.map(f => f.key))}
                    className="text-[10px] text-green-600 hover:text-green-700 font-medium"
                  >
                    Confirm all
                  </button>
                )}
              </div>
            )}
            {fields.map((field) => renderField(field, needsApproval))}
          </div>
        )}
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
            {reviewItems.map((item, i) => (
              <button
                key={item.document.id}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`w-full text-left px-2 py-1 rounded text-[11px] truncate ${i === currentIndex ? "bg-[#9e2339]/10 dark:bg-[#9e2339]/20 text-[#9e2339] dark:text-[#d45a6a] font-medium" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              >
                #{i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* PDF Preview - column 2, fixed by grid, completely independent */}
        <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 overflow-hidden">
          {pdfError && !packetBase64 ? (
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
              pages={current.document.pages}
              filename={current.packet.filename || current.packet.name}
              loading={loadingPdf}
            />
          )}
        </div>

        {/* Extracted data panel - column 3, fixed width by grid */}
        <div className="flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Extracted Data</h3>
              {current.document.pages && current.document.pages.length > 0 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  Page{current.document.pages.length > 1 ? "s" : ""} {current.document.pages.join(", ")}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {allFieldsApproved 
                ? "All fields confirmed — ready to save"
                : `${approvedCount}/${allFields.length} fields confirmed`}
            </p>
          </div>

          {/* Scrollable content area - this is the ONLY part that scrolls */}
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
            {renderSection(
              "Needs Attention",
              <AlertCircle className="h-3.5 w-3.5" />,
              categorizedFields.critical,
              "critical",
              "critical",
              true // needsApproval
            )}
            {renderSection(
              "Low Confidence",
              <AlertTriangle className="h-3.5 w-3.5" />,
              categorizedFields.warning,
              "warning",
              "warning",
              true // needsApproval
            )}
            {renderSection(
              "Verified Fields",
              <CheckCircle className="h-3.5 w-3.5" />,
              categorizedFields.ok,
              "ok",
              "ok",
              true // every field can be individually confirmed
            )}
          </div>

          {/* Status and Save button - pinned to bottom */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-2 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                Fields confirmed: {approvedCount}/{allFields.length}
              </span>
              {allFieldsApproved ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> All confirmed
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => approveAllFields(allFields.map(f => f.key))}
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Confirm all remaining
                </button>
              )}
            </div>

            {/* Error message from failed save */}
            {saveError && (
              <p className="text-[10px] text-red-600 dark:text-red-400 leading-tight bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5">
                <AlertCircle className="h-3 w-3 inline-block mr-0.5 -mt-px" />
                {saveError} — your edits are still here, try again.
              </p>
            )}

            <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
              <AlertTriangle className="h-3 w-3 inline-block mr-0.5 -mt-px" />
              Saving will lock these fields as the final extracted data for this document. This action cannot be undone.
            </p>
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
