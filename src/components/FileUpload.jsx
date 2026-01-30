import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { fileToBase64 } from "../lib/retab";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function FileUpload({ onFileSelect, selectedFile, onClear, disabled }) {
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles, rejectedFiles) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === "file-too-large") {
          setError("File is too large. Maximum size is 50MB.");
        } else if (rejection.errors[0]?.code === "file-invalid-type") {
          setError("Invalid file type. Please upload a PDF file.");
        } else {
          setError(rejection.errors[0]?.message || "File rejected");
        }
        return;
      }

      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setIsProcessing(true);

      try {
        const base64 = await fileToBase64(file);
        onFileSelect({
          file,
          name: file.name,
          size: file.size,
          base64,
        });
      } catch (err) {
        setError("Failed to process file. Please try again.");
        console.error("File processing error:", err);
      } finally {
        setIsProcessing(false);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        "application/pdf": [".pdf"],
      },
      maxFiles: 1,
      maxSize: MAX_FILE_SIZE,
      disabled: disabled || isProcessing,
    });

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (selectedFile) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#9e2339]/10 rounded-lg">
              <FileText className="h-6 w-6 text-[#9e2339]" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            disabled={disabled}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive && !isDragReject && "border-[#9e2339] bg-[#9e2339]/5",
          isDragReject && "border-red-500 bg-red-50",
          !isDragActive && "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
          (disabled || isProcessing) && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#9e2339] border-t-transparent" />
              <p className="text-sm text-gray-600">Processing file...</p>
            </>
          ) : (
            <>
              <div className="p-3 bg-gray-100 rounded-full">
                <Upload className="h-6 w-6 text-gray-600" />
              </div>
              {isDragActive ? (
                <p className="text-sm text-gray-600">
                  {isDragReject ? "Invalid file type" : "Drop your PDF here..."}
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Drag and drop your PDF here
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      or click to browse (max 50MB)
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
