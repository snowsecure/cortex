import React, { useState, useMemo, useEffect, useRef } from "react";
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
  RotateCcw,
  Loader2,
  PenLine,
} from "lucide-react";
import { useToast } from "./ui/toast";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { getSplitTypeDisplayName } from "../hooks/usePacketPipeline";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { getMergedExtractionData } from "../lib/utils";
import { schemas } from "../schemas/index";
import * as api from "../lib/api";
import { pdfBlobCache } from "../lib/pdfCache";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Renders a single PDF page on a <canvas> using pdfjs-dist.
 */
function PdfCanvasPage({ pdfDoc, pageNumber, scale }) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        ctx.scale(dpr, dpr);

        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException" && !cancelled) {
          console.error("PDF page render error:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageNumber, scale]);

  return <canvas ref={canvasRef} className="block mx-auto shadow-md" />;
}

/**
 * PDF Preview Component.
 *
 * Props:
 *   base64Data  — base64 or data-URL string (legacy path, converted to Blob URL internally)
 *   blobUrl     — pre-built Blob URL from the server (preferred, avoids base64 overhead)
 *   pages       — page numbers this document spans (for navigation)
 *   filename    — display name
 *   loading     — show spinner
 */
function PDFPreview({ base64Data, blobUrl: externalBlobUrl, pages, filename, loading }) {
  const [zoom, setZoom] = useState(100);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfRenderError, setPdfRenderError] = useState(null);
  const [pdfDocLoading, setPdfDocLoading] = useState(false);
  
  // Get the pages this document spans
  const pageNumbers = useMemo(() => {
    if (!pages) return [1];
    if (Array.isArray(pages) && pages.length > 0) return pages;
    return [1];
  }, [pages]);

  // Reset page index when switching documents
  const prevPagesRef = useRef(pages);
  useEffect(() => {
    if (prevPagesRef.current !== pages) {
      setCurrentPageIndex(0);
      prevPagesRef.current = pages;
    }
  }, [pages]);

  const hasData = !!(base64Data || externalBlobUrl);

  // Build pdfjs source — prefer Blob URL (no base64 overhead), fall back to decoded data
  const pdfSource = useMemo(() => {
    if (externalBlobUrl) return { url: externalBlobUrl };
    if (!base64Data) return null;
    try {
      const b64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { data: bytes };
    } catch {
      return null;
    }
  }, [base64Data, externalBlobUrl]);

  // Load PDF document via pdfjs
  useEffect(() => {
    if (!pdfSource) { setPdfDoc(null); return; }
    let cancelled = false;
    setPdfDocLoading(true);
    setPdfRenderError(null);
    const loadingTask = pdfjsLib.getDocument(pdfSource);
    loadingTask.promise
      .then((doc) => {
        if (cancelled) { doc.destroy(); return; }
        setPdfDoc((prev) => { prev?.destroy?.(); return doc; });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("pdfjs load error:", err);
          setPdfRenderError("Failed to render PDF");
        }
      })
      .finally(() => { if (!cancelled) setPdfDocLoading(false); });
    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
    };
  }, [pdfSource]);

  // Cleanup pdfDoc on unmount
  useEffect(() => {
    return () => { pdfDoc?.destroy?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scale = zoom / 100;
  const pageNum = pageNumbers[currentPageIndex] || pageNumbers[0] || 1;
  
  if (loading || pdfDocLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin opacity-60" />
          <p>Loading PDF…</p>
        </div>
      </div>
    );
  }
  
  if (!hasData || pdfRenderError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{pdfRenderError || "PDF preview not available"}</p>
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
                Page {pageNumbers[currentPageIndex]}{pageNumbers.length > 1 ? ` (${currentPageIndex + 1}/${pageNumbers.length})` : ""}
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
            title="Reset zoom to 100%"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* PDF Canvas Viewer — pdfjs-dist renders on <canvas> for consistent cross-browser display */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-800 p-4">
        {pdfDoc && (
          <PdfCanvasPage
            key={`${pageNum}-${zoom}`}
            pdfDoc={pdfDoc}
            pageNumber={pageNum}
            scale={scale}
          />
        )}
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
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfFetchError, setPdfFetchError] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);

  // Fetch PDF from server as Blob URL, using the shared LRU cache.
  useEffect(() => {
    if (!packet?.id) return;
    if (packet.base64 || pdfBlobCache.has(packet.id)) {
      setLoadingPdf(false);
      setPdfFetchError(false);
      return;
    }
    let cancelled = false;
    setPdfFetchError(false);
    setLoadingPdf(true);
    api.getPacketFileAsBlobUrl(packet.id)
      .then((url) => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        pdfBlobCache.set(packet.id, url, 0);
        setCacheVersion(v => v + 1);
        setPdfFetchError(false);
      })
      .catch(() => { if (!cancelled) setPdfFetchError(true); })
      .finally(() => { if (!cancelled) setLoadingPdf(false); });
    return () => { cancelled = true; };
  }, [packet?.id, packet?.base64]);

  const pdfBase64 = packet?.base64 ?? null;
  const pdfBlobUrl = packet?.id ? pdfBlobCache.get(packet.id) : null;
  const pdfLoading = loadingPdf && !pdfBase64 && !pdfBlobUrl;

  if (!document) return null;
  
  // Get extracted data and likelihoods (with corrections merged in)
  const { data: extractedData, likelihoods, editedFields, originalData } = getMergedExtractionData(document, schemas);
  
  // Get display name - prefer category override, then split type, then category
  const catOverride = document.categoryOverride || null;
  const splitType = document.splitType || document.classification?.splitType;
  const displayName = catOverride?.name
    ? catOverride.name
    : splitType 
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
  
  // Confidence styling helpers
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return "text-green-600 dark:text-green-400";
    if (confidence >= 0.7) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };
  const getConfidenceBorder = (confidence) => {
    if (confidence >= 0.9) return "border-l-green-400 dark:border-l-green-600";
    if (confidence >= 0.7) return "border-l-amber-400 dark:border-l-amber-500";
    return "border-l-red-400 dark:border-l-red-500";
  };
  
  const hasAnyLikelihoods = Object.keys(likelihoods).length > 0;
  
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
        
        {/* Review guidance */}
        {document.reviewReasons?.length > 0 && (
          <div className="px-4 py-2.5 bg-orange-50/80 dark:bg-orange-950/20 border-b border-orange-200/60 dark:border-orange-800/40 shrink-0">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-500 dark:text-orange-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  {document.reviewReasons.length === 1
                    ? "This document needs your attention"
                    : `${document.reviewReasons.length} items need your attention`}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {document.reviewReasons.map((reason, i) => (
                    <li key={i} className="text-xs text-orange-700/90 dark:text-orange-300/80 flex items-start gap-1.5">
                      <span className="text-orange-400 dark:text-orange-500 mt-px shrink-0">&#8250;</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Split view: PDF left, Data right */}
        <div className="flex-1 flex min-h-0">
          {/* PDF Preview - Left Side */}
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700">
            <PDFPreview 
              base64Data={pdfBase64}
              blobUrl={pdfBlobUrl}
              pages={document.pages}
              filename={packet?.filename}
              loading={pdfLoading}
            />
            {pdfFetchError && !pdfBase64 && !pdfBlobUrl && (
              <p className="text-xs text-amber-600 dark:text-amber-400 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-800">
                Could not load PDF from server. Extracted data above is still from the original file.
              </p>
            )}
          </div>
          
          {/* Extracted Data - Right Side */}
          <div className="w-1/2 flex flex-col">
            {/* Data header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="font-medium text-gray-700 dark:text-gray-300">Extracted Data</h3>
                {hasAnyLikelihoods && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> high</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> medium</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> low</span>
                  </div>
                )}
              </div>
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
                <div className="space-y-1">
                  {sortedFields.map(([key, value]) => {
                    const confidence = likelihoods[key];
                    const hasConfidence = confidence !== undefined && confidence !== null;
                    const isCorrected = editedFields && key in editedFields;
                    const originalValue = isCorrected ? originalData?.[key] : null;
                    const valueChanged = isCorrected && JSON.stringify(originalValue) !== JSON.stringify(value);
                    
                    // Subtle left-border color when confidence is available
                    const borderClass = hasConfidence && !isCorrected
                      ? `border-l-2 ${getConfidenceBorder(confidence)}`
                      : isCorrected ? "border-l-2 border-l-blue-400 dark:border-l-blue-500" : "border-l-2 border-l-transparent";
                    
                    return (
                      <div 
                        key={key} 
                        className={`py-2 px-3 rounded-r-lg hover:bg-gray-100 dark:hover:bg-gray-600 ${borderClass} ${
                          isCorrected ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-700/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                            {isCorrected && (
                              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded inline-flex items-center gap-0.5">
                                <PenLine className="h-2.5 w-2.5" /> edited by reviewer
                              </span>
                            )}
                          </p>
                          {hasConfidence && !isCorrected && (
                            <span className={`text-[10px] tabular-nums font-medium shrink-0 ${getConfidenceColor(confidence)}`}>
                              {Math.round(confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <p className={`text-sm break-words whitespace-pre-wrap ${
                          isCorrected ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-900 dark:text-gray-100"
                        }`}>
                          {formatValue(value)}
                        </p>
                        {/* Show original AI value when human changed it */}
                        {valueChanged && originalValue != null && originalValue !== "" && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                            <span className="line-through">{formatValue(originalValue)}</span>
                            <span className="text-blue-500 dark:text-blue-400 ml-1">→ reviewer correction</span>
                          </p>
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
