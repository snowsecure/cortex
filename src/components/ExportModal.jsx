import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  X,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  Save,
  Trash2,
  Settings2,
  Eye,
  Copy,
  GripVertical,
  Filter,
  Columns,
  Package,
  FileCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { cn, getMergedExtractionData, formatDateTimeCST } from "../lib/utils";
import { useToast } from "./ui/toast";
import { PacketStatus } from "../hooks/useBatchQueue";
import { getCategoryDisplayName, DOCUMENT_CATEGORIES } from "../lib/documentCategories";
import { getSplitTypeDisplayName } from "../hooks/usePacketPipeline";

// Export formats
const EXPORT_FORMATS = [
  { id: "json", label: "JSON", icon: FileJson, description: "Hierarchical structure, best for APIs" },
  { id: "csv", label: "CSV", icon: FileSpreadsheet, description: "Flat table, one row per document" },
  { id: "csv_grouped", label: "CSV (By Type)", icon: FileSpreadsheet, description: "Separate CSV per document type" },
  { id: "summary", label: "Summary Report", icon: FileText, description: "Human-readable text summary" },
];

// Filter options
const FILTER_OPTIONS = [
  { id: "all", label: "All Documents", description: "Include all processed documents" },
  { id: "completed", label: "Completed Only", description: "Exclude documents needing review" },
  { id: "reviewed", label: "Reviewed Only", description: "Only include approved/rejected documents" },
  { id: "high_confidence", label: "High Confidence", description: "Only documents with >75% confidence" },
];

// Field categories for organization
const FIELD_CATEGORIES = {
  metadata: {
    label: "Document Metadata",
    fields: [
      { id: "packet_id", label: "Packet ID" },
      { id: "packet_filename", label: "Source Filename" },
      { id: "document_id", label: "Document ID" },
      { id: "document_type", label: "Document Type" },
      { id: "document_type_display", label: "Document Type (Display)" },
      { id: "pages", label: "Page Numbers" },
      { id: "split_type", label: "Split Type" },
    ],
  },
  confidence: {
    label: "Confidence & Review",
    fields: [
      { id: "extraction_confidence", label: "Extraction Confidence" },
      { id: "classification_confidence", label: "Classification Confidence" },
      { id: "needs_review", label: "Needs Review" },
      { id: "review_reasons", label: "Review Reasons" },
      { id: "review_status", label: "Review Status" },
      { id: "reviewer_notes", label: "Reviewer Notes" },
    ],
  },
  recording: {
    label: "Recording Information",
    fields: [
      { id: "recording_date", label: "Recording Date" },
      { id: "recording_book_number", label: "Book Number" },
      { id: "recording_page_number", label: "Page Number" },
      { id: "recording_instrument_number", label: "Instrument Number" },
      { id: "recording_county", label: "Recording County" },
    ],
  },
  property: {
    label: "Property Information",
    fields: [
      { id: "property_street_address", label: "Street Address" },
      { id: "property_city", label: "City" },
      { id: "property_state", label: "State" },
      { id: "property_zip", label: "ZIP Code" },
      { id: "property_county", label: "County" },
      { id: "parcel_identification_number", label: "Parcel/APN" },
      { id: "legal_description", label: "Legal Description" },
      { id: "lot_number", label: "Lot" },
      { id: "block_number", label: "Block" },
      { id: "subdivision_name", label: "Subdivision" },
    ],
  },
  parties: {
    label: "Parties",
    fields: [
      { id: "grantor_name", label: "Grantor/Seller" },
      { id: "grantee_name", label: "Grantee/Buyer" },
      { id: "borrower_name", label: "Borrower" },
      { id: "lender_name", label: "Lender" },
      { id: "trustee_name", label: "Trustee" },
      { id: "beneficiary_name", label: "Beneficiary" },
    ],
  },
  financial: {
    label: "Financial",
    fields: [
      { id: "consideration_amount", label: "Consideration/Price" },
      { id: "loan_amount", label: "Loan Amount" },
      { id: "interest_rate", label: "Interest Rate" },
      { id: "transfer_tax", label: "Transfer Tax" },
    ],
  },
  signatures: {
    label: "Signatures & Notary",
    fields: [
      { id: "grantor_signature_present", label: "Grantor Signature" },
      { id: "grantee_signature_present", label: "Grantee Signature" },
      { id: "notary_signature_present", label: "Notary Signature" },
      { id: "notary_seal_present", label: "Notary Seal" },
      { id: "notary_name", label: "Notary Name" },
      { id: "notary_commission_expiration", label: "Notary Expiration" },
    ],
  },
  all_extracted: {
    label: "All Extracted Fields",
    fields: [], // Will be populated dynamically
  },
};

// Default export templates
const DEFAULT_TEMPLATES = [
  {
    id: "basic",
    name: "Basic Export",
    description: "Essential fields only",
    format: "csv",
    filter: "all",
    fields: ["packet_filename", "document_type_display", "pages", "extraction_confidence", "needs_review"],
    includeAllExtracted: false,
  },
  {
    id: "full",
    name: "Full Export",
    description: "All metadata + extracted data",
    format: "json",
    filter: "all",
    fields: ["packet_id", "packet_filename", "document_id", "document_type", "pages", "extraction_confidence", "needs_review", "review_reasons"],
    includeAllExtracted: true,
  },
  {
    id: "recording",
    name: "Recording Info",
    description: "Focus on recording details",
    format: "csv",
    filter: "completed",
    fields: ["packet_filename", "document_type_display", "recording_date", "recording_book_number", "recording_page_number", "recording_instrument_number", "recording_county"],
    includeAllExtracted: false,
  },
  {
    id: "review",
    name: "Review Report",
    description: "Documents needing attention",
    format: "summary",
    filter: "all",
    fields: ["packet_filename", "document_type_display", "extraction_confidence", "needs_review", "review_reasons"],
    includeAllExtracted: false,
  },
];

/**
 * Flatten nested object for CSV export
 */
function flattenObject(obj, prefix = "") {
  const result = {};
  
  for (const [key, value] of Object.entries(obj || {})) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    
    if (value === null || value === undefined) {
      result[newKey] = "";
    } else if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = value.join("; ");
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Convert data to CSV string
 */
function convertToCSV(data, columns) {
  const header = columns.map(col => `"${col.replace(/"/g, '""')}"`).join(",");
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      return `"${stringValue.replace(/"/g, '""')}"`;
    }).join(",")
  );
  
  return [header, ...rows].join("\n");
}

/**
 * Download data as file
 */
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Field selection checkbox
 */
function FieldCheckbox({ field, checked, onChange, disabled }) {
  return (
    <label className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer",
      disabled && "opacity-50 cursor-not-allowed"
    )}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(field.id, e.target.checked)}
        disabled={disabled}
        className="rounded border-gray-300 text-[#9e2339] focus:ring-[#9e2339]"
      />
      <span className="text-sm text-gray-700">{field.label}</span>
    </label>
  );
}

/**
 * Collapsible field category
 */
function FieldCategory({ category, config, selectedFields, onFieldToggle, onSelectAll, onDeselectAll }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const selectedCount = config.fields.filter(f => selectedFields.includes(f.id)).length;
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          <span className="font-medium text-sm text-gray-900">{config.label}</span>
          <Badge variant="secondary" className="text-xs">
            {selectedCount}/{config.fields.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onSelectAll(category)}>
            All
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onDeselectAll(category)}>
            None
          </Button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-2 grid grid-cols-2 gap-1">
          {config.fields.map(field => (
            <FieldCheckbox
              key={field.id}
              field={field}
              checked={selectedFields.includes(field.id)}
              onChange={onFieldToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Export preview panel
 */
function ExportPreview({ data, format, maxRows = 5 }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <Eye className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>No data to preview</p>
      </div>
    );
  }

  if (format === "json") {
    const preview = data.slice(0, maxRows);
    return (
      <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-auto max-h-64 font-mono">
        {JSON.stringify(preview, null, 2)}
      </pre>
    );
  }

  if (format === "summary") {
    return (
      <div className="text-sm bg-gray-50 p-3 rounded-lg overflow-auto max-h-64 font-mono whitespace-pre-wrap">
        {data.slice(0, 500)}...
      </div>
    );
  }

  // CSV preview as table
  const columns = Object.keys(data[0] || {}).slice(0, 6);
  const rows = data.slice(0, maxRows);

  return (
    <div className="overflow-auto max-h-64 border rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {columns.map(col => (
              <th key={col} className="px-2 py-1.5 text-left font-medium text-gray-700 border-b">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
            {Object.keys(data[0] || {}).length > 6 && (
              <th className="px-2 py-1.5 text-left font-medium text-gray-400 border-b">
                +{Object.keys(data[0] || {}).length - 6} more
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map(col => (
                <td key={col} className="px-2 py-1.5 text-gray-600 truncate max-w-[150px]">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > maxRows && (
        <div className="px-2 py-1.5 bg-gray-50 text-xs text-gray-500 text-center">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
}

/**
 * Template selector/manager
 */
function TemplateManager({ templates, activeTemplate, onSelect, onSave, onDelete, currentConfig }) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const handleSave = () => {
    if (newTemplateName.trim()) {
      onSave({
        id: `custom_${Date.now()}`,
        name: newTemplateName.trim(),
        description: "Custom template",
        ...currentConfig,
      });
      setNewTemplateName("");
      setShowSaveDialog(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Templates</span>
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowSaveDialog(true)}>
          <Save className="h-3.5 w-3.5 mr-1" />
          Save Current
        </Button>
      </div>
      
      {showSaveDialog && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
          <Input
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="Template name..."
            className="h-8 text-sm"
            autoFocus
          />
          <Button size="sm" className="h-8" onClick={handleSave}>Save</Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowSaveDialog(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-2">
        {templates.map(template => (
          <div
            key={template.id}
            onClick={() => onSelect(template)}
            className={cn(
              "p-2 border rounded-lg cursor-pointer transition-all",
              activeTemplate?.id === template.id
                ? "border-[#9e2339] bg-[#9e2339]/5"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">{template.name}</span>
              {template.id.startsWith("custom_") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-red-500"
                  onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main export modal component
 */
export function ExportModal({ packets, stats, isOpen, onClose }) {
  const toast = useToast();

  // State
  const [format, setFormat] = useState("csv");
  const [filter, setFilter] = useState("all");
  const [selectedFields, setSelectedFields] = useState([
    "packet_filename", "document_type_display", "pages", "extraction_confidence", "needs_review"
  ]);
  const [includeAllExtracted, setIncludeAllExtracted] = useState(true);
  const [includeConfidenceScores, setIncludeConfidenceScores] = useState(false);
  const [templates, setTemplates] = useState(() => {
    const saved = localStorage.getItem("export_templates");
    return saved ? [...DEFAULT_TEMPLATES, ...JSON.parse(saved)] : DEFAULT_TEMPLATES;
  });
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("format");

  // Get filtered packets
  const filteredPackets = useMemo(() => {
    let result = packets.filter(p => 
      p.status === PacketStatus.COMPLETED || 
      p.status === PacketStatus.NEEDS_REVIEW
    );
    
    if (filter === "completed") {
      result = result.filter(p => p.status === PacketStatus.COMPLETED);
    } else if (filter === "high_confidence") {
      result = result.map(p => ({
        ...p,
        documents: p.documents?.filter(d => (d.extractionConfidence || 0) >= 0.75)
      })).filter(p => p.documents?.length > 0);
    }
    
    return result;
  }, [packets, filter]);

  // Collect all unique extracted fields from data
  const allExtractedFields = useMemo(() => {
    const fieldSet = new Set();
    
    for (const packet of filteredPackets) {
      for (const doc of packet.documents || []) {
        const { data } = getMergedExtractionData(doc);
        Object.keys(data).forEach(key => fieldSet.add(key));
      }
    }
    
    return Array.from(fieldSet).sort().map(id => ({ id, label: id.replace(/_/g, ' ') }));
  }, [filteredPackets]);

  // Build export data
  const exportData = useMemo(() => {
    const rows = [];
    
    for (const packet of filteredPackets) {
      for (const doc of packet.documents || []) {
        const { data: extractedData, likelihoods, editedFields } = getMergedExtractionData(doc);
        
        const row = {
          packet_id: packet.id,
          packet_filename: packet.filename,
          document_id: doc.id,
          document_type: doc.classification?.category,
          document_type_display: getCategoryDisplayName(doc.classification?.category),
          pages: Array.isArray(doc.pages) ? doc.pages.join("-") : doc.pages,
          split_type: doc.splitType,
          extraction_confidence: doc.extractionConfidence,
          classification_confidence: doc.classification?.confidence,
          needs_review: doc.needsReview,
          review_reasons: (doc.reviewReasons || []).join("; "),
          review_status: doc.status === "reviewed" ? "reviewed" : doc.status === "rejected" ? "rejected" : doc.reviewStatus || "pending",
          reviewer_notes: doc.reviewerNotes || "",
          corrected_fields: Object.keys(editedFields).length > 0 ? Object.keys(editedFields).join("; ") : "",
        };
        
        // Add selected extracted fields
        if (includeAllExtracted) {
          Object.assign(row, extractedData);
          
          // Add confidence scores for each field
          if (includeConfidenceScores) {
            Object.entries(likelihoods).forEach(([key, value]) => {
              row[`${key}_confidence`] = value;
            });
          }
        }
        
        rows.push(row);
      }
    }
    
    return rows;
  }, [filteredPackets, includeAllExtracted, includeConfidenceScores]);

  // Estimate export size (rough: avg ~200 bytes per field per row for CSV, ~400 for JSON)
  const estimatedSize = useMemo(() => {
    if (exportData.length === 0) return null;
    const colCount = Object.keys(exportData[0] || {}).length || 1;
    const avgBytesPerRow = format === "json" ? colCount * 400 : colCount * 200;
    const totalBytes = exportData.length * avgBytesPerRow;
    if (totalBytes < 1024) return `~${totalBytes} B`;
    if (totalBytes < 1024 * 1024) return `~${(totalBytes / 1024).toFixed(0)} KB`;
    return `~${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [exportData, format]);

  // Document count by type
  const documentCounts = useMemo(() => {
    const counts = {};
    for (const packet of filteredPackets) {
      for (const doc of packet.documents || []) {
        const type = doc.classification?.category || "unknown";
        counts[type] = (counts[type] || 0) + 1;
      }
    }
    return counts;
  }, [filteredPackets]);

  // Handle field toggle
  const handleFieldToggle = useCallback((fieldId, checked) => {
    setSelectedFields(prev => 
      checked ? [...prev, fieldId] : prev.filter(f => f !== fieldId)
    );
  }, []);

  // Handle select all/none for category
  const handleSelectAll = useCallback((category) => {
    const categoryFields = FIELD_CATEGORIES[category]?.fields.map(f => f.id) || [];
    setSelectedFields(prev => [...new Set([...prev, ...categoryFields])]);
  }, []);

  const handleDeselectAll = useCallback((category) => {
    const categoryFields = FIELD_CATEGORIES[category]?.fields.map(f => f.id) || [];
    setSelectedFields(prev => prev.filter(f => !categoryFields.includes(f)));
  }, []);

  // Apply template
  const handleApplyTemplate = useCallback((template) => {
    setActiveTemplate(template);
    setFormat(template.format);
    setFilter(template.filter);
    setSelectedFields(template.fields);
    setIncludeAllExtracted(template.includeAllExtracted);
  }, []);

  // Save template
  const handleSaveTemplate = useCallback((template) => {
    const customTemplates = templates.filter(t => t.id.startsWith("custom_"));
    const newCustomTemplates = [...customTemplates, template];
    localStorage.setItem("export_templates", JSON.stringify(newCustomTemplates));
    setTemplates([...DEFAULT_TEMPLATES, ...newCustomTemplates]);
  }, [templates]);

  // Delete template
  const handleDeleteTemplate = useCallback((templateId) => {
    const customTemplates = templates.filter(t => t.id.startsWith("custom_") && t.id !== templateId);
    localStorage.setItem("export_templates", JSON.stringify(customTemplates));
    setTemplates([...DEFAULT_TEMPLATES, ...customTemplates]);
    if (activeTemplate?.id === templateId) {
      setActiveTemplate(null);
    }
  }, [templates, activeTemplate]);

  // Execute export — uses requestAnimationFrame yielding for large datasets to keep UI responsive
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

      // Helper: yield to the main thread periodically for large datasets
      const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

      if (format === "json") {
        const jsonData = {
          export_date: new Date().toISOString(),
          export_version: "2.0",
          filter_applied: filter,
          summary: {
            total_packets: filteredPackets.length,
            total_documents: exportData.length,
            documents_by_type: documentCounts,
          },
          documents: exportData,
        };
        // Yield before heavy serialization for large datasets
        if (exportData.length > 500) await yieldToMain();
        const content = JSON.stringify(jsonData, null, 2);
        downloadFile(content, `stewart-export-${timestamp}.json`, "application/json");
      } 
      else if (format === "csv") {
        let columns = [...selectedFields];
        if (includeAllExtracted) {
          const extractedCols = allExtractedFields.map(f => f.id);
          columns = [...columns, ...extractedCols.filter(c => !columns.includes(c))];
        }
        
        // For large datasets, build CSV in chunks to avoid blocking
        if (exportData.length > 1000) {
          await yieldToMain();
          const CHUNK = 500;
          const header = columns.map(col => `"${col.replace(/"/g, '""')}"`).join(",");
          const parts = [header];
          for (let i = 0; i < exportData.length; i += CHUNK) {
            const slice = exportData.slice(i, i + CHUNK);
            const csvChunk = slice.map(row =>
              columns.map(col => {
                const value = row[col];
                if (value === null || value === undefined) return "";
                const s = String(value);
                return `"${s.replace(/"/g, '""')}"`;
              }).join(",")
            ).join("\n");
            parts.push(csvChunk);
            if (i + CHUNK < exportData.length) await yieldToMain();
          }
          downloadFile(parts.join("\n"), `stewart-export-${timestamp}.csv`, "text/csv");
        } else {
          const csv = convertToCSV(exportData, columns);
          downloadFile(csv, `stewart-export-${timestamp}.csv`, "text/csv");
        }
      }
      else if (format === "csv_grouped") {
        const byType = {};
        exportData.forEach(row => {
          const type = row.document_type || "other";
          if (!byType[type]) byType[type] = [];
          byType[type].push(row);
        });
        
        for (const [type, rows] of Object.entries(byType)) {
          const columns = Object.keys(rows[0] || {});
          const csv = convertToCSV(rows, columns);
          downloadFile(csv, `stewart-${type}-${timestamp}.csv`, "text/csv");
          await yieldToMain(); // Yield between file downloads
        }
      }
      else if (format === "summary") {
        let summary = `STEWART INGESTION ENGINE - EXPORT SUMMARY\n`;
        summary += `Generated: ${formatDateTimeCST(new Date())} CST\n`;
        summary += `${"=".repeat(60)}\n\n`;
        
        summary += `OVERVIEW\n`;
        summary += `---------\n`;
        summary += `Total Packets: ${filteredPackets.length}\n`;
        summary += `Total Documents: ${exportData.length}\n`;
        summary += `Documents Needing Review: ${exportData.filter(d => d.needs_review).length}\n\n`;
        
        summary += `DOCUMENTS BY TYPE\n`;
        summary += `-----------------\n`;
        Object.entries(documentCounts).forEach(([type, count]) => {
          summary += `${getCategoryDisplayName(type)}: ${count}\n`;
        });
        summary += `\n`;
        
        summary += `REVIEW REQUIRED\n`;
        summary += `---------------\n`;
        exportData.filter(d => d.needs_review).forEach(doc => {
          summary += `\n• ${doc.packet_filename} - ${doc.document_type_display}\n`;
          summary += `  Confidence: ${Math.round((doc.extraction_confidence || 0) * 100)}%\n`;
          summary += `  Reasons: ${doc.review_reasons || "N/A"}\n`;
        });
        
        downloadFile(summary, `stewart-summary-${timestamp}.txt`, "text/plain");
      }
      
      toast.success("Export complete");
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed: " + error.message);
      setIsExporting(false);
    }
  }, [format, filter, selectedFields, includeAllExtracted, includeConfidenceScores, exportData, filteredPackets, documentCounts, allExtractedFields, onClose, toast]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#9e2339] flex items-center justify-center">
              <Download className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Export Data</h2>
              <p className="text-sm text-gray-500">
                {filteredPackets.length} packets • {exportData.length} documents
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {[
            { id: "format", label: "Format", icon: FileText },
            { id: "fields", label: "Fields", icon: Columns },
            { id: "filter", label: "Filter", icon: Filter },
            { id: "templates", label: "Templates", icon: Package },
            { id: "preview", label: "Preview", icon: Eye },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-[#9e2339] text-[#9e2339]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "format" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {EXPORT_FORMATS.map(fmt => (
                  <div
                    key={fmt.id}
                    onClick={() => setFormat(fmt.id)}
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer transition-all",
                      format === fmt.id
                        ? "border-[#9e2339] bg-[#9e2339]/5 ring-1 ring-[#9e2339]"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        format === fmt.id ? "bg-[#9e2339] text-white" : "bg-gray-100 text-gray-600"
                      )}>
                        <fmt.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{fmt.label}</p>
                        <p className="text-xs text-gray-500">{fmt.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAllExtracted}
                    onChange={(e) => setIncludeAllExtracted(e.target.checked)}
                    className="rounded border-gray-300 text-[#9e2339] focus:ring-[#9e2339]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Include all extracted fields</span>
                    <p className="text-xs text-gray-500">Add all data extracted from documents</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeConfidenceScores}
                    onChange={(e) => setIncludeConfidenceScores(e.target.checked)}
                    className="rounded border-gray-300 text-[#9e2339] focus:ring-[#9e2339]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Include field confidence scores</span>
                    <p className="text-xs text-gray-500">Add _confidence column for each extracted field</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === "fields" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">
                Select which fields to include in your export. Extracted data fields are controlled by the checkbox above.
              </p>
              
              {Object.entries(FIELD_CATEGORIES).filter(([k]) => k !== 'all_extracted').map(([key, config]) => (
                <FieldCategory
                  key={key}
                  category={key}
                  config={config}
                  selectedFields={selectedFields}
                  onFieldToggle={handleFieldToggle}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                />
              ))}
            </div>
          )}

          {activeTab === "filter" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">
                Choose which documents to include in the export.
              </p>
              
              <div className="space-y-2">
                {FILTER_OPTIONS.map(opt => (
                  <label
                    key={opt.id}
                    className={cn(
                      "flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all",
                      filter === opt.id
                        ? "border-[#9e2339] bg-[#9e2339]/5"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="filter"
                      value={opt.id}
                      checked={filter === opt.id}
                      onChange={() => setFilter(opt.id)}
                      className="mt-0.5 text-[#9e2339] focus:ring-[#9e2339]"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                      <p className="text-xs text-gray-500">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Current Selection</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500">Packets</p>
                    <p className="font-semibold">{filteredPackets.length}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500">Documents</p>
                    <p className="font-semibold">{exportData.length}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500">Need Review</p>
                    <p className="font-semibold text-amber-600">{exportData.filter(d => d.needs_review).length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "templates" && (
            <TemplateManager
              templates={templates}
              activeTemplate={activeTemplate}
              onSelect={handleApplyTemplate}
              onSave={handleSaveTemplate}
              onDelete={handleDeleteTemplate}
              currentConfig={{
                format,
                filter,
                fields: selectedFields,
                includeAllExtracted,
              }}
            />
          )}

          {activeTab === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">Export Preview</h4>
                <Badge variant="secondary">{exportData.length} rows</Badge>
              </div>
              <ExportPreview data={exportData} format={format} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            <span>{exportData.length} documents will be exported</span>
            {estimatedSize && (
              <span className="ml-2 text-gray-400">({estimatedSize})</span>
            )}
            {exportData.length > 5000 && (
              <span className="ml-2 text-amber-600 font-medium">Large export — may take a moment</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || exportData.length === 0}
              className="bg-[#9e2339] hover:bg-[#7a1b2d] min-w-[120px]"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
