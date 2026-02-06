import React, { useState, useMemo, useEffect } from "react";
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
  Loader2,
} from "lucide-react";
import { useToast } from "./ui/toast";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { getSplitTypeDisplayName } from "../hooks/usePacketPipeline";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { getMergedExtractionData } from "../lib/utils";
import * as api from "../lib/api";

/**
 * PDF Preview Component
 */
function PDFPreview({ base64Data, pages, filename, loading }) {
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
      // Strip data URL prefix if present (e.g., "data:application/pdf;base64,")
      const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const binaryString = atob(base64String);
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
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin opacity-60" />
          <p>Loading PDF from server…</p>
        </div>
      </div>
    );
  }
  
  if (!base64Data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>PDF preview not available</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      {/* PDF Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {pageNumbers.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                disabled={currentPageIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-600 min-w-[80px] text-center">
                Page {pageNumbers[currentPageIndex]} of {pageNumbers.length} pages
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setCurrentPageIndex(Math.min(pageNumbers.length - 1, currentPageIndex + 1))}
                disabled={currentPageIndex === pageNumbers.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {pageNumbers.length === 1 && (
            <span className="text-xs text-gray-600">
              Page {pageNumbers[0]}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setZoom(Math.max(50, zoom - 25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setZoom(Math.min(200, zoom + 25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setZoom(100)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-800">
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
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [fetchedBase64, setFetchedBase64] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfFetchError, setPdfFetchError] = useState(false);

  // Fetch PDF from server when base64 isn't in browser memory
  // Always attempt fetch — the file may be on the server even if hasServerFile isn't set
  useEffect(() => {
    if (!packet?.id) return;
    if (packet.base64) {
      setFetchedBase64(null);
      setLoadingPdf(false);
      setPdfFetchError(false);
      return;
    }
    setFetchedBase64(null);
    setPdfFetchError(false);
    setLoadingPdf(true);
    api.getPacketFileAsBase64(packet.id)
      .then((b64) => {
        setFetchedBase64(b64);
        setPdfFetchError(false);
      })
      .catch(() => setPdfFetchError(true))
      .finally(() => setLoadingPdf(false));
  }, [packet?.id, packet?.base64]);

  const pdfBase64 = packet?.base64 ?? fetchedBase64;
  const pdfLoading = loadingPdf && !pdfBase64;

  if (!document) return null;
  
  // Get extracted data and likelihoods (with corrections merged in)
  const { data: extractedData, likelihoods, editedFields } = getMergedExtractionData(document);
  
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
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard");
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] max-w-7xl h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{displayName}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Pages: {formatPages()}
                {packet?.filename && (
                  <span className="ml-2 text-gray-400 dark:text-gray-500">• {packet.filename}</span>
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
            ) : document.status === "reviewed" ? (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Reviewed
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
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 shrink-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Review Reasons:</p>
            <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
              {document.reviewReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Split view: PDF left, Data right */}
        <div className="flex-1 flex min-h-0">
          {/* PDF Preview - Left Side */}
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700">
            <PDFPreview 
              base64Data={pdfBase64} 
              pages={document.pages}
              filename={packet?.filename}
              loading={pdfLoading}
            />
            {pdfFetchError && !pdfBase64 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-800">
                Could not load PDF from server. Extracted data above is still from the original file.
              </p>
            )}
          </div>
          
          {/* Extracted Data - Right Side */}
          <div className="w-1/2 flex flex-col">
            {/* Data header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Extracted Data</h3>
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
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  {document.status === "pending" || document.status === "processing"
                    ? "No data extracted yet"
                    : "No data extracted"}
                </p>
              ) : (
                <div className="space-y-2">
                  {sortedFields.map(([key, value]) => {
                    const confidence = likelihoods[key];
                    const hasConfidence = confidence !== undefined;
                    const isCorrected = editedFields && key in editedFields;
                    
                    return (
                      <div 
                        key={key} 
                        className={`flex items-start justify-between py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 ${
                          isCorrected ? "bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800" : "bg-gray-50 dark:bg-gray-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                            {isCorrected && (
                              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded">corrected</span>
                            )}
                          </p>
                          <p className={`text-sm break-words whitespace-pre-wrap ${
                            isCorrected ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-900 dark:text-gray-100"
                          }`}>
                            {formatValue(value)}
                          </p>
                        </div>
                        {!isCorrected && hasConfidence && (
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
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export { PDFPreview };
export default DocumentDetailModal;
