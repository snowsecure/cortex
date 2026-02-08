import React, { useState } from "react";
import {
  History,
  ChevronDown,
  ChevronRight,
  Trash2,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Download,
  Copy,
  Check,
  Calendar,
  Layers,
  FileJson,
  User,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn, formatDateTimeCST, formatRelativeTimeCST } from "../lib/utils";
import { getCategoryDisplayName } from "../lib/documentCategories";

/**
 * Format timestamp for display (CST)
 */
function formatTimestamp(isoString) {
  return formatDateTimeCST(isoString);
}

/**
 * Format relative time (CST)
 */
function formatRelativeTime(isoString) {
  return formatRelativeTimeCST(isoString);
}

/**
 * Format a field name for display
 */
function formatFieldName(key) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get key info from extracted data for display
 */
function getKeyInfo(docType, data) {
  if (!data) return [];
  const info = [];
  
  // Common fields to show
  const priorityFields = [
    "grantor", "grantee", "property_address", "legal_description",
    "loan_amount", "recording_date", "document_date", "parcel_number",
    "total_amount_owed", "filing_date", "secured_party", "debtor_name"
  ];
  
  for (const field of priorityFields) {
    if (data[field]) {
      const value = typeof data[field] === "object" 
        ? JSON.stringify(data[field]) 
        : String(data[field]);
      if (value && value !== "null" && value !== "undefined") {
        info.push({ label: formatFieldName(field), value: value.slice(0, 100) });
        if (info.length >= 4) break;
      }
    }
  }
  
  return info;
}

/**
 * Document details in history
 */
function HistoryDocument({ document }) {
  const [expanded, setExpanded] = useState(false);
  const keyInfo = getKeyInfo(document.documentType, document.extractedData);
  const fieldCount = document.extractedData ? Object.keys(document.extractedData).length : 0;
  
  return (
    <div className="border-l-2 border-gray-200 dark:border-neutral-600 ml-4 pl-3 py-1.5">
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-700 rounded px-2 py-1.5 -ml-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-gray-400 dark:text-neutral-400 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-gray-400 dark:text-neutral-400 shrink-0" />
          )}
          <span className="text-sm text-gray-700 dark:text-neutral-200">
            {getCategoryDisplayName(document.documentType)}
          </span>
          {document.needsReview && (
            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" title="Flagged for review" />
          )}
          {document.pages && (
            <span className="text-xs text-gray-400 dark:text-neutral-500">
              p. {Array.isArray(document.pages) ? document.pages.join(", ") : document.pages}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0">
          {fieldCount} fields
        </span>
      </div>
      
      {/* Quick preview of key info when not expanded */}
      {!expanded && keyInfo.length > 0 && (
        <div className="ml-5 mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-neutral-400">
          {keyInfo.slice(0, 2).map((item, i) => (
            <span key={i}><span className="text-gray-400 dark:text-neutral-500">{item.label}:</span> {item.value}</span>
          ))}
        </div>
      )}
      
      {/* Expanded view with all data */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-2">
          {/* Key info in readable format */}
          {keyInfo.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 dark:bg-neutral-800 rounded text-xs">
              {keyInfo.map((item, i) => (
                <div key={i}>
                  <span className="text-gray-400 dark:text-neutral-500">{item.label}</span>
                  <p className="text-gray-700 dark:text-neutral-200 font-medium truncate">{item.value}</p>
                </div>
              ))}
            </div>
          )}
          
          {/* Raw JSON toggle */}
          {document.extractedData && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200">
                View raw JSON ({fieldCount} fields)
              </summary>
              <pre className="mt-2 p-2 bg-gray-50 dark:bg-neutral-800 rounded whitespace-pre-wrap overflow-x-auto max-h-48 text-gray-900 dark:text-neutral-100">
                {JSON.stringify(document.extractedData, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Single history entry (run)
 */
function HistoryEntry({ entry, onDelete, onExport }) {
  const [expanded, setExpanded] = useState(false);
  
  // Calculate summary stats
  const totalFields = entry.packets?.reduce((sum, p) => 
    sum + (p.documents?.reduce((dSum, d) => 
      dSum + (d.extractedData ? Object.keys(d.extractedData).length : 0), 0) || 0), 0) || 0;
  
  return (
    <div className="border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-800">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-700",
          expanded && "border-b border-gray-200 dark:border-neutral-700"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 dark:text-neutral-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 dark:text-neutral-400" />
          )}
          <Clock className="h-4 w-4 text-gray-400 dark:text-neutral-400" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                {formatRelativeTime(entry.timestamp)}
              </p>
              <span className="text-xs text-gray-400 dark:text-neutral-500">
                {formatTimestamp(entry.timestamp)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              {entry.created_by && (
                <span className="inline-flex items-center gap-0.5 mr-1.5">
                  <User className="h-3 w-3" />
                  {entry.created_by} ·
                </span>
              )}
              {entry.stats.totalPackets} packet{entry.stats.totalPackets !== 1 ? "s" : ""} · {entry.stats.totalDocuments} document{entry.stats.totalDocuments !== 1 ? "s" : ""} · {totalFields} fields extracted
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {entry.stats.needsReview > 0 && (
            <Badge variant="warning" className="text-xs">
              {entry.stats.needsReview} ⚠
            </Badge>
          )}
          {entry.stats.failed > 0 && (
            <Badge variant="destructive" className="text-xs">
              {entry.stats.failed} ✗
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-500 dark:text-neutral-300"
            onClick={() => onExport(entry, "json")}
            title="Export as JSON"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 dark:text-neutral-400 hover:text-red-500"
            onClick={() => onDelete(entry.id)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="p-3 bg-gray-50 dark:bg-neutral-900 space-y-3">
          {/* Summary stats */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-neutral-400 pb-2 border-b border-gray-200 dark:border-neutral-700">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {entry.stats.totalPackets} packet{entry.stats.totalPackets !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {entry.stats.totalDocuments} document{entry.stats.totalDocuments !== 1 ? "s" : ""}
            </span>
            {entry.stats.completed > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle className="h-3 w-3" />
                {entry.stats.completed} completed
              </span>
            )}
            {entry.stats.needsReview > 0 && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {entry.stats.needsReview} need review
              </span>
            )}
          </div>
          
          {/* Packets */}
          {(entry.packets || []).map(packet => (
            <PacketHistoryItem key={packet.id} packet={packet} />
          ))}
          
          {/* Export options */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-neutral-700">
            <span className="text-xs text-gray-500 dark:text-neutral-400">Export:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onExport(entry, "json")}
            >
              <FileJson className="h-3 w-3 mr-1" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onExport(entry, "csv")}
            >
              <FileText className="h-3 w-3 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onExport(entry, "summary")}
            >
              <Download className="h-3 w-3 mr-1" />
              Summary
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Packet within a history entry
 */
function PacketHistoryItem({ packet }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white dark:bg-neutral-800 rounded border border-gray-200 dark:border-neutral-700">
      <div 
        className={cn(
          "flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-700",
          expanded && "border-b border-gray-100 dark:border-neutral-700"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 dark:text-neutral-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 dark:text-neutral-400 shrink-0" />
          )}
          <FileText className="h-4 w-4 text-gray-400 dark:text-neutral-400 shrink-0" />
          <span className="text-sm text-gray-700 dark:text-neutral-200 truncate">
            {packet.filename}
          </span>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">
          {packet.documentCount} doc{packet.documentCount !== 1 ? "s" : ""}
        </Badge>
      </div>
      
      {expanded && packet.documents?.length > 0 && (
        <div className="p-2 space-y-1">
          {packet.documents.map(doc => (
            <HistoryDocument key={doc.id} document={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Main history log component
 */
export function HistoryLog({ history, onDelete, onClearAll, onExport, onClose }) {
  if (!history || history.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-neutral-900 pt-16 pb-16">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 dark:bg-neutral-700 mb-4">
            <History className="h-7 w-7 text-gray-400 dark:text-neutral-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-neutral-100 mb-2">No history yet</h2>
          <p className="text-gray-500 dark:text-neutral-400 mb-6">
            Completed runs will show up here after you process documents.
          </p>
        </div>
      </div>
    );
  }

  const handleExportEntry = (entry, format = "json") => {
    const timestamp = formatTimestamp(entry.timestamp).replace(/[/:]/g, "-").replace(/ /g, "_");
    
    if (format === "json") {
      const exportData = {
        exported_at: new Date().toISOString(),
        exported_at_cst: formatTimestamp(new Date()),
        run_id: entry.id,
        processed_at: entry.timestamp,
        processed_at_cst: formatTimestamp(entry.timestamp),
        stats: entry.stats,
        packets: (entry.packets || []).map(p => ({
          ...p,
          documents: p.documents?.map(d => ({
            document_type: d.documentType,
            document_type_display: getCategoryDisplayName(d.documentType),
            pages: d.pages,
            needs_review: d.needsReview,
            extracted_data: d.extractedData,
          }))
        })),
      };
      
      const content = JSON.stringify(exportData, null, 2);
      downloadFile(content, `history-${timestamp}.json`, "application/json");
    } 
    else if (format === "csv") {
      // Flatten documents into CSV rows
      const rows = [];
      (entry.packets || []).forEach(packet => {
        packet.documents?.forEach(doc => {
          const data = doc.extractedData || {};
          rows.push({
            packet_filename: packet.filename,
            document_type: getCategoryDisplayName(doc.documentType),
            pages: Array.isArray(doc.pages) ? doc.pages.join(", ") : doc.pages,
            needs_review: doc.needsReview ? "Yes" : "No",
            ...data,
          });
        });
      });
      
      if (rows.length === 0) {
        rows.push({ message: "No extracted data" });
      }
      
      // Get all unique columns
      const columns = [...new Set(rows.flatMap(r => Object.keys(r)))];
      
      // Build CSV
      const csvLines = [columns.join(",")];
      rows.forEach(row => {
        csvLines.push(columns.map(col => {
          const val = row[col];
          if (val === undefined || val === null) return "";
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
        }).join(","));
      });
      
      downloadFile(csvLines.join("\n"), `history-${timestamp}.csv`, "text/csv");
    }
    else if (format === "summary") {
      // Human-readable summary
      let summary = `PROCESSING HISTORY EXPORT\n`;
      summary += `${"=".repeat(60)}\n\n`;
      summary += `Run ID: ${entry.id}\n`;
      summary += `Processed: ${formatTimestamp(entry.timestamp)} CST\n`;
      summary += `Exported: ${formatTimestamp(new Date())} CST\n\n`;
      
      summary += `SUMMARY\n`;
      summary += `${"-".repeat(40)}\n`;
      summary += `Total Packets: ${entry.stats.totalPackets}\n`;
      summary += `Total Documents: ${entry.stats.totalDocuments}\n`;
      summary += `Completed: ${entry.stats.completed}\n`;
      summary += `Needs Review: ${entry.stats.needsReview}\n`;
      summary += `Failed: ${entry.stats.failed}\n\n`;
      
      (entry.packets || []).forEach((packet, pi) => {
        summary += `\nPACKET ${pi + 1}: ${packet.filename}\n`;
        summary += `${"-".repeat(40)}\n`;
        summary += `Documents: ${packet.documentCount}\n\n`;
        
        packet.documents?.forEach((doc, di) => {
          summary += `  Document ${di + 1}: ${getCategoryDisplayName(doc.documentType)}\n`;
          if (doc.pages) {
            summary += `    Pages: ${Array.isArray(doc.pages) ? doc.pages.join(", ") : doc.pages}\n`;
          }
          if (doc.needsReview) {
            summary += `    Status: NEEDS REVIEW\n`;
          }
          
          if (doc.extractedData) {
            summary += `    Extracted Fields:\n`;
            Object.entries(doc.extractedData).forEach(([key, value]) => {
              const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
              summary += `      ${formatFieldName(key)}: ${displayValue.slice(0, 80)}${displayValue.length > 80 ? "..." : ""}\n`;
            });
          }
          summary += `\n`;
        });
      });
      
      downloadFile(summary, `history-${timestamp}-summary.txt`, "text/plain");
    }
  };
  
  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculate total stats
  const totalStats = history.reduce((acc, entry) => ({
    packets: acc.packets + (entry.stats?.totalPackets || 0),
    documents: acc.documents + (entry.stats?.totalDocuments || 0),
    completed: acc.completed + (entry.stats?.completed || 0),
    needsReview: acc.needsReview + (entry.stats?.needsReview || 0),
    failed: acc.failed + (entry.stats?.failed || 0),
  }), { packets: 0, documents: 0, completed: 0, needsReview: 0, failed: 0 });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700 shrink-0">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-gray-600 dark:text-neutral-300" />
          <h3 className="font-semibold text-gray-900 dark:text-neutral-100">Processing History</h3>
          <Badge variant="secondary">{history.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Export all history
              const allData = {
                exported_at: new Date().toISOString(),
                exported_at_cst: formatTimestamp(new Date()),
                total_runs: history.length,
                total_stats: totalStats,
                runs: history,
              };
              const content = JSON.stringify(allData, null, 2);
              const timestamp = formatTimestamp(new Date()).replace(/[/:]/g, "-").replace(/ /g, "_");
              downloadFile(content, `all-history-${timestamp}.json`, "application/json");
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            Export All
          </Button>
        </div>
      </div>
      
      {/* Stats summary */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 shrink-0">
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-neutral-400">
          <span>{totalStats.packets} total packets</span>
          <span>{totalStats.documents} total documents</span>
          <span className="text-green-600 dark:text-green-400">{totalStats.completed} completed</span>
          {totalStats.needsReview > 0 && (
            <span className="text-amber-600 dark:text-amber-400">{totalStats.needsReview} need review</span>
          )}
          {totalStats.failed > 0 && (
            <span className="text-red-600 dark:text-red-400">{totalStats.failed} failed</span>
          )}
        </div>
      </div>
      
      {/* History list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.map(entry => (
          <HistoryEntry
            key={entry.id}
            entry={entry}
            onDelete={onDelete}
            onExport={handleExportEntry}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Compact history button with dropdown
 */
export function HistoryButton({ history, onClick }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="relative"
    >
      <History className="h-4 w-4 mr-1" />
      History
      {history.length > 0 && (
        <Badge 
          variant="secondary" 
          className="ml-1 h-5 px-1.5 text-xs"
        >
          {history.length}
        </Badge>
      )}
    </Button>
  );
}

export default HistoryLog;
