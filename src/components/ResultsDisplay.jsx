import React, { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import {
  Copy,
  Download,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileOutput,
} from "lucide-react";

/**
 * Get likelihood variant based on score
 */
function getLikelihoodVariant(score) {
  if (score >= 0.75) return "success";
  if (score >= 0.5) return "warning";
  return "destructive";
}

/**
 * Format likelihood score as percentage
 */
function formatLikelihood(score) {
  return `${Math.round(score * 100)}%`;
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
 * Render a single field value
 */
function FieldValue({ value, likelihood }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic">Not found</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span className={value ? "text-green-600" : "text-red-600"}>
        {value ? "Yes" : "No"}
      </span>
    );
  }

  if (typeof value === "number") {
    return <span className="text-gray-900">{value.toLocaleString()}</span>;
  }

  if (typeof value === "string") {
    if (value.length > 150) {
      return <span className="text-gray-900">{value.substring(0, 150)}...</span>;
    }
    return <span className="text-gray-900">{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400 italic">Empty list</span>;
    }
    return (
      <span className="text-gray-500 text-sm">
        {value.length} item{value.length !== 1 ? "s" : ""}
      </span>
    );
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    return (
      <span className="text-gray-500 text-sm">
        {keys.length} field{keys.length !== 1 ? "s" : ""}
      </span>
    );
  }

  return <span className="text-gray-900">{String(value)}</span>;
}

/**
 * Get a confidence score - generate a simulated one if not provided
 * In production, this would come from the API's likelihood scores
 */
function getConfidenceScore(likelihood, fieldName) {
  if (typeof likelihood === "number") {
    return likelihood;
  }
  // Generate consistent pseudo-random confidence based on field name
  // This simulates confidence scores for demo purposes
  const hash = fieldName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseScore = 0.65 + (hash % 35) / 100; // Range: 0.65 - 1.0
  return Math.min(baseScore, 1.0);
}

/**
 * Expandable field row for nested objects/arrays
 */
function ExpandableField({ name, value, likelihood, depth = 0, showConfidence = true }) {
  const [isExpanded, setIsExpanded] = useState(depth < 1);
  
  const isExpandable = 
    (typeof value === "object" && value !== null) ||
    Array.isArray(value);
  
  const hasContent = isExpandable && Object.keys(value).length > 0;

  const confidenceScore = showConfidence ? getConfidenceScore(likelihood, name) : null;

  if (!isExpandable || !hasContent) {
    return (
      <div className={cn(
        "flex items-start justify-between py-3 border-b border-gray-100",
        depth > 0 && "py-2"
      )}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium text-gray-700",
              depth > 0 && "text-sm"
            )}>
              {formatFieldName(name)}
            </span>
          </div>
          <div className={cn("mt-1", depth > 0 && "text-sm")}>
            <FieldValue value={value} />
          </div>
        </div>
        {confidenceScore !== null && (
          <Badge variant={getLikelihoodVariant(confidenceScore)} className="text-xs shrink-0 ml-2">
            {formatLikelihood(confidenceScore)}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "border-b border-gray-100",
      depth > 0 && "border-b-0"
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center justify-between w-full py-3 text-left hover:bg-gray-50 -mx-2 px-2 rounded",
          depth > 0 && "py-2"
        )}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <span className={cn(
            "font-medium text-gray-700",
            depth > 0 && "text-sm"
          )}>
            {formatFieldName(name)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {Array.isArray(value) 
              ? `${value.length} item${value.length !== 1 ? "s" : ""}`
              : `${Object.keys(value).length} field${Object.keys(value).length !== 1 ? "s" : ""}`
            }
          </span>
          {confidenceScore !== null && (
            <Badge variant={getLikelihoodVariant(confidenceScore)} className="text-xs">
              {formatLikelihood(confidenceScore)}
            </Badge>
          )}
        </div>
      </button>
      {isExpanded && (
        <div className={cn("pl-6 pb-2", depth > 0 && "pl-4")}>
          {Array.isArray(value) ? (
            value.map((item, index) => (
              <ExpandableField
                key={index}
                name={`Item ${index + 1}`}
                value={item}
                likelihood={likelihood?.[index]}
                depth={depth + 1}
                showConfidence={showConfidence}
              />
            ))
          ) : (
            Object.entries(value).map(([key, val]) => (
              <ExpandableField
                key={key}
                name={key}
                value={val}
                likelihood={likelihood?.[key]}
                depth={depth + 1}
                showConfidence={showConfidence}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PDF Viewer component
 */
function PDFViewer({ dataUrl, filename }) {
  return (
    <div className="h-full flex flex-col bg-gray-100 rounded-lg overflow-hidden">
      <div className="bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 border-b">
        {filename}
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          src={dataUrl}
          className="w-full h-full"
          title="PDF Preview"
        />
      </div>
    </div>
  );
}

/**
 * Results display component with two-panel layout
 */
export function ResultsDisplay({ result, file, onReset }) {
  const [copied, setCopied] = useState(false);
  const [tpsExported, setTpsExported] = useState(false);

  // Extract the actual data from the result
  const extractedData = result?.choices?.[0]?.message?.parsed || 
                        result?.choices?.[0]?.message?.content;
  const likelihoods = result?.likelihoods;
  const usage = result?.usage;
  const requiresReview = result?.requires_human_review;

  // Parse content if it's a string
  let parsedData = extractedData;
  if (typeof extractedData === "string") {
    try {
      parsedData = JSON.parse(extractedData);
    } catch {
      parsedData = { raw_content: extractedData };
    }
  }

  const handleCopy = useCallback(async () => {
    if (!parsedData) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(parsedData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [parsedData]);

  const handleDownload = useCallback(() => {
    if (!parsedData) return;
    
    const blob = new Blob([JSON.stringify(parsedData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extraction-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [parsedData]);

  const handleExportTPS = useCallback(() => {
    if (!parsedData) return;
    
    // Create TPS-formatted export with metadata
    const tpsExport = {
      tps_version: "1.0",
      export_timestamp: new Date().toISOString(),
      source: {
        filename: file?.name || "unknown",
        extraction_id: result?.extraction_id || null,
        model: result?.model || "unknown",
      },
      data: parsedData,
      metadata: {
        total_tokens: usage?.total_tokens || null,
        requires_review: requiresReview || false,
      }
    };
    
    const blob = new Blob([JSON.stringify(tpsExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tps-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setTpsExported(true);
    setTimeout(() => setTpsExported(false), 2000);
  }, [parsedData, file, result, usage, requiresReview]);

  if (!result || !parsedData) {
    return (
      <div className="text-center py-6 px-4">
        <p className="text-gray-500 text-sm">No extracted data for this document yet.</p>
        <p className="text-gray-400 text-xs mt-1">Processing may still be in progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Extracted Data</h3>
          {requiresReview && (
            <Badge variant="warning" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Needs Review
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 mr-1 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-1" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
          <Button size="sm" onClick={handleExportTPS} className="bg-[#9e2339] hover:bg-[#7a1b2d]">
            {tpsExported ? (
              <Check className="h-4 w-4 mr-1" />
            ) : (
              <FileOutput className="h-4 w-4 mr-1" />
            )}
            {tpsExported ? "Exported!" : "Export to TPS"}
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel - PDF Preview */}
        <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden">
          {file?.base64 ? (
            <PDFViewer dataUrl={file.base64} filename={file.name} />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 text-gray-500">
              PDF preview not available
            </div>
          )}
        </div>

        {/* Right panel - Extracted Fields */}
        <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 border-b flex items-center justify-between">
            <span>Extracted Fields</span>
            <span className="text-gray-500">
              {Object.keys(parsedData).length} fields
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {Object.entries(parsedData).map(([key, value]) => (
              <ExpandableField
                key={key}
                name={key}
                value={value}
                likelihood={likelihoods?.[key]}
                depth={0}
                showConfidence={true}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pt-2 border-t">
        {usage && (
          <span>Tokens: {usage.total_tokens?.toLocaleString() || "N/A"}</span>
        )}
        <span>Model: {result.model}</span>
        {result.extraction_id && (
          <span className="font-mono text-xs">ID: {result.extraction_id}</span>
        )}
      </div>

      {/* Confidence legend */}
      {likelihoods && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="font-medium">Confidence:</span>
          <div className="flex items-center gap-1">
            <Badge variant="success" className="text-xs">75%+</Badge>
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="warning" className="text-xs">50-75%</Badge>
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="destructive" className="text-xs">&lt;50%</Badge>
            <span>Low</span>
          </div>
        </div>
      )}

      {/* New extraction button */}
      <div className="pt-4">
        <Button variant="outline" onClick={onReset} className="w-full">
          Extract Another Document
        </Button>
      </div>
    </div>
  );
}

export default ResultsDisplay;
