import React from "react";
import { ExtractionStatus } from "../hooks/useRetabExtract";
import { Loader2, Upload, Cpu, FileSearch, CheckCircle, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

const statusConfig = {
  [ExtractionStatus.IDLE]: {
    icon: null,
    label: "Ready",
    color: "text-gray-400",
  },
  [ExtractionStatus.UPLOADING]: {
    icon: Upload,
    label: "Uploading document...",
    color: "text-blue-500",
  },
  [ExtractionStatus.PROCESSING]: {
    icon: Cpu,
    label: "Processing document...",
    color: "text-blue-500",
  },
  [ExtractionStatus.EXTRACTING]: {
    icon: FileSearch,
    label: "Extracting data...",
    color: "text-[#9e2339]",
  },
  [ExtractionStatus.COMPLETE]: {
    icon: CheckCircle,
    label: "Extraction complete",
    color: "text-green-500",
  },
  [ExtractionStatus.ERROR]: {
    icon: XCircle,
    label: "Extraction failed",
    color: "text-red-500",
  },
};

export function ExtractionProgress({ status, progress, error }) {
  const config = statusConfig[status] || statusConfig[ExtractionStatus.IDLE];
  const Icon = config.icon;
  const isLoading =
    status === ExtractionStatus.UPLOADING ||
    status === ExtractionStatus.PROCESSING ||
    status === ExtractionStatus.EXTRACTING;

  if (status === ExtractionStatus.IDLE) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Status indicator */}
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn("relative", config.color)}>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
          </div>
        )}
        <span className={cn("text-sm font-medium", config.color)}>
          {config.label}
        </span>
      </div>

      {/* Progress bar */}
      {isLoading && (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#9e2339] h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Progress steps */}
      {isLoading && (
        <div className="flex justify-between text-xs text-gray-500">
          <span
            className={cn(
              progress >= 10 && "text-[#9e2339] font-medium"
            )}
          >
            Upload
          </span>
          <span
            className={cn(
              progress >= 30 && "text-[#9e2339] font-medium"
            )}
          >
            Process
          </span>
          <span
            className={cn(
              progress >= 50 && "text-[#9e2339] font-medium"
            )}
          >
            Extract
          </span>
          <span
            className={cn(
              progress >= 100 && "text-[#9e2339] font-medium"
            )}
          >
            Complete
          </span>
        </div>
      )}

      {/* Error message */}
      {status === ExtractionStatus.ERROR && error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}

export default ExtractionProgress;
