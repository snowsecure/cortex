import React, { useState, useCallback, useEffect, useMemo } from "react";
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
import { RetabSettingsPanel, BatchConfigOverride, QuickSettingsBadge } from "./components/RetabSettings";
import { SchemaExplorer } from "./components/SchemaExplorer";
import { saveSettings, RETAB_MODELS } from "./lib/retabConfig";
import { useBatchQueue, BatchStatus } from "./hooks/useBatchQueue";
import { useProcessingHistory } from "./hooks/useProcessingHistory";
import { getApiKey, setApiKey, hasApiKey } from "./lib/retab";
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
  Settings, 
  Settings2,
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
  Sliders,
  Zap,
  BookOpen,
  Mail,
} from "lucide-react";

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
 * Welcome Dashboard Component
 */
function WelcomeDashboard({ 
  onUpload, 
  onViewHistory, 
  onViewHelp, 
  onViewAdmin,
  history,
  usage,
  currentStats 
}) {
  // Calculate aggregate stats from history
  const totalStats = React.useMemo(() => {
    let totalDocs = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalReview = 0;
    
    for (const entry of history) {
      if (entry.stats) {
        totalDocs += entry.stats.total || 0;
        totalCompleted += entry.stats.completed || 0;
        totalFailed += entry.stats.failed || 0;
        totalReview += entry.stats.needsReview || 0;
      }
    }
    
    // Add current batch if any
    if (currentStats?.total > 0) {
      totalDocs += currentStats.total;
      totalCompleted += currentStats.completed || 0;
      totalFailed += currentStats.failed || 0;
      totalReview += currentStats.needsReview || 0;
    }
    
    const successRate = totalDocs > 0 ? Math.round((totalCompleted / totalDocs) * 100) : 0;
    
    return { totalDocs, totalCompleted, totalFailed, totalReview, successRate };
  }, [history, currentStats]);

  const hasStats = totalStats.totalDocs > 0 || usage?.totalCost > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-6xl tracking-tight text-gray-900 mb-2" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900 }}>
            CORTEX
          </h1>
          <p className="text-sm text-gray-400 tracking-widest uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Structured Data, On Demand
          </p>
        </div>

        {/* Stats Row */}
        {hasStats && (
          <div className="flex items-center justify-center gap-8 mb-10 py-4 px-6 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{totalStats.totalDocs}</p>
              <p className="text-xs text-gray-500">Documents</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{totalStats.successRate}%</p>
              <p className="text-xs text-gray-500">Success Rate</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{history.length}</p>
              <p className="text-xs text-gray-500">Batches</p>
            </div>
            {usage?.totalCost > 0 && (
              <>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">${usage.totalCost.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Total Spent</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <button
            onClick={onUpload}
            className="group p-6 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
              <Upload className="h-5 w-5 text-gray-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Upload Documents</h3>
            <p className="text-sm text-gray-500">
              Process new PDF packets
            </p>
          </button>

          <button
            onClick={onViewHistory}
            className="group p-6 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
              <History className="h-5 w-5 text-gray-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">
              View History
              {history.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({history.length})
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500">
              Previously processed documents
            </p>
          </button>

          <button
            onClick={onViewHelp}
            className="group p-6 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
              <HelpCircle className="h-5 w-5 text-gray-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Help & Docs</h3>
            <p className="text-sm text-gray-500">
              Learn how CORTEX works
            </p>
          </button>
        </div>

        {/* Workflow Steps - Interactive */}
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            onClick={onUpload}
            className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:scale-105 transition-all"
          >
            <span className="w-6 h-6 rounded-full bg-gray-900 group-hover:bg-gray-800 text-white flex items-center justify-center text-xs font-bold transition-colors">1</span>
            <span className="text-gray-700 font-medium">Upload</span>
          </button>
          <div className="w-8 h-px bg-gradient-to-r from-gray-300 to-gray-200" />
          <button
            onClick={onViewHelp}
            className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:scale-105 transition-all"
            title="AI identifies document boundaries"
          >
            <span className="w-6 h-6 rounded-full bg-gray-900 group-hover:bg-gray-800 text-white flex items-center justify-center text-xs font-bold transition-colors">2</span>
            <span className="text-gray-700 font-medium">Split</span>
          </button>
          <div className="w-8 h-px bg-gradient-to-r from-gray-200 to-gray-300" />
          <button
            onClick={onViewHelp}
            className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:scale-105 transition-all"
            title="Data extracted using custom schemas"
          >
            <span className="w-6 h-6 rounded-full bg-gray-900 group-hover:bg-gray-800 text-white flex items-center justify-center text-xs font-bold transition-colors">3</span>
            <span className="text-gray-700 font-medium">Extract</span>
          </button>
          <div className="w-8 h-px bg-gradient-to-r from-gray-300 to-gray-200" />
          <button
            onClick={onViewHelp}
            className="group flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:scale-105 transition-all"
            title="Export to JSON, CSV, or TPS"
          >
            <span className="w-6 h-6 rounded-full bg-gray-900 group-hover:bg-gray-800 text-white flex items-center justify-center text-xs font-bold transition-colors">4</span>
            <span className="text-gray-700 font-medium">Export</span>
          </button>
        </div>

        {/* Bottom Links */}
        <div className="flex items-center justify-center gap-4 mt-8 text-sm text-gray-500">
          <button 
            onClick={onViewAdmin}
            className="hover:text-gray-700 transition-colors"
          >
            Admin
          </button>
          <span className="text-gray-300">·</span>
          <a 
            href="mailto:philip.snowden@stewart.com?subject=SAIL%20Inquiry%20from%20CORTEX"
            className="hover:text-gray-700 transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
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
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSchemaExplorer, setShowSchemaExplorer] = useState(false);
  const [showSessionRestoredBanner, setShowSessionRestoredBanner] = useState(false);
  const [batchConfig, setBatchConfig] = useState(null); // Per-batch override
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, action: null });
  
  // Health status
  const [healthStatus, setHealthStatus] = useState({
    server: 'checking',
    database: 'checking',
    retabApi: 'unknown',
    lastCheck: null,
    error: null
  });

  // Batch queue hook
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

  // Track if we've saved the current batch to history
  const [currentBatchSaved, setCurrentBatchSaved] = useState(false);

  // Save to history when batch completes
  useEffect(() => {
    if (isComplete && !currentBatchSaved && packets.length > 0) {
      addToHistory({ packets, stats });
      setCurrentBatchSaved(true);
    }
  }, [isComplete, currentBatchSaved, packets, stats, addToHistory]);

  // Reset saved flag when starting new batch
  useEffect(() => {
    if (batchStatus === BatchStatus.PROCESSING) {
      setCurrentBatchSaved(false);
    }
  }, [batchStatus]);

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
    // Apply batch-specific config if set
    if (batchConfig) {
      setRetabConfig(batchConfig);
    }
    setViewMode(ViewMode.PROCESSING);
    setCurrentBatchSaved(false);
    start();
    // Clear batch config after starting
    setBatchConfig(null);
  }, [start, batchConfig, setRetabConfig]);

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
  const handleApproveReview = useCallback((document, packet, reviewData) => {
    console.log("Approved:", document.id, {
      editedFields: reviewData.editedFields,
      notes: reviewData.reviewerNotes,
    });
    
    // TODO: In production, update the document state:
    // - Apply editedFields to extraction data
    // - Clear needsReview flag
    // - Save reviewerNotes
    // - Sync to database
  }, []);

  // Handle reject review item - mark for re-processing or removal
  const handleRejectReview = useCallback((document, packet, reviewData) => {
    console.log("Rejected:", document.id, {
      notes: reviewData.reviewerNotes,
    });
    
    // TODO: In production:
    // - Flag document as rejected
    // - Save rejection reason/notes
    // - Optionally remove from results or mark for re-processing
  }, []);

  // Handle new batch - go back to upload without clearing results
  const handleNewBatch = useCallback(() => {
    clearAll();
    setCurrentBatchSaved(false);
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shrink-0">
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
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
              </div>
              
              {/* Brand text */}
              <div className="flex flex-col -space-y-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl tracking-wide text-gray-900" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900 }}>CORTEX</span>
                  <span className="text-[10px] text-gray-400">v0.2</span>
                </div>
                <span className="text-[9px] tracking-wider text-gray-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Structured Data, On Demand</span>
              </div>
              
              {!apiKeyConfigured && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded ml-2">
                  API Key Required
                </span>
              )}
            </button>
            
            {/* Center: Navigation */}
            {apiKeyConfigured && (
              <nav className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode(ViewMode.DASHBOARD)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.DASHBOARD
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Home
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.UPLOAD)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.UPLOAD
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Upload
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.RESULTS)}
                    disabled={!hasPackets}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.PROCESSING || viewMode === ViewMode.RESULTS
                        ? "bg-white text-gray-900 shadow-sm"
                        : hasPackets 
                          ? "text-gray-600 hover:text-gray-900" 
                          : "text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Results
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.REVIEW)}
                    disabled={!hasNeedsReview}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      viewMode === ViewMode.REVIEW
                        ? "bg-white text-gray-900 shadow-sm"
                        : hasNeedsReview 
                          ? "text-gray-600 hover:text-gray-900" 
                          : "text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Review
                    {hasNeedsReview && (
                      <span className="w-2 h-2 bg-amber-500 rounded-full" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => setViewMode(ViewMode.HISTORY)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      viewMode === ViewMode.HISTORY
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    History
                  </button>
                </nav>
            )}
            
            {/* Right: Actions */}
            {apiKeyConfigured && (
              <div className="flex items-center gap-3">
                {/* Cost tracker */}
                {usage.totalCost > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-50 to-green-50 rounded-md border border-emerald-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-700">
                      ${usage.totalCost.toFixed(2)}
                    </span>
                    {usage.totalCredits > 0 && (
                      <span className="text-[10px] text-emerald-500">
                        ({usage.totalCredits} cr)
                      </span>
                    )}
                  </div>
                )}
                
                <QuickSettingsBadge 
                  config={retabConfig} 
                  onClick={() => setShowSettingsPanel(true)} 
                />
                
                <div className="relative group">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
                    <Menu className="h-4 w-4" />
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <button
                      onClick={() => setShowSettingsPanel(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Sliders className="h-4 w-4" />
                      Settings
                    </button>
                    <button
                      onClick={() => setShowSchemaExplorer(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <BookOpen className="h-4 w-4" />
                      Schemas
                    </button>
                    <button
                      onClick={() => setViewMode(ViewMode.ADMIN)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Admin
                    </button>
                    <button
                      onClick={() => setViewMode(ViewMode.HELP)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Help & Docs
                    </button>
                    <a
                      href="mailto:philip.snowden@stewart.com?subject=SAIL%20Inquiry%20from%20CORTEX"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#9e2339] hover:bg-red-50"
                    >
                      <Mail className="h-4 w-4" />
                      Contact SAIL
                    </a>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={handleClearApiKey}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
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
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <History className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Previous session restored
                </p>
                <p className="text-xs text-blue-700">
                  {stats.completed + stats.needsReview} document{stats.completed + stats.needsReview !== 1 ? 's' : ''} from your last session. 
                  Note: Original PDF files are not preserved.
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
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                Start Fresh
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSessionRestoredBanner(false)}
                className="text-blue-500 hover:text-blue-700"
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

        {/* Dashboard view */}
        {apiKeyConfigured && viewMode === ViewMode.DASHBOARD && (
          <WelcomeDashboard
            onUpload={() => setViewMode(ViewMode.UPLOAD)}
            onViewHistory={() => setViewMode(ViewMode.HISTORY)}
            onViewHelp={() => setViewMode(ViewMode.HELP)}
            onViewAdmin={() => setViewMode(ViewMode.ADMIN)}
            history={history}
            usage={usage}
            currentStats={stats}
          />
        )}

        {/* Upload view */}
        {apiKeyConfigured && viewMode === ViewMode.UPLOAD && (
          <div className="max-w-4xl mx-auto px-4 py-8 w-full">
            <Card>
              <CardHeader>
                <CardTitle>Upload Document Packets</CardTitle>
                <CardDescription>
                  Upload PDF packets containing title documents. Each PDF can contain
                  multiple documents from a single real estate transaction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <BatchFileUpload
                  onFilesSelected={handleFilesSelected}
                  selectedFiles={packets}
                  onClearAll={handleClearAll}
                  onRemoveFile={handleRemoveFile}
                  disabled={isProcessing}
                />
                
                {/* Batch-specific config override */}
                {hasPackets && (
                  <BatchConfigOverride
                    config={batchConfig || retabConfig}
                    onChange={setBatchConfig}
                    globalConfig={retabConfig}
                  />
                )}

                {hasPackets && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      {packets.length} packet{packets.length !== 1 ? "s" : ""} ready
                      to process
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
                    <span className="text-sm text-gray-500">Processing</span>
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
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <FileText className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-900">
                        Batch processing complete
                      </p>
                      <p className="text-sm text-green-700">
                        {stats.completed} completed
                        {stats.needsReview > 0 && `, ${stats.needsReview} need review`}
                        {stats.failed > 0 && `, ${stats.failed} failed`}
                        {currentBatchSaved && " • Saved to history"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50 shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Left: Health + Processing Stats */}
            <div className="flex items-center gap-3 min-w-[200px]">
              {/* Health Status */}
              <div 
                className="flex items-center gap-1.5 text-[10px] cursor-help"
                title={
                  healthStatus.server === 'online' && healthStatus.database === 'online'
                    ? `Server: Online\nDatabase: Connected\nRetab API: ${apiKeyConfigured ? 'Configured' : 'Not configured'}\nLast check: ${healthStatus.lastCheck ? new Date(healthStatus.lastCheck).toLocaleTimeString() : 'Never'}`
                    : healthStatus.server === 'checking'
                    ? 'Checking connection to Retab extraction engine...'
                    : `Server: ${healthStatus.server === 'offline' ? 'Offline' : 'Error'}\nDatabase: ${healthStatus.database === 'online' ? 'Connected' : healthStatus.database}\n${healthStatus.error ? `Error: ${healthStatus.error}` : ''}`
                }
              >
                {healthStatus.server === 'online' && healthStatus.database === 'online' ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-gray-400">Retab Online</span>
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
              {hasPackets && <div className="w-px h-3 bg-gray-200" />}
              
              {/* Processing Stats */}
              {hasPackets && (
                <>
                  {stats.processing > 0 ? (
                    <div className="flex items-center gap-1.5 cursor-help" title={`Currently processing ${stats.processing} document${stats.processing > 1 ? 's' : ''}`}>
                      <div className="relative">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping absolute" />
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      </div>
                      <span className="text-[11px] font-medium text-blue-600">
                        {stats.processing} processing
                      </span>
                    </div>
                  ) : isComplete ? (
                    <div className="flex items-center gap-1 cursor-help" title="All documents have been processed">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="text-[11px] font-medium text-green-600">Complete</span>
                    </div>
                  ) : null}
                  
                  {stats.completed > 0 && (
                    <span className="text-[11px] text-gray-500 cursor-help" title={`${stats.completed} document${stats.completed > 1 ? 's' : ''} successfully extracted`}>
                      {stats.completed} <span className="text-green-500">✓</span>
                    </span>
                  )}
                  {stats.needsReview > 0 && (
                    <span className="text-[11px] text-amber-600 cursor-help" title={`${stats.needsReview} document${stats.needsReview > 1 ? 's' : ''} flagged for human review due to low confidence`}>
                      {stats.needsReview} review
                    </span>
                  )}
                  {stats.failed > 0 && (
                    <span className="text-[11px] text-red-500 cursor-help" title={`${stats.failed} document${stats.failed > 1 ? 's' : ''} failed to process - click to retry`}>
                      {stats.failed} failed
                    </span>
                  )}
                </>
              )}
            </div>
            
            {/* Center: Branding */}
            <div className="flex items-center gap-1.5 text-[11px] cursor-help" title="Stewart AI Lab - Intelligent Document Processing">
              <span className="text-gray-400">POWERED BY</span>
              <span className="font-semibold text-[#9e2339]">SAIL</span>
            </div>
            
            {/* Right: Cost & Progress */}
            <div className="flex items-center gap-3 min-w-[200px] justify-end">
              {hasPackets && stats.total > 0 && (
                <div 
                  className="flex items-center gap-1.5 cursor-help" 
                  title={`Progress: ${stats.completed} of ${stats.total} documents completed (${Math.round((stats.completed / stats.total) * 100)}%)`}
                >
                  <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#9e2339] to-[#c13350] transition-all duration-500"
                      style={{ width: `${Math.round((stats.completed / stats.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium w-8">
                    {Math.round((stats.completed / stats.total) * 100)}%
                  </span>
                </div>
              )}
              {usage.totalCost > 0 && (
                <div 
                  className="flex items-center gap-1 text-[11px] cursor-help" 
                  title={`Retab API Usage\nTotal Cost: $${usage.totalCost.toFixed(4)}\nCredits: ${usage.totalCredits}\nPages Processed: ${usage.totalPages || 'N/A'}\nAPI Calls: ${usage.totalCalls || 'N/A'}`}
                >
                  <span className="text-emerald-600 font-semibold">${usage.totalCost.toFixed(2)}</span>
                  {usage.totalCredits > 0 && (
                    <span className="text-gray-400">({usage.totalCredits} cr)</span>
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
      
      {/* Retab Settings Panel */}
      {showSettingsPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <RetabSettingsPanel
              onClose={() => setShowSettingsPanel(false)}
              onSave={(newSettings) => {
                setRetabConfig(newSettings);
                saveSettings(newSettings);
                setShowSettingsPanel(false);
              }}
            />
          </div>
        </div>
      )}
      
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
