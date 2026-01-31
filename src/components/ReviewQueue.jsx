import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  FileText,
  CheckCircle,
  XCircle,
  Lightbulb,
  Sparkles,
  Save,
  SkipForward,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Edit3,
  RotateCcw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { getSplitTypeDisplayName } from "../hooks/usePacketPipeline";

// ============================================================================
// PDF PREVIEW COMPONENT
// ============================================================================

function PDFPreview({ base64Data, pages, filename }) {
  const [zoom, setZoom] = useState(100);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const pageNumbers = useMemo(() => {
    if (!pages) return [1];
    if (Array.isArray(pages) && pages.length > 0) return pages;
    return [1];
  }, [pages]);
  
  const pdfUrl = useMemo(() => {
    if (!base64Data) return null;
    const pageNum = pageNumbers[currentPageIndex] || pageNumbers[0] || 1;
    
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
  
  useEffect(() => {
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
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {pageNumbers.length > 1 ? (
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
              <span className="text-xs text-gray-300 min-w-[90px] text-center">
                Page {pageNumbers[currentPageIndex]} ({currentPageIndex + 1}/{pageNumbers.length})
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
          ) : (
            <span className="text-xs text-gray-300">Page {pageNumbers[0]}</span>
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

// ============================================================================
// FIELD EDITOR COMPONENT
// ============================================================================

function FieldEditor({ 
  fieldName, 
  currentValue, 
  confidence, 
  aiSuggestion,
  onSave,
  onAcceptSuggestion,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentValue ?? "");
  
  const formatFieldName = (name) => {
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  };
  
  const formatValue = (value) => {
    if (value === null || value === undefined) return "(empty)";
    if (value === "") return "(empty)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };
  
  const handleSave = () => {
    onSave(fieldName, editValue);
    setIsEditing(false);
  };
  
  const handleAcceptSuggestion = () => {
    onSave(fieldName, aiSuggestion);
    onAcceptSuggestion?.(fieldName);
  };
  
  const confidencePct = Math.round((confidence || 0) * 100);
  const isLowConfidence = confidencePct < 70;
  const hasSuggestion = aiSuggestion && aiSuggestion !== currentValue;
  
  return (
    <div className={cn(
      "rounded-lg border-2 p-4 transition-all",
      isLowConfidence ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
    )}>
      {/* Field Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">
            {formatFieldName(fieldName)}
          </span>
          {isLowConfidence && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <Badge 
          variant={confidencePct >= 70 ? "success" : confidencePct >= 50 ? "warning" : "destructive"}
          className="font-mono text-xs"
        >
          {confidencePct}% confidence
        </Badge>
      </div>
      
      {/* Current Value */}
      {!isEditing ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1">Current Value:</p>
              <p className={cn(
                "text-sm p-2 rounded bg-gray-100",
                (currentValue === null || currentValue === undefined || currentValue === "") && "text-gray-400 italic"
              )}>
                {formatValue(currentValue)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditValue(currentValue ?? "");
                setIsEditing(true);
              }}
            >
              <Edit3 className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          </div>
          
          {/* AI Suggestion */}
          {hasSuggestion && (
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-medium text-purple-700">AI Suggestion</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm p-2 rounded bg-purple-50 border border-purple-200 flex-1">
                  {formatValue(aiSuggestion)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  onClick={handleAcceptSuggestion}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Accept
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Edit Mode */
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Edit Value:</p>
            {typeof currentValue === "boolean" ? (
              <div className="flex gap-2">
                <Button
                  variant={editValue === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditValue(true)}
                >
                  Yes
                </Button>
                <Button
                  variant={editValue === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditValue(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="text-sm"
                autoFocus
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REVIEW PANEL COMPONENT
// ============================================================================

function ReviewPanel({
  document,
  packet,
  editedFields,
  onFieldEdit,
  reviewerNotes,
  onNotesChange,
  onApprove,
  onReject,
  onSkip,
}) {
  const [showAllFields, setShowAllFields] = useState(false);
  
  // Extract data and likelihoods
  const extractedData = document.extraction?.choices?.[0]?.message?.parsed || 
                        document.extraction?.data || 
                        {};
  const likelihoods = document.extraction?.likelihoods || {};
  
  // Get document display name
  const splitType = document.splitType || document.classification?.splitType;
  const displayName = splitType 
    ? getSplitTypeDisplayName(splitType)
    : getCategoryDisplayName(document.classification?.category || "unknown");
  
  // Calculate overall confidence
  const allConfidences = Object.values(likelihoods).filter(v => typeof v === "number");
  const avgConfidence = allConfidences.length > 0 
    ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length 
    : 0;
  
  // Separate fields into those needing review vs others
  const { problemFields, okFields } = useMemo(() => {
    const entries = Object.entries(extractedData);
    const problem = [];
    const ok = [];
    
    for (const [key, value] of entries) {
      const confidence = likelihoods[key];
      const isEmpty = value === null || value === undefined || value === "";
      const isLowConfidence = confidence !== undefined && confidence < 0.7;
      
      // Check if this field was mentioned in review reasons
      const isMentionedInReasons = document.reviewReasons?.some(
        reason => reason.toLowerCase().includes(key.toLowerCase().replace(/_/g, " "))
      );
      
      if (isEmpty || isLowConfidence || isMentionedInReasons) {
        problem.push({ key, value, confidence, isEmpty, isLowConfidence });
      } else {
        ok.push({ key, value, confidence });
      }
    }
    
    // Sort problem fields by confidence (lowest first)
    problem.sort((a, b) => (a.confidence ?? 1) - (b.confidence ?? 1));
    
    return { problemFields: problem, okFields: ok };
  }, [extractedData, likelihoods, document.reviewReasons]);
  
  // Generate AI suggestions for problem fields
  const aiSuggestions = useMemo(() => {
    const suggestions = {};
    
    for (const { key, value, isEmpty } of problemFields) {
      // Simple heuristics for suggestions (in production, this would call an AI API)
      if (isEmpty) {
        // Look for similar data in other fields
        const lowerKey = key.toLowerCase();
        
        // Common patterns
        if (lowerKey.includes("date") && !value) {
          // Suggest document date or recording date if available
          suggestions[key] = extractedData.document_date || extractedData.recording_date || null;
        }
        if (lowerKey.includes("county") && !value) {
          suggestions[key] = extractedData.property_county || extractedData.county || null;
        }
      } else if (typeof value === "string") {
        // Suggest formatting improvements
        const trimmed = value.trim();
        
        // Name formatting: "SMITH, JOHN" -> "John Smith"
        if (key.toLowerCase().includes("name") && value.includes(",")) {
          const parts = value.split(",").map(p => p.trim());
          if (parts.length === 2) {
            suggestions[key] = `${parts[1]} ${parts[0]}`.replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g, " ");
          }
        }
        
        // ALL CAPS -> Title Case
        if (value === value.toUpperCase() && value.length > 3) {
          suggestions[key] = value.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        }
      }
    }
    
    return suggestions;
  }, [problemFields, extractedData]);
  
  // Get current value (edited or original)
  const getCurrentValue = (key) => {
    return editedFields[key] !== undefined ? editedFields[key] : extractedData[key];
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Document Header */}
      <div className="p-4 border-b bg-white shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{displayName}</h2>
            <p className="text-sm text-gray-500">
              {packet?.filename} • Pages {document.pages?.join(", ") || "N/A"}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Overall Confidence:</span>
              <Badge 
                variant={avgConfidence >= 0.7 ? "success" : avgConfidence >= 0.5 ? "warning" : "destructive"}
                className="font-mono"
              >
                {Math.round(avgConfidence * 100)}%
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Review Reasons */}
        {document.reviewReasons?.length > 0 && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Why This Needs Review:</span>
            </div>
            <ul className="text-sm text-amber-700 list-disc list-inside">
              {document.reviewReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Fields Section */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Problem Fields - PRIMARY FOCUS */}
        {problemFields.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900">
                Fields Needing Review ({problemFields.length})
              </h3>
            </div>
            <div className="space-y-3">
              {problemFields.map(({ key, confidence }) => (
                <FieldEditor
                  key={key}
                  fieldName={key}
                  currentValue={getCurrentValue(key)}
                  confidence={confidence}
                  aiSuggestion={aiSuggestions[key]}
                  onSave={onFieldEdit}
                  onAcceptSuggestion={() => {}}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Other Fields - Collapsed by default */}
        {okFields.length > 0 && (
          <div className="border-t pt-4">
            <button
              onClick={() => setShowAllFields(!showAllFields)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-3"
            >
              {showAllFields ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <Eye className="h-4 w-4" />
              <span>{showAllFields ? "Hide" : "Show"} {okFields.length} other fields</span>
            </button>
            
            {showAllFields && (
              <div className="grid grid-cols-1 gap-2">
                {okFields.map(({ key, value, confidence }) => (
                  <div key={key} className="flex items-start justify-between p-2 rounded bg-gray-50 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-gray-700">
                        {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}:
                      </span>{" "}
                      <span className="text-gray-900">
                        {value === null || value === undefined || value === "" 
                          ? <span className="text-gray-400 italic">(empty)</span>
                          : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)
                        }
                      </span>
                    </div>
                    {confidence !== undefined && (
                      <span className="text-xs text-green-600 font-mono ml-2">
                        {Math.round(confidence * 100)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Reviewer Notes */}
      <div className="p-4 border-t bg-gray-50 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Reviewer Notes</span>
        </div>
        <textarea
          value={reviewerNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add notes about this document (optional)..."
          className="w-full p-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#9e2339] focus:border-transparent"
          rows={2}
        />
      </div>
      
      {/* Action Buttons */}
      <div className="p-4 border-t bg-white shrink-0">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onSkip}
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip for Now
          </Button>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={onReject}
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={onApprove}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// QUEUE LIST COMPONENT
// ============================================================================

function QueueList({ items, currentIndex, onSelectItem }) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b bg-gray-50">
        <h3 className="font-medium text-gray-900">Review Queue</h3>
        <p className="text-xs text-gray-500 mt-0.5">{items.length} items need review</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.map((item, index) => {
          const doc = item.document;
          const splitType = doc.splitType || doc.classification?.splitType;
          const displayName = splitType 
            ? getSplitTypeDisplayName(splitType)
            : getCategoryDisplayName(doc.classification?.category || "unknown");
          
          const extractedData = doc.extraction?.choices?.[0]?.message?.parsed || {};
          const likelihoods = doc.extraction?.likelihoods || {};
          const confidences = Object.values(likelihoods).filter(v => typeof v === "number");
          const avgConf = confidences.length > 0 
            ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length * 100)
            : 0;
          
          return (
            <button
              key={doc.id}
              onClick={() => onSelectItem(index)}
              className={cn(
                "w-full text-left p-3 border-b transition-colors",
                index === currentIndex 
                  ? "bg-[#9e2339]/10 border-l-4 border-l-[#9e2339]"
                  : "hover:bg-gray-50"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {item.packet?.filename}
                  </p>
                </div>
                <Badge 
                  variant={avgConf >= 70 ? "secondary" : avgConf >= 50 ? "warning" : "destructive"}
                  className="text-xs shrink-0 ml-2"
                >
                  {avgConf}%
                </Badge>
              </div>
              {doc.reviewReasons?.length > 0 && (
                <p className="text-xs text-amber-600 mt-1 truncate">
                  {doc.reviewReasons[0]}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN REVIEW QUEUE COMPONENT
// ============================================================================

export function ReviewQueue({ packets, onApprove, onReject, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedFields, setEditedFields] = useState({});
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [completed, setCompleted] = useState(new Set());
  
  // Build flat list of items needing review
  const reviewItems = useMemo(() => {
    const items = [];
    for (const packet of packets) {
      const docs = packet.documents || [];
      for (const doc of docs) {
        if (doc.needsReview && !completed.has(doc.id)) {
          items.push({ document: doc, packet });
        }
      }
    }
    return items;
  }, [packets, completed]);
  
  // Current item
  const currentItem = reviewItems[currentIndex];
  
  // Reset edited fields when changing documents
  useEffect(() => {
    setEditedFields({});
    setReviewerNotes("");
  }, [currentItem?.document?.id]);
  
  // Handle field edit
  const handleFieldEdit = useCallback((fieldName, value) => {
    setEditedFields(prev => ({ ...prev, [fieldName]: value }));
  }, []);
  
  // Handle approve
  const handleApprove = useCallback(() => {
    if (!currentItem) return;
    
    // Mark as completed locally
    setCompleted(prev => new Set([...prev, currentItem.document.id]));
    
    // Call parent handler
    onApprove?.(currentItem.document, currentItem.packet, {
      editedFields,
      reviewerNotes,
      status: "approved",
    });
    
    // Move to next item
    if (currentIndex >= reviewItems.length - 1) {
      // Last item - close or show completion
      if (reviewItems.length <= 1) {
        onClose?.();
      }
    }
  }, [currentItem, currentIndex, reviewItems.length, editedFields, reviewerNotes, onApprove, onClose]);
  
  // Handle reject
  const handleReject = useCallback(() => {
    if (!currentItem) return;
    
    setCompleted(prev => new Set([...prev, currentItem.document.id]));
    
    onReject?.(currentItem.document, currentItem.packet, {
      editedFields,
      reviewerNotes,
      status: "rejected",
    });
    
    if (currentIndex >= reviewItems.length - 1 && reviewItems.length <= 1) {
      onClose?.();
    }
  }, [currentItem, currentIndex, reviewItems.length, editedFields, reviewerNotes, onReject, onClose]);
  
  // Handle skip
  const handleSkip = useCallback(() => {
    if (currentIndex < reviewItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (reviewItems.length > 1) {
      setCurrentIndex(0);
    }
  }, [currentIndex, reviewItems.length]);
  
  // Navigate with keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle if typing in input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      
      if (e.key === "ArrowLeft" || e.key === "k") {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      } else if (e.key === "ArrowRight" || e.key === "j") {
        setCurrentIndex(Math.min(reviewItems.length - 1, currentIndex + 1));
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, reviewItems.length]);
  
  // Empty state
  if (reviewItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All Done!</h2>
          <p className="text-gray-500 mb-4">No more documents need review.</p>
          <Button onClick={onClose}>
            Return to Results
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex">
      {/* Left: Queue List */}
      <div className="w-64 border-r bg-white shrink-0">
        <QueueList 
          items={reviewItems}
          currentIndex={currentIndex}
          onSelectItem={setCurrentIndex}
        />
      </div>
      
      {/* Center: PDF Preview */}
      <div className="flex-1 min-w-0">
        <PDFPreview
          base64Data={currentItem?.packet?.base64}
          pages={currentItem?.document?.pages}
          filename={currentItem?.packet?.filename}
        />
      </div>
      
      {/* Right: Review Panel */}
      <div className="w-[450px] border-l bg-white shrink-0">
        {currentItem && (
          <ReviewPanel
            document={currentItem.document}
            packet={currentItem.packet}
            editedFields={editedFields}
            onFieldEdit={handleFieldEdit}
            reviewerNotes={reviewerNotes}
            onNotesChange={setReviewerNotes}
            onApprove={handleApprove}
            onReject={handleReject}
            onSkip={handleSkip}
          />
        )}
      </div>
    </div>
  );
}

export default ReviewQueue;
