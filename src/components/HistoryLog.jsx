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
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import { getCategoryDisplayName } from "../lib/documentCategories";

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

/**
 * Format relative time
 */
function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Document details in history
 */
function HistoryDocument({ document }) {
  const [expanded, setExpanded] = useState(false);
  const confidence = document.confidence || 0;
  
  return (
    <div className="border-l-2 border-gray-200 ml-4 pl-3 py-1">
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -ml-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-gray-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-gray-400" />
          )}
          <span className="text-sm text-gray-700">
            {getCategoryDisplayName(document.documentType)}
          </span>
          {document.needsReview && (
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          )}
        </div>
        <Badge 
          variant={confidence >= 0.75 ? "success" : confidence >= 0.5 ? "warning" : "destructive"}
          className="text-xs"
        >
          {Math.round(confidence * 100)}%
        </Badge>
      </div>
      
      {expanded && document.extractedData && (
        <div className="mt-2 ml-5 p-2 bg-gray-50 rounded text-xs">
          <pre className="whitespace-pre-wrap overflow-x-auto max-h-48">
            {JSON.stringify(document.extractedData, null, 2)}
          </pre>
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
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div 
        className={cn(
          "flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50",
          expanded && "border-b border-gray-200"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <Clock className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {formatRelativeTime(entry.timestamp)}
            </p>
            <p className="text-xs text-gray-500">
              {entry.stats.totalPackets} packet{entry.stats.totalPackets !== 1 ? "s" : ""}, {entry.stats.totalDocuments} document{entry.stats.totalDocuments !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {entry.stats.completed > 0 && (
            <Badge variant="success" className="text-xs">
              {entry.stats.completed} ✓
            </Badge>
          )}
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
            className="h-7 w-7"
            onClick={() => onExport(entry)}
            title="Export"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-red-500"
            onClick={() => onDelete(entry.id)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="p-3 bg-gray-50 space-y-3">
          {entry.packets.map(packet => (
            <PacketHistoryItem key={packet.id} packet={packet} />
          ))}
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
    <div className="bg-white rounded border border-gray-200">
      <div 
        className={cn(
          "flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50",
          expanded && "border-b border-gray-100"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
          )}
          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 truncate">
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
  if (history.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mb-4">
          <History className="h-7 w-7 text-gray-400" />
        </div>
        <p className="text-gray-600 font-medium">No history yet</p>
        <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
          Completed runs will show up here after you process documents.
        </p>
      </div>
    );
  }

  const handleExportEntry = (entry) => {
    const exportData = {
      exported_at: new Date().toISOString(),
      run_id: entry.id,
      processed_at: entry.timestamp,
      stats: entry.stats,
      packets: entry.packets,
    };
    
    const content = JSON.stringify(exportData, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `history-${entry.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Processing History</h3>
          <Badge variant="secondary">{history.length}</Badge>
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
