import React, { useState, useMemo, useEffect, useCallback } from "react";
import { CheckCircle, FileText } from "lucide-react";
import { Button } from "./ui/button";
import { PDFPreview } from "./DocumentDetailModal";
import { getExtractionData } from "../lib/utils";
import * as api from "../lib/api";

/**
 * Normalize base64: strip data URL prefix if present so PDFPreview (atob) gets raw base64.
 */
function toRawBase64(urlOrRaw) {
  if (!urlOrRaw) return null;
  if (typeof urlOrRaw !== "string") return null;
  if (urlOrRaw.startsWith("data:")) return urlOrRaw.split(",")[1] || null;
  return urlOrRaw;
}

/**
 * Review Queue — documents needing human review.
 * PDF viewer + editable extracted fields; Approve/Reject with optional edits.
 */
export function ReviewQueue({ packets, onApprove, onReject, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedData, setEditedData] = useState({});
  const [pdfBase64, setPdfBase64] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const reviewItems = useMemo(() => {
    const items = [];
    for (const packet of packets) {
      const docs = packet.documents || [];
      for (const doc of docs) {
        if (doc.needsReview) {
          items.push({ document: doc, packet });
        }
      }
    }
    return items;
  }, [packets]);

  const current = reviewItems[currentIndex];

  // Reset edited data when switching document; load PDF when packet has no base64 but hasServerFile
  useEffect(() => {
    if (!current) return;
    const { data } = getExtractionData(current.document.extraction);
    setEditedData(typeof data === "object" && data !== null ? { ...data } : {});

    const raw = toRawBase64(current.packet.base64);
    if (raw) {
      setPdfBase64(raw);
      return;
    }
    if (current.packet.hasServerFile && current.packet.id) {
      setPdfLoading(true);
      setPdfBase64(null);
      api.getPacketFileAsBase64(current.packet.id)
        .then((base64) => {
          setPdfBase64(base64);
        })
        .catch(() => setPdfBase64(null))
        .finally(() => setPdfLoading(false));
    } else {
      setPdfBase64(null);
    }
  }, [current?.document?.id, current?.packet?.id, current?.packet?.base64, current?.packet?.hasServerFile]);

  const handleFieldChange = useCallback((key, value) => {
    setEditedData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleApprove = useCallback(() => {
    if (current) {
      onApprove?.(current.document, current.packet, { editedFields: editedData });
      setCurrentIndex((i) => Math.min(i + 1, reviewItems.length - 1));
    }
  }, [current, editedData, onApprove, reviewItems.length]);

  const handleReject = useCallback(() => {
    if (current) {
      onReject?.(current.document, current.packet, {});
      setCurrentIndex((i) => Math.min(i + 1, reviewItems.length - 1));
    }
  }, [current, onReject, reviewItems.length]);

  if (reviewItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mb-4">
            <CheckCircle className="h-7 w-7 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No items to review</h2>
          <p className="text-gray-500 mb-6">All documents passed automatic validation.</p>
          <Button onClick={onClose}>Return to Results</Button>
        </div>
      </div>
    );
  }

  const { likelihoods } = getExtractionData(current.document.extraction);
  const displayName = current.document.splitType || current.document.classification?.category || "Document";

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Document: {displayName}</h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          Back to Results
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-52 border-r bg-white p-3 shrink-0">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Review Queue</h3>
          <p className="text-xs text-gray-500 mb-3">{currentIndex + 1} of {reviewItems.length}</p>
          <div className="space-y-1">
            {reviewItems.map((item, i) => (
              <button
                key={item.document.id}
                onClick={() => setCurrentIndex(i)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${i === currentIndex ? "bg-amber-100 border border-amber-300 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {item.document.splitType || item.document.classification?.category || "Document"}
              </button>
            ))}
          </div>
        </div>

        {/* PDF + Fields */}
        <div className="flex-1 flex min-w-0">
          {/* PDF viewer */}
          <div className="w-1/2 min-w-0 flex flex-col border-r border-gray-200 bg-white">
            {pdfLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <span className="text-sm">Loading PDF…</span>
              </div>
            ) : pdfBase64 ? (
              <PDFPreview
                base64Data={pdfBase64}
                pages={current.document.pages}
                filename={current.packet.filename || current.packet.name}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-500">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">PDF not available</p>
                  <p className="text-xs mt-1">Upload and process on this device to view.</p>
                </div>
              </div>
            )}
          </div>

          {/* Editable fields */}
          <div className="w-1/2 flex flex-col min-w-0 bg-white">
            <div className="px-4 py-2 border-b bg-gray-50 shrink-0">
              <h3 className="text-sm font-medium text-gray-700">Extracted data — edit if needed</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {Object.entries(editedData).length === 0 ? (
                <p className="text-gray-500 text-sm">No extracted fields.</p>
              ) : (
                Object.entries(editedData).map(([key, value]) => {
                  const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  const confidence = likelihoods?.[key];
                  const isObject = value !== null && typeof value === "object";
                  const needsReview = confidence !== undefined && confidence < 0.75;
                  const isLowConfidence = confidence !== undefined && confidence < 0.5;
                  const fieldWrapperClass = needsReview
                    ? isLowConfidence
                      ? "rounded-lg p-3 border-2 border-red-300 bg-red-50"
                      : "rounded-lg p-3 border-2 border-amber-300 bg-amber-50"
                    : "rounded-lg p-2 border border-transparent";
                  const inputClass = needsReview
                    ? isLowConfidence
                      ? "w-full px-3 py-2 border-2 border-red-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-red-400 focus:border-red-400"
                      : "w-full px-3 py-2 border-2 border-amber-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    : "w-full px-3 py-2 border border-gray-200 rounded-md text-sm";
                  const textareaClass = needsReview
                    ? isLowConfidence
                      ? "w-full px-3 py-2 border-2 border-red-300 rounded-md text-sm font-mono min-h-[80px] bg-white focus:ring-2 focus:ring-red-400 focus:border-red-400"
                      : "w-full px-3 py-2 border-2 border-amber-300 rounded-md text-sm font-mono min-h-[80px] bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    : "w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono min-h-[80px]";
                  return (
                    <div key={key} className={`space-y-1 ${fieldWrapperClass}`}>
                      <label className="block text-xs font-medium text-gray-600">
                        {label}
                        {confidence !== undefined && (
                          <span className={`ml-2 font-semibold ${confidence >= 0.75 ? "text-green-600" : confidence >= 0.5 ? "text-amber-600" : "text-red-600"}`}>
                            ({Math.round(confidence * 100)}%)
                          </span>
                        )}
                        {needsReview && (
                          <span className={`ml-2 text-[10px] font-semibold uppercase tracking-wide ${isLowConfidence ? "text-red-600" : "text-amber-700"}`}>
                            — Review
                          </span>
                        )}
                      </label>
                      {isObject ? (
                        <textarea
                          className={textareaClass}
                          value={JSON.stringify(value, null, 2)}
                          onChange={(e) => {
                            try {
                              const next = JSON.parse(e.target.value);
                              handleFieldChange(key, next);
                            } catch {
                              // leave as-is on parse error
                            }
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          className={inputClass}
                          value={value == null ? "" : String(value)}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex gap-2 p-4 border-t bg-gray-50 shrink-0">
              <Button variant="success" onClick={handleApprove}>Approve</Button>
              <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={handleReject}>Reject</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewQueue;
