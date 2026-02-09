import React, { useState, useMemo, useEffect } from "react";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Eye,
  RotateCcw,
  Trash2,
  Filter,
  User,
  ShieldCheck,
  PenLine,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn, getMergedExtractionData, getDocumentQualityTier, NOT_IN_DOCUMENT_VALUE, NOT_IN_DOCUMENT_LABEL } from "../lib/utils";
import { PacketStatus } from "../hooks/useBatchQueue";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { getSplitTypeDisplayName } from "../hooks/usePacketPipeline";
import { schemas } from "../schemas/index";
import { RETAB_MODELS } from "../lib/retabConfig";

/**
 * Format a timestamp into a short relative string (e.g., "2m ago", "3h ago", "Feb 7")
 */
function timeAgo(timestamp) {
  if (!timestamp) return null;
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Get status badge variant
 */
function getStatusVariant(status) {
  switch (status) {
    case PacketStatus.COMPLETED:
    case "completed":
    case "reviewed":
      return "success";
    case PacketStatus.NEEDS_REVIEW:
    case "needs_review":
      return "warning";
    case PacketStatus.FAILED:
    case "failed":
      return "destructive";
    case PacketStatus.SPLITTING:
    case PacketStatus.CLASSIFYING:
    case PacketStatus.EXTRACTING:
    case "processing":
    case "retrying":
      return "processing";
    case "pending":
      return "secondary";
    default:
      return "secondary";
  }
}

/**
 * Get status display text
 */
function getStatusText(status) {
  switch (status) {
    case PacketStatus.QUEUED:
      return "Up next";
    case PacketStatus.SPLITTING:
      return "Splitting...";
    case PacketStatus.CLASSIFYING:
      return "Classifying...";
    case PacketStatus.EXTRACTING:
      return "Extracting...";
    case PacketStatus.COMPLETED:
    case "completed":
      return "Completed";
    case "reviewed":
      return "Sealed";
    case PacketStatus.NEEDS_REVIEW:
    case "needs_review":
      return "Needs Review";
    case PacketStatus.FAILED:
    case "failed":
      return "Failed";
    case PacketStatus.RETRYING:
    case "retrying":
      return "Retrying...";
    case "pending":
      return "Pending";
    case "processing":
      return "Extracting...";
    default:
      return status;
  }
}

/**
 * Get status icon
 */
function StatusIcon({ status, className }) {
  const isProcessing = [
    PacketStatus.SPLITTING,
    PacketStatus.CLASSIFYING,
    PacketStatus.EXTRACTING,
    PacketStatus.RETRYING,
    "retrying",
    "processing",
  ].includes(status);

  if (isProcessing) {
    return <Loader2 className={cn("animate-spin", className)} />;
  }

  switch (status) {
    case PacketStatus.COMPLETED:
    case "completed":
      return <CheckCircle className={cn("text-green-500", className)} />;
    case PacketStatus.NEEDS_REVIEW:
    case "needs_review":
      return <AlertTriangle className={cn("text-amber-500", className)} />;
    case PacketStatus.FAILED:
    case "failed":
      return <XCircle className={cn("text-red-500", className)} />;
    case PacketStatus.QUEUED:
    case "pending":
      return <Clock className={cn("text-gray-400", className)} />;
    default:
      return <FileText className={cn("text-gray-400", className)} />;
  }
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes == null || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Confidence tier label and styling for document row indicator
 */
function getConfidenceTier(confidence) {
  const c = confidence ?? 0;
  if (c >= 0.75) return { label: "High", variant: "success", Icon: CheckCircle };
  if (c >= 0.5) return { label: "Medium", variant: "warning", Icon: AlertTriangle };
  return { label: "Low", variant: "destructive", Icon: XCircle };
}

/**
 * Format a field name for display
 */
function formatFieldName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format a value for display
 */
function formatValue(value) {
  if (value === NOT_IN_DOCUMENT_VALUE) return NOT_IN_DOCUMENT_LABEL;
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    // Format as currency if it looks like money
    if (value >= 100) return `$${value.toLocaleString()}`;
    return value.toLocaleString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Get priority fields for a document type (shown first)
 */
function getPriorityFields(category) {
  const priorities = {
    recorded_transfer_deed: ['grantor_name', 'grantee_name', 'recording_date', 'consideration', 'property_address'],
    deed_of_trust_mortgage: ['borrower_name', 'lender_name', 'loan_amount', 'recording_date', 'maturity_date'],
    mortgage_child_docs: ['document_type', 'borrower_name', 'lender_name', 'recording_date'],
    tax_lien: ['tax_type', 'debtor_name', 'total_amount_owed', 'recording_date', 'tax_year'],
    mechanics_lien: ['claimant_name', 'property_owner_name', 'claim_amount', 'recording_date'],
    hoa_lien: ['hoa_name', 'property_owner_name', 'amount_owed', 'recording_date'],
    judgments: ['judgment_creditor', 'judgment_debtor', 'judgment_amount', 'recording_date'],
    easement: ['easement_type', 'grantor_name', 'grantee_name', 'recording_date'],
    settlement_statement: ['closing_date', 'buyer_name', 'seller_name', 'purchase_price', 'loan_amount'],
    cover_sheet: ['order_number', 'buyer_name', 'seller_name', 'property_address', 'transaction_type'],
    transaction_summary: ['order_number', 'buyer_name', 'seller_name', 'property_address', 'closing_date'],
    other_recorded: ['document_title', 'document_type', 'document_summary', 'party_1_name', 'party_2_name'],
  };
  return priorities[category] || ['recording_date', 'property_address'];
}

/**
 * Document row within a packet - expandable to show extracted data
 */
function DocumentRow({ document, packet, onViewDocument, onRetryDocument, expanded, onToggle }) {
  // Extract data from Retab API response (with corrections merged in)
  const { data, likelihoods, editedFields, originalData } = getMergedExtractionData(document, schemas);
  
  // Get display name - prefer category override (reviewer reclassification), then split type, then category
  const catOverride = document.categoryOverride || null;
  const splitType = document.splitType || document.classification?.splitType;
  const displayName = catOverride?.name
    ? catOverride.name
    : splitType 
      ? getSplitTypeDisplayName(splitType)
      : getCategoryDisplayName(document.classification?.category || "unknown");
  
  // Get key fields based on document type
  const getKeyInfo = () => {
    const category = document.classification?.category;
    switch (category) {
      case "recorded_transfer_deed":
        return data.grantor_name && data.grantee_name 
          ? `${data.grantor_name} → ${data.grantee_name}`
          : null;
      case "deed_of_trust_mortgage":
        return data.loan_amount 
          ? `$${Number(data.loan_amount).toLocaleString()}`
          : null;
      case "tax_lien":
        return data.total_amount_owed 
          ? `$${Number(data.total_amount_owed).toLocaleString()}`
          : null;
      default:
        return data.recording_date || null;
    }
  };

  const keyInfo = getKeyInfo();
  
  // Use extraction confidence when set; null means API didn't return likelihoods (show as unknown)
  const extractionKnown = document.extractionConfidence != null && typeof document.extractionConfidence === "number";
  const confidence = extractionKnown ? document.extractionConfidence : (document.classification?.confidence ?? 0);
  
  // Format pages display
  const formatPages = () => {
    const pages = document.pages;
    if (!pages) return null;
    if (Array.isArray(pages) && pages.length === 0) return null;
    if (Array.isArray(pages)) return pages.join(", ");
    return String(pages);
  };
  const pagesDisplay = formatPages();

  // Get all extracted fields with their likelihoods
  const extractedFields = useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    
    const category = document.classification?.category;
    const priorityFields = getPriorityFields(category);
    
    const fields = Object.entries(data)
      .filter(([key, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => ({
        key,
        value,
        likelihood: likelihoods[key],
        priority: priorityFields.indexOf(key),
      }));
    
    // Sort: priority fields first (in order), then by likelihood (lowest first to highlight issues)
    return fields.sort((a, b) => {
      // Priority fields come first
      if (a.priority >= 0 && b.priority < 0) return -1;
      if (a.priority < 0 && b.priority >= 0) return 1;
      if (a.priority >= 0 && b.priority >= 0) return a.priority - b.priority;
      // Then sort by likelihood (low confidence first)
      const aLike = a.likelihood ?? 1;
      const bLike = b.likelihood ?? 1;
      return aLike - bLike;
    });
  }, [data, likelihoods, document.classification?.category]);

  // Count fields
  const fieldCount = extractedFields.length;
  const lowConfCount = extractedFields.filter(f => f.likelihood !== undefined && f.likelihood < 0.7).length;
  const correctedCount = editedFields ? Object.keys(editedFields).length : 0;

  return (
    <div>
      {/* Document header row */}
      <div 
        className={cn(
          "flex items-center justify-between py-2 px-4 hover:bg-gray-100 dark:hover:bg-neutral-700 cursor-pointer",
          expanded && "bg-gray-100 dark:bg-neutral-700"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400 dark:text-neutral-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400 dark:text-neutral-500" />
            )}
          </button>
          <StatusIcon status={document.status} className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap w-fit max-w-full">
              <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                {displayName}
              </span>
              {catOverride && (
                <span
                  className="text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                  title="The document category was manually assigned during review. “(Custom)” indicates a free-text type, not a preset schema."
                >
                  Category manually assigned{catOverride.isCustom ? " (Custom)" : ""}
                </span>
              )}
              {pagesDisplay && (
                <span className="text-xs text-gray-500 dark:text-neutral-400 shrink-0">
                  (pages {pagesDisplay})
                </span>
              )}
              {fieldCount > 0 && (
                <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0">
                  • {fieldCount} fields
                </span>
              )}
            </div>
            {keyInfo && (
              <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">{keyInfo}</p>
            )}
            {document.needsReview && document.reviewReasons?.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                {document.reviewReasons[0]}
              </p>
            )}
            {document.status === "reviewed" && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <span>
                  Sealed{(document.reviewedBy || document.reviewed_by) ? <> by <span className="font-normal">{document.reviewedBy || document.reviewed_by}</span></> : ""}
                  {(document.reviewedAt || document.reviewed_at) && (
                    <span className="text-green-500/70 dark:text-green-400/60"> · {timeAgo(document.reviewedAt || document.reviewed_at)}</span>
                  )}
                </span>
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {correctedCount > 0 && (
            <Badge variant="default" className="text-xs font-normal bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
              <PenLine className="h-3 w-3" />
              {correctedCount} Fields Edited by {document.reviewedBy || document.reviewed_by || "reviewer"}
            </Badge>
          )}
          {lowConfCount > 0 && (
            <Badge variant="warning" className="text-xs">
              {lowConfCount} low conf
            </Badge>
          )}
          {(() => {
            const quality = getDocumentQualityTier(document);
            // Only show badge when it communicates something actionable
            if (quality.tier === "unscored") return null;
            const pct = extractionKnown ? Math.round((confidence ?? 0) * 100) : null;
            const tierStyles = {
              verified: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400",
              high: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400",
              needs_attention: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400",
            };
            const tierIcons = {
              verified: CheckCircle,
              high: CheckCircle,
              needs_attention: AlertTriangle,
            };
            const TierIcon = tierIcons[quality.tier];
            return (
              <span
                className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", tierStyles[quality.tier])}
                title={quality.tier === "verified"
                  ? "Human-reviewed — highest data trust"
                  : pct != null
                    ? `${pct}% extraction confidence`
                    : quality.label}
              >
                <TierIcon className="h-3 w-3 shrink-0" />
                {quality.label}
              </span>
            );
          })()}
          {document.status === "failed" && onRetryDocument && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              onClick={(e) => {
                e.stopPropagation();
                onRetryDocument(packet.id, document.id);
              }}
              title="Retry this document"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          {document.status === "retrying" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onViewDocument(document, packet);
            }}
            title="View full details"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded data view */}
      {expanded && (
        <div className="bg-white dark:bg-neutral-800 border-t border-gray-100 dark:border-neutral-700 px-4 py-3 ml-7">
          {/* Show error if document failed */}
          {document.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Extraction Error</p>
                {onRetryDocument && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetryDocument(packet.id, document.id);
                    }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{document.error}</p>
            </div>
          )}
          
          {extractedFields.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {extractedFields.slice(0, 12).map(({ key, value, likelihood }) => {
                const isCorrected = editedFields && key in editedFields;
                const originalValue = isCorrected ? originalData?.[key] : null;
                const valueChanged = isCorrected && JSON.stringify(originalValue) !== JSON.stringify(value);
                return (
                <div key={key} className={cn(
                  "flex flex-col rounded-md px-2 py-1 -mx-1",
                  isCorrected && "bg-blue-50/70 dark:bg-blue-900/15 border border-blue-200/60 dark:border-blue-800/40"
                )}>
                  <span className="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-1">
                    {formatFieldName(key)}
                    {isCorrected && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-0.5">
                        <PenLine className="h-2.5 w-2.5" /> Edited
                      </span>
                    )}
                    {!isCorrected && likelihood !== undefined && (
                      <span className={cn(
                        "text-[10px]",
                        likelihood >= 0.7 ? "text-green-600 dark:text-green-400" : 
                        likelihood >= 0.5 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                      )}>
                        ({Math.round(likelihood * 100)}%)
                      </span>
                    )}
                  </span>
                  <span className={cn(
                    "text-sm truncate",
                    isCorrected ? "text-blue-700 dark:text-blue-300 font-medium" :
                    likelihood !== undefined && likelihood < 0.5 ? "text-red-700 dark:text-red-400 font-medium" : "text-gray-900 dark:text-neutral-100"
                  )} title={String(value)}>
                    {formatValue(value)}
                  </span>
                  {/* Show original AI value when human changed it */}
                  {valueChanged && originalValue != null && originalValue !== "" && (
                    <span className="text-[10px] text-gray-400 dark:text-neutral-500 truncate mt-0.5" title={`AI extracted: ${String(originalValue)}`}>
                      <span className="line-through">{formatValue(originalValue)}</span>
                      <span className="text-blue-500 dark:text-blue-400 ml-1">→ reviewer</span>
                    </span>
                  )}
                </div>
                );
              })}
            </div>
          ) : !document.error ? (
            <p className="text-sm text-gray-500 dark:text-neutral-400 italic">No extracted data available</p>
          ) : null}
          
          {extractedFields.length > 12 && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-700">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDocument(document, packet);
                }}
              >
                View all {extractedFields.length} fields →
              </Button>
            </div>
          )}

          {/* Show all review reasons */}
          {document.reviewReasons?.length > 1 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-amber-700 mb-1">Review Reasons:</p>
              <ul className="text-xs text-amber-600 space-y-0.5">
                {document.reviewReasons.map((reason, i) => (
                  <li key={i}>• {reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Per-packet run info strip with live elapsed timer.
 * Always visible once the packet has started processing.
 */
function PacketRunInfo({ packet, isProcessing }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isProcessing) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isProcessing]);

  const u = packet.usage;
  const modelInfo = u?.model ? RETAB_MODELS[u.model] : null;
  const modelLabel = modelInfo?.name || u?.model;
  const consensus = u?.nConsensus ?? 1;
  const smartRouting = u?.costOptimize ?? false;
  const pages = u?.totalPages ?? 0;
  const cost = u?.totalCost ?? 0;
  const credits = u?.totalCredits ?? 0;

  // Elapsed: live during processing, frozen after completion
  let elapsedLabel = null;
  if (packet.startedAt) {
    const start = new Date(packet.startedAt).getTime();
    const end = packet.completedAt
      ? new Date(packet.completedAt).getTime()
      : now;
    const totalSec = Math.max(0, Math.floor((end - start) / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    elapsedLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  const dot = <span className="text-gray-300 dark:text-neutral-600">&middot;</span>;

  return (
    <div className="px-4 py-1.5 flex items-center gap-1.5 flex-wrap text-[11px] text-gray-400 dark:text-neutral-500">
      {modelLabel && (
        <span className="font-medium text-gray-500 dark:text-neutral-400">{modelLabel}</span>
      )}
      {consensus > 1 && <>{dot}<span>{consensus}x consensus</span></>}
      {smartRouting && <>{dot}<span>smart routing</span></>}
      {pages > 0 && <>{dot}<span>{pages} pg{pages !== 1 ? "s" : ""}</span></>}
      {cost > 0 && <>{dot}<span>${cost.toFixed(3)}</span></>}
      {credits > 0 && <>{dot}<span className="tabular-nums">{credits.toFixed(1)} cr</span></>}
      {elapsedLabel && (
        <>
          {(modelLabel || pages > 0 || cost > 0) && dot}
          <span className="tabular-nums">{elapsedLabel}</span>
        </>
      )}
    </div>
  );
}

/**
 * Single packet row with expandable documents
 */
function PacketRow({ packet, onViewDocument, onRetryDocument, onRetry, onRemove, expanded, onToggle }) {
  const [expandedDocs, setExpandedDocs] = useState(new Set());
  
  const isProcessing = [
    PacketStatus.SPLITTING,
    PacketStatus.CLASSIFYING,
    PacketStatus.EXTRACTING,
    PacketStatus.RETRYING,
  ].includes(packet.status);

  const docStats = useMemo(() => {
    const docs = packet.documents || [];
    return {
      total: docs.length,
      completed: docs.filter(d => d.status === "completed").length,
      needsReview: docs.filter(d => d.needsReview).length,
      failed: docs.filter(d => d.status === "failed").length,
    };
  }, [packet.documents]);

  const toggleDoc = (docId) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const expandAllDocs = () => {
    setExpandedDocs(new Set(packet.documents?.map(d => d.id) || []));
  };

  const collapseAllDocs = () => {
    setExpandedDocs(new Set());
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* Packet header */}
      <div 
        className={cn(
          "flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700",
          expanded && "border-b border-gray-200 dark:border-gray-700"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            )}
          </button>
          
          <StatusIcon status={packet.status} className="h-5 w-5 shrink-0" />
          
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {packet.filename || "Unknown file"}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {packet.createdBy && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {packet.createdBy}
                </span>
              )}
              {packet.createdBy && formatFileSize(packet.size) && <span>•</span>}
              {formatFileSize(packet.size) && <span>{formatFileSize(packet.size)}</span>}
              {(() => {
                // During extraction, show the total from progress (split count), not partial documents array
                const displayTotal = isProcessing && packet.progress?.totalDocs > 0
                  ? packet.progress.totalDocs
                  : docStats.total;
                return displayTotal > 0 ? (
                  <>
                    <span>•</span>
                    <span>{displayTotal} document{displayTotal !== 1 ? "s" : ""}</span>
                  </>
                ) : null;
              })()}
              {isProcessing && (() => {
                const prog = packet.progress;
                if (packet.status === PacketStatus.SPLITTING) {
                  return <><span>•</span><span className="text-blue-600 dark:text-blue-400">Splitting PDF…</span></>;
                }
                if (packet.status === PacketStatus.CLASSIFYING) {
                  return <><span>•</span><span className="text-blue-600 dark:text-blue-400">Classifying…</span></>;
                }
                if (packet.status === PacketStatus.EXTRACTING && prog?.totalDocs > 0) {
                  const current = Math.min((prog.docIndex ?? 0) + 1, prog.totalDocs);
                  return (
                    <><span>•</span><span className="text-blue-600 dark:text-blue-400">{current}/{prog.totalDocs} docs</span></>
                  );
                }
                return <><span>•</span><span className="text-blue-600 dark:text-blue-400">{getStatusText(packet.status)}</span></>;
              })()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {/* Document stats badges */}
          {docStats.total > 0 && !isProcessing && (
            <div className="flex items-center gap-1 mr-2">
              {docStats.completed > 0 && (
                <Badge variant="success" className="text-xs">
                  {docStats.completed} ✓
                </Badge>
              )}
              {docStats.needsReview > 0 && (
                <Badge variant="warning" className="text-xs">
                  {docStats.needsReview} ⚠
                </Badge>
              )}
              {docStats.failed > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {docStats.failed} ✗
                </Badge>
              )}
            </div>
          )}
          
          {/* Status badge */}
          <Badge variant={getStatusVariant(packet.status)}>
            {packet.status === PacketStatus.EXTRACTING && packet.progress?.totalDocs > 0
              ? `Extracting ${Math.min((packet.progress.docIndex ?? 0) + 1, packet.progress.totalDocs)}/${packet.progress.totalDocs}`
              : getStatusText(packet.status)}
          </Badge>
          
          {/* Actions */}
          {packet.status === PacketStatus.FAILED && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onRetry?.(packet.id)}
              title="Retry"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          
          {!isProcessing && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-500"
              onClick={() => onRemove(packet.id)}
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Per-packet progress bar during extraction */}
      {isProcessing && packet.status === PacketStatus.EXTRACTING && packet.progress?.totalDocs > 0 && (
        <div className="px-4 pt-3 pb-3">
          <div className="h-2.5 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
              style={{
                width: `${Math.max(2, Math.round(((packet.progress.docIndex ?? 0) / packet.progress.totalDocs) * 100))}%`,
                transition: "width 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      )}

      {/* Per-packet run info — always visible once processing has started */}
      {packet.startedAt && (
        <PacketRunInfo packet={packet} isProcessing={isProcessing} />
      )}

      {/* Expanded documents */}
      {expanded && packet.documents?.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {packet.documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                packet={packet}
                onViewDocument={onViewDocument}
                onRetryDocument={onRetryDocument}
                expanded={expandedDocs.has(doc.id)}
                onToggle={() => toggleDoc(doc.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {expanded && packet.error && (
        <div className="p-4 bg-red-50 text-sm text-red-700">
          <strong>Error:</strong> {packet.error}
        </div>
      )}

      {/* Empty state for expanded packet with no docs */}
      {expanded && !packet.documents?.length && !isProcessing && !packet.error && (
        <div className="p-4 bg-gray-50/80 dark:bg-gray-900/50 rounded-lg text-sm text-gray-500 dark:text-gray-400 text-center">
          Documents will appear here once processing finishes.
        </div>
      )}
    </div>
  );
}

/**
 * Filter options
 */
const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "needs_review", label: "Needs Review" },
  { value: "failed", label: "Failed" },
];

/**
 * Main packet results view component
 */
export function PacketResultsView({
  packets,
  stats,
  onViewDocument,
  onRetryPacket,
  onRetryDocument,
  onRemovePacket,
  onRetryAllFailed,
}) {
  const [expandedPackets, setExpandedPackets] = useState(new Set());
  const [filter, setFilter] = useState("all");

  /**
   * Toggle packet expansion
   */
  const togglePacket = (packetId) => {
    setExpandedPackets(prev => {
      const next = new Set(prev);
      if (next.has(packetId)) {
        next.delete(packetId);
      } else {
        next.add(packetId);
      }
      return next;
    });
  };

  /**
   * Expand/collapse all
   */
  const expandAll = () => {
    setExpandedPackets(new Set(packets.map(p => p.id)));
  };

  const collapseAll = () => {
    setExpandedPackets(new Set());
  };

  /**
   * Filter packets
   */
  const filteredPackets = useMemo(() => {
    if (filter === "all") return packets;
    
    return packets.filter(p => {
      switch (filter) {
        case "processing":
          return [
            PacketStatus.SPLITTING,
            PacketStatus.CLASSIFYING,
            PacketStatus.EXTRACTING,
            PacketStatus.RETRYING,
            PacketStatus.QUEUED,
          ].includes(p.status);
        case "completed":
          return p.status === PacketStatus.COMPLETED;
        case "needs_review":
          return p.status === PacketStatus.NEEDS_REVIEW;
        case "failed":
          return p.status === PacketStatus.FAILED;
        default:
          return true;
      }
    });
  }, [packets, filter]);

  if (packets.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-neutral-900 pt-16 pb-16">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 dark:bg-neutral-700 mb-4">
            <FileText className="h-7 w-7 text-gray-400 dark:text-neutral-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-neutral-100 mb-2">No items to display</h2>
          <p className="text-gray-500 dark:text-neutral-400 mb-6">
            Upload documents from the Upload tab and run processing to see results here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Minimal filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {FILTER_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                filter === option.value
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        
        {stats.failed > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetryAllFailed}
            className="text-xs text-red-600 hover:text-red-700"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry failed
          </Button>
        )}
      </div>

      {/* Packet list */}
      <div className="space-y-2">
        {filteredPackets.map((packet) => (
          <PacketRow
            key={packet.id}
            packet={packet}
            expanded={expandedPackets.has(packet.id)}
            onToggle={() => togglePacket(packet.id)}
            onViewDocument={onViewDocument}
            onRetryDocument={onRetryDocument}
            onRetry={onRetryPacket}
            onRemove={onRemovePacket}
          />
        ))}
      </div>

      {filteredPackets.length === 0 && packets.length > 0 && (
        <div className="text-center py-8 px-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm">No packets match this filter.</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Try a different filter.</p>
        </div>
      )}
    </div>
  );
}

export default PacketResultsView;
