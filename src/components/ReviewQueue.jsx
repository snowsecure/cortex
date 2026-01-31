import React, { useState, useCallback, useEffect, useMemo } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "./ui/button";
import { getExtractionData } from "../lib/utils";
import { PDFPreview } from "./DocumentDetailModal";
import * as api from "../lib/api";

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

export function ReviewQueue({ packets, onApprove, onReject, onClose }) {
  const reviewItems = useMemo(() => getReviewItems(packets), [packets]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedFields, setEditedFields] = useState({});
  const [base64ByPacketId, setBase64ByPacketId] = useState({});

  const current = reviewItems[currentIndex];

  // Fetch PDF from server when packet has server file and no base64
  useEffect(() => {
    if (!current?.packet?.hasServerFile || current.packet.base64) return;
    const id = current.packet.id;
    if (base64ByPacketId[id]) return;
    api.getPacketFileAsBase64(id).then((b64) => {
      setBase64ByPacketId((prev) => ({ ...prev, [id]: b64 }));
    }).catch(() => {});
  }, [current?.packet?.id, current?.packet?.hasServerFile, current?.packet?.base64, base64ByPacketId]);

  const packetBase64 = current
    ? (current.packet.base64 || base64ByPacketId[current.packet.id])
    : null;

  const handleApprove = useCallback(() => {
    if (current) {
      onApprove?.(current.document, current.packet, { editedFields: { ...editedFields } });
      setEditedFields({});
      setCurrentIndex((i) => Math.min(i + 1, reviewItems.length - 1));
    }
  }, [current, onApprove, editedFields, reviewItems.length]);

  const handleReject = useCallback(() => {
    if (current) {
      onReject?.(current.document, current.packet, {});
      setEditedFields({});
      setCurrentIndex((i) => Math.min(i + 1, reviewItems.length - 1));
    }
  }, [current, onReject, reviewItems.length]);

  if (reviewItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 pt-16 pb-16">
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
  const data = getExtractionData(current.document.extraction).data;
  const displayName = current.document.splitType || current.document.classification?.category || "Document";
  const REVIEW_THRESHOLD = 0.75;
  const LOW_THRESHOLD = 0.5;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Document: {displayName}</h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          Back to Results
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-52 border-r bg-white p-3 shrink-0">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Review Queue</h3>
          <p className="text-xs text-gray-500 mb-3">{currentIndex + 1} of {reviewItems.length}</p>
          <div className="space-y-1">
            {reviewItems.map((item, i) => (
              <button
                key={item.document.id}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs truncate ${i === currentIndex ? "bg-[#9e2339]/10 text-[#9e2339] font-medium" : "text-gray-600 hover:bg-gray-100"}`}
              >
                {item.packet.filename || item.packet.name || "Document"} — #{i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 border-r bg-gray-100 flex flex-col">
            <PDFPreview
              base64Data={packetBase64}
              pages={current.document.pages}
              filename={current.packet.filename || current.packet.name}
            />
          </div>
          <div className="w-96 shrink-0 overflow-y-auto p-4 bg-white flex flex-col gap-4">
            <h3 className="text-sm font-medium text-gray-900">Extracted data</h3>
            <div className="space-y-3">
              {Object.entries(data || {}).map(([key, value]) => {
                const likelihood = likelihoods?.[key];
                const isLow = typeof likelihood === "number" && likelihood < REVIEW_THRESHOLD;
                const isVeryLow = typeof likelihood === "number" && likelihood < LOW_THRESHOLD;
                const displayValue = editedFields[key] !== undefined ? editedFields[key] : (value ?? "");
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      {key}
                      {isLow && (
                        <span className={`text-[10px] ${isVeryLow ? "text-red-600" : "text-amber-600"}`}>
                          — Review
                        </span>
                      )}
                    </label>
                    {typeof displayValue === "object" && displayValue !== null ? (
                      <textarea
                        className={`w-full px-2 py-1.5 text-sm border rounded min-h-[60px] ${isVeryLow ? "border-red-300 bg-red-50/50" : isLow ? "border-amber-300 bg-amber-50/50" : "border-gray-200"}`}
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
                        className={`w-full px-2 py-1.5 text-sm border rounded ${isVeryLow ? "border-red-300 bg-red-50/50" : isLow ? "border-amber-300 bg-amber-50/50" : "border-gray-200"}`}
                        value={displayValue}
                        onChange={(e) => setEditedFields((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-auto pt-4 border-t">
              <Button variant="success" onClick={handleApprove} className="flex-1">
                Approve
              </Button>
              <Button variant="outline" onClick={handleReject} className="flex-1 border-red-300 text-red-700 hover:bg-red-50">
                Reject
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
