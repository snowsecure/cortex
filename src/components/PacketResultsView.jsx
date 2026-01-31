import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn, getExtractionData } from "../lib/utils";
import { PacketStatus } from "../hooks/useBatchQueue";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { getSplitTypeDisplayName } from "../hooks/usePacketPipeline";

/**
 * Get status badge variant
 */
function getStatusVariant(status) {
  switch (status) {
    case PacketStatus.COMPLETED:
    case "completed":
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
      return "default";
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
      return "Queued";
    case PacketStatus.SPLITTING:
      return "Splitting...";
    case PacketStatus.CLASSIFYING:
      return "Classifying...";
    case PacketStatus.EXTRACTING:
      return "Extracting...";
    case PacketStatus.COMPLETED:
    case "completed":
      return "Completed";
    case PacketStatus.NEEDS_REVIEW:
    case "needs_review":
      return "Needs Review";
    case PacketStatus.FAILED:
    case "failed":
      return "Failed";
    case PacketStatus.RETRYING:
      return "Retrying...";
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
      return <Clock className={cn("text-gray-400", className)} />;
    default:
      return <FileText className={cn("text-gray-400", className)} />;
  }
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format confidence as percentage
 */
function formatConfidence(confidence) {
  return `${Math.round((confidence || 0) * 100)}%`;
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
function DocumentRow({ document, packet, onViewDocument, expanded, onToggle }) {
  // Extract data from Retab API response
  const { data, likelihoods } = getExtractionData(document.extraction);
  
  // Get display name - prefer split type, fallback to category
  const splitType = document.splitType || document.classification?.splitType;
  const displayName = splitType 
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
  
  // Use extraction confidence if available, otherwise classification confidence
  const confidence = document.extractionConfidence || document.classification?.confidence || 0;
  
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

  return (
    <div className="border-l-2 border-gray-200 ml-4">
      {/* Document header row */}
      <div 
        className={cn(
          "flex items-center justify-between py-2 px-4 hover:bg-gray-100 cursor-pointer",
          expanded && "bg-gray-100"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          <StatusIcon status={document.status} className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {displayName}
              </span>
              {pagesDisplay && (
                <span className="text-xs text-gray-500">
                  (pages {pagesDisplay})
                </span>
              )}
              {fieldCount > 0 && (
                <span className="text-xs text-gray-400">
                  • {fieldCount} fields
                </span>
              )}
            </div>
            {keyInfo && (
              <p className="text-xs text-gray-500 truncate">{keyInfo}</p>
            )}
            {document.needsReview && document.reviewReasons?.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                {document.reviewReasons[0]}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {lowConfCount > 0 && (
            <Badge variant="warning" className="text-xs">
              {lowConfCount} low conf
            </Badge>
          )}
          <Badge 
            variant={confidence >= 0.75 ? "success" : confidence >= 0.5 ? "warning" : "destructive"}
            className="text-xs"
          >
            {formatConfidence(confidence)}
          </Badge>
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
        <div className="bg-white border-t border-gray-100 px-4 py-3 ml-7">
          {/* Show error if document failed */}
          {document.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-3">
              <p className="text-sm font-medium text-red-800">Extraction Error</p>
              <p className="text-xs text-red-600 mt-1">{document.error}</p>
            </div>
          )}
          
          {extractedFields.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {extractedFields.slice(0, 12).map(({ key, value, likelihood }) => (
                <div key={key} className="flex flex-col">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    {formatFieldName(key)}
                    {likelihood !== undefined && (
                      <span className={cn(
                        "text-[10px]",
                        likelihood >= 0.7 ? "text-green-600" : 
                        likelihood >= 0.5 ? "text-amber-600" : "text-red-600"
                      )}>
                        ({Math.round(likelihood * 100)}%)
                      </span>
                    )}
                  </span>
                  <span className={cn(
                    "text-sm truncate",
                    likelihood !== undefined && likelihood < 0.5 ? "text-red-700 font-medium" : "text-gray-900"
                  )} title={String(value)}>
                    {formatValue(value)}
                  </span>
                </div>
              ))}
            </div>
          ) : !document.error ? (
            <p className="text-sm text-gray-500 italic">No extracted data available</p>
          ) : null}
          
          {extractedFields.length > 12 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
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
 * Single packet row with expandable documents
 */
function PacketRow({ packet, onViewDocument, onRetry, onRemove, expanded, onToggle }) {
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
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Packet header */}
      <div 
        className={cn(
          "flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50",
          expanded && "border-b border-gray-200"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400" />
            )}
          </button>
          
          <StatusIcon status={packet.status} className="h-5 w-5 shrink-0" />
          
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate">
              {packet.filename}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{formatFileSize(packet.size)}</span>
              {docStats.total > 0 && (
                <>
                  <span>•</span>
                  <span>{docStats.total} document{docStats.total !== 1 ? "s" : ""}</span>
                </>
              )}
              {isProcessing && (() => {
                const prog = packet.progress;
                if (packet.status === PacketStatus.SPLITTING) {
                  return <><span>•</span><span className="text-blue-600">Splitting PDF…</span></>;
                }
                if (packet.status === PacketStatus.CLASSIFYING) {
                  return <><span>•</span><span className="text-blue-600">Classifying…</span></>;
                }
                if (packet.status === PacketStatus.EXTRACTING && prog?.totalDocs > 0) {
                  const current = Math.min((prog.docIndex ?? 0) + 1, prog.totalDocs);
                  return (
                    <><span>•</span><span className="text-blue-600">Extracting document {current} of {prog.totalDocs}</span></>
                  );
                }
                return <><span>•</span><span className="text-blue-600">{getStatusText(packet.status)}</span></>;
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
              onClick={() => onRetry(packet.id)}
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

      {/* Expanded documents */}
      {expanded && packet.documents?.length > 0 && (
        <div className="bg-gray-50">
          {/* Document controls */}
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-gray-100">
            </div>
          {/* Document list */}
          <div className="divide-y divide-gray-100">
            {packet.documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                packet={packet}
                onViewDocument={onViewDocument}
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
        <div className="p-4 bg-gray-50/80 rounded-lg text-sm text-gray-500 text-center">
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
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mb-4">
          <FileText className="h-7 w-7 text-gray-400" />
        </div>
        <p className="text-gray-600 font-medium">No items to display</p>
        <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
          Upload documents from the Upload tab and run processing to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Minimal filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {FILTER_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                filter === option.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
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
            onRetry={onRetryPacket}
            onRemove={onRemovePacket}
          />
        ))}
      </div>

      {filteredPackets.length === 0 && packets.length > 0 && (
        <div className="text-center py-8 px-4">
          <p className="text-gray-500 text-sm">No packets match this filter.</p>
          <p className="text-gray-400 text-xs mt-1">Try a different filter.</p>
        </div>
      )}
    </div>
  );
}

export default PacketResultsView;
