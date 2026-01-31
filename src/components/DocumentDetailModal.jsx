import React from "react";
import { X, FileText, CheckCircle, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { getSplitTypeDisplayName } from "../hooks/usePacketPipeline";
import { getCategoryDisplayName } from "../lib/documentCategories";

/**
 * Modal for viewing document extraction details
 */
export function DocumentDetailModal({ document, onClose }) {
  const [copied, setCopied] = React.useState(false);
  
  if (!document) return null;
  
  // Get extracted data
  const extractedData = document.extraction?.choices?.[0]?.message?.parsed || 
                        document.extraction?.data || 
                        {};
  
  // Get likelihoods for field confidence
  const likelihoods = document.extraction?.likelihoods || {};
  
  // Get display name
  const splitType = document.splitType || document.classification?.splitType;
  const displayName = splitType 
    ? getSplitTypeDisplayName(splitType)
    : getCategoryDisplayName(document.classification?.category || "unknown");
  
  // Format pages
  const formatPages = () => {
    const pages = document.pages;
    if (!pages) return "N/A";
    if (Array.isArray(pages) && pages.length === 0) return "N/A";
    if (Array.isArray(pages)) return pages.join(", ");
    return String(pages);
  };
  
  // Copy JSON to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  
  // Format field value for display
  const formatValue = (value) => {
    if (value === null || value === undefined) return <span className="text-gray-400 italic">null</span>;
    if (value === "") return <span className="text-gray-400 italic">empty</span>;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };
  
  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.75) return "text-green-600";
    if (confidence >= 0.5) return "text-amber-600";
    return "text-red-600";
  };
  
  // Sort fields by confidence (lowest first to highlight issues)
  const sortedFields = Object.entries(extractedData).sort((a, b) => {
    const confA = likelihoods[a[0]] ?? 1;
    const confB = likelihoods[b[0]] ?? 1;
    return confA - confB;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="font-semibold text-lg">{displayName}</h2>
              <p className="text-sm text-gray-500">Pages: {formatPages()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {document.needsReview ? (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Needs Review
              </Badge>
            ) : (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Completed
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Review reasons */}
        {document.reviewReasons?.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
            <p className="text-sm font-medium text-amber-800">Review Reasons:</p>
            <ul className="text-sm text-amber-700 list-disc list-inside">
              {document.reviewReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Extracted fields */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-700">Extracted Data</h3>
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy JSON
                </>
              )}
            </Button>
          </div>
          
          {sortedFields.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No data extracted</p>
          ) : (
            <div className="space-y-2">
              {sortedFields.map(([key, value]) => {
                const confidence = likelihoods[key];
                const hasConfidence = confidence !== undefined;
                
                return (
                  <div 
                    key={key} 
                    className="flex items-start justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700">
                        {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                      <p className="text-sm text-gray-900 break-words whitespace-pre-wrap">
                        {formatValue(value)}
                      </p>
                    </div>
                    {hasConfidence && (
                      <span className={`text-xs font-medium ml-2 shrink-0 ${getConfidenceColor(confidence)}`}>
                        {Math.round(confidence * 100)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DocumentDetailModal;
