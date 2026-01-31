import React, { useCallback, useState, useRef } from "react";
import { Upload, FolderOpen, FileText, X, AlertCircle, Files } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { fileToBase64 } from "../lib/retab";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
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
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  /**
   * Process files and convert to base64
   */
  const processFiles = useCallback(async (fileItems) => {
    setIsScanning(true);
    setError(null);
    setProcessingProgress({ current: 0, total: fileItems.length });
    
    try {
      const processedFiles = [];
      
      for (let i = 0; i < fileItems.length; i++) {
        const { file, path } = fileItems[i];
        setProcessingProgress({ current: i + 1, total: fileItems.length });
        
        try {
          const base64 = await fileToBase64(file);
          processedFiles.push({
            id: generateFileId(),
            file,
            name: file.name,
            path,
            size: file.size,
            base64,
            addedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error(`Failed to process file ${file.name}:`, err);
          // Continue with other files
        }
      }
      
      if (processedFiles.length > 0) {
        onFilesSelected(processedFiles);
      }
      
      if (processedFiles.length < fileItems.length) {
        setError(`${fileItems.length - processedFiles.length} file(s) could not be processed`);
      }
    } catch (err) {
      setError("Failed to process files. Please try again.");
      console.error("File processing error:", err);
    } finally {
      setIsScanning(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  }, [onFilesSelected]);

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
        setError("No valid PDF files found. Please upload PDF files under 100MB.");
        setIsScanning(false);
        return;
      }
      
      await processFiles(fileItems);
    } catch (err) {
      setError("Failed to scan dropped items. Please try again.");
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
      setError("No valid PDF files selected. Please select PDF files under 100MB.");
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
   * Calculate total size of selected files
   */
  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  // Show file list if files are selected
  if (selectedFiles.length > 0) {
    return (
      <div className="space-y-4">
        {/* Summary header */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#9e2339]/10 rounded-lg">
              <Files className="h-6 w-6 text-[#9e2339]" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {selectedFiles.length} PDF packet{selectedFiles.length !== 1 ? "s" : ""} selected
              </p>
              <p className="text-sm text-gray-500">
                Total size: {formatFileSize(totalSize)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
            >
              <Upload className="h-4 w-4 mr-1" />
              Add More
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              disabled={disabled || isProcessing}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Clear All
            </Button>
          </div>
        </div>

        {/* File list */}
        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {selectedFiles.map((fileData) => (
            <div
              key={fileData.id}
              className="flex items-center justify-between p-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {fileData.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(fileData.size)}
                    {fileData.path !== fileData.name && (
                      <span className="ml-2 text-gray-400">
                        {fileData.path}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveFile(fileData.id)}
                disabled={disabled || isProcessing}
                className="h-8 w-8 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileInputChange}
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
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#9e2339] border-t-transparent" />
            <p className="text-sm text-gray-600">
              {processingProgress.total > 0 
                ? `Processing ${processingProgress.current} of ${processingProgress.total} files...`
                : "Scanning files..."
              }
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <FolderOpen className="h-8 w-8 text-gray-600" />
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
                  PDF files up to 100MB each
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
