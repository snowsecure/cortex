import React, { useState, useCallback, useMemo } from "react";
import { Download, FileJson, FileSpreadsheet, Check, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { PacketStatus } from "../hooks/useBatchQueue";
import { getCategoryDisplayName } from "../lib/documentCategories";
import { getExtractionData } from "../lib/utils";

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
  const header = columns.join(",");
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
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
 * Export component for packets and stats
 */
export function BatchExport({ packets, stats }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  /**
   * Get exportable packets (completed or needs review)
   */
  const exportablePackets = useMemo(() => {
    return packets.filter(p => 
      p.status === PacketStatus.COMPLETED || 
      p.status === PacketStatus.NEEDS_REVIEW
    );
  }, [packets]);

  /**
   * Export as JSON (hierarchical structure)
   */
  const exportJSON = useCallback(() => {
    setIsExporting(true);
    
    try {
      const exportData = {
        export_date: new Date().toISOString(),
        export_version: "1.0",
        summary: {
          total_packets: exportablePackets.length,
          total_documents: exportablePackets.reduce((sum, p) => sum + (p.documents?.length || 0), 0),
          completed: stats.completed,
          needs_review: stats.needsReview,
        },
        packets: exportablePackets.map(packet => ({
          packet_id: packet.id,
          filename: packet.filename,
          status: packet.status,
          processed_at: packet.completedAt,
          documents: (packet.documents || []).map(doc => {
            const { data, likelihoods } = getExtractionData(doc.extraction);
            return {
              document_id: doc.id,
              document_type: doc.classification?.category,
              document_type_display: getCategoryDisplayName(doc.classification?.category),
              pages: doc.pages,
              classification_confidence: doc.classification?.confidence,
              classification_reasoning: doc.classification?.reasoning,
              needs_review: doc.needsReview,
              review_reasons: doc.reviewReasons,
              extracted_data: data,
              likelihoods,
            };
          }),
        })),
      };

      const content = JSON.stringify(exportData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadFile(content, `stewart-extraction-${timestamp}.json`, "application/json");
      
      setExportSuccess("json");
      setTimeout(() => setExportSuccess(null), 2000);
    } catch (error) {
      console.error("JSON export failed:", error);
      alert("Export failed: " + error.message);
    } finally {
      setIsExporting(false);
    }
  }, [exportablePackets, stats]);

  /**
   * Export as CSV (flattened, one row per document)
   */
  const exportCSV = useCallback(() => {
    setIsExporting(true);
    
    try {
      const rows = [];
      const columnSet = new Set([
        "packet_id",
        "packet_filename",
        "document_id",
        "document_type",
        "pages",
        "classification_confidence",
        "needs_review",
        "review_reasons",
      ]);

      // First pass: collect all columns
      for (const packet of exportablePackets) {
        for (const doc of packet.documents || []) {
          const { data } = getExtractionData(doc.extraction);
          const flattened = flattenObject(data, "data");
          Object.keys(flattened).forEach(key => columnSet.add(key));
        }
      }

      const columns = Array.from(columnSet);

      // Second pass: create rows
      for (const packet of exportablePackets) {
        for (const doc of packet.documents || []) {
          const { data } = getExtractionData(doc.extraction);
          const flattened = flattenObject(data, "data");
          
          const row = {
            packet_id: packet.id,
            packet_filename: packet.filename,
            document_id: doc.id,
            document_type: doc.classification?.category,
            pages: Array.isArray(doc.pages) ? doc.pages.join("-") : doc.pages,
            classification_confidence: doc.classification?.confidence,
            needs_review: doc.needsReview ? "Yes" : "No",
            review_reasons: (doc.reviewReasons || []).join("; "),
            ...flattened,
          };
          
          rows.push(row);
        }
      }

      const csv = convertToCSV(rows, columns);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadFile(csv, `stewart-extraction-${timestamp}.csv`, "text/csv");
      
      setExportSuccess("csv");
      setTimeout(() => setExportSuccess(null), 2000);
    } catch (error) {
      console.error("CSV export failed:", error);
      alert("Export failed: " + error.message);
    } finally {
      setIsExporting(false);
    }
  }, [exportablePackets]);

  /**
   * Export TPS format (Stewart Title specific)
   */
  const exportTPS = useCallback(() => {
    setIsExporting(true);
    
    try {
      const exportData = {
        tps_version: "1.0",
        export_timestamp: new Date().toISOString(),
        source: "Stewart Ingestion Engine",
        run_summary: {
          total_packets: exportablePackets.length,
          total_documents: exportablePackets.reduce((sum, p) => sum + (p.documents?.length || 0), 0),
          requires_review_count: stats.needsReview,
        },
        transactions: exportablePackets.map(packet => {
          // Try to extract common transaction info from documents
          const deeds = packet.documents?.filter(d => 
            d.classification?.category === "recorded_transfer_deed"
          ) || [];
          const { data: firstDeed } = getExtractionData(deeds[0]?.extraction);
          
          return {
            transaction_id: packet.id,
            source_file: packet.filename,
            property_info: {
              address: firstDeed?.property_street_address || null,
              county: firstDeed?.property_county || null,
              state: firstDeed?.property_state || null,
              parcel_number: firstDeed?.parcel_identification_number || null,
              legal_description: firstDeed?.legal_description || null,
            },
            vesting: {
              current_owner: firstDeed?.grantee_name || null,
              prior_owner: firstDeed?.grantor_name || null,
            },
            documents: (packet.documents || []).map(doc => {
              const { data } = getExtractionData(doc.extraction);
              return {
                doc_type: doc.classification?.category,
                confidence: doc.classification?.confidence,
                requires_review: doc.needsReview,
                recording_info: {
                  date: data.recording_date,
                  book: data.recording_book_number,
                  page: data.recording_page_number,
                  instrument: data.recording_instrument_number,
                },
                extracted_fields: data,
              };
            }),
            review_status: {
              requires_review: packet.status === PacketStatus.NEEDS_REVIEW,
              review_items: packet.documents
                ?.filter(d => d.needsReview)
                .map(d => ({
                  document_type: d.classification?.category,
                  reasons: d.reviewReasons,
                })) || [],
            },
          };
        }),
      };

      const content = JSON.stringify(exportData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadFile(content, `tps-export-${timestamp}.json`, "application/json");
      
      setExportSuccess("tps");
      setTimeout(() => setExportSuccess(null), 2000);
    } catch (error) {
      console.error("TPS export failed:", error);
      alert("Export failed: " + error.message);
    } finally {
      setIsExporting(false);
    }
  }, [exportablePackets, stats]);

  const hasExportableData = exportablePackets.length > 0;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportJSON}
        disabled={!hasExportableData || isExporting}
      >
        {exportSuccess === "json" ? (
          <Check className="h-4 w-4 mr-1 text-green-500" />
        ) : isExporting ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <FileJson className="h-4 w-4 mr-1" />
        )}
        JSON
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={exportCSV}
        disabled={!hasExportableData || isExporting}
      >
        {exportSuccess === "csv" ? (
          <Check className="h-4 w-4 mr-1 text-green-500" />
        ) : isExporting ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-1" />
        )}
        CSV
      </Button>
      
      <Button
        size="sm"
        onClick={exportTPS}
        disabled={!hasExportableData || isExporting}
        className="bg-[#9e2339] hover:bg-[#7a1b2d]"
      >
        {exportSuccess === "tps" ? (
          <Check className="h-4 w-4 mr-1" />
        ) : isExporting ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-1" />
        )}
        TPS Export
      </Button>
    </div>
  );
}

export default BatchExport;
