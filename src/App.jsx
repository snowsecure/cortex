import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense, lazy } from "react";
import { BatchFileUpload } from "./components/BatchFileUpload";
import { PacketResultsView } from "./components/PacketResultsView";
import { ReviewQueue } from "./components/ReviewQueue";
import { ToastProvider, useToast } from "./components/ui/toast";
import { ConfirmDialog } from "./components/ui/confirm-dialog";
import { ExportModal } from "./components/ExportModal";
import { HistoryLog, HistoryButton } from "./components/HistoryLog";
import { DocumentDetailModal } from "./components/DocumentDetailModal";
import { ProcessingConfigOverride } from "./components/RetabSettings";
import OnboardingModal from "./components/OnboardingModal";
import { ErrorBoundary } from "./components/ui/error-boundary";

// --- Lazy-loaded heavy components (not needed on initial render) ---
const AdminDashboard = lazy(() =>
  import("./components/AdminDashboard").then(m => ({ default: m.AdminDashboard }))
);
const HelpDocumentation = lazy(() =>
  import("./components/HelpDocumentation").then(m => ({ default: m.HelpDocumentation }))
);
const ExportPage = lazy(() =>
  import("./components/ExportPage").then(m => ({ default: m.ExportPage }))
);
const SchemaExplorer = lazy(() =>
  import("./components/SchemaExplorer").then(m => ({ default: m.SchemaExplorer }))
);
import { RETAB_MODELS } from "./lib/retabConfig";
import { useBatchQueue, BatchStatus } from "./hooks/useBatchQueue";
import { useProcessingHistory } from "./hooks/useProcessingHistory";
import { getApiKey, setApiKey, hasApiKey, getUsername, setUsername, hasUsername } from "./lib/retab";
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
  Square, 
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

const isProduction = import.meta.env.PROD;

/** Lightweight spinner shown while lazy components load */
function LazyFallback({ name }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 text-gray-400 dark:text-gray-500">
      <div className="text-center space-y-2">
        <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300 rounded-full mx-auto" />
        {name && <p className="text-sm">Loading {name}…</p>}
      </div>
    </div>
  );
}

/**
 * View modes for the application
 */
const ViewMode = {
  DASHBOARD: "dashboard",
  UPLOAD: "upload",
  PROCESSING: "processing",
  RESULTS: "results",
  REVIEW: "review",
  EXPORT: "export",
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
    // Only clear when actually leaving the drop zone (not when entering a child element)
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!onFilesDropped) return;
    // DataTransferItem references are invalidated after the first async tick.
    // Collect all File objects synchronously from items so multiple drops are not lost.
    const items = e.dataTransfer?.items;
    if (!items?.length) return;
    const files = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind !== "file") continue;
      const file = items[i].getAsFile();
      if (file && DASHBOARD_PDF_TYPES.includes(file.type) && file.size <= DASHBOARD_MAX_FILE_SIZE) {
        files.push(file);
      }
    }
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
      className={`flex-1 flex flex-col items-center justify-center p-8 min-h-0 bg-[#fafafa] dark:bg-neutral-900 relative overflow-hidden transition-colors ${isDragOver ? "bg-[#9e2339]/5 dark:bg-[#9e2339]/10 outline-2 outline-[#9e2339]/30 -outline-offset-2" : ""}`}
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
      <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#9e2339]/[0.14] dark:bg-[#9e2339]/[0.24] blur-[100px] pointer-events-none" aria-hidden />
      <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-sky-300/25 dark:bg-sky-500/18 blur-[80px] pointer-events-none" aria-hidden />
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
                    <span className="text-sm font-medium text-slate-900 dark:text-neutral-100">{queuedCount} packet{queuedCount !== 1 ? "s" : ""} queued</span>
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
  // Toast notifications
  const toast = useToast();

  // Dark mode state
  const [isDark, setIsDark, toggleDarkMode] = useDarkMode();

  // API Key state
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [apiKeyConfigured, setApiKeyConfigured] = useState(hasApiKey());
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);

  // Username state (stored in localStorage like API key)
  const [usernameInput, setUsernameInput] = useState(getUsername());
  const [usernameConfigured, setUsernameConfigured] = useState(hasUsername());

  // Both API key and username must be set to use the app
  const isSetupComplete = apiKeyConfigured && usernameConfigured;

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
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Only show completion banner when a run just finished in this session (not when viewing old results)
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
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
    dbInitComplete,
    addPackets,
    start,
    pause,
    resume,
    retryPacket,
    retryAllFailed,
    retryDocument,
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

  // File-centric progress — smooth single bar based on files completed.
  // Active file contributes partial progress so the bar never sits at 0% for long.
  const footerProgress = useMemo(() => {
    if (!packets.length) return { percent: 0, completedFiles: 0, totalFiles: 0 };

    let completedFiles = 0;
    let activeFileProgress = 0; // 0–1 fraction of the currently-active file

    for (const p of packets) {
      if (["completed", "needs_review", "failed"].includes(p.status)) {
        completedFiles++;
      } else if (p.status === "splitting") {
        activeFileProgress = 0.1; // just started
      } else if (p.status === "classifying") {
        activeFileProgress = 0.2;
      } else if (p.status === "extracting") {
        const total = p.progress?.totalDocs || 1;
        const done = p.progress?.docIndex || 0;
        // Extraction is ~80% of the file's work (splitting is the first ~20%)
        activeFileProgress = 0.2 + 0.8 * (done / total);
      }
    }

    // Smooth percentage: completed files + partial credit for the active one
    const raw = (completedFiles + activeFileProgress) / packets.length;
    const percent = Math.min(100, Math.round(raw * 100));
    return { percent, completedFiles, totalFiles: packets.length };
  }, [packets]);

  // Current activity summary — files can process concurrently, so show counts
  const currentActivityLabel = useMemo(() => {
    const active = packets.filter(px =>
      ["splitting", "classifying", "extracting"].includes(px.status)
    );
    if (active.length === 0) return null;

    // Pick the most advanced file's stage as the detail hint
    const extracting = active.find(p => p.status === "extracting");
    let detail;
    if (extracting && extracting.progress?.totalDocs > 0) {
      const cur = Math.min((extracting.progress.docIndex ?? 0) + 1, extracting.progress.totalDocs);
      detail = `extracting doc ${cur} of ${extracting.progress.totalDocs}`;
    } else if (active.some(p => p.status === "extracting")) {
      detail = "extracting";
    } else if (active.some(p => p.status === "classifying")) {
      detail = "classifying";
    } else {
      detail = "splitting";
    }

    return { activeCount: active.length, detail };
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

  // Reset saved flag and banner when starting new run
  useEffect(() => {
    if (batchStatus === BatchStatus.PROCESSING) {
      setCurrentRunSaved(false);
      setBannerDismissed(false);
      setShowCompletionBanner(false);
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
      setShowCompletionBanner(true);

      // Show browser notification — permission was already requested at start
      if (notificationsSupported() && Notification.permission === "granted") {
        showProcessingComplete(stats);
        // If there are items needing review, follow up with a second notification
        if (stats.needsReview > 0) {
          setTimeout(() => showNeedsReview(stats.needsReview), 1500);
        }
      }
    }
  }, [batchStatus, packets.length, stats]);

  // Remind user of items needing review when they return to the tab
  const wasHiddenRef = useRef(false);
  useEffect(() => {
    if (!notificationsSupported()) return;
    // Only set up the listener when there are items to review
    if (stats.needsReview <= 0) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
      }
      if (document.visibilityState === "visible" && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        if (Notification.permission === "granted" && stats.needsReview > 0) {
          showNeedsReview(stats.needsReview);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stats.needsReview]);

  // After DB init completes, redirect to results if we have packets,
  // or redirect to dashboard if we're on a view that requires packets but have none.
  useEffect(() => {
    if (!dbInitComplete) return; // Wait until DB restore is fully done
    
    if (packets.length > 0) {
      // If we restored packets and we're on dashboard, go to results
      if (viewMode === ViewMode.DASHBOARD) {
        setViewMode(ViewMode.RESULTS, true);
      }
    } else {
      // No packets — redirect away from views that need them
      const packetViews = [ViewMode.RESULTS, ViewMode.PROCESSING, ViewMode.REVIEW];
      if (packetViews.includes(viewMode)) {
        setViewMode(ViewMode.DASHBOARD, true);
      }
    }
  }, [dbInitComplete]); // Only run once when init finishes

  // Health check - runs on mount and every 30 seconds
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${api.API_BASE}/api/status`);
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

  // Handle API key + username save
  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim() || !usernameInput.trim()) {
      setShowApiKeyWarning(true);
      return;
    }
    setApiKey(apiKeyInput.trim());
    setApiKeyConfigured(true);
    setUsername(usernameInput.trim());
    setUsernameConfigured(true);
    setShowApiKeyWarning(false);
    // Request notification permission early so it's ready when processing finishes
    if (notificationsSupported()) requestPermission();
  };

  // Handle API key clear (also clears username)
  const handleClearApiKey = () => {
    setApiKey("");
    setApiKeyInput("");
    setApiKeyConfigured(false);
    setUsername("");
    setUsernameInput("");
    setUsernameConfigured(false);
  };

  // Handle file selection
  const handleFilesSelected = useCallback((files) => {
    addPackets(files);
  }, [addPackets]);

  // Handle clear all files — require confirmation so we don't accidentally wipe server data
  const handleClearAll = useCallback(() => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove all packets?",
      message: "This will remove all files from the queue and delete them from the server. Completed or in-progress work cannot be recovered.",
      confirmText: "Remove all",
      action: () => clearAll(),
    });
  }, [clearAll]);

  // Handle remove packet (from Upload or Results). Shows toast if server delete fails.
  const handleRemovePacket = useCallback(async (packetId) => {
    const ok = await removePacket(packetId);
    if (!ok) {
      toast.error("Could not delete. It may reappear after refresh.");
    }
  }, [removePacket, toast]);

  // Handle remove single file (Upload page)
  const handleRemoveFile = useCallback((fileId) => {
    handleRemovePacket(fileId);
  }, [handleRemovePacket]);

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
    // Debug: console.log("View document:", document.id, packet?.filename);
  }, []);

  // Handle open review queue
  const handleOpenReview = useCallback(() => {
    setViewMode(ViewMode.REVIEW);
  }, []);

  // Handle close review queue
  const handleCloseReview = useCallback(() => {
    setViewMode(ViewMode.RESULTS);
  }, []);

  // Handle approve review item - apply edits, verify persistence, and mark as reviewed
  const handleApproveReview = useCallback(async (document, packet, reviewData) => {
    const sentEdits = reviewData.editedFields || {};
    const editedCount = Object.keys(sentEdits).length;
    // userEditedCount = fields the reviewer actually typed into (excludes phantom edits
    // and schema-fill fields). Falls back to editedCount for backwards compatibility.
    const userEditedCount = reviewData.userEditedCount ?? editedCount;
    const reviewer = getUsername() || "reviewer";
    const catOverride = reviewData.categoryOverride || null;
    const docName = catOverride?.name || document.splitType || document.classification?.category || "Document";

    // Save to database — the server returns the saved document for verification
    const savedDoc = await api.reviewDocument(document.id, {
      status: "reviewed",
      editedFields: sentEdits,
      reviewerNotes: reviewData.reviewerNotes || null,
      reviewedBy: reviewer,
      ...(catOverride && { categoryOverride: catOverride }),
    });

    // --- Verify the save was persisted correctly ---
    const savedEdits = savedDoc?.edited_fields
      ? (typeof savedDoc.edited_fields === "string" ? JSON.parse(savedDoc.edited_fields) : savedDoc.edited_fields)
      : {};
    const savedStatus = savedDoc?.status;

    // Check status was set
    if (savedStatus !== "reviewed") {
      throw new Error(`Server returned status "${savedStatus}" instead of "reviewed"`);
    }

    // Check edited fields round-tripped correctly (key count + value equality)
    if (editedCount > 0) {
      const savedKeys = Object.keys(savedEdits);
      if (savedKeys.length !== editedCount) {
        throw new Error(`Sent ${editedCount} field edits but server persisted ${savedKeys.length}`);
      }
      for (const [key, value] of Object.entries(sentEdits)) {
        if (JSON.stringify(savedEdits[key]) !== JSON.stringify(value)) {
          throw new Error(`Field "${key}" was not persisted correctly`);
        }
      }
    }

    // --- Verified: update local state ---
    updateDocument(packet.id, document.id, {
      status: "reviewed",
      needsReview: false,
      editedFields: sentEdits,
      reviewerNotes: reviewData.reviewerNotes || null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewer,
      ...(catOverride && { categoryOverride: catOverride }),
    });

    if (!isProduction) console.log("Review sealed:", document.id, { editedCount, userEditedCount });

    // Return result for ReviewQueue UI feedback
    return { ok: true, editedCount: userEditedCount, documentName: docName };
  }, [updateDocument, toast]);

  // Handle reject review item - mark for re-processing or removal
  const handleRejectReview = useCallback(async (document, packet, reviewData) => {
    try {
      // Save rejection to database
      await api.reviewDocument(document.id, {
        status: "rejected",
        editedFields: {},
        reviewerNotes: reviewData.reviewerNotes || "Rejected by reviewer",
        reviewedBy: getUsername() || "reviewer",
      });
      
      // Update local state
      updateDocument(packet.id, document.id, {
        status: "rejected",
        needsReview: false,
        reviewerNotes: reviewData.reviewerNotes || "Rejected by reviewer",
        reviewedAt: new Date().toISOString(),
        reviewedBy: getUsername() || "reviewer",
      });
      
      toast.info("Document rejected");
      if (!isProduction) console.log("Document rejected:", document.id);
    } catch (error) {
      console.error("Failed to save rejection:", error);
      toast.error("Failed to save rejection: " + error.message);
    }
  }, [updateDocument, toast]);

  // Handle new upload — go to upload page to add more files; do not clear existing packets
  const handleNewUpload = useCallback(() => {
    setCurrentRunSaved(false);
    setViewMode(ViewMode.UPLOAD);
  }, []);

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
    <div className="h-screen bg-gray-50 dark:bg-neutral-900 flex flex-col overflow-hidden transition-colors">
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
                  <span className="text-[10px] text-gray-400 dark:text-neutral-500">v0.4.4</span>
                </div>
                <span className="text-[9px] tracking-wider text-gray-400 dark:text-neutral-500" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Structured Data, On Demand</span>
              </div>
              
              {!isSetupComplete && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded ml-2">
                  API Key Required
                </span>
              )}
            </button>
            
            {/* Center: Navigation */}
            {isSetupComplete && (
              <nav className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode(ViewMode.DASHBOARD)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.DASHBOARD
                        ? isDark ? "bg-white text-gray-900 shadow-md ring-1 ring-neutral-400/50" : "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 dark:text-neutral-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-600"
                    }`}
                  >
                    Home
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.UPLOAD)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      viewMode === ViewMode.UPLOAD
                        ? isDark ? "bg-white text-gray-900 shadow-md ring-1 ring-neutral-400/50" : "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 dark:text-neutral-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-600"
                    }`}
                  >
                    Upload
                    {!isProcessing && packets.some(p => p.status === "queued") && (
                      <span className="w-2 h-2 bg-[#9e2339] rounded-full" title="Files queued — ready to start" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.RESULTS)}
                    title={hasPackets ? "View processing results" : "Results (no items yet)"}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.PROCESSING || viewMode === ViewMode.RESULTS
                        ? isDark ? "bg-white text-gray-900 shadow-md ring-1 ring-neutral-400/50" : "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 dark:text-neutral-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-600"
                    }`}
                  >
                    Results
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.REVIEW)}
                    title={hasNeedsReview ? `${stats.needsReview} document(s) need review` : "Review queue (empty if none need review)"}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      viewMode === ViewMode.REVIEW
                        ? isDark ? "bg-white text-gray-900 shadow-md ring-1 ring-neutral-400/50" : "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 dark:text-neutral-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-600"
                    }`}
                  >
                    Review
                    {hasNeedsReview && (
                      <span className="w-2 h-2 bg-amber-500 rounded-full" title={`${stats.needsReview} need review`} />
                    )}
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.EXPORT)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.EXPORT
                        ? isDark ? "bg-white text-gray-900 shadow-md ring-1 ring-neutral-400/50" : "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 dark:text-neutral-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-600"
                    }`}
                  >
                    Export
                  </button>
                </nav>
            )}
            
            {/* Right: Actions */}
            {isSetupComplete && (
              <div className="flex items-center gap-1">
                {/* Username badge */}
                <span className="text-xs text-gray-500 dark:text-neutral-400 hidden sm:inline mr-1">{getUsername()}</span>
                <div className="relative group">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 dark:text-neutral-400">
                    <Menu className="h-4 w-4" />
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    {/* Tools */}
                    <button
                      onClick={() => setViewMode(ViewMode.HISTORY)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <History className="h-4 w-4" />
                      History
                    </button>
                    <button
                      onClick={() => setViewMode(ViewMode.HELP)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Help & Docs
                    </button>
                    <button
                      onClick={() => setShowSchemaExplorer(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <BookOpen className="h-4 w-4" />
                      Schemas
                    </button>
                    <div className="border-t border-gray-100 dark:border-neutral-700 my-1" />
                    {/* Admin & Support */}
                    <button
                      onClick={() => setViewMode(ViewMode.ADMIN)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Admin
                    </button>
                    <a
                      href="mailto:philip.snowden@stewart.com?subject=SAIL%20Inquiry%20from%20CORTEX"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#9e2339] hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Mail className="h-4 w-4" />
                      Contact SAIL
                    </a>
                    <div className="border-t border-gray-100 dark:border-neutral-700 my-1" />
                    <button
                      onClick={handleClearApiKey}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 dark:text-neutral-400"
                  onClick={toggleDarkMode}
                  title={isDark ? "Light mode" : "Dark mode"}
                  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Onboarding modal (API Key + Username) */}
        {!isSetupComplete && (
          <OnboardingModal
            usernameInput={usernameInput}
            setUsernameInput={setUsernameInput}
            apiKeyInput={apiKeyInput}
            setApiKeyInput={setApiKeyInput}
            onComplete={handleSaveApiKey}
            showWarning={showApiKeyWarning}
            setShowWarning={setShowApiKeyWarning}
          />
        )}

        {/* Dashboard view (home) */}
        {isSetupComplete && viewMode === ViewMode.DASHBOARD && (
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
        {isSetupComplete && viewMode === ViewMode.UPLOAD && (() => {
          // Only show queued packets on the upload page — completed/failed/processing
          // packets belong on the Results page, not cluttering the upload staging area.
          const queuedPackets = packets.filter(
            p => p.status === "queued" || p.status === "splitting" || p.status === "classifying" || p.status === "extracting"
          );
          const hasQueuedPackets = queuedPackets.length > 0;

          return (
            <div className="flex-1 min-h-0 overflow-y-auto max-w-4xl mx-auto px-4 py-8 w-full">
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
                    selectedFiles={queuedPackets}
                    onClearAll={handleClearAll}
                    onRemoveFile={handleRemoveFile}
                    disabled={false}
                    sessionId={sessionId}
                    dbConnected={dbConnected}
                    processingConfig={runConfig || retabConfig}
                    initialFilesToProcess={pendingDropFiles}
                    onInitialFilesProcessed={() => setPendingDropFiles(null)}
                  />
                  
                  {/* Processing config override for this run */}
                  {hasQueuedPackets && (
                    <ProcessingConfigOverride
                      config={runConfig || retabConfig}
                      onChange={setRunConfig}
                      globalConfig={retabConfig}
                    />
                  )}

                  {hasQueuedPackets && (
                    <div className="pt-4">
                      <Button
                        onClick={handleStartProcessing}
                        size="lg"
                        className="w-full py-3 text-base bg-[#9e2339] hover:bg-[#852030] text-white gap-2"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Start Processing {queuedPackets.length} file{queuedPackets.length !== 1 ? "s" : ""}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* Processing/Results view */}
        {isSetupComplete && (viewMode === ViewMode.PROCESSING || viewMode === ViewMode.RESULTS) && (
          <ErrorBoundary name="Results">
          <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full min-h-0">
            {/* Toolbar */}
            <div className="mb-3 shrink-0">
              {/* Processing state */}
              {isProcessing && (
                <>
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="h-2 w-2 rounded-full bg-[#9e2339] animate-pulse shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                        {currentActivityLabel
                          ? `${footerProgress.completedFiles} of ${footerProgress.totalFiles} done \u00b7 ${currentActivityLabel.detail}`
                          : `${footerProgress.completedFiles} of ${footerProgress.totalFiles} done`}
                      </span>
                    </div>
                    <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500 shrink-0">
                      {footerProgress.percent}%
                    </span>
                    <Button
                      size="sm"
                      onClick={pause}
                      className="h-8 px-4 gap-1.5 bg-[#9e2339] hover:bg-[#852030] text-white shrink-0"
                    >
                      <Square className="h-3 w-3 fill-current" />
                      Stop
                    </Button>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full"
                      style={{
                        width: `${Math.max(2, footerProgress.percent)}%`,
                        transition: "width 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    />
                  </div>
                </>
              )}

              {/* Stopped state */}
              {isPaused && (
                <>
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-sm text-amber-600 dark:text-amber-400">
                        Stopped &mdash; {footerProgress.completedFiles} of {footerProgress.totalFiles} file{footerProgress.totalFiles !== 1 ? "s" : ""} done
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={resume}
                      className="h-8 px-4 gap-1.5 bg-[#9e2339] hover:bg-[#852030] text-white shrink-0"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Resume
                    </Button>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 dark:bg-amber-500 rounded-full"
                      style={{ width: `${Math.max(2, footerProgress.percent)}%` }}
                    />
                  </div>
                </>
              )}

              {/* Idle state */}
              {!isProcessing && !isPaused && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex items-center gap-2.5 text-sm text-gray-500 dark:text-gray-400 flex-1 min-w-0">
                    <span className="tabular-nums">{packets.length} file{packets.length !== 1 ? "s" : ""}</span>
                    <span className="text-gray-300 dark:text-neutral-600">&middot;</span>
                    <span className="tabular-nums">{stats?.total ?? 0} doc{(stats?.total ?? 0) !== 1 ? "s" : ""}</span>
                    {(stats?.completed ?? 0) > 0 && (
                      <>
                        <span className="text-gray-300 dark:text-neutral-600">&middot;</span>
                        <span className="text-green-600 dark:text-green-400 tabular-nums">{stats.completed} done</span>
                      </>
                    )}
                    {(stats?.needsReview ?? 0) > 0 && (
                      <>
                        <span className="text-gray-300 dark:text-neutral-600">&middot;</span>
                        <span className="text-amber-600 dark:text-amber-400 tabular-nums">{stats.needsReview} review</span>
                      </>
                    )}
                    {(stats?.failed ?? 0) > 0 && (
                      <>
                        <span className="text-gray-300 dark:text-neutral-600">&middot;</span>
                        <span className="text-red-500 tabular-nums">{stats.failed} failed</span>
                      </>
                    )}
                  </div>
                  {(() => {
                    const queuedFiles = packets.filter(p => p.status === "queued");
                    if (queuedFiles.length === 0) return null;
                    return (
                      <Button
                        size="sm"
                        onClick={handleStartProcessing}
                        className="h-8 px-4 gap-1.5 bg-[#9e2339] hover:bg-[#852030] text-white shrink-0 animate-in fade-in"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        Process {queuedFiles.length} file{queuedFiles.length !== 1 ? "s" : ""}
                      </Button>
                    );
                  })()}
                </div>
              )}

            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto">
              <PacketResultsView
                packets={packets}
                stats={stats}
                retabConfig={retabConfig}
                onViewDocument={handleViewDocument}
                onRetryPacket={retryPacket}
                onRetryDocument={retryDocument}
                onRemovePacket={handleRemovePacket}
                onRetryAllFailed={retryAllFailed}
              />
            </div>

            {/* Completion banner — only when a run just finished in this session */}
            {isComplete && !isProcessing && showCompletionBanner && !bannerDismissed && (
              <div className="mt-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shrink-0 relative">
                {/* Dismiss */}
                <button
                  onClick={() => setBannerDismissed(true)}
                  className="absolute top-2 right-2 p-1 rounded-md text-green-400 hover:text-green-600 dark:text-green-600 dark:hover:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/40 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-center justify-between gap-4 pr-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 bg-green-100 dark:bg-green-800/50 rounded-full shrink-0">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Done — {stats?.completed ?? 0} completed{(stats?.needsReview ?? 0) > 0 ? `, ${stats.needsReview} need review` : ""}{(stats?.failed ?? 0) > 0 ? `, ${stats.failed} failed` : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-green-600/80 dark:text-green-400/70">
                        {currentRunSaved && <span>Saved to history</span>}
                        {(usage?.totalPages ?? 0) > 0 && <span>{currentRunSaved ? "·" : ""} {usage.totalPages} page{usage.totalPages !== 1 ? "s" : ""}</span>}
                        {(usage?.totalCost ?? 0) > 0 && <span>· ${usage.totalCost.toFixed(2)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {stats.needsReview > 0 && (
                      <Button
                        size="sm"
                        onClick={() => setViewMode(ViewMode.REVIEW)}
                        className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                      >
                        <ListChecks className="h-3.5 w-3.5 mr-1" />
                        Review
                      </Button>
                    )}
                    {hasFailed && (
                      <Button variant="ghost" size="sm" onClick={retryAllFailed} className="h-8 px-2.5 text-xs text-green-700 dark:text-green-300">
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          </ErrorBoundary>
        )}

        {/* Review queue view */}
        {isSetupComplete && viewMode === ViewMode.REVIEW && (
          <ErrorBoundary name="Review">
            <div className="flex-1 min-h-0">
              <ReviewQueue
                packets={packets}
                onApprove={handleApproveReview}
                onClose={handleCloseReview}
              />
            </div>
          </ErrorBoundary>
        )}

        {/* Export view */}
        {isSetupComplete && viewMode === ViewMode.EXPORT && (
          <ErrorBoundary name="Export">
            <Suspense fallback={<LazyFallback name="Export" />}>
              <ExportPage packets={packets} stats={stats} />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* History view */}
        {isSetupComplete && viewMode === ViewMode.HISTORY && (
          <ErrorBoundary name="History">
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
          </ErrorBoundary>
        )}

        {/* Admin Dashboard view */}
        {isSetupComplete && viewMode === ViewMode.ADMIN && (
          <ErrorBoundary name="Admin Dashboard">
            <Suspense fallback={<LazyFallback name="Admin Dashboard" />}>
              <div className="flex-1 min-h-0">
                <AdminDashboard
                  packets={packets}
                  stats={stats}
                  usage={usage}
                  retabConfig={retabConfig}
                  history={history}
                  dbConnected={dbConnected || healthStatus.database === 'online'}
                  onClose={() => setViewMode(hasPackets ? ViewMode.RESULTS : ViewMode.DASHBOARD)}
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Help Documentation view */}
        {viewMode === ViewMode.HELP && (
          <ErrorBoundary name="Help">
            <Suspense fallback={<LazyFallback name="Help" />}>
              <div className="flex-1 min-h-0">
                <HelpDocumentation
                  onClose={() => setViewMode(hasPackets ? ViewMode.RESULTS : ViewMode.DASHBOARD)}
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        )}
      </main>

      {/* Footer — balanced 3-column grid, SAIL always centered */}
      <footer className="border-t border-gray-100 dark:border-neutral-700 bg-gray-50/80 dark:bg-neutral-800/80 shrink-0 w-full">
        <div className="w-full px-4 py-2">
          <div className="grid grid-cols-3 items-center">
            {/* Left: Health */}
            <div className="flex items-center gap-3">
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
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="text-gray-400 dark:text-neutral-500">Retab Online</span>
                  </>
                ) : healthStatus.server === 'checking' ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse shrink-0" />
                    <span className="text-gray-400">Connecting…</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="text-red-500">
                      {healthStatus.server === 'offline' ? 'Offline' : 
                       healthStatus.database !== 'online' ? 'DB Error' : 'Error'}
                    </span>
                  </>
                )}
              </div>

              {/* Processing stats — appear contextually */}
              {hasPackets && (
                <>
                  <div className="w-px h-3 bg-gray-200 dark:bg-neutral-600" />
                  <div className="flex items-center gap-2 text-[10px]">
                    {stats.completed > 0 && (
                      <span className="text-gray-400 dark:text-neutral-500" title={`${stats.completed} completed`}>
                        <span className="text-green-500">✓</span> {stats.completed}
                      </span>
                    )}
                    {stats.needsReview > 0 && (
                      <span className="text-amber-500" title={`${stats.needsReview} need review`}>
                        ⚠ {stats.needsReview}
                      </span>
                    )}
                    {stats.failed > 0 && (
                      <span className="text-red-400" title={`${stats.failed} failed`}>
                        ✕ {stats.failed}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            
            {/* Center: Branding — always centered */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] cursor-help" title="Stewart AI Lab - Intelligent Document Processing">
              <span className="text-gray-300 dark:text-neutral-600">POWERED BY</span>
              <span className="font-semibold text-[#9e2339]">SAIL</span>
            </div>
            
            {/* Right: Cost — appears when available */}
            <div className="flex items-center gap-2 justify-end text-[10px]">
              {usage.totalCost > 0 && (
                <div 
                  className="flex items-center gap-1.5 cursor-help" 
                  title={`Retab API Usage\nTotal Cost: $${usage.totalCost.toFixed(3)}\nCredits: ${usage.totalCredits}\nPages Processed: ${usage.totalPages || 'N/A'}\nAPI Calls: ${usage.totalCalls || 'N/A'}`}
                >
                  <span className="text-gray-400 dark:text-neutral-500">${usage.totalCost.toFixed(3)}</span>
                  {usage.totalCredits > 0 && (
                    <span className="text-gray-300 dark:text-neutral-600">{usage.totalCredits.toFixed(1)} cr</span>
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
            <ErrorBoundary name="Schema Explorer">
              <Suspense fallback={<LazyFallback name="Schema Explorer" />}>
                <SchemaExplorer onClose={() => setShowSchemaExplorer(false)} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      )}
      
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, action: null })}
        onConfirm={() => confirmDialog.action?.()}
        title={confirmDialog.title ?? "Confirm"}
        message={confirmDialog.message ?? ""}
        confirmText={confirmDialog.confirmText ?? "Confirm"}
        cancelText={confirmDialog.cancelText ?? "Cancel"}
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
