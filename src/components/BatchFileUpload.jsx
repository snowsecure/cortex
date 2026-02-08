import React, { useCallback, useState, useRef } from "react";
import { Upload, FolderOpen, FileText, X, AlertCircle, Files } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";
import { cn } from "../lib/utils";
import { fileToBase64, getUsername } from "../lib/retab";
import { getPdfPageCount } from "../lib/pdfUtils";
import { estimateCost } from "../lib/retabConfig";
import * as api from "../lib/api";

const MAX_FILE_SIZE = 75 * 1024 * 1024; // 75MB per file — base64 inflates ~33% to ~100MB, matching JSON body limit
const LARGE_FILE_WARNING_SIZE = 50 * 1024 * 1024; // 50MB — warn about extraction speed on large files
const SUPPORTED_TYPES = ["application/pdf"];

/**
 * Recursively scan a directory entry for PDF files
 */
async function scanDirectoryEntry(entry, basePath = "") {
  const files = [];
  
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => {
      entry.file(resolve, reject);
    });
    
    if (SUPPORTED_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE) {
      files.push({
        file,
        path: basePath ? `${basePath}/${file.name}` : file.name,
      });
    }
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let entries = [];
    
    // readEntries may need multiple calls for large directories
    let batch;
    do {
      batch = await new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      entries = entries.concat(batch);
    } while (batch.length > 0);
    
    const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    
    for (const childEntry of entries) {
      const childFiles = await scanDirectoryEntry(childEntry, newBasePath);
      files.push(...childFiles);
    }
  }
  
  return files;
}

/**
 * Process dropped items (files or folders)
 */
async function processDroppedItems(items) {
  const files = [];
  
  for (const item of items) {
    if (item.kind === "file") {
      const entry = item.webkitGetAsEntry?.();
      
      if (entry) {
        const scannedFiles = await scanDirectoryEntry(entry);
        files.push(...scannedFiles);
      } else {
        // Fallback for browsers without webkitGetAsEntry
        const file = item.getAsFile();
        if (file && SUPPORTED_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE) {
          files.push({ file, path: file.name });
        }
      }
    }
  }
  
  return files;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes == null || isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generate unique ID for files
 */
function generateFileId() {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function BatchFileUpload({ 
  onFilesSelected, 
  selectedFiles = [], 
  onClearAll, 
  onRemoveFile,
  disabled = false,
  isProcessing = false,
  sessionId = null,
  dbConnected = false,
  processingConfig = null,
  initialFilesToProcess = null,
  onInitialFilesProcessed = null,
}) {
  const toast = useToast();
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [uploadProgress, setUploadProgress] = useState(0); // 0-1 for current file upload
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const lastProcessedInitialRef = useRef(null);
  const uploadAbortRef = useRef(null);

  // Abort in-flight uploads on unmount
  React.useEffect(() => {
    return () => { uploadAbortRef.current?.abort(); };
  }, []);

  /** Cancel any in-progress upload batch */
  const cancelUpload = useCallback(() => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
  }, []);

  /**
   * Process files: upload to server when connected (so work continues if user leaves),
   * otherwise convert to base64 in browser. On server upload failure, fall back to base64.
   */
  const processFiles = useCallback(async (fileItems) => {
    // Abort any previous in-flight upload batch
    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const { signal } = controller;

    setIsScanning(true);
    setError(null);
    
    // Warn about duplicate files (same name + size as already-selected files)
    const existingKeys = new Set(
      selectedFiles.map(f => `${(f.name ?? f.filename ?? "").toLowerCase()}::${f.size ?? 0}`)
    );
    const duplicateNames = [];
    for (const item of fileItems) {
      const key = `${item.file.name.toLowerCase()}::${item.file.size}`;
      if (existingKeys.has(key)) {
        duplicateNames.push(item.file.name);
      }
    }
    if (duplicateNames.length > 0) {
      toast.warning(
        `${duplicateNames.length} file${duplicateNames.length > 1 ? "s" : ""} already uploaded: ${duplicateNames.slice(0, 3).join(", ")}${duplicateNames.length > 3 ? ` and ${duplicateNames.length - 3} more` : ""}. Re-processing anyway.`,
        6000
      );
    }

    setProcessingProgress({ current: 0, total: fileItems.length });
    
    const uploadToServer = sessionId && dbConnected;
    const failedReasons = [];
    
    try {
      const processedFiles = [];
      
      for (let i = 0; i < fileItems.length; i++) {
        // Check for cancellation between files
        if (signal.aborted) {
          toast.info(`Upload cancelled — ${processedFiles.length} of ${fileItems.length} files processed`);
          break;
        }
        const { file, path } = fileItems[i];
        setProcessingProgress({ current: i + 1, total: fileItems.length });
        
        try {
          const pageCount = await getPdfPageCount(file);
          if (uploadToServer) {
            try {
              setUploadProgress(0);
              const packet = await api.uploadPacketFile(sessionId, file, getUsername(), {
                signal,
                onProgress: (pct) => setUploadProgress(pct),
              });
              processedFiles.push({
                id: packet.id,
                name: packet.filename || file.name,
                path: packet.filename || path,
                size: file.size,
                pageCount: pageCount ?? undefined,
                hasServerFile: true,
                createdBy: getUsername() || null,
                addedAt: new Date().toISOString(),
              });
            } catch (uploadErr) {
              // If upload was cancelled, don't fall back to base64
              if (uploadErr.name === "AbortError" || signal.aborted) break;
              // Fall back to base64 when server upload fails (e.g. backend down, CORS)
              console.warn(`Server upload failed for ${file.name}, using local processing:`, uploadErr.message);
              const base64 = await fileToBase64(file);
              processedFiles.push({
                id: generateFileId(),
                file,
                name: file.name,
                path,
                size: file.size,
                pageCount: pageCount ?? undefined,
                base64,
                createdBy: getUsername() || null,
                addedAt: new Date().toISOString(),
              });
            }
          } else {
            const base64 = await fileToBase64(file);
            processedFiles.push({
              id: generateFileId(),
              file,
              name: file.name,
              path,
              size: file.size,
              pageCount: pageCount ?? undefined,
              base64,
              createdBy: getUsername() || null,
              addedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error(`Failed to process file ${file.name}:`, err);
          failedReasons.push(err.message || String(err));
        }
      }
      
      if (processedFiles.length > 0) {
        // Warn about large files that may fail during extraction due to base64 inflation
        const largeFiles = processedFiles.filter(f => f.size >= LARGE_FILE_WARNING_SIZE);
        if (largeFiles.length > 0) {
          const names = largeFiles.map(f => f.name).join(", ");
          toast.warning(
            `${largeFiles.length === 1 ? `"${names}" is` : `${largeFiles.length} files are`} over 50 MB. ` +
            `Large files take longer to process and use more memory. Consider splitting before uploading for best results.`,
            8000
          );
        }
        onFilesSelected(processedFiles);
      }
      
      if (failedReasons.length > 0) {
        const firstReason = failedReasons[0];
        const msg = `${failedReasons.length} file(s) could not be processed${firstReason ? `: ${firstReason}` : ""}`;
        setError(msg);
        toast.warning(msg);
      }
    } catch (err) {
      const msg = `Failed to process files: ${err.message || "Please try again."}`;
      setError(msg);
      toast.error(msg);
      console.error("File processing error:", err);
    } finally {
      setIsScanning(false);
      setProcessingProgress({ current: 0, total: 0 });
      setUploadProgress(0);
    }
  }, [onFilesSelected, sessionId, dbConnected, selectedFiles, toast, cancelUpload]);

  // Process initial files (e.g. dropped on dashboard) once when provided
  React.useEffect(() => {
    if (!initialFilesToProcess?.length || lastProcessedInitialRef.current === initialFilesToProcess) return;
    const fileItems = initialFilesToProcess
      .filter((f) => SUPPORTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE)
      .map((f) => ({ file: f, path: f.name }));
    if (fileItems.length === 0) {
      onInitialFilesProcessed?.();
      return;
    }
    lastProcessedInitialRef.current = initialFilesToProcess;
    processFiles(fileItems).finally(() => {
      onInitialFilesProcessed?.();
    });
  }, [initialFilesToProcess, processFiles, onInitialFilesProcessed]);

  /**
   * Handle drag events
   */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) {
      setIsDragActive(true);
    }
  }, [disabled, isProcessing]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setIsDragReject(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handle drop event
   */
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setIsDragReject(false);
    
    if (disabled || isProcessing) return;
    
    const items = Array.from(e.dataTransfer.items);
    if (items.length === 0) return;
    
    setIsScanning(true);
    
    try {
      const fileItems = await processDroppedItems(items);
      
      if (fileItems.length === 0) {
        setError("No valid PDF files found. Please upload PDF files under 75 MB.");
        setIsScanning(false);
        return;
      }
      
      await processFiles(fileItems);
    } catch (err) {
      setError("Failed to scan dropped items. Please try again.");
      toast.error("Failed to scan dropped items. Please try again.");
      console.error("Drop handling error:", err);
      setIsScanning(false);
    }
  }, [disabled, isProcessing, processFiles]);

  /**
   * Handle file input change (multiple files)
   */
  const handleFileInputChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const fileItems = files
      .filter(f => SUPPORTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE)
      .map(f => ({ file: f, path: f.name }));
    
    if (fileItems.length === 0) {
      setError("No valid PDF files selected. Please select PDF files under 75 MB.");
      return;
    }
    
    await processFiles(fileItems);
    
    // Reset input
    e.target.value = "";
  }, [processFiles]);

  /**
   * Handle folder input change
   */
  const handleFolderInputChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const fileItems = files
      .filter(f => SUPPORTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE)
      .map(f => ({ 
        file: f, 
        path: f.webkitRelativePath || f.name 
      }));
    
    if (fileItems.length === 0) {
      setError("No valid PDF files found in the selected folder.");
      return;
    }
    
    await processFiles(fileItems);
    
    // Reset input
    e.target.value = "";
  }, [processFiles]);

  /**
   * Calculate total size and estimated cost of selected files
   */
  const totalSize = selectedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  const totalEstimatedCost = processingConfig
    ? selectedFiles.reduce((sum, f) => {
        const pages = f.pageCount ?? 0;
        if (pages <= 0) return sum;
        const { totalCost } = estimateCost(pages, processingConfig);
        return sum + totalCost;
      }, 0)
    : null;

  // Show file list if files are selected
  if (selectedFiles.length > 0) {
    const totalPages = selectedFiles.reduce((sum, f) => sum + (f.pageCount ?? 0), 0);

    return (
      <div className="space-y-3">
        {/* Summary row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Files className="h-5 w-5 text-[#9e2339] shrink-0" />
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {selectedFiles.length} File{selectedFiles.length !== 1 ? "s" : ""} Ready
            </span>
            <span className="text-xs text-gray-500 hidden sm:inline">
              — {formatFileSize(totalSize)}
              {totalPages > 0 && <>, {totalPages} page{totalPages !== 1 ? "s" : ""}</>}
              {totalEstimatedCost != null && totalEstimatedCost > 0 && (
                <span className="text-teal-600"> · ~${totalEstimatedCost.toFixed(2)} est.</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 disabled:opacity-50"
            >
              + Files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={disabled || isProcessing}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 disabled:opacity-50"
            >
              + Folder
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={onClearAll}
              disabled={disabled || isProcessing}
              className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
            >
              Clear all
            </button>
          </div>
        </div>

        {/* File list: name, size, path (when from folder) */}
        <div className="space-y-1.5 max-h-112 overflow-y-auto">
          {selectedFiles.map((fileData) => (
            <div
              key={fileData.id}
              className="flex items-center justify-between gap-2 py-2.5 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileText className="h-4 w-4 text-[#9e2339] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={fileData.name ?? fileData.filename}>
                    {fileData.name ?? fileData.filename ?? "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <span>{formatFileSize(fileData.size)}</span>
                    {fileData.pageCount != null && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span>{fileData.pageCount} page{fileData.pageCount !== 1 ? "s" : ""}</span>
                      </>
                    )}
                    {processingConfig && fileData.pageCount != null && fileData.pageCount > 0 && (() => {
                      const { totalCost } = estimateCost(fileData.pageCount, processingConfig);
                      return totalCost > 0 ? (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-teal-600" title="Estimated cost to process this file at current quality settings (model + consensus)">
                            ~${totalCost.toFixed(2)} est.
                          </span>
                        </>
                      ) : null;
                    })()}
                    {fileData.path && fileData.path !== (fileData.name ?? fileData.filename) && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="truncate" title={fileData.path}>
                          {fileData.path}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Always-visible remove button (was opacity-0/group-hover which users couldn't find) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(fileData.id);
                }}
                disabled={disabled || isProcessing}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-30 shrink-0"
                title="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Hidden inputs (both file and folder) */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderInputChange}
          className="hidden"
        />
      </div>
    );
  }

  // Show upload zone
  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragActive && !isDragReject && "border-[#9e2339] bg-[#9e2339]/5",
          isDragReject && "border-red-500 bg-red-50",
          !isDragActive && "border-gray-300 hover:border-gray-400",
          (disabled || isProcessing || isScanning) && "opacity-50 cursor-not-allowed"
        )}
      >
        {isScanning ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#9e2339] border-t-transparent" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {processingProgress.total > 0 
                ? `Uploading ${processingProgress.current} of ${processingProgress.total} files...`
                : "Scanning files..."
              }
            </p>
            {/* Per-file upload progress bar */}
            {processingProgress.total > 0 && uploadProgress > 0 && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-[#9e2339] h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                />
              </div>
            )}
            {/* Overall batch progress */}
            {processingProgress.total > 1 && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <div
                  className="bg-gray-400 dark:bg-gray-500 h-1 rounded-full transition-all duration-200"
                  style={{ width: `${Math.round(((processingProgress.current - 1) / processingProgress.total) * 100)}%` }}
                />
              </div>
            )}
            {processingProgress.total > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); cancelUpload(); }}
                className="text-xs text-gray-500 hover:text-red-600 dark:hover:text-red-400 underline"
              >
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full">
              <FolderOpen className="h-8 w-8 text-gray-600 dark:text-gray-300" />
            </div>
            
            {isDragActive ? (
              <p className="text-sm text-gray-600">
                {isDragReject ? "Invalid files" : "Drop your files or folder here..."}
              </p>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    Drag and drop PDF packets or folders here
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Each PDF can contain multiple documents from a single transaction
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || isProcessing}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Select Files
                  </Button>
                  <span className="text-gray-400">or</span>
                  <Button
                    variant="outline"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={disabled || isProcessing}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Select Folder
                  </Button>
                </div>
                
                <p className="text-xs text-gray-400">
                  PDF files up to 75 MB each
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderInputChange}
        className="hidden"
      />
    </div>
  );
}

export default BatchFileUpload;
