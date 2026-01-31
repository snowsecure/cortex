import React, { useState, useMemo, useCallback } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Edit3,
  RotateCcw,
  FileText,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Signature,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Building,
  FileCheck,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Stamp,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { getSplitTypeDisplayName } from "../hooks/usePacketPipeline";

// Field categories for grouping
const FIELD_CATEGORIES = {
  signatures: {
    label: "Signatures & Notary",
    icon: Signature,
    color: "purple",
    fields: ["signature", "notary", "witness", "seal", "acknowledgment"],
  },
  parties: {
    label: "Parties",
    icon: User,
    color: "blue",
    fields: ["grantor", "grantee", "borrower", "lender", "trustor", "trustee", "buyer", "seller", "principal", "agent", "affiant", "claimant", "creditor", "debtor"],
  },
  property: {
    label: "Property",
    icon: MapPin,
    color: "green",
    fields: ["property", "address", "parcel", "lot", "block", "subdivision", "legal_description", "county", "acreage"],
  },
  recording: {
    label: "Recording Info",
    icon: FileCheck,
    color: "orange",
    fields: ["recording", "instrument", "book", "page", "document_number"],
  },
  dates: {
    label: "Dates",
    icon: Calendar,
    color: "cyan",
    fields: ["date", "expiration", "effective", "maturity"],
  },
  financial: {
    label: "Financial",
    icon: DollarSign,
    color: "emerald",
    fields: ["amount", "loan", "price", "consideration", "tax", "fee", "premium"],
  },
  entity: {
    label: "Entity Info",
    icon: Building,
    color: "indigo",
    fields: ["entity", "corporation", "llc", "trust", "company", "organization"],
  },
};

/**
 * Categorize a field by its name
 */
function categorizeField(fieldName) {
  const lower = fieldName.toLowerCase();
  for (const [category, config] of Object.entries(FIELD_CATEGORIES)) {
    if (config.fields.some(keyword => lower.includes(keyword))) {
      return category;
    }
  }
  return "other";
}

/**
 * Format confidence as percentage with color
 */
function ConfidenceBadge({ confidence, size = "default" }) {
  const pct = Math.round((confidence || 0) * 100);
  let variant = "success";
  if (pct < 50) variant = "destructive";
  else if (pct < 75) variant = "warning";
  
  return (
    <Badge variant={variant} className={cn("font-mono", size === "sm" && "text-[10px] px-1.5 py-0")}>
      {pct}%
    </Badge>
  );
}

/**
 * Boolean field indicator (for signature present, seal present, etc.)
 */
function BooleanIndicator({ value, label, expectedTrue = true }) {
  const isCorrect = expectedTrue ? value === true : value === false;
  
  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1 rounded text-xs font-medium",
      value === true && "bg-green-100 text-green-800",
      value === false && "bg-red-100 text-red-800",
      value === null || value === undefined && "bg-gray-100 text-gray-500"
    )}>
      {value === true ? (
        <CheckCircle className="h-3.5 w-3.5" />
      ) : value === false ? (
        <XCircle className="h-3.5 w-3.5" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
      <span>{label}</span>
    </div>
  );
}

/**
 * Signature verification panel
 */
function SignaturePanel({ data, onEdit }) {
  const signatureFields = Object.entries(data).filter(([key]) => 
    key.toLowerCase().includes("signature") || 
    key.toLowerCase().includes("seal") ||
    key.toLowerCase().includes("notary")
  );

  if (signatureFields.length === 0) return null;

  return (
    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
      <div className="flex items-center gap-2 mb-3">
        <Stamp className="h-4 w-4 text-purple-600" />
        <span className="font-medium text-purple-900 text-sm">Signature Verification</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {signatureFields.map(([key, value]) => (
          <BooleanIndicator
            key={key}
            value={value}
            label={key.replace(/_/g, ' ').replace(/present$/i, '').trim()}
            expectedTrue={true}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Format field name for display
 */
function formatFieldName(name) {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Format value for display
 */
function formatValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

/**
 * Editable field row with enhanced styling
 */
function EditableField({ name, value, likelihood, isEditing, editedValue, onEdit, onStartEdit, onCancelEdit, category }) {
  const displayValue = isEditing ? editedValue : formatValue(value);
  const hasBeenEdited = editedValue !== undefined && editedValue !== formatValue(value);
  const isBoolean = typeof value === "boolean";
  const categoryConfig = FIELD_CATEGORIES[category];
  
  // Don't show boolean fields in editable section - they're in the signature panel
  if (isBoolean && (name.includes("signature") || name.includes("seal") || name.includes("notary"))) {
    return null;
  }

  return (
    <div className={cn(
      "py-2 px-3 rounded-lg transition-all border",
      likelihood !== undefined && likelihood < 0.5 && !hasBeenEdited && "bg-red-50 border-red-200",
      likelihood !== undefined && likelihood >= 0.5 && likelihood < 0.75 && !hasBeenEdited && "bg-amber-50 border-amber-200",
      likelihood === undefined || likelihood >= 0.75 && !hasBeenEdited && "bg-white border-gray-200",
      hasBeenEdited && "bg-blue-50 border-blue-300 ring-1 ring-blue-200"
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {categoryConfig && (
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              `bg-${categoryConfig.color}-500`
            )} />
          )}
          <span className="text-sm font-medium text-gray-700">
            {formatFieldName(name)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {likelihood !== undefined && <ConfidenceBadge confidence={likelihood} size="sm" />}
          {hasBeenEdited && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-blue-500">Edited</Badge>
          )}
        </div>
      </div>
      
      {isEditing ? (
        <div className="flex items-center gap-2 mt-1">
          {isBoolean ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={editedValue === "Yes" ? "default" : "outline"}
                onClick={() => onEdit(name, "Yes")}
                className="h-7"
              >
                Yes
              </Button>
              <Button
                size="sm"
                variant={editedValue === "No" ? "default" : "outline"}
                onClick={() => onEdit(name, "No")}
                className="h-7"
              >
                No
              </Button>
            </div>
          ) : (
            <Input
              value={editedValue ?? formatValue(value)}
              onChange={(e) => onEdit(name, e.target.value)}
              className="text-sm h-8"
              autoFocus
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onCancelEdit}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div 
          className="flex items-center justify-between group cursor-pointer hover:bg-white/50 rounded px-1 py-0.5 -mx-1"
          onClick={() => onStartEdit(name)}
        >
          <span className={cn(
            "text-sm break-words",
            displayValue ? "text-gray-900" : "text-gray-400 italic"
          )}>
            {displayValue || "Click to add value"}
          </span>
          <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
        </div>
      )}
    </div>
  );
}

/**
 * Collapsible field group
 */
function FieldGroup({ category, fields, editingField, editedFields, onEditField, onStartEdit, onCancelEdit }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = FIELD_CATEGORIES[category] || { label: "Other Fields", icon: FileText, color: "gray" };
  const Icon = config.icon;
  
  const lowConfidenceCount = fields.filter(f => f.likelihood !== undefined && f.likelihood < 0.75).length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors",
          `border-l-4 border-l-${config.color}-500`
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", `text-${config.color}-600`)} />
          <span className="font-medium text-sm text-gray-900">{config.label}</span>
          <Badge variant="secondary" className="text-xs">{fields.length}</Badge>
          {lowConfidenceCount > 0 && (
            <Badge variant="warning" className="text-xs">{lowConfidenceCount} low</Badge>
          )}
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      
      {isExpanded && (
        <div className="p-2 space-y-1.5 bg-white">
          {fields.map(({ key, value, likelihood }) => (
            <EditableField
              key={key}
              name={key}
              value={value}
              likelihood={likelihood}
              isEditing={editingField === key}
              editedValue={editedFields[key]}
              onEdit={onEditField}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              category={category}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Review item card with status indicators
 */
function ReviewItemCard({ item, isSelected, onClick, hasEdits }) {
  const { document, packet } = item;
  const splitType = document.splitType || document.classification?.splitType;
  const displayName = splitType 
    ? getSplitTypeDisplayName(splitType)
    : getCategoryDisplayName(document.classification?.category || "unknown");
  const confidence = document.extractionConfidence || document.classification?.confidence || 0;
  
  // Check for signature issues
  const data = document.extraction?.choices?.[0]?.message?.parsed || document.extraction?.data || {};
  const hasSignatureIssue = Object.entries(data).some(([key, value]) => 
    key.toLowerCase().includes("signature_present") && value === false
  );
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 border rounded-lg cursor-pointer transition-all",
        isSelected 
          ? "border-[#9e2339] bg-[#9e2339]/5 shadow-sm" 
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-900 truncate">
              {displayName}
            </p>
            {hasEdits && (
              <span className="w-2 h-2 rounded-full bg-blue-500" title="Has edits" />
            )}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {packet.filename}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ConfidenceBadge confidence={confidence} size="sm" />
          {hasSignatureIssue && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Sig Issue
            </Badge>
          )}
        </div>
      </div>
      
      {document.reviewReasons?.length > 0 && (
        <div className="mt-2 text-xs text-amber-700 line-clamp-2 bg-amber-50 rounded px-2 py-1">
          {document.reviewReasons[0]}
        </div>
      )}
    </div>
  );
}

/**
 * Enhanced PDF Preview with zoom
 */
function PDFPreview({ base64, filename, pages }) {
  const [zoom, setZoom] = useState(100);
  
  if (!base64) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 text-gray-500">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No preview available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 text-white text-sm">
        <span className="truncate font-medium">{filename}</span>
        <div className="flex items-center gap-1">
          {pages && pages.length > 0 && (
            <Badge variant="secondary" className="mr-2">
              Pages: {Array.isArray(pages) ? pages.join(", ") : pages}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-gray-700"
            onClick={() => setZoom(Math.max(50, zoom - 25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs w-12 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-gray-700"
            onClick={() => setZoom(Math.min(200, zoom + 25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-gray-700"
            onClick={() => setZoom(100)}
            title="Reset zoom"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* PDF iframe */}
      <div className="flex-1 min-h-0 overflow-auto bg-gray-700 p-2">
        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
          <iframe
            src={base64}
            className="w-full bg-white rounded shadow-lg"
            style={{ height: '100vh', minHeight: '600px' }}
            title="PDF Preview"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Reviewer notes panel
 */
function ReviewerNotes({ notes, onNotesChange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-100"
      >
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MessageSquare className="h-4 w-4" />
          <span>Reviewer Notes</span>
          {notes && <span className="w-2 h-2 rounded-full bg-blue-500" />}
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isExpanded && (
        <div className="px-4 pb-3">
          <textarea
            value={notes || ""}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add notes about this document..."
            className="w-full h-20 text-sm border border-gray-300 rounded-md p-2 resize-none focus:ring-2 focus:ring-[#9e2339] focus:border-transparent"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Review detail panel with grouped fields
 */
function ReviewDetailPanel({ item, editedFields, reviewerNotes, onEditField, onNotesChange, onApprove, onReject, onResetEdits }) {
  const [editingField, setEditingField] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyLowConf, setShowOnlyLowConf] = useState(false);
  
  const { document, packet } = item;
  const data = document.extraction?.choices?.[0]?.message?.parsed || 
               document.extraction?.data || 
               {};
  const likelihoods = document.extraction?.likelihoods || {};
  
  const splitType = document.splitType || document.classification?.splitType;
  const displayName = splitType 
    ? getSplitTypeDisplayName(splitType)
    : getCategoryDisplayName(document.classification?.category || "unknown");
  
  // Group and filter fields
  const groupedFields = useMemo(() => {
    const groups = {};
    
    Object.entries(data).forEach(([key, value]) => {
      // Apply search filter
      if (searchTerm && !key.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !formatValue(value).toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }
      
      // Apply low confidence filter
      const likelihood = likelihoods[key];
      if (showOnlyLowConf && (likelihood === undefined || likelihood >= 0.75)) {
        return;
      }
      
      const category = categorizeField(key);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push({ key, value, likelihood });
    });
    
    // Sort fields within each group by likelihood
    Object.values(groups).forEach(group => {
      group.sort((a, b) => {
        if (a.likelihood !== undefined && b.likelihood !== undefined) {
          return a.likelihood - b.likelihood;
        }
        if (a.likelihood !== undefined) return -1;
        return 0;
      });
    });
    
    return groups;
  }, [data, likelihoods, searchTerm, showOnlyLowConf]);

  const hasEdits = Object.keys(editedFields).length > 0;
  const totalFields = Object.keys(data).length;
  const lowConfFields = Object.entries(likelihoods).filter(([_, v]) => v < 0.75).length;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">
              {displayName}
            </h3>
            <p className="text-sm text-gray-500">{packet.filename}</p>
          </div>
          <div className="text-right">
            <ConfidenceBadge confidence={document.extractionConfidence || document.classification?.confidence} />
            <p className="text-xs text-gray-500 mt-1">
              {totalFields} fields • {lowConfFields} low confidence
            </p>
          </div>
        </div>
        
        {/* Review reasons */}
        {document.reviewReasons?.length > 0 && (
          <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Review Required</p>
                <ul className="mt-1 text-sm text-amber-700 space-y-0.5">
                  {document.reviewReasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-amber-400">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Signature verification panel */}
      <div className="px-4 pt-3">
        <SignaturePanel data={data} onEdit={onEditField} />
      </div>

      {/* Search and filter */}
      <div className="px-4 py-3 border-b border-gray-200 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search fields..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showOnlyLowConf ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyLowConf(!showOnlyLowConf)}
            className="h-7 text-xs"
          >
            <Filter className="h-3 w-3 mr-1" />
            Low Confidence Only
          </Button>
          {showOnlyLowConf && (
            <span className="text-xs text-gray-500">
              Showing {Object.values(groupedFields).flat().length} of {totalFields} fields
            </span>
          )}
        </div>
      </div>

      {/* Grouped fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {Object.entries(groupedFields).map(([category, fields]) => (
          <FieldGroup
            key={category}
            category={category}
            fields={fields}
            editingField={editingField}
            editedFields={editedFields}
            onEditField={onEditField}
            onStartEdit={(name) => setEditingField(name)}
            onCancelEdit={() => setEditingField(null)}
          />
        ))}
        
        {Object.keys(groupedFields).length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Eye className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No fields match your filters</p>
          </div>
        )}
      </div>

      {/* Reviewer notes */}
      <ReviewerNotes notes={reviewerNotes} onNotesChange={onNotesChange} />

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {hasEdits && (
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="text-blue-600 font-medium">
              {Object.keys(editedFields).length} field(s) edited
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetEdits}
              className="text-gray-500 h-7"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset All
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => onReject(item)}
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <X className="h-4 w-4 mr-1.5" />
            Reject
          </Button>
          <Button
            onClick={() => onApprove(item, editedFields)}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-1.5" />
            {hasEdits ? "Save & Approve" : "Approve"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Session progress bar
 */
function SessionProgress({ total, approved, rejected }) {
  const remaining = total - approved - rejected;
  const approvedPct = total > 0 ? (approved / total) * 100 : 0;
  const rejectedPct = total > 0 ? (rejected / total) * 100 : 0;
  
  return (
    <div className="px-4 py-2 bg-gray-100 border-b">
      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
        <span>Session Progress</span>
        <span>{remaining} remaining</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
        <div 
          className="bg-green-500 transition-all" 
          style={{ width: `${approvedPct}%` }}
        />
        <div 
          className="bg-red-500 transition-all" 
          style={{ width: `${rejectedPct}%` }}
        />
      </div>
      <div className="flex items-center justify-center gap-4 mt-1 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {approved} approved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {rejected} rejected
        </span>
      </div>
    </div>
  );
}

/**
 * Main review queue component
 */
export function ReviewQueue({ packets, onApprove, onReject, onClose }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editedFieldsByDoc, setEditedFieldsByDoc] = useState({});
  const [reviewerNotesByDoc, setReviewerNotesByDoc] = useState({});
  const [sessionStats, setSessionStats] = useState({ approved: 0, rejected: 0 });
  const [filterCategory, setFilterCategory] = useState("all");

  /**
   * Get all items needing review
   */
  const reviewItems = useMemo(() => {
    const items = [];
    
    for (const packet of packets) {
      for (const document of packet.documents || []) {
        if (document.needsReview) {
          items.push({ packet, document });
        }
      }
    }
    
    // Sort by confidence (lowest first)
    return items.sort((a, b) => 
      (a.document.extractionConfidence || a.document.classification?.confidence || 0) - 
      (b.document.extractionConfidence || b.document.classification?.confidence || 0)
    );
  }, [packets]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (filterCategory === "all") return reviewItems;
    
    return reviewItems.filter(item => {
      const category = item.document.classification?.category || "other";
      if (filterCategory === "signatures") {
        const data = item.document.extraction?.choices?.[0]?.message?.parsed || {};
        return Object.entries(data).some(([key, value]) => 
          key.toLowerCase().includes("signature_present") && value === false
        );
      }
      if (filterCategory === "low_confidence") {
        return (item.document.extractionConfidence || 0) < 0.5;
      }
      return true;
    });
  }, [reviewItems, filterCategory]);

  const selectedItem = filteredItems[selectedIndex];
  const currentDocId = selectedItem?.document?.id;
  const currentEditedFields = editedFieldsByDoc[currentDocId] || {};
  const currentNotes = reviewerNotesByDoc[currentDocId] || "";

  const handleEditField = useCallback((fieldName, value) => {
    if (!currentDocId) return;
    setEditedFieldsByDoc(prev => ({
      ...prev,
      [currentDocId]: {
        ...(prev[currentDocId] || {}),
        [fieldName]: value,
      },
    }));
  }, [currentDocId]);

  const handleNotesChange = useCallback((notes) => {
    if (!currentDocId) return;
    setReviewerNotesByDoc(prev => ({
      ...prev,
      [currentDocId]: notes,
    }));
  }, [currentDocId]);

  const handleResetEdits = useCallback(() => {
    if (!currentDocId) return;
    setEditedFieldsByDoc(prev => {
      const next = { ...prev };
      delete next[currentDocId];
      return next;
    });
  }, [currentDocId]);

  const handleNext = () => {
    if (selectedIndex < filteredItems.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handlePrev = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleApprove = (item, editedFields) => {
    const notes = reviewerNotesByDoc[item.document?.id];
    onApprove?.({ ...item, editedFields, reviewerNotes: notes });
    
    // Update stats
    setSessionStats(prev => ({ ...prev, approved: prev.approved + 1 }));
    
    // Clear state for this document
    if (item.document?.id) {
      setEditedFieldsByDoc(prev => {
        const next = { ...prev };
        delete next[item.document.id];
        return next;
      });
      setReviewerNotesByDoc(prev => {
        const next = { ...prev };
        delete next[item.document.id];
        return next;
      });
    }
    
    // Move to next item if available
    if (selectedIndex >= filteredItems.length - 1 && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleReject = (item) => {
    const notes = reviewerNotesByDoc[item.document?.id];
    onReject?.({ ...item, reviewerNotes: notes });
    
    // Update stats
    setSessionStats(prev => ({ ...prev, rejected: prev.rejected + 1 }));
    
    // Clear state for this document
    if (item.document?.id) {
      setEditedFieldsByDoc(prev => {
        const next = { ...prev };
        delete next[item.document.id];
        return next;
      });
      setReviewerNotesByDoc(prev => {
        const next = { ...prev };
        delete next[item.document.id];
        return next;
      });
    }
    
    // Move to next item if available
    if (selectedIndex >= filteredItems.length - 1 && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'ArrowLeft' || e.key === 'k') {
        handlePrev();
      } else if (e.key === 'ArrowRight' || e.key === 'j') {
        handleNext();
      } else if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
        if (selectedItem) handleApprove(selectedItem, currentEditedFields);
      } else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        if (selectedItem) handleReject(selectedItem);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, selectedItem, currentEditedFields]);

  if (reviewItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gradient-to-b from-green-50 to-white">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">All Clear!</p>
          <p className="text-sm mt-1 text-gray-500">No items require review</p>
          {sessionStats.approved + sessionStats.rejected > 0 && (
            <p className="text-sm mt-3 text-gray-600">
              Session: {sessionStats.approved} approved, {sessionStats.rejected} rejected
            </p>
          )}
          <Button variant="outline" onClick={onClose} className="mt-6">
            Close Review Queue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Human Review Queue</h2>
            <p className="text-xs text-gray-500">
              Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">A</kbd> to approve, 
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-600 ml-1">R</kbd> to reject, 
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-600 ml-1">←→</kbd> to navigate
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { value: "all", label: "All" },
              { value: "signatures", label: "Sig Issues" },
              { value: "low_confidence", label: "Low Conf" },
            ].map(opt => (
              <Button
                key={opt.value}
                variant={filterCategory === opt.value ? "default" : "ghost"}
                size="sm"
                onClick={() => { setFilterCategory(opt.value); setSelectedIndex(0); }}
                className="h-7 text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
          
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              disabled={selectedIndex === 0}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {selectedIndex + 1} / {filteredItems.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              disabled={selectedIndex >= filteredItems.length - 1}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <SessionProgress 
        total={reviewItems.length} 
        approved={sessionStats.approved} 
        rejected={sessionStats.rejected} 
      />

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel - Review list */}
        <div className="w-72 border-r border-gray-200 overflow-y-auto bg-white">
          <div className="p-3 space-y-2">
            {filteredItems.map((item, index) => (
              <ReviewItemCard
                key={`${item.packet.id}-${item.document.id}`}
                item={item}
                isSelected={index === selectedIndex}
                onClick={() => setSelectedIndex(index)}
                hasEdits={!!editedFieldsByDoc[item.document.id]}
              />
            ))}
          </div>
        </div>

        {/* Center panel - PDF Preview */}
        <div className="flex-1 min-w-0">
          {selectedItem && (
            <PDFPreview
              base64={selectedItem.packet.base64}
              filename={selectedItem.packet.filename}
              pages={selectedItem.document.pages}
            />
          )}
        </div>

        {/* Right panel - Review details */}
        <div className="w-[420px] border-l border-gray-200 bg-white shadow-lg">
          {selectedItem && (
            <ReviewDetailPanel
              item={selectedItem}
              editedFields={currentEditedFields}
              reviewerNotes={currentNotes}
              onEditField={handleEditField}
              onNotesChange={handleNotesChange}
              onResetEdits={handleResetEdits}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewQueue;
