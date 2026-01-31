import React, { useState, useCallback, useEffect } from "react";
import { BatchFileUpload } from "./components/BatchFileUpload";
import { PacketResultsView } from "./components/PacketResultsView";
import { ReviewQueue } from "./components/ReviewQueue";
import { BatchExport } from "./components/BatchExport";
import { ExportModal } from "./components/ExportModal";
import { HistoryLog, HistoryButton } from "./components/HistoryLog";
import { DocumentDetailModal } from "./components/DocumentDetailModal";
import { AdminDashboard } from "./components/AdminDashboard";
import { RetabSettingsPanel, BatchConfigOverride, QuickSettingsBadge } from "./components/RetabSettings";
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
  Trash2,
  Clock,
  CheckCircle,
  Menu,
  BarChart3,
  Sliders,
  Zap,
} from "lucide-react";

/**
 * View modes for the application
 */
const ViewMode = {
  UPLOAD: "upload",
  PROCESSING: "processing",
  RESULTS: "results",
  REVIEW: "review",
  HISTORY: "history",
  ADMIN: "admin",
};

function App() {
  // API Key state
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [apiKeyConfigured, setApiKeyConfigured] = useState(hasApiKey());
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState(ViewMode.UPLOAD);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSessionRestoredBanner, setShowSessionRestoredBanner] = useState(false);
  const [batchConfig, setBatchConfig] = useState(null); // Per-batch override

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
      setViewMode(ViewMode.PROCESSING);
    } else {
      setViewMode(ViewMode.UPLOAD);
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
          {/* Top row - Logo and actions */}
          <div className="flex items-center justify-between py-3">
            <button 
              onClick={() => setViewMode(ViewMode.UPLOAD)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
            >
              <img 
                src="/stewart-logo.png" 
                alt="Stewart" 
                className="h-11 w-11 rounded-full"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  SAIL - IDP <span className="text-sm font-normal text-gray-400">v0.2</span>
                </h1>
                <div className="flex items-center gap-3 text-xs">
                  {apiKeyConfigured ? (
                    <>
                      <span className="flex items-center gap-1 text-green-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        API Connected
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className={dbConnected ? "text-green-600" : "text-amber-600"}>
                        {dbConnected ? "DB Connected" : "Local Storage"}
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">
                        Retab Engine Ready
                      </span>
                      {hasPackets && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className={isProcessing ? "text-blue-600" : "text-gray-500"}>
                            {isProcessing ? "Processing..." : "Idle"}
                          </span>
                          {usage.totalCredits > 0 && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-emerald-600 font-medium" title={`${usage.totalCredits.toFixed(1)} credits × $0.01`}>
                                ${usage.totalCost.toFixed(2)} spent
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      API Key Required
                    </span>
                  )}
                </div>
              </div>
            </button>
            
            {apiKeyConfigured && (
              <div className="flex items-center gap-2">
                {/* Quick stats */}
                {hasPackets && (
                  <div className="hidden sm:flex items-center gap-3 mr-4 text-sm">
                    {stats.processing > 0 && (
                      <span className="flex items-center gap-1 text-blue-600">
                        <Clock className="h-4 w-4 animate-pulse" />
                        {stats.processing} processing
                      </span>
                    )}
                    {stats.completed > 0 && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        {stats.completed}
                      </span>
                    )}
                    {stats.needsReview > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        {stats.needsReview}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Quick settings badge */}
                <QuickSettingsBadge 
                  config={retabConfig} 
                  onClick={() => setShowSettingsPanel(true)} 
                />
                
                {/* Settings dropdown */}
                <div className="relative group">
                  <Button variant="ghost" size="sm" className="text-gray-500">
                    <Settings className="h-4 w-4 mr-1" />
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <button
                      onClick={() => setShowSettingsPanel(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Sliders className="h-4 w-4" />
                      Retab Settings
                    </button>
                    <button
                      onClick={() => setViewMode(ViewMode.ADMIN)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Admin Dashboard
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={handleClearApiKey}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Key className="h-4 w-4" />
                      Change API Key
                    </button>
                    <button
                      onClick={() => setShowExportModal(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      disabled={stats.completed + stats.needsReview === 0}
                    >
                      <Download className="h-4 w-4" />
                      Export Data
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => {
                        if (confirm("Clear all data and start fresh?")) {
                          clearAll();
                          setViewMode(ViewMode.UPLOAD);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear All Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Navigation tabs */}
          {apiKeyConfigured && (
            <nav className="flex items-center gap-1 -mb-px">
              <button
                onClick={() => setViewMode(ViewMode.UPLOAD)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  viewMode === ViewMode.UPLOAD
                    ? "border-[#9e2339] text-[#9e2339]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Upload className="h-4 w-4" />
                Upload
              </button>
              
              {hasPackets && (
                <button
                  onClick={() => setViewMode(ViewMode.RESULTS)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    viewMode === ViewMode.PROCESSING || viewMode === ViewMode.RESULTS
                      ? "border-[#9e2339] text-[#9e2339]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <FolderOpen className="h-4 w-4" />
                  Results
                  {stats.total > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                      {stats.total}
                    </span>
                  )}
                </button>
              )}
              
              {hasNeedsReview && (
                <button
                  onClick={() => setViewMode(ViewMode.REVIEW)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    viewMode === ViewMode.REVIEW
                      ? "border-[#9e2339] text-[#9e2339]"
                      : "border-transparent text-amber-600 hover:text-amber-700 hover:border-amber-300"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  Review
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                    {stats.needsReview}
                  </span>
                </button>
              )}
              
              <button
                onClick={handleViewHistory}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  viewMode === ViewMode.HISTORY
                    ? "border-[#9e2339] text-[#9e2339]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <History className="h-4 w-4" />
                History
                {history.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                    {history.length}
                  </span>
                )}
              </button>
            </nav>
          )}
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
                  setViewMode(ViewMode.UPLOAD);
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
            {/* Processing controls */}
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isComplete ? "Processing Results" : "Processing..."}
                </h2>
                
                {/* Processing controls */}
                {(isProcessing || isPaused) && (
                  <div className="flex items-center gap-2">
                    {isProcessing ? (
                      <Button variant="outline" size="sm" onClick={pause}>
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={resume}>
                        <Play className="h-4 w-4 mr-1" />
                        Resume
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Review queue button */}
                {hasNeedsReview && (
                  <Button
                    variant="outline"
                    onClick={handleOpenReview}
                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Review Queue ({stats.needsReview})
                  </Button>
                )}

                {/* Export buttons */}
                <div className="flex items-center gap-2">
                  <BatchExport packets={packets} stats={stats} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExportModal(true)}
                    disabled={stats.completed + stats.needsReview === 0}
                  >
                    <Settings2 className="h-4 w-4 mr-1" />
                    Custom Export
                  </Button>
                </div>
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
              onClose={() => setViewMode(hasPackets ? ViewMode.RESULTS : ViewMode.UPLOAD)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <p>
              POWERED BY{" "}
              <span className="font-semibold text-[#9e2339]">SAIL</span>
            </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[90vh] flex flex-col">
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
    </div>
  );
}

export default App;
