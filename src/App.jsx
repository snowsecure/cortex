import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { BatchFileUpload } from "./components/BatchFileUpload";
import { PacketResultsView } from "./components/PacketResultsView";
import { ReviewQueue } from "./components/ReviewQueue";
import { ToastProvider, useToast } from "./components/ui/toast";
import { ConfirmDialog } from "./components/ui/confirm-dialog";
import { BatchExport } from "./components/BatchExport";
import { ExportModal } from "./components/ExportModal";
import { HistoryLog, HistoryButton } from "./components/HistoryLog";
import { DocumentDetailModal } from "./components/DocumentDetailModal";
import { AdminDashboard } from "./components/AdminDashboard";
import { HelpDocumentation } from "./components/HelpDocumentation";
import { ProcessingConfigOverride } from "./components/RetabSettings";
import { SchemaExplorer } from "./components/SchemaExplorer";
import { RETAB_MODELS } from "./lib/retabConfig";
import { useBatchQueue, BatchStatus } from "./hooks/useBatchQueue";
import { useProcessingHistory } from "./hooks/useProcessingHistory";
import { getApiKey, setApiKey, hasApiKey } from "./lib/retab";
import { requestPermission, showProcessingComplete, showNeedsReview, isSupported as notificationsSupported } from "./lib/notifications";
import * as api from "./lib/api";
import { formatTimeCST } from "./lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { 
  AlertCircle, 
  Key, 
  FileText, 
  Play, 
  Pause, 
  RotateCcw,
  AlertTriangle,
  X,
  History,
  Plus,
  Upload,
  ListChecks,
  Download,
  ChevronDown,
  FolderOpen,
  Eye,
  HelpCircle,
  LogOut,
  BrainCircuit,
  Trash2,
  Clock,
  CheckCircle,
  Menu,
  BarChart3,
  Zap,
  BookOpen,
  Mail,
  Moon,
  Sun,
} from "lucide-react";
import { useDarkMode } from "./hooks/useDarkMode";

/**
 * View modes for the application
 */
const ViewMode = {
  DASHBOARD: "dashboard",
  UPLOAD: "upload",
  PROCESSING: "processing",
  RESULTS: "results",
  REVIEW: "review",
  HISTORY: "history",
  ADMIN: "admin",
  HELP: "help",
};

/**
 * Home Dashboard: health, outstanding tasks, upload, and stats.
 */
const DASHBOARD_PDF_TYPES = ["application/pdf"];
const DASHBOARD_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function WelcomeDashboard({
  onUpload,
  onFilesDropped,
  onViewHistory,
  onViewHelp,
  onViewAdmin,
  onViewResults,
  onViewReview,
  history,
  usage,
  currentStats,
  healthStatus,
  apiKeyConfigured,
  packets = [],
  isProcessing = false,
  hasPackets = false,
  hasNeedsReview = false,
  hasFailed = false,
}) {
  const [stats30d, setStats30d] = React.useState(null);
  const [stats30dLoading, setStats30dLoading] = React.useState(true);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);

  const handleDragLeave = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!onFilesDropped) return;
    const files = Array.from(e.dataTransfer.files || []).filter(
      (f) => DASHBOARD_PDF_TYPES.includes(f.type) && f.size <= DASHBOARD_MAX_FILE_SIZE
    );
    if (files.length > 0) onFilesDropped(files);
  }, [onFilesDropped]);

  React.useEffect(() => {
    let cancelled = false;
    const base = window.location.origin;
    fetch(`${base}/api/stats/30d`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setStats30d(data);
      })
      .catch(() => { if (!cancelled) setStats30d(null); })
      .finally(() => { if (!cancelled) setStats30dLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const has30dStats = stats30d && (
    (stats30d.totalPages > 0) ||
    (stats30d.packetsProcessed > 0) ||
    (stats30d.documentsProcessed > 0) ||
    (stats30d.totalCost > 0)
  );

  const queuedCount = currentStats?.queued ?? packets.filter((p) => p.status === "queued").length;
  const hasOutstanding = isProcessing || (hasPackets && queuedCount > 0) || hasNeedsReview || hasFailed;

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center p-8 min-h-0 bg-[#fafafa] dark:bg-neutral-900 relative overflow-hidden transition-colors ${isDragOver ? "bg-[#9e2339]/5 dark:bg-[#9e2339]/10 ring-2 ring-[#9e2339]/30 ring-inset" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-xl border-2 border-dashed border-[#9e2339]/50 bg-[#9e2339]/5 dark:bg-[#9e2339]/10">
            <Upload className="h-10 w-10 text-[#9e2339]" />
            <span className="text-sm font-medium text-[#9e2339]">Drop PDFs here</span>
            <span className="text-xs text-slate-500 dark:text-neutral-400">Files will be added to the upload queue</span>
          </div>
        </div>
      )}
      {/* Subtle whoosh of color */}
      <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#9e2339]/[0.08] dark:bg-[#9e2339]/[0.15] blur-[100px] pointer-events-none" aria-hidden />
      <div className="absolute -bottom-32 left-1/4 w-80 h-80 rounded-full bg-sky-300/15 dark:bg-sky-500/10 blur-[80px] pointer-events-none" aria-hidden />
      <div className="relative z-10 max-w-3xl w-full">
        {/* Hero */}
        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.25em] uppercase text-slate-400 dark:text-neutral-500 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Stewart
          </p>
          <h1 className="text-5xl sm:text-6xl tracking-tight text-slate-900 dark:text-neutral-100 mb-2" style={{ fontFamily: "Inter, sans-serif", fontWeight: 900 }}>
            CORTEX
          </h1>
          <p className="text-xs tracking-[0.25em] uppercase text-slate-400 dark:text-neutral-500" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Structured Data, On Demand
          </p>
        </div>

        {/* Outstanding tasks — compact inline list */}
        {hasOutstanding && (
          <div className="mb-6 max-w-md mx-auto">
            <div className="space-y-2">
              {isProcessing && (
                <button
                  onClick={onViewResults}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 text-left hover:bg-amber-100/80 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-200">Processing in progress</span>
                  </div>
                  <span className="text-amber-600 dark:text-amber-400 text-xs">View →</span>
                </button>
              )}
              {!isProcessing && hasPackets && queuedCount > 0 && (
                <button
                  onClick={onViewResults}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-neutral-700/50 border border-slate-200/60 dark:border-neutral-600 text-left hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500 dark:text-neutral-400" />
                    <span className="text-sm font-medium text-slate-900 dark:text-neutral-100">{packets.length} packet{packets.length !== 1 ? "s" : ""} queued</span>
                  </div>
                  <span className="text-slate-500 dark:text-neutral-400 text-xs">View →</span>
                </button>
              )}
              {hasNeedsReview && (
                <button
                  onClick={onViewReview}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 text-left hover:bg-amber-100/80 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-200">{currentStats?.needsReview ?? 0} document{(currentStats?.needsReview ?? 0) !== 1 ? "s" : ""} need review</span>
                  </div>
                  <span className="text-amber-600 dark:text-amber-400 text-xs">Review →</span>
                </button>
              )}
              {hasFailed && (
                <button
                  onClick={onViewResults}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/40 text-left hover:bg-red-100/80 dark:hover:bg-red-900/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium text-red-900 dark:text-red-200">{currentStats?.failed ?? 0} failed</span>
                  </div>
                  <span className="text-red-600 dark:text-red-400 text-xs">View →</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Primary action — large block */}
        <div className="flex justify-center mb-5">
          <button
            onClick={onUpload}
            className="w-full max-w-md group flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700 shadow-sm hover:shadow-md dark:shadow-none hover:border-[#9e2339]/20 dark:hover:border-[#9e2339]/40 hover:bg-[#9e2339]/5 dark:hover:bg-[#9e2339]/10 transition-all text-left"
          >
          <div className="w-9 h-9 rounded-lg bg-[#9e2339]/10 dark:bg-[#9e2339]/20 flex items-center justify-center shrink-0 group-hover:bg-[#9e2339]/20 dark:group-hover:bg-[#9e2339]/30 transition-colors">
            <Upload className="h-4 w-4 text-[#9e2339]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-slate-900 dark:text-neutral-100 text-sm">Upload PDFs</span>
          </div>
          <span className="text-slate-400 dark:text-neutral-500 group-hover:text-[#9e2339] text-xs shrink-0">Get started</span>
          </button>
        </div>

        {/* Secondary actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            onClick={onViewHelp}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-neutral-300 bg-white/80 dark:bg-neutral-800/80 border border-slate-200/60 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 hover:border-slate-300 dark:hover:border-neutral-600 hover:text-slate-900 dark:hover:text-neutral-100 transition-all"
          >
            <HelpCircle className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
            Help & Docs
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 mt-10 pt-6 border-t border-slate-200/50 dark:border-neutral-700/50">
          <a
            href="mailto:philip.snowden@stewart.com?subject=SAIL%20Inquiry%20from%20CORTEX"
            className="text-xs text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  // Dark mode state
  const [isDark, setIsDark, toggleDarkMode] = useDarkMode();

  // API Key state
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [apiKeyConfigured, setApiKeyConfigured] = useState(hasApiKey());
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);

  // View state with browser history support
  const [viewMode, setViewModeState] = useState(() => {
    // Initialize from URL hash if present
    const hash = window.location.hash.slice(1);
    if (hash && Object.values(ViewMode).includes(hash)) {
      return hash;
    }
    return ViewMode.DASHBOARD;
  });
  
  // Wrapper to update both state and browser history
  const setViewMode = useCallback((newMode, replaceState = false) => {
    setViewModeState(newMode);
    const url = `#${newMode}`;
    if (replaceState) {
      window.history.replaceState({ viewMode: newMode }, '', url);
    } else {
      window.history.pushState({ viewMode: newMode }, '', url);
    }
  }, []);
  
  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state?.viewMode) {
        setViewModeState(event.state.viewMode);
      } else {
        // Fallback to hash
        const hash = window.location.hash.slice(1);
        if (hash && Object.values(ViewMode).includes(hash)) {
          setViewModeState(hash);
        } else {
          setViewModeState(ViewMode.DASHBOARD);
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // Set initial history state
    if (!window.history.state?.viewMode) {
      window.history.replaceState({ viewMode }, '', `#${viewMode}`);
    }
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSchemaExplorer, setShowSchemaExplorer] = useState(false);
  const [showSessionRestoredBanner, setShowSessionRestoredBanner] = useState(false);
  const [runConfig, setRunConfig] = useState(null); // Per-run config override
  const [pendingDropFiles, setPendingDropFiles] = useState(null); // Files dropped on homepage
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, action: null });
  
  // Health status
  const [healthStatus, setHealthStatus] = useState({
    server: 'checking',
    database: 'checking',
    retabApi: 'unknown',
    lastCheck: null,
    error: null
  });

  // Processing queue hook
  const {
    packets,
    stats,
    usage,
    batchStatus,
    config,
    retabConfig,
    sessionId,
    dbConnected,
    addPackets,
    start,
    pause,
    resume,
    retryPacket,
    retryAllFailed,
    removePacket,
    clearAll,
    setRetabConfig,
    updateDocument,
    isProcessing,
    isPaused,
    isComplete,
    hasPackets,
    hasFailed,
    hasNeedsReview,
  } = useBatchQueue();

  // History hook
  const {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    hasHistory,
  } = useProcessingHistory();

  // Document-level progress for footer bar (updates as docs are extracted, not only when packets finish)
  const footerProgress = useMemo(() => {
    if (!packets.length || !stats.total) return { percent: 0, label: "0%", completedSteps: 0, totalSteps: 0 };
    let completedSteps = 0;
    let totalSteps = 0;
    for (const p of packets) {
      const total = Math.max(1, p.progress?.totalDocs ?? p.documents?.length ?? 1);
      if (p.status === "completed" || p.status === "needs_review" || p.status === "failed") {
        completedSteps += total;
        totalSteps += total;
      } else if (p.status === "splitting" || p.status === "classifying" || p.status === "extracting") {
        totalSteps += total;
        completedSteps += p.progress?.docIndex ?? 0;
      } else {
        totalSteps += 1;
      }
    }
    const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : Math.round((stats.completed / stats.total) * 100);
    return { percent, completedSteps, totalSteps, label: `${percent}%` };
  }, [packets, stats.total, stats.completed]);

  // Current step label for active processing (toolbar + footer)
  const currentActivityLabel = useMemo(() => {
    const p = packets.find(px => ["splitting", "classifying", "extracting"].includes(px.status));
    if (!p) return null;
    if (p.status === "splitting") return "Splitting PDF…";
    if (p.status === "classifying") return "Classifying…";
    if (p.status === "extracting" && p.progress?.totalDocs > 0) {
      const current = Math.min((p.progress.docIndex ?? 0) + 1, p.progress.totalDocs);
      return `Extracting document ${current} of ${p.progress.totalDocs}`;
    }
    return "Extracting…";
  }, [packets]);

  // Track if we've saved the current run to history
  const [currentRunSaved, setCurrentRunSaved] = useState(false);

  // Save to history when processing completes (localStorage + server when db connected)
  useEffect(() => {
    if (isComplete && !currentRunSaved && packets.length > 0) {
      addToHistory({ packets, stats, sessionId, usage });
      setCurrentRunSaved(true);
    }
  }, [isComplete, currentRunSaved, packets, stats, sessionId, usage, addToHistory]);

  // Reset saved flag when starting new run
  useEffect(() => {
    if (batchStatus === BatchStatus.PROCESSING) {
      setCurrentRunSaved(false);
    }
  }, [batchStatus]);

  // Browser notification when processing completes (transition PROCESSING → COMPLETED)
  const prevBatchStatusRef = useRef(batchStatus);
  useEffect(() => {
    const wasProcessing = prevBatchStatusRef.current === BatchStatus.PROCESSING;
    const isNowComplete = batchStatus === BatchStatus.COMPLETED;
    prevBatchStatusRef.current = batchStatus;
    if (wasProcessing && isNowComplete && packets.length > 0) {
      setViewMode(ViewMode.RESULTS);
    }
    if (notificationsSupported() && wasProcessing && isNowComplete && packets.length > 0) {
      requestPermission().then((granted) => {
        if (granted) showProcessingComplete(stats);
      });
    }
  }, [batchStatus, packets.length, stats]);

  // Remind user of items needing review when they return to the tab
  const wasHiddenRef = useRef(false);
  useEffect(() => {
    if (!notificationsSupported() || stats.needsReview <= 0) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") wasHiddenRef.current = true;
      if (document.visibilityState === "visible" && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        if (Notification.permission === "granted") showNeedsReview(stats.needsReview);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stats.needsReview]);

  // Check for restored session on mount
  useEffect(() => {
    // If we have packets but didn't just upload them, session was restored
    if (packets.length > 0 && batchStatus === BatchStatus.COMPLETED) {
      setShowSessionRestoredBanner(true);
      setViewMode(ViewMode.RESULTS);
      // Auto-hide banner after 10 seconds
      const timer = setTimeout(() => setShowSessionRestoredBanner(false), 10000);
      return () => clearTimeout(timer);
    }
  }, []); // Only run on mount

  // Health check - runs on mount and every 30 seconds
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/status');
        if (response.ok) {
          const data = await response.json();
          setHealthStatus({
            server: 'online',
            database: data.database === 'connected' ? 'online' : 'error',
            retabApi: apiKeyConfigured ? 'configured' : 'not_configured',
            lastCheck: new Date().toISOString(),
            error: null
          });
        } else {
          setHealthStatus(prev => ({
            ...prev,
            server: 'error',
            lastCheck: new Date().toISOString(),
            error: `Server returned ${response.status}`
          }));
        }
      } catch (err) {
        setHealthStatus({
          server: 'offline',
          database: 'unknown',
          retabApi: apiKeyConfigured ? 'configured' : 'not_configured',
          lastCheck: new Date().toISOString(),
          error: 'Cannot connect to server'
        });
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [apiKeyConfigured]);

  // Handle API key save
  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) {
      setShowApiKeyWarning(true);
      return;
    }
    setApiKey(apiKeyInput.trim());
    setApiKeyConfigured(true);
    setShowApiKeyWarning(false);
  };

  // Handle API key clear
  const handleClearApiKey = () => {
    setApiKey("");
    setApiKeyInput("");
    setApiKeyConfigured(false);
  };

  // Handle file selection
  const handleFilesSelected = useCallback((files) => {
    addPackets(files);
  }, [addPackets]);

  // Handle clear all files
  const handleClearAll = useCallback(() => {
    clearAll();
  }, [clearAll]);

  // Handle remove single file
  const handleRemoveFile = useCallback((fileId) => {
    removePacket(fileId);
  }, [removePacket]);

  // Handle start processing
  const handleStartProcessing = useCallback(() => {
    // Request notification permission when user starts (so they get alerted when complete)
    if (notificationsSupported()) requestPermission();
    // Apply per-run config if set
    if (runConfig) {
      setRetabConfig(runConfig);
    }
    setViewMode(ViewMode.PROCESSING);
    setCurrentRunSaved(false);
    start();
    setRunConfig(null);
  }, [start, runConfig, setRetabConfig]);

  // Handle view document
  const handleViewDocument = useCallback((document, packet) => {
    setSelectedDocument({ document, packet });
    console.log("View document:", document, "from packet:", packet?.filename);
  }, []);

  // Handle open review queue
  const handleOpenReview = useCallback(() => {
    setViewMode(ViewMode.REVIEW);
  }, []);

  // Handle close review queue
  const handleCloseReview = useCallback(() => {
    setViewMode(ViewMode.RESULTS);
  }, []);

  // Handle approve review item - apply edits and mark as reviewed
  const handleApproveReview = useCallback(async (document, packet, reviewData) => {
    try {
      // Save to database
      await api.reviewDocument(document.id, {
        status: "reviewed",
        editedFields: reviewData.editedFields || {},
        reviewerNotes: reviewData.reviewerNotes || null,
        reviewedBy: "reviewer", // TODO: Add user identification
      });
      
      // Update local state using UPDATE_DOCUMENT action
      updateDocument(packet.id, document.id, {
        status: "reviewed",
        needsReview: false,
        editedFields: reviewData.editedFields || {},
        reviewerNotes: reviewData.reviewerNotes || null,
        reviewedAt: new Date().toISOString(),
      });
      
      console.log("Review saved:", document.id, {
        editedFields: reviewData.editedFields,
        status: "reviewed",
      });
    } catch (error) {
      console.error("Failed to save review:", error);
      // TODO: Show error toast to user
    }
  }, [updateDocument]);

  // Handle reject review item - mark for re-processing or removal
  const handleRejectReview = useCallback(async (document, packet, reviewData) => {
    try {
      // Save rejection to database
      await api.reviewDocument(document.id, {
        status: "rejected",
        editedFields: {},
        reviewerNotes: reviewData.reviewerNotes || "Rejected by reviewer",
        reviewedBy: "reviewer", // TODO: Add user identification
      });
      
      // Update local state
      updateDocument(packet.id, document.id, {
        status: "rejected",
        needsReview: false,
        reviewerNotes: reviewData.reviewerNotes || "Rejected by reviewer",
        reviewedAt: new Date().toISOString(),
      });
      
      console.log("Document rejected:", document.id);
    } catch (error) {
      console.error("Failed to save rejection:", error);
    }
  }, [updateDocument]);

  // Handle new upload - go back to upload without clearing results
  const handleNewUpload = useCallback(() => {
    clearAll();
    setCurrentRunSaved(false);
    setViewMode(ViewMode.UPLOAD);
  }, [clearAll]);

  // Handle view history
  const handleViewHistory = useCallback(() => {
    setViewMode(ViewMode.HISTORY);
  }, []);

  // Handle close history
  const handleCloseHistory = useCallback(() => {
    // Go back to appropriate view
    if (hasPackets) {
      setViewMode(ViewMode.RESULTS);
    } else {
      setViewMode(ViewMode.DASHBOARD);
    }
  }, [hasPackets]);

  // Handle add more files (from processing view)
  const handleAddMoreFiles = useCallback(() => {
    setViewMode(ViewMode.UPLOAD);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex flex-col transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 shrink-0">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo */}
            <button 
              onClick={() => setViewMode(ViewMode.DASHBOARD)}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              {/* Stewart logo with health dot */}
              <div className="relative">
                <img 
                  src="/stewart-logo.png" 
                  alt="Stewart" 
                  className="h-8 w-8 rounded-full"
                />
              </div>
              
              {/* Brand text */}
              <div className="flex flex-col -space-y-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl tracking-wide text-gray-900 dark:text-white" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900 }}>CORTEX</span>
                  <span className="text-[10px] text-gray-400 dark:text-neutral-500">v0.2</span>
                </div>
                <span className="text-[9px] tracking-wider text-gray-400 dark:text-neutral-500" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Structured Data, On Demand</span>
              </div>
              
              {!apiKeyConfigured && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded ml-2">
                  API Key Required
                </span>
              )}
            </button>
            
            {/* Center: Navigation */}
            {apiKeyConfigured && (
              <nav className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-700 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode(ViewMode.DASHBOARD)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.DASHBOARD
                        ? "bg-white dark:bg-neutral-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Home
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.UPLOAD)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.UPLOAD
                        ? "bg-white dark:bg-neutral-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Upload
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.RESULTS)}
                    title={hasPackets ? "View processing results" : "Results (no items yet)"}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.PROCESSING || viewMode === ViewMode.RESULTS
                        ? "bg-white dark:bg-neutral-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Results
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.REVIEW)}
                    title={hasNeedsReview ? `${stats.needsReview} document(s) need review` : "Review queue (empty if none need review)"}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      viewMode === ViewMode.REVIEW
                        ? "bg-white dark:bg-neutral-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Review
                    {hasNeedsReview && (
                      <span className="w-2 h-2 bg-amber-500 rounded-full" title={`${stats.needsReview} need review`} />
                    )}
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.HISTORY)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.HISTORY
                        ? "bg-white dark:bg-neutral-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    History
                  </button>
                </nav>
            )}
            
            {/* Right: Actions */}
            {apiKeyConfigured && (
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 dark:text-neutral-400">
                    <Menu className="h-4 w-4" />
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <button
                      onClick={() => setShowSchemaExplorer(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <BookOpen className="h-4 w-4" />
                      Schemas
                    </button>
                    <button
                      onClick={() => setViewMode(ViewMode.ADMIN)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Admin
                    </button>
                    <button
                      onClick={() => setViewMode(ViewMode.HELP)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Help & Docs
                    </button>
                    <a
                      href="mailto:philip.snowden@stewart.com?subject=SAIL%20Inquiry%20from%20CORTEX"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#9e2339] hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Mail className="h-4 w-4" />
                      Contact SAIL
                    </a>
                    <button
                      onClick={toggleDarkMode}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {isDark ? "Light Mode" : "Dark Mode"}
                    </button>
                    <div className="border-t border-gray-100 dark:border-neutral-700 my-1" />
                    <button
                      onClick={handleClearApiKey}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <Key className="h-4 w-4" />
                      API Key
                    </button>
                    <button
                      onClick={() => setConfirmDialog({
                        isOpen: true,
                        title: "Clear All Data",
                        message: "This will remove all packets, results, and processing data. This action cannot be undone.",
                        action: () => {
                          clearAll();
                          setViewMode(ViewMode.DASHBOARD);
                        }
                      })}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Session Restored Banner */}
      {showSessionRestoredBanner && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800/50 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center">
                <History className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  Previous session restored
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {stats.completed + stats.needsReview} document{stats.completed + stats.needsReview !== 1 ? 's' : ''} from your last session. 
                  PDFs available for 1 hour; extraction results retained until cleared.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearAll();
                  setShowSessionRestoredBanner(false);
                  setViewMode(ViewMode.DASHBOARD);
                }}
                className="text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40"
              >
                Start Fresh
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSessionRestoredBanner(false)}
                className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0">
        {/* API Key Configuration */}
        {!apiKeyConfigured && (
          <div className="max-w-2xl mx-auto px-4 py-8 w-full">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-[#9e2339]" />
                  Configure API Key
                </CardTitle>
                <CardDescription>
                  Enter your Retab API key to get started. You can find your API
                  key in the{" "}
                  <a
                    href="https://retab.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#9e2339] hover:underline"
                  >
                    Retab Dashboard
                  </a>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="Enter your Retab API key"
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        setShowApiKeyWarning(false);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                    />
                  </div>
                  {showApiKeyWarning && (
                    <Alert variant="warning">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please enter a valid API key
                      </AlertDescription>
                    </Alert>
                  )}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Security Note</AlertTitle>
                    <AlertDescription>
                      Your API key is stored locally in your browser.
                    </AlertDescription>
                  </Alert>
                  <Button onClick={handleSaveApiKey} className="w-full">
                    Save API Key
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dashboard view (home) */}
        {apiKeyConfigured && viewMode === ViewMode.DASHBOARD && (
          <WelcomeDashboard
            onUpload={() => setViewMode(ViewMode.UPLOAD)}
            onFilesDropped={(files) => {
              setPendingDropFiles(files);
              setViewMode(ViewMode.UPLOAD);
            }}
            onViewHistory={() => setViewMode(ViewMode.HISTORY)}
            onViewHelp={() => setViewMode(ViewMode.HELP)}
            onViewAdmin={() => setViewMode(ViewMode.ADMIN)}
            onViewResults={() => setViewMode(ViewMode.RESULTS)}
            onViewReview={() => setViewMode(ViewMode.REVIEW)}
            history={history}
            usage={usage}
            currentStats={stats}
            healthStatus={healthStatus}
            apiKeyConfigured={apiKeyConfigured}
            packets={packets}
            isProcessing={isProcessing}
            hasPackets={hasPackets}
            hasNeedsReview={hasNeedsReview}
            hasFailed={hasFailed}
          />
        )}

        {/* Upload view */}
        {apiKeyConfigured && viewMode === ViewMode.UPLOAD && (
          <div className="max-w-4xl mx-auto px-4 py-8 w-full">
            <Card>
              <CardHeader>
                <CardTitle>Upload Document Packets</CardTitle>
                <CardDescription>
                  Each PDF can contain multiple documents from a single real estate transaction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <BatchFileUpload
                  onFilesSelected={handleFilesSelected}
                  selectedFiles={packets}
                  onClearAll={handleClearAll}
                  onRemoveFile={handleRemoveFile}
                  disabled={isProcessing}
                  sessionId={sessionId}
                  dbConnected={dbConnected}
                  processingConfig={runConfig || retabConfig}
                  initialFilesToProcess={pendingDropFiles}
                  onInitialFilesProcessed={() => setPendingDropFiles(null)}
                />
                
                {/* Processing config override for this run */}
                {hasPackets && (
                  <ProcessingConfigOverride
                    config={runConfig || retabConfig}
                    onChange={setRunConfig}
                    globalConfig={retabConfig}
                  />
                )}

                {hasPackets && (
                  <div className="flex items-center justify-between pt-6">
                    <p className="text-sm text-gray-600">
                      {packets.length} packet{packets.length !== 1 ? "s" : ""} ready to process
                    </p>
                    <Button onClick={handleStartProcessing} size="lg">
                      <Play className="h-4 w-4 mr-2" />
                      Start Processing
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Processing/Results view */}
        {apiKeyConfigured && (viewMode === ViewMode.PROCESSING || viewMode === ViewMode.RESULTS) && (
          <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full min-h-0">
            {/* Minimal toolbar */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-3">
                {isProcessing && (
                  <>
                    <span className="text-sm text-gray-500">
                      {currentActivityLabel ?? "Processing"}
                    </span>
                    <Button variant="ghost" size="sm" onClick={pause} className="h-7 px-2 text-gray-500">
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {isPaused && (
                  <>
                    <span className="text-sm text-amber-600">Paused</span>
                    <Button variant="ghost" size="sm" onClick={resume} className="h-7 px-2 text-gray-500">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {isComplete && !isProcessing && !isPaused && (
                  <span className="text-sm text-gray-500">
                    {stats.total} document{stats.total !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <BatchExport packets={packets} stats={stats} />
              </div>
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto">
              <PacketResultsView
                packets={packets}
                stats={stats}
                onViewDocument={handleViewDocument}
                onRetryPacket={retryPacket}
                onRemovePacket={removePacket}
                onRetryAllFailed={retryAllFailed}
              />
            </div>

            {/* Completion message */}
            {isComplete && !isProcessing && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shrink-0">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-800/50 rounded-full">
                      <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">
                        Processing complete
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {stats.completed} completed
                        {stats.needsReview > 0 && `, ${stats.needsReview} need review`}
                        {stats.failed > 0 && `, ${stats.failed} failed`}
                        {currentRunSaved && " • Saved to history"}
                      </p>
                      {stats.needsReview > 0 && (
                        <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5 font-medium">
                          Review results to approve or fix extractions.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {stats.needsReview > 0 && (
                      <Button
                        size="default"
                        onClick={() => setViewMode(ViewMode.REVIEW)}
                        className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                      >
                        <ListChecks className="h-4 w-4 mr-1.5" />
                        Review results
                      </Button>
                    )}
                    {hasFailed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={retryAllFailed}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Retry Failed
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddMoreFiles}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add More Files
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review queue view */}
        {apiKeyConfigured && viewMode === ViewMode.REVIEW && (
          <div className="flex-1 min-h-0">
            <ReviewQueue
              packets={packets}
              onApprove={handleApproveReview}
              onReject={handleRejectReview}
              onClose={handleCloseReview}
            />
          </div>
        )}

        {/* History view */}
        {apiKeyConfigured && viewMode === ViewMode.HISTORY && (
          <div className="flex-1 min-h-0 max-w-4xl mx-auto w-full">
            <Card className="h-full flex flex-col m-4">
              <HistoryLog
                history={history}
                onDelete={removeFromHistory}
                onClearAll={clearHistory}
                onClose={handleCloseHistory}
              />
            </Card>
          </div>
        )}

        {/* Admin Dashboard view */}
        {apiKeyConfigured && viewMode === ViewMode.ADMIN && (
          <div className="flex-1 min-h-0">
            <AdminDashboard
              packets={packets}
              stats={stats}
              usage={usage}
              retabConfig={retabConfig}
              history={history}
              dbConnected={dbConnected}
              onClose={() => setViewMode(hasPackets ? ViewMode.RESULTS : ViewMode.DASHBOARD)}
            />
          </div>
        )}

        {/* Help Documentation view */}
        {viewMode === ViewMode.HELP && (
          <div className="flex-1 min-h-0">
            <HelpDocumentation
              onClose={() => setViewMode(hasPackets ? ViewMode.RESULTS : ViewMode.DASHBOARD)}
            />
          </div>
        )}
      </main>

      {/* Footer — full width across base of page */}
      <footer className="border-t border-gray-100 dark:border-neutral-700 bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-neutral-800 dark:via-neutral-800 dark:to-neutral-800 shrink-0 w-full">
        <div className="w-full px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Left: Health + Processing Stats */}
            <div className="flex items-center gap-3 min-w-[200px]">
              {/* Health Status */}
              <div 
                className="flex items-center gap-1.5 text-[10px] cursor-help"
                title={
                  healthStatus.server === 'online' && healthStatus.database === 'online'
                    ? `Server: Online\nDatabase: Connected\nRetab API: ${apiKeyConfigured ? 'Configured' : 'Not configured'}\nLast check: ${healthStatus.lastCheck ? formatTimeCST(healthStatus.lastCheck) + ' CST' : 'Never'}`
                    : healthStatus.server === 'checking'
                    ? 'Checking connection to Retab extraction engine...'
                    : `Server: ${healthStatus.server === 'offline' ? 'Offline' : 'Error'}\nDatabase: ${healthStatus.database === 'online' ? 'Connected' : healthStatus.database}\n${healthStatus.error ? `Error: ${healthStatus.error}` : ''}`
                }
              >
                {healthStatus.server === 'online' && healthStatus.database === 'online' ? (
                  <>
                    <div className="relative">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping absolute" />
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    </div>
                    <span className="text-gray-400 dark:text-neutral-500">Retab Online</span>
                  </>
                ) : healthStatus.server === 'checking' ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
                    <span className="text-gray-400">Connecting to Retab...</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-red-500">
                      {healthStatus.server === 'offline' ? 'Retab Offline' : 
                       healthStatus.database !== 'online' ? 'DB Error' : 'Retab Error'}
                    </span>
                  </>
                )}
              </div>
              
              {/* Separator */}
              {hasPackets && <div className="w-px h-3 bg-gray-200 dark:bg-neutral-600" />}
              
              {/* Processing Stats */}
              {hasPackets && (
                <div className="flex items-center gap-1.5">
                  {stats.processing > 0 ? (
                    <div className="flex items-center gap-1 cursor-help" title="Processing in progress">
                      <div className="relative">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping absolute" />
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      </div>
                      <span className="text-[11px] font-medium text-blue-600">Processing</span>
                    </div>
                  ) : isComplete ? (
                    <div className="flex items-center gap-1 cursor-help" title="All documents have been processed">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="text-[11px] font-medium text-green-600">Complete:</span>
                    </div>
                  ) : null}
                  {stats.completed > 0 && (
                    <span className="text-[11px] text-gray-500 dark:text-neutral-400 cursor-help" title={`${stats.completed} document${stats.completed > 1 ? 's' : ''} successfully extracted`}>
                      {stats.completed} <span className="text-green-500">✓</span>
                    </span>
                  )}
                  {stats.needsReview > 0 && (
                    <span className="text-[11px] text-amber-600 cursor-help" title={`${stats.needsReview} document${stats.needsReview > 1 ? 's' : ''} flagged for human review due to low confidence`}>
                      {stats.needsReview} Review
                    </span>
                  )}
                  {stats.failed > 0 && (
                    <span className="text-[11px] text-red-500 cursor-help" title={`${stats.failed} document${stats.failed > 1 ? 's' : ''} failed to process - click to retry`}>
                      {stats.failed} failed
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Center: Branding */}
            <div className="flex items-center gap-1.5 text-[11px] cursor-help" title="Stewart AI Lab - Intelligent Document Processing">
              <span className="text-gray-400 dark:text-neutral-500">POWERED BY</span>
              <span className="font-semibold text-[#9e2339]">SAIL</span>
            </div>
            
            {/* Right: Cost */}
            <div className="flex items-center gap-3 min-w-[200px] justify-end">
              {usage.totalCost > 0 && (
                <div 
                  className="flex items-center gap-1 text-[11px] cursor-help" 
                  title={`Retab API Usage\nTotal Cost: $${usage.totalCost.toFixed(3)}\nCredits: ${usage.totalCredits}\nPages Processed: ${usage.totalPages || 'N/A'}\nAPI Calls: ${usage.totalCalls || 'N/A'}`}
                >
                  <span className="text-emerald-600 font-semibold">${usage.totalCost.toFixed(3)}</span>
                  {usage.totalCredits > 0 && (
                    <span className="text-gray-400 dark:text-neutral-500">({usage.totalCredits.toFixed(2)} cr)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Document Detail Modal */}
      {selectedDocument && (
        <DocumentDetailModal
          document={selectedDocument.document}
          packet={selectedDocument.packet}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        packets={packets}
        stats={stats}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
      
      {/* Schema Explorer */}
      {showSchemaExplorer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            <SchemaExplorer onClose={() => setShowSchemaExplorer(false)} />
          </div>
        </div>
      )}
      
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, action: null })}
        onConfirm={() => confirmDialog.action?.()}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Clear Data"
        variant="danger"
      />
    </div>
  );
}

// Wrap App with ToastProvider
function AppWithProviders() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

export default AppWithProviders;
