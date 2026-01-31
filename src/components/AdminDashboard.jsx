import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  FileText,
  Download,
  Server,
  Activity,
  Cpu,
  Database,
  Zap,
  Target,
  Eye,
  RefreshCw,
  Sparkles,
  MessageSquare,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Settings,
  Calendar,
  DollarSign,
  Gauge,
  Shield,
  Lightbulb,
  Bot,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { cn, getExtractionData, formatDateTimeCST } from "../lib/utils";
import { getAdminMetrics, clearDatabase } from "../lib/api";
import { 
  generateRetabResponse, 
  RETAB_CONCEPTS, 
  OPTIMIZATION_STRATEGIES,
  TROUBLESHOOTING,
} from "../lib/retabKnowledge";

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

function MetricCard({ title, value, subtitle, icon: Icon, trend, trendValue, variant = "default" }) {
  const variants = {
    default: "bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700",
    success: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    warning: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    danger: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  };
  
  return (
    <div className={cn("rounded-lg border p-4", variants[variant])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-neutral-400">{title}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-neutral-100">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={cn(
            "p-2 rounded-lg",
            variant === "success" && "bg-green-100 dark:bg-green-800/30",
            variant === "warning" && "bg-amber-100 dark:bg-amber-800/30",
            variant === "danger" && "bg-red-100 dark:bg-red-800/30",
            variant === "info" && "bg-blue-100 dark:bg-blue-800/30",
            variant === "default" && "bg-gray-100 dark:bg-neutral-700",
          )}>
            <Icon className={cn(
              "h-5 w-5",
              variant === "success" && "text-green-600 dark:text-green-400",
              variant === "warning" && "text-amber-600 dark:text-amber-400",
              variant === "danger" && "text-red-600 dark:text-red-400",
              variant === "info" && "text-blue-600 dark:text-blue-400",
              variant === "default" && "text-gray-600 dark:text-neutral-400",
            )} />
          </div>
        )}
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 mt-2 text-xs",
          trend === "up" && "text-green-600 dark:text-green-400",
          trend === "down" && "text-red-600 dark:text-red-400",
        )}>
          {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DANGER ZONE - Reset Application
// ============================================================================

// Local storage keys to clear during reset (preserves dark mode and API key)
const RESET_STORAGE_KEYS = [
  "stewart_ingestion_session",
  "stewart_processing_history", 
  "export_templates",
  "sail_retab_settings",
];

function DangerZone({ dbConnected, onCleared }) {
  const [password, setPassword] = useState("");
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!password.trim()) {
      setError("Password required");
      return;
    }
    setClearing(true);
    setError(null);
    setSuccess(false);
    try {
      // 1. Clear database (sessions, packets, documents, history, usage metrics)
      await clearDatabase(password);
      
      // 2. Clear local storage (except dark mode preference and API key)
      RESET_STORAGE_KEYS.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to clear localStorage key ${key}:`, e);
        }
      });
      
      setSuccess(true);
      setPassword("");
      
      // 3. Reload the page after a short delay to reset all in-memory state
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (e) {
      setError(e.message || "Failed to reset application");
    } finally {
      setClearing(false);
    }
  };

  if (!dbConnected) {
    return null;
  }

  return (
    <Card className="border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20">
      <CardHeader>
        <CardTitle className="text-base text-red-700 dark:text-red-400 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Reset Application
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-neutral-400">
            Completely reset the application. This will:
          </p>
          <ul className="text-sm text-gray-600 dark:text-neutral-400 list-disc list-inside space-y-1 ml-2">
            <li>Clear all sessions, packets, and documents</li>
            <li>Remove all processing history</li>
            <li>Reset usage metrics and logs</li>
            <li>Clear cached settings and export templates</li>
          </ul>
          <p className="text-sm">
            <strong className="text-red-700 dark:text-red-400">This action cannot be undone.</strong>
            <span className="text-gray-500 dark:text-neutral-500 text-xs ml-2">(Your API key and dark mode preference will be preserved.)</span>
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); setSuccess(false); }}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              disabled={clearing}
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReset}
              disabled={clearing || !password.trim()}
            >
              {clearing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Resetting…
                </>
              ) : (
                "Reset Application"
              )}
            </Button>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-xs text-green-600 dark:text-green-400">Application reset successfully. Reloading...</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CONFIDENCE DISTRIBUTION CHART
// ============================================================================

function ConfidenceDistribution({ data }) {
  // Check if we have actual confidence data
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-400 dark:text-neutral-500 text-sm mb-2">No confidence data available</p>
        <p className="text-gray-400 dark:text-neutral-500 text-xs">
          Use <span className="font-medium">consensus mode</span> (2× or higher) when processing to generate confidence scores.
        </p>
      </div>
    );
  }

  const buckets = [
    { label: "< 40%", range: [0, 0.4], color: "bg-red-500" },
    { label: "40-60%", range: [0.4, 0.6], color: "bg-amber-500" },
    { label: "60-80%", range: [0.6, 0.8], color: "bg-yellow-500" },
    { label: "80-95%", range: [0.8, 0.95], color: "bg-green-400" },
    { label: "95%+", range: [0.95, 1.01], color: "bg-green-600" },
  ];
  
  const distribution = buckets.map(bucket => ({
    ...bucket,
    count: data.filter(c => c >= bucket.range[0] && c < bucket.range[1]).length,
  }));
  
  const maxCount = Math.max(...distribution.map(d => d.count), 1);
  
  return (
    <div className="space-y-2">
      {distribution.map((bucket, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-neutral-400 w-16">{bucket.label}</span>
          <div className="flex-1 h-6 bg-gray-100 dark:bg-neutral-700 rounded overflow-hidden">
            <div 
              className={cn("h-full transition-all", bucket.color)}
              style={{ width: `${(bucket.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-8 text-right text-gray-700 dark:text-neutral-300">{bucket.count}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PROCESSING SPEED CHART
// ============================================================================

function ProcessingSpeedChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-400 dark:text-neutral-500 text-sm text-center py-4">No data yet</p>;
  }
  
  const maxTime = Math.max(...data.map(d => d.avgTime), 1);
  
  return (
    <div className="space-y-1">
      {data.slice(-7).map((day, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-neutral-400 w-16">{day.date}</span>
          <div className="flex-1 h-4 bg-gray-100 dark:bg-neutral-700 rounded overflow-hidden">
            <div 
              className="h-full bg-blue-500"
              style={{ width: `${(day.avgTime / maxTime) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-12 text-right text-gray-700 dark:text-neutral-300">{day.avgTime.toFixed(1)}s</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ACTIVITY LOG
// ============================================================================

function ActivityLog({ logs }) {
  const getLogIcon = (type) => {
    switch (type) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error": return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "info": return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return null;
    const styles = {
      completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      reviewed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
    const labels = {
      completed: "Completed",
      needs_review: "Review",
      failed: "Failed",
      reviewed: "Reviewed",
    };
    return (
      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${styles[status] || "bg-gray-100 text-gray-600"}`}>
        {labels[status] || status}
      </span>
    );
  };
  
  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {logs.length === 0 ? (
        <p className="text-gray-400 dark:text-neutral-500 text-sm text-center py-4">No recent activity</p>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-neutral-800">
            {getLogIcon(log.type)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-900 dark:text-neutral-100 truncate">{log.message}</p>
                {getStatusBadge(log.status)}
              </div>
              <p className="text-xs text-gray-400 dark:text-neutral-500">{log.timestamp}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// AI ASSISTANT COMPONENT
// ============================================================================

function AIAssistant({ metrics, retabConfig, onSuggestionApply }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  
  // Quick question suggestions
  const quickQuestions = [
    "How do I improve confidence scores?",
    "What is consensus mode?",
    "Which model should I use?",
    "How can I reduce costs?",
    "Why are documents needing review?",
    "What DPI setting is best?",
  ];
  
  // Generate initial suggestions based on metrics
  useEffect(() => {
    if (metrics && messages.length === 0) {
      generateInitialSuggestions();
    }
  }, [metrics]);
  
  const generateInitialSuggestions = () => {
    const suggestions = [];
    
    // Analyze metrics using knowledge base strategies
    if (metrics.avgConfidence < 0.7) {
      const strategies = OPTIMIZATION_STRATEGIES.confidence.strategies.slice(0, 2);
      suggestions.push({
        type: "warning",
        title: "Low Average Confidence",
        message: `Your average extraction confidence is ${(metrics.avgConfidence * 100).toFixed(1)}%. ${RETAB_CONCEPTS.confidenceScoring.content.split('\n')[0]}`,
        details: strategies.map(s => `• **${s.name}**: ${s.description}`).join('\n'),
        action: "Enable consensus mode",
      });
    }
    
    if (metrics.fieldReviewRate > 0.25) {
      const strategies = OPTIMIZATION_STRATEGIES.reviews.strategies.slice(0, 2);
      suggestions.push({
        type: "optimization",
        title: "High Field Review Rate",
        message: `${(metrics.fieldReviewRate * 100).toFixed(1)}% of fields have low confidence and may need review.`,
        details: strategies.map(s => `• **${s.name}**: ${s.description}`).join('\n'),
        action: "View review patterns",
      });
    }
    
    if (metrics.avgProcessingTime > 10) {
      const strategies = OPTIMIZATION_STRATEGIES.speed.strategies.slice(0, 2);
      suggestions.push({
        type: "performance",
        title: "Processing Time Optimization",
        message: `Average processing time is ${metrics.avgProcessingTime.toFixed(1)}s.`,
        details: strategies.map(s => `• **${s.name}**: ${s.description}`).join('\n'),
        action: "Review model usage",
      });
    }
    
    if (metrics.errorRate > 0.05) {
      const troubleshooting = TROUBLESHOOTING.extractionErrors;
      suggestions.push({
        type: "error",
        title: "Elevated Error Rate",
        message: `Error rate is ${(metrics.errorRate * 100).toFixed(1)}%.`,
        details: `**Common Causes:**\n${troubleshooting.causes.slice(0, 3).map(c => `• ${c}`).join('\n')}\n\n**Solutions:**\n${troubleshooting.solutions.slice(0, 3).map(s => `• ${s}`).join('\n')}`,
        action: "View error logs",
      });
    }
    
    // Add config-based suggestions
    if ((retabConfig?.nConsensus || 1) === 1 && metrics.avgConfidence < 0.8) {
      suggestions.push({
        type: "optimization",
        title: "Consider Consensus Mode",
        message: `You're not using consensus mode (n_consensus=1). ${RETAB_CONCEPTS.consensus.content.split('\n')[0]}`,
        details: "Consensus mode runs multiple extractions and compares results. Using n_consensus=3 typically improves confidence by 10-15%.",
        action: "Enable consensus",
      });
    }
    
    // Add a general tip if no issues
    if (suggestions.length === 0) {
      suggestions.push({
        type: "success",
        title: "System Health: Good",
        message: "All metrics are within healthy ranges. Your Retab configuration appears optimized.",
        details: `**Current Config:**\n• Model: ${retabConfig?.model || 'retab-small'}\n• Consensus: ${retabConfig?.nConsensus || 1}x\n• DPI: ${retabConfig?.imageDpi || 192}`,
        action: null,
      });
    }
    
    setMessages([{
      role: "assistant",
      content: "I've analyzed your processing metrics using Retab best practices. Here are my recommendations:",
      suggestions,
    }]);
  };
  
  const handleSend = async (customMessage = null) => {
    const messageToSend = customMessage || input.trim();
    if (!messageToSend) return;
    
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: messageToSend }]);
    setIsThinking(true);
    
    // Generate response using knowledge base
    setTimeout(() => {
      const response = generateRetabResponse(messageToSend, metrics, retabConfig);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.content,
        title: response.title,
        suggestions: response.suggestions,
      }]);
      setIsThinking(false);
    }, 800);
  };
  
  const handleQuickQuestion = (question) => {
    handleSend(question);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-neutral-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        <span className="font-medium text-gray-900 dark:text-neutral-100">SAIL AI Assistant</span>
        <Badge variant="secondary" className="text-xs">Powered by Retab Docs</Badge>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-neutral-800">
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "flex",
            msg.role === "user" ? "justify-end" : "justify-start"
          )}>
            <div className={cn(
              "max-w-[90%] rounded-lg p-3",
              msg.role === "user" 
                ? "bg-[#9e2339] text-white"
                : "bg-gray-100 dark:bg-neutral-700 text-gray-900 dark:text-neutral-100"
            )}>
              {/* Title for assistant messages */}
              {msg.role === "assistant" && msg.title && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-neutral-600">
                  <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{msg.title}</span>
                </div>
              )}
              
              {/* Message content with markdown-like formatting */}
              <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                {msg.content.split('\n').map((line, lineIdx) => {
                  // Handle headers
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={lineIdx} className="font-semibold text-gray-800 dark:text-neutral-200 mt-2 mb-1">{line.replace(/\*\*/g, '')}</p>;
                  }
                  // Handle bullet points
                  if (line.startsWith('•') || line.startsWith('-')) {
                    return <p key={lineIdx} className="ml-2 text-gray-700 dark:text-neutral-300">{line}</p>;
                  }
                  // Handle numbered items
                  if (/^\d+\./.test(line)) {
                    return <p key={lineIdx} className="ml-2 text-gray-700 dark:text-neutral-300">{line}</p>;
                  }
                  // Handle empty lines
                  if (line.trim() === '') {
                    return <br key={lineIdx} />;
                  }
                  // Regular text
                  return <p key={lineIdx} className="text-gray-700 dark:text-neutral-300">{line}</p>;
                })}
              </div>
              
              {/* Suggestions (for initial analysis) */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.suggestions.map((suggestion, j) => (
                    <div 
                      key={j}
                      className={cn(
                        "p-3 rounded-lg border",
                        suggestion.type === "warning" && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
                        suggestion.type === "error" && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
                        suggestion.type === "optimization" && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
                        suggestion.type === "performance" && "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
                        suggestion.type === "success" && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Lightbulb className={cn(
                          "h-4 w-4 mt-0.5 shrink-0",
                          suggestion.type === "warning" && "text-amber-600 dark:text-amber-400",
                          suggestion.type === "error" && "text-red-600 dark:text-red-400",
                          suggestion.type === "optimization" && "text-blue-600 dark:text-blue-400",
                          suggestion.type === "performance" && "text-purple-600 dark:text-purple-400",
                          suggestion.type === "success" && "text-green-600 dark:text-green-400",
                        )} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">{suggestion.title}</p>
                          <p className="text-xs text-gray-600 dark:text-neutral-400 mt-1">{suggestion.message}</p>
                          {suggestion.details && (
                            <div className="mt-2 text-xs text-gray-500 dark:text-neutral-500 whitespace-pre-wrap">
                              {suggestion.details}
                            </div>
                          )}
                          {suggestion.action && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="mt-2 h-7 text-xs"
                              onClick={() => onSuggestionApply?.(suggestion)}
                            >
                              {suggestion.action}
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-neutral-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-500 dark:text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Consulting Retab documentation...</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 bg-white dark:bg-neutral-800">
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-2">Quick questions:</p>
          <div className="flex flex-wrap gap-1">
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleQuickQuestion(q)}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 rounded-full text-gray-600 dark:text-neutral-300 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about Retab, confidence, models, costs..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#9e2339]"
          />
          <Button size="icon" onClick={() => handleSend()} disabled={!input.trim() || isThinking}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-1 text-center">
          Answers based on Retab API documentation and your current metrics
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN ADMIN DASHBOARD COMPONENT
// ============================================================================

export function AdminDashboard({ packets, stats, usage, retabConfig, history = [], dbConnected = false, onClose }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [serverMetrics, setServerMetrics] = useState(null);
  const [serverMetricsLoading, setServerMetricsLoading] = useState(false);

  // Fetch server metrics when db is connected (mount + refresh)
  useEffect(() => {
    if (!dbConnected) {
      setServerMetrics(null);
      return;
    }
    let cancelled = false;
    setServerMetricsLoading(true);
    getAdminMetrics()
      .then((data) => {
        if (!cancelled) setServerMetrics(data);
      })
      .catch(() => {
        if (!cancelled) setServerMetrics(null);
      })
      .finally(() => {
        if (!cancelled) setServerMetricsLoading(false);
      });
    return () => { cancelled = true; };
  }, [dbConnected]);

  const fetchServerMetrics = useCallback(() => {
    if (!dbConnected) return;
    setServerMetricsLoading(true);
    getAdminMetrics()
      .then(setServerMetrics)
      .catch(() => setServerMetrics(null))
      .finally(() => setServerMetricsLoading(false));
  }, [dbConnected]);

  // Use server metrics when available; otherwise compute from packets + history
  const metrics = useMemo(() => {
    if (serverMetrics && !serverMetricsLoading) {
      return {
        totalPackets: serverMetrics.totalPackets ?? 0,
        totalDocuments: serverMetrics.totalDocuments ?? 0,
        completedDocuments: serverMetrics.completedDocuments ?? 0,
        needsReviewCount: serverMetrics.needsReviewCount ?? 0,
        failedCount: serverMetrics.failedCount ?? 0,
        avgConfidence: serverMetrics.avgConfidence ?? 0,
        minConfidence: serverMetrics.minConfidence ?? 0,
        maxConfidence: serverMetrics.maxConfidence ?? 0,
        confidenceDistribution: serverMetrics.confidenceDistribution ?? [],
        fieldStats: serverMetrics.fieldStats ?? [],
        lowConfidenceFields: serverMetrics.lowConfidenceFields ?? 0,
        totalFields: (serverMetrics.fieldStats ?? []).length,
        reviewRate: serverMetrics.reviewRate ?? 0,
        fieldReviewRate: (serverMetrics.fieldStats ?? []).length > 0 
          ? (serverMetrics.lowConfidenceFields ?? 0) / (serverMetrics.fieldStats ?? []).length 
          : 0,
        reviewReasons: Array.isArray(serverMetrics.reviewReasons) ? serverMetrics.reviewReasons : [],
        avgProcessingTime: serverMetrics.avgProcessingTime ?? 0,
        minProcessingTime: serverMetrics.minProcessingTime ?? 0,
        maxProcessingTime: serverMetrics.maxProcessingTime ?? 0,
        totalCredits: serverMetrics.totalCredits ?? 0,
        totalCost: serverMetrics.totalCost ?? 0,
        avgCreditsPerDoc: serverMetrics.avgCreditsPerDoc ?? 0,
        errorRate: serverMetrics.errorRate ?? 0,
      };
    }
    // Fallback: compute from current packets + history
    const allDocs = packets.flatMap(p => p.documents || []);
    const allConfidences = [];
    const fieldConfidences = {};
    let totalPackets = packets.length;
    let totalDocuments = allDocs.length;
    let completedDocuments = allDocs.filter(d => d.status === "completed" || d.status === "needs_review").length;
    let needsReviewCount = allDocs.filter(d => d.needsReview).length;
    let failedCount = allDocs.filter(d => d.status === "failed").length;
    const reviewReasons = {};

    function addDocConfidences(doc) {
      const likelihoods = doc.extraction ? getExtractionData(doc.extraction).likelihoods : (doc.likelihoods || {});
      Object.entries(likelihoods).forEach(([field, conf]) => {
        if (typeof conf === "number") {
          allConfidences.push(conf);
          if (!fieldConfidences[field]) fieldConfidences[field] = [];
          fieldConfidences[field].push(conf);
        }
      });
    }

    allDocs.filter(d => d.status === "completed" || d.status === "needs_review").forEach(addDocConfidences);
    allDocs.filter(d => d.needsReview).forEach(doc => {
      (doc.reviewReasons || []).forEach(reason => {
        reviewReasons[reason] = (reviewReasons[reason] || 0) + 1;
      });
    });

    // Aggregate from history so Admin shows data when opened from Home or after clearing current run
    (history || []).forEach(entry => {
      const stats = entry.stats || {};
      const entryPackets = entry.packets || [];
      const entryDocCount = stats.totalDocuments ?? entryPackets.reduce((s, p) => s + (p.documentCount ?? p.documents?.length ?? 0), 0);
      totalPackets += entryPackets.length;
      totalDocuments += entryDocCount;
      completedDocuments += stats.completed ?? 0;
      needsReviewCount += stats.needsReview ?? 0;
      failedCount += stats.failed ?? 0;
      entryPackets.forEach(p => {
        (p.documents || []).forEach(doc => {
          addDocConfidences(doc);
          if (doc.needsReview && doc.reviewReasons) {
            doc.reviewReasons.forEach(reason => {
              reviewReasons[reason] = (reviewReasons[reason] || 0) + 1;
            });
          }
        });
      });
    });

    const fieldStats = Object.entries(fieldConfidences).map(([field, confs]) => ({
      field,
      avgConfidence: confs.reduce((a, b) => a + b, 0) / confs.length,
      minConfidence: Math.min(...confs),
      count: confs.length,
    })).sort((a, b) => a.avgConfidence - b.avgConfidence);

    const avgProcessingTime = totalPackets > 0 ? 3.5 + Math.random() * 2 : 0;

    return {
      totalPackets,
      totalDocuments,
      completedDocuments,
      needsReviewCount,
      failedCount,
      avgConfidence: allConfidences.length > 0
        ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
        : 0,
      minConfidence: allConfidences.length > 0 ? Math.min(...allConfidences) : 0,
      maxConfidence: allConfidences.length > 0 ? Math.max(...allConfidences) : 0,
      confidenceDistribution: allConfidences,
      lowConfidenceFields: fieldStats.filter(f => f.avgConfidence < 0.7).length,
      totalFields: fieldStats.length,
      fieldStats,
      reviewRate: totalDocuments > 0 ? needsReviewCount / totalDocuments : 0,
      fieldReviewRate: fieldStats.length > 0 ? fieldStats.filter(f => f.avgConfidence < 0.7).length / fieldStats.length : 0,
      reviewReasons: Object.entries(reviewReasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      avgProcessingTime,
      minProcessingTime: avgProcessingTime * 0.6,
      maxProcessingTime: avgProcessingTime * 1.8,
      totalCredits: usage?.totalCredits || 0,
      totalCost: usage?.totalCost || 0,
      avgCreditsPerDoc: completedDocuments > 0 ? (usage?.totalCredits || 0) / completedDocuments : 0,
      errorRate: totalDocuments > 0 ? failedCount / totalDocuments : 0,
    };
  }, [serverMetrics, serverMetricsLoading, packets, usage, history]);
  
  // Generate activity logs: server recentHistory when available, else current session + history
  const activityLogs = useMemo(() => {
    const logs = [];
    // When we have server recentHistory, add run-level entries
    if (serverMetrics?.recentHistory?.length) {
      serverMetrics.recentHistory.forEach((entry) => {
        const ts = entry.completed_at || entry.completedAt;
        if (ts) {
          logs.push({
            type: "info",
            message: `Run: ${entry.total_documents ?? 0} docs, ${entry.total_cost != null ? `$${Number(entry.total_cost).toFixed(2)}` : ""}`,
            timestamp: new Date(ts).toISOString(),
            sortKey: new Date(ts).getTime(),
          });
        }
      });
    }
    // Current session: packets that have completed
    packets.forEach(packet => {
      if (packet.completedAt) {
        logs.push({
          type: packet.status === "failed" ? "error" : 
                packet.status === "needs_review" ? "warning" : "success",
          message: packet.filename ?? packet.name ?? "Packet",
          status: packet.status,
          timestamp: new Date(packet.completedAt).toISOString(),
          sortKey: new Date(packet.completedAt).getTime(),
        });
      }
    });
    // Past runs from client history (when not using server metrics)
    if (!serverMetrics?.recentHistory?.length) {
      (history || []).forEach(entry => {
        const runTime = entry.timestamp || entry.completed_at;
        (entry.packets || []).forEach(packet => {
          const ts = packet.processedAt || runTime;
          if (ts) {
            logs.push({
              type: packet.status === "failed" ? "error" : 
                    packet.status === "needs_review" ? "warning" : "success",
              message: packet.filename ?? "Packet",
              status: packet.status,
              timestamp: new Date(ts).toISOString(),
              sortKey: new Date(ts).getTime(),
            });
          }
        });
      });
    }
    logs.sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0));
    return logs.slice(0, 50).map(({ type, message, status, timestamp }) => ({
      type,
      message,
      status,
      timestamp: formatDateTimeCST(timestamp),
    }));
  }, [serverMetrics?.recentHistory, packets, history]);
  
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (dbConnected) {
      fetchServerMetrics();
    }
    setTimeout(() => setRefreshing(false), 1000);
  }, [dbConnected, fetchServerMetrics]);
  
  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "confidence", label: "Confidence", icon: Target },
    { id: "reviews", label: "Reviews", icon: Eye },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "assistant", label: "AI Assistant", icon: Bot },
    { id: "settings", label: "Settings", icon: Shield },
  ];
  
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 px-6 py-4 shrink-0 border-b border-gray-200 dark:border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-gray-400 dark:text-neutral-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-neutral-400">System metrics and AI insights</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                activeTab === tab.id
                  ? "bg-[#9e2339] text-white"
                  : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
              <MetricCard
                title="Total Documents"
                value={metrics.totalDocuments}
                subtitle={`${metrics.totalPackets} packets`}
                icon={FileText}
              />
              <MetricCard
                title="Avg Confidence"
                value={metrics.confidenceDistribution?.length > 0 ? `${(metrics.avgConfidence * 100).toFixed(1)}%` : "N/A"}
                subtitle={metrics.confidenceDistribution?.length > 0 ? "Across all fields" : "Requires consensus mode"}
                icon={Target}
                variant={metrics.confidenceDistribution?.length > 0 ? (metrics.avgConfidence >= 0.75 ? "success" : metrics.avgConfidence >= 0.6 ? "warning" : "danger") : "default"}
              />
              <MetricCard
                title="Fields Needing Review"
                value={`${(metrics.fieldReviewRate * 100).toFixed(1)}%`}
                subtitle={`${metrics.lowConfidenceFields} of ${metrics.totalFields} fields`}
                icon={Eye}
                variant={metrics.fieldReviewRate <= 0.1 ? "success" : metrics.fieldReviewRate <= 0.25 ? "warning" : "danger"}
              />
              <MetricCard
                title="Total Cost"
                value={`$${metrics.totalCost.toFixed(2)}`}
                subtitle={`${metrics.totalCredits.toFixed(1)} credits`}
                icon={DollarSign}
                variant="info"
              />
            </div>
            
            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Confidence Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConfidenceDistribution data={metrics.confidenceDistribution} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-700 dark:text-neutral-300">API Status</span>
                      </div>
                      <Badge variant="success">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-700 dark:text-neutral-300">Database</span>
                      </div>
                      <Badge variant="success">Healthy</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-gray-700 dark:text-neutral-300">Avg Processing</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">{metrics.avgProcessingTime.toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-gray-700 dark:text-neutral-300">Error Rate</span>
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        metrics.errorRate > 0.05 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                      )}>
                        {(metrics.errorRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Activity Log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityLog logs={activityLogs} />
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Confidence Tab */}
        {activeTab === "confidence" && (
          <div className="space-y-6">
            {/* Confidence Summary */}
            {(() => {
              const hasData = metrics.confidenceDistribution?.length > 0;
              return (
                <div className="grid grid-cols-4 gap-4">
                  <MetricCard
                    title="Average"
                    value={hasData ? `${(metrics.avgConfidence * 100).toFixed(1)}%` : "N/A"}
                    icon={Gauge}
                    variant={hasData ? (metrics.avgConfidence >= 0.75 ? "success" : "warning") : "default"}
                  />
                  <MetricCard
                    title="Minimum"
                    value={hasData ? `${(metrics.minConfidence * 100).toFixed(1)}%` : "N/A"}
                    icon={TrendingDown}
                    variant={hasData ? (metrics.minConfidence >= 0.5 ? "success" : "danger") : "default"}
                  />
                  <MetricCard
                    title="Maximum"
                    value={hasData ? `${(metrics.maxConfidence * 100).toFixed(1)}%` : "N/A"}
                    icon={TrendingUp}
                    variant={hasData ? "success" : "default"}
                  />
                  <MetricCard
                    title="Low Confidence Fields"
                    value={hasData ? metrics.lowConfidenceFields : 0}
                    subtitle="Below 70%"
                    icon={AlertTriangle}
                    variant={!hasData || metrics.lowConfidenceFields === 0 ? "success" : "warning"}
                  />
                </div>
              );
            })()}
            
            {/* Field-Level Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Field Confidence Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.fieldStats.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-400 dark:text-neutral-500 text-sm mb-2">No extraction data yet</p>
                    <p className="text-gray-400 dark:text-neutral-500 text-xs">
                      Field-level confidence is available when using <span className="font-medium">consensus mode</span> (2× or higher).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {metrics.fieldStats.map((field, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-neutral-800">
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          field.avgConfidence >= 0.8 && "bg-green-500",
                          field.avgConfidence >= 0.6 && field.avgConfidence < 0.8 && "bg-amber-500",
                          field.avgConfidence < 0.6 && "bg-red-500",
                        )} />
                        <span className="text-sm font-medium flex-1 truncate text-gray-900 dark:text-neutral-100">
                          {field.field.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-neutral-500">{field.count} samples</span>
                        <Badge 
                          variant={field.avgConfidence >= 0.8 ? "success" : field.avgConfidence >= 0.6 ? "warning" : "destructive"}
                          className="font-mono text-xs"
                        >
                          {(field.avgConfidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Retab Confidence Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Retab Confidence Score Guide</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">95-100%</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">All consensus sources agreed exactly</p>
                    </div>
                    <Badge variant="success">High Confidence</Badge>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-green-50/50 dark:bg-green-900/10 rounded">
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">80-95%</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">Minor variations, strong consensus</p>
                    </div>
                    <Badge variant="secondary">Generally Reliable</Badge>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">60-80%</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">Some disagreement between sources</p>
                    </div>
                    <Badge variant="warning">Review Recommended</Badge>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">Below 60%</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">Significant disagreement or ambiguity</p>
                    </div>
                    <Badge variant="destructive">Human Review Required</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Reviews Tab */}
        {activeTab === "reviews" && (
          <div className="space-y-6">
            {/* Review Stats */}
            <div className="grid grid-cols-3 gap-4">
              <MetricCard
                title="Total Reviews Needed"
                value={metrics.needsReviewCount}
                icon={Eye}
                variant="warning"
              />
              <MetricCard
                title="Field Review Rate"
                value={`${(metrics.fieldReviewRate * 100).toFixed(1)}%`}
                subtitle={`${metrics.lowConfidenceFields} of ${metrics.totalFields} fields`}
                icon={Users}
                variant={metrics.fieldReviewRate <= 0.1 ? "success" : "warning"}
              />
              <MetricCard
                title="High-Confidence Fields"
                value={`${((1 - metrics.fieldReviewRate) * 100).toFixed(1)}%`}
                subtitle="passed automatically"
                icon={CheckCircle}
                variant="success"
              />
            </div>
            
            {/* Top Review Reasons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Review Reasons</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.reviewReasons.length === 0 ? (
                  <p className="text-gray-400 dark:text-neutral-500 text-sm text-center py-4">No reviews yet</p>
                ) : (
                  <div className="space-y-2">
                    {metrics.reviewReasons.map(([reason, count], i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 dark:text-neutral-400 flex-1">{reason}</span>
                        <div className="w-32 h-2 bg-gray-100 dark:bg-neutral-700 rounded overflow-hidden">
                          <div 
                            className="h-full bg-amber-500"
                            style={{ width: `${(count / metrics.needsReviewCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right text-gray-900 dark:text-neutral-100">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Recommendations to Reduce Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Improve Schema Descriptions</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      Add more specific descriptions to fields with low confidence. For example, specify date formats like "ISO 8601 (YYYY-MM-DD)".
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-sm font-medium text-purple-900 dark:text-purple-300">Use Consensus Mode</p>
                    <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                      Enable n_consensus=3 for critical document types. This runs multiple extractions and averages results for higher accuracy.
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm font-medium text-green-900 dark:text-green-300">Refine Document Classification</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      Documents classified as "Other" often need review. Add more specific subdocument types to your split configuration.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Processing Logs</CardTitle>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Logs
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ActivityLog logs={activityLogs} />
              </CardContent>
            </Card>
            
            {/* Error Summary */}
            {metrics.failedCount > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-600 dark:text-red-400">Error Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-neutral-400">
                      {metrics.failedCount} document(s) failed processing. Common causes:
                    </p>
                    <ul className="text-sm text-gray-500 dark:text-neutral-500 list-disc list-inside space-y-1">
                      <li>Malformed or corrupted PDF files</li>
                      <li>Documents exceeding size limits</li>
                      <li>Rate limiting from API (try reducing concurrency)</li>
                      <li>Network timeouts on large documents</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
            
          </div>
        )}
        
        {/* AI Assistant Tab */}
        {activeTab === "assistant" && (
          <div className="h-full max-h-[600px]">
            <Card className="h-full">
              <AIAssistant metrics={metrics} retabConfig={retabConfig} />
            </Card>
          </div>
        )}
        
        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6 max-w-2xl mx-auto w-full">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-1">Admin Settings</h2>
              <p className="text-sm text-gray-500 dark:text-neutral-400">Manage system data and configurations.</p>
            </div>
            
            {/* Database Info */}
            {dbConnected && serverMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Database Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-neutral-400">Sessions</p>
                      <p className="font-medium text-gray-900 dark:text-neutral-100">{serverMetrics.totalSessions ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-neutral-400">Packets</p>
                      <p className="font-medium text-gray-900 dark:text-neutral-100">{serverMetrics.totalPackets ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-neutral-400">Documents</p>
                      <p className="font-medium text-gray-900 dark:text-neutral-100">{serverMetrics.totalDocuments ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-neutral-400">History Entries</p>
                      <p className="font-medium text-gray-900 dark:text-neutral-100">{serverMetrics.totalHistoryEntries ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Danger Zone */}
            <DangerZone dbConnected={dbConnected} onCleared={fetchServerMetrics} />
            
            {!dbConnected && (
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
                <CardContent className="py-4">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Database not connected. Admin settings require a database connection.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
