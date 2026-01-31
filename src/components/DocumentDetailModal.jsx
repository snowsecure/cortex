import React, { useState, useMemo } from "react";
import { 
  X, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Check,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { getSplitTypeDisplayName } from "../hooks/usePacketPipeline";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { getExtractionData } from "../lib/utils";

/**
 * PDF Preview Component
 */
function PDFPreview({ base64Data, pages, filename }) {
  const [zoom, setZoom] = useState(100);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  // Get the pages this document spans
  const pageNumbers = useMemo(() => {
    if (!pages) return [1];
    if (Array.isArray(pages) && pages.length > 0) return pages;
    return [1];
  }, [pages]);
  
  // Create PDF URL with page parameter
  const pdfUrl = useMemo(() => {
    if (!base64Data) return null;
    
    // Get the current page to display
    const pageNum = pageNumbers[currentPageIndex] || pageNumbers[0] || 1;
    
    // Create object URL from base64
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      return `${url}#page=${pageNum}`;
    } catch (e) {
      console.error("Failed to create PDF URL:", e);
      return null;
    }
  }, [base64Data, pageNumbers, currentPageIndex]);
  
  // Cleanup URL on unmount
  React.useEffect(() => {
    return () => {
      if (pdfUrl) {
        const baseUrl = pdfUrl.split("#")[0];
        URL.revokeObjectURL(baseUrl);
      }
    };
  }, [pdfUrl]);
  
  if (!base64Data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>PDF preview not available</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* PDF Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {pageNumbers.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-300 hover:text-white hover:bg-gray-700"
                onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                disabled={currentPageIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-300 min-w-[80px] text-center">
                Page {pageNumbers[currentPageIndex]} of {pageNumbers.length} pages
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-300 hover:text-white hover:bg-gray-700"
                onClick={() => setCurrentPageIndex(Math.min(pageNumbers.length - 1, currentPageIndex + 1))}
                disabled={currentPageIndex === pageNumbers.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {pageNumbers.length === 1 && (
            <span className="text-xs text-gray-300">
              Page {pageNumbers[0]}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-300 hover:text-white hover:bg-gray-700"
            onClick={() => setZoom(Math.max(50, zoom - 25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-300 w-12 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-300 hover:text-white hover:bg-gray-700"
            onClick={() => setZoom(Math.min(200, zoom + 25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-300 hover:text-white hover:bg-gray-700"
            onClick={() => setZoom(100)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto">
        <iframe
          src={pdfUrl}
          title={filename || "Document Preview"}
          className="w-full h-full border-0"
          style={{ 
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
            width: `${10000 / zoom}%`,
            height: `${10000 / zoom}%`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Modal for viewing document extraction details with PDF preview
 */
export function DocumentDetailModal({ document, packet, onClose }) {
  const [copied, setCopied] = useState(false);
  
  if (!document) return null;
  
  // Get extracted data and likelihoods
  const { data: extractedData, likelihoods } = getExtractionData(document.extraction);
  
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
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-7xl h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="font-semibold text-lg">{displayName}</h2>
              <p className="text-sm text-gray-500">
                Pages: {formatPages()}
                {packet?.filename && (
                  <span className="ml-2 text-gray-400">• {packet.filename}</span>
                )}
              </p>
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
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
            <p className="text-sm font-medium text-amber-800">Review Reasons:</p>
            <ul className="text-sm text-amber-700 list-disc list-inside">
              {document.reviewReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Split view: PDF left, Data right */}
        <div className="flex-1 flex min-h-0">
          {/* PDF Preview - Left Side */}
          <div className="w-1/2 border-r border-gray-200">
            <PDFPreview 
              base64Data={packet?.base64} 
              pages={document.pages}
              filename={packet?.filename}
            />
          </div>
          
          {/* Extracted Data - Right Side */}
          <div className="w-1/2 flex flex-col">
            {/* Data header */}
            <div className="flex items-center justify-between p-3 border-b bg-gray-50 shrink-0">
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
            
            {/* Fields list */}
            <div className="flex-1 overflow-y-auto p-4">
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
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DocumentDetailModal;
