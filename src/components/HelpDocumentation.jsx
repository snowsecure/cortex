import React, { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import {
  ChevronRight,
  ChevronDown,
  Upload,
  FileText,
  Layers,
  CheckCircle,
  AlertTriangle,
  Download,
  Settings,
  Eye,
  Zap,
  ArrowRight,
  ArrowDown,
  Play,
  HelpCircle,
  Target,
  Clock,
  DollarSign,
  Mail,
  Cpu,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Sparkles,
  GitBranch,
  Check,
  X,
  Timer,
  Database,
  Shield,
  FileCode,
  Puzzle,
  TrendingUp,
  Gauge,
  Terminal,
  Server,
  Bug,
  Copy,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "../lib/utils";
import { API_BASE } from "../lib/api";

// ============================================================================
// ANIMATED WORKFLOW DIAGRAM
// ============================================================================

function AnimatedWorkflowDiagram() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  
  const steps = [
    {
      id: "upload",
      icon: Upload,
      title: "Upload",
      subtitle: "PDF Packets",
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-500",
      lightBg: "bg-blue-50",
      description: "Drop multi-document PDF packets for processing",
      details: {
        what: "Upload PDF files containing title documents from real estate transactions.",
        how: "Drag & drop files or folders, or click to browse. Supports multiple files.",
        tips: [
          "Each PDF can contain multiple documents",
          "Maximum 100MB per file",
          "Organize by transaction for easier tracking",
        ],
        technical: "Files are converted to base64 and processed via the Retab API."
      }
    },
    {
      id: "split",
      icon: Layers,
      title: "Split",
      subtitle: "Document Detection",
      color: "from-violet-500 to-violet-600",
      bgColor: "bg-violet-500",
      lightBg: "bg-violet-50",
      description: "AI identifies document boundaries and classifies types",
      details: {
        what: "The AI analyzes the PDF to find where each document starts and ends.",
        how: "Uses visual and textual cues to detect document boundaries, then classifies each segment.",
        tips: [
          "26+ document types recognized automatically",
          "Preserves page order within each document",
          "Unrecognized types flagged for manual classification",
        ],
        technical: "Calls /documents/split endpoint with document type taxonomy."
      }
    },
    {
      id: "extract",
      icon: Zap,
      title: "Extract",
      subtitle: "Structured Data",
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500",
      lightBg: "bg-amber-50",
      description: "Pull structured fields from each document using type-specific schemas",
      details: {
        what: "Extract specific data fields based on document type (deed, mortgage, lien, etc.).",
        how: "Each document type has a specialized JSON schema defining what fields to extract.",
        tips: [
          "Schemas have 20-90 fields depending on document type",
          "Critical fields trigger review if missing",
          "Confidence scores assigned to each field",
        ],
        technical: "Uses /documents/extract with document-specific JSON schemas and optional consensus."
      }
    },
    {
      id: "validate",
      icon: Target,
      title: "Validate",
      subtitle: "Confidence Scoring",
      color: "from-emerald-500 to-green-500",
      bgColor: "bg-emerald-500",
      lightBg: "bg-emerald-50",
      description: "Calculate likelihood scores and flag uncertain extractions",
      details: {
        what: "Each extracted field gets a confidence score (0-100%) based on AI certainty.",
        how: "With consensus mode, multiple extractions are compared. Agreement = high confidence.",
        tips: [
          "≥75% is production-ready (Retab recommendation)",
          "50-74% should be reviewed",
          "<50% likely needs correction",
        ],
        technical: "Likelihoods from API response indicate extraction reliability per field."
      }
    },
    {
      id: "review",
      icon: Eye,
      title: "Review",
      subtitle: "Human Verification",
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-500",
      lightBg: "bg-orange-50",
      description: "Verify flagged items with side-by-side PDF view",
      details: {
        what: "Human reviewers verify extractions that the AI is uncertain about.",
        how: "View the original PDF alongside extracted data. Edit or approve values.",
        tips: [
          "Focus on flagged fields first",
          "AI provides suggestions for uncertain values",
          "Corrections improve future accuracy",
        ],
        technical: "Review queue prioritizes by confidence score and critical field status."
      }
    },
    {
      id: "export",
      icon: Download,
      title: "Export",
      subtitle: "Structured Output",
      color: "from-cyan-500 to-blue-500",
      bgColor: "bg-cyan-500",
      lightBg: "bg-cyan-50",
      description: "Download validated data in JSON, CSV, or TPS format",
      details: {
        what: "Export your structured data for use in other systems.",
        how: "Choose format based on your needs: JSON for APIs, CSV for spreadsheets, TPS for Stewart.",
        tips: [
          "JSON includes all metadata and confidence scores",
          "CSV flattens data to rows/columns",
          "TPS formatted for Stewart Title Production System",
        ],
        technical: "Export includes extraction results, likelihoods, and review annotations."
      }
    },
  ];
  
  // Auto-advance animation
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveStep(prev => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isPlaying, steps.length]);
  
  const activeStepData = steps[activeStep];
  const ActiveIcon = activeStepData.icon;
  
  return (
    <div className="py-4">
      {/* Main visualization */}
      <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-800 dark:to-neutral-900 rounded-2xl p-6 mb-4 dark:border dark:border-neutral-700">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-neutral-700 rounded-t-2xl overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-300 bg-gradient-to-r", activeStepData.color)}
            style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        
        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8 mt-2">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === activeStep;
            const isPast = index < activeStep;
            
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => { setActiveStep(index); setIsPlaying(false); }}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-2 rounded-xl transition-all",
                    isActive && "scale-110",
                    !isActive && "opacity-60 hover:opacity-100"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                    isActive ? `bg-gradient-to-br ${step.color} text-white shadow-lg` : 
                    isPast ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400"
                  )}>
                    {isPast && !isActive ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    isActive ? "text-gray-900 dark:text-neutral-100" : "text-gray-500 dark:text-neutral-400"
                  )}>
                    {step.title}
                  </span>
                </button>
                
                {index < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-1 rounded transition-colors",
                    index < activeStep ? "bg-green-400" : "bg-gray-200 dark:bg-neutral-700"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Active step detail */}
        <div className={cn("rounded-xl p-5 transition-colors", activeStepData.lightBg, "dark:bg-neutral-800/80")}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br",
              activeStepData.color
            )}>
              <ActiveIcon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">{activeStepData.title}</h3>
                <span className="text-sm text-gray-500 dark:text-neutral-400">— {activeStepData.subtitle}</span>
              </div>
              <p className="text-gray-600 dark:text-neutral-300">{activeStepData.description}</p>
              
            </div>
          </div>
          
          {/* Always show details - compact */}
          <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-neutral-600/50 grid md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <div>
                <span className="font-semibold text-gray-500 dark:text-neutral-500 uppercase">What: </span>
                <span className="text-gray-600 dark:text-neutral-300">{activeStepData.details.what}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-500 dark:text-neutral-500 uppercase">How: </span>
                <span className="text-gray-600 dark:text-neutral-300">{activeStepData.details.how}</span>
              </div>
            </div>
            <div>
              <span className="font-semibold text-gray-500 dark:text-neutral-500 uppercase">Tips: </span>
              <span className="text-gray-600 dark:text-neutral-300">{activeStepData.details.tips.join(" · ")}</span>
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isPlaying ? "bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-300" : "bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
            )}
          >
            {isPlaying ? <Timer className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <span className="text-xs text-gray-500 dark:text-neutral-400">
            {isPlaying ? "Auto-playing" : "Paused"} · Click any step to explore
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONSENSUS MODE EXPLAINER (from Retab docs)
// ============================================================================

function ConsensusExplainer() {
  const [consensusLevel, setConsensusLevel] = useState(3);
  
  const examples = {
    1: {
      responses: [{ grantor: "SMITH, JOHN", recording_date: "Jan 15", loan_amount: "$250,000" }],
      likelihoods: { grantor: "N/A", recording_date: "N/A", loan_amount: "N/A" },
      cost: "1×",
      recommendation: "Testing only"
    },
    3: {
      responses: [
        { grantor: "SMITH, JOHN", recording_date: "2024-01-15", loan_amount: "$250,000" },
        { grantor: "John Smith", recording_date: "January 15, 2024", loan_amount: "250000" },
        { grantor: "SMITH JOHN", recording_date: "01/15/2024", loan_amount: "$250,000.00" },
      ],
      likelihoods: { grantor: "0.5 ⚠", recording_date: "0.5 ⚠", loan_amount: "0.75 ✓" },
      cost: "3×",
      recommendation: "Production use"
    },
    5: {
      responses: [
        { grantor: "John Smith", recording_date: "2024-01-15", loan_amount: "250000" },
        { grantor: "John Smith", recording_date: "2024-01-15", loan_amount: "250000" },
        { grantor: "John Smith", recording_date: "2024-01-15", loan_amount: "250000" },
        { grantor: "John Smith", recording_date: "2024-01-15", loan_amount: "250000" },
        { grantor: "John Smith", recording_date: "2024-01-15", loan_amount: "250000" },
      ],
      likelihoods: { grantor: "1.0 ✓", recording_date: "1.0 ✓", loan_amount: "1.0 ✓" },
      cost: "5×",
      recommendation: "Schema testing"
    },
  };
  
  const current = examples[consensusLevel];
  
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Consensus</strong> is Retab's approach to extraction validation. It runs multiple parallel 
          AI requests using the same schema and compares results. When responses disagree, it reveals 
          ambiguities in the extraction.
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
          Retab docs:{" "}
          <a href="https://docs.retab.com/overview/Build-your-Schema" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800 dark:hover:text-blue-300">Build your Schema</a>
          {" · "}
          <a href="https://docs.retab.com/overview/Best-practices" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800 dark:hover:text-blue-300">Best practices</a>
        </p>
      </div>
      
      {/* Level selector */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-neutral-800 rounded-xl">
        <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">n_consensus =</span>
        <div className="flex gap-2">
          {[1, 3, 5].map(level => (
            <button
              key={level}
              onClick={() => setConsensusLevel(level)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                consensusLevel === level 
                  ? "bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900" 
                  : "bg-white dark:bg-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-600"
              )}
            >
              {level}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500 dark:text-neutral-400">
          Cost: <strong>{current.cost}</strong> · {current.recommendation}
        </span>
      </div>
      
      {/* Visual comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
            {consensusLevel} Parallel Extraction{consensusLevel > 1 ? 's' : ''}
          </h4>
          <div className="space-y-2">
            {current.responses.slice(0, 3).map((response, i) => (
              <div key={i} className="p-3 bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-mono">
                <span className="text-gray-400 dark:text-neutral-500">Response #{i + 1}:</span>
                <div className="mt-1 text-gray-700 dark:text-neutral-300">
                  grantor: "{response.grantor}"<br/>
                  recording_date: "{response.recording_date}"<br/>
                  loan_amount: "{response.loan_amount}"
                </div>
              </div>
            ))}
            {current.responses.length > 3 && (
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-neutral-700 text-white text-xs font-medium rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  +{current.responses.length - 3} more identical responses
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Likelihood Scores</h4>
          <div className="p-4 bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-neutral-400">
                  <th className="pb-2">Field</th>
                  <th className="pb-2">Likelihood</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(current.likelihoods).map(([field, score]) => (
                  <tr key={field} className="border-t border-gray-100 dark:border-neutral-700">
                    <td className="py-2 font-mono text-gray-700 dark:text-neutral-300">{field}</td>
                    <td className="py-2 font-medium text-gray-900 dark:text-neutral-100">{score}</td>
                    <td className="py-2">
                      {score.includes("✓") && <span className="text-green-600 dark:text-green-400">Good</span>}
                      {score.includes("⚠") && <span className="text-amber-600 dark:text-amber-400">Needs work</span>}
                      {score.includes("✗") && <span className="text-red-600 dark:text-red-400">Poor</span>}
                      {score === "N/A" && <span className="text-gray-400 dark:text-neutral-500">No comparison</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>Production threshold:</strong> Likelihood ≥0.75 is recommended for deployment.
              Lower scores indicate schema needs improvement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCHEMA BUILDING PROCESS (from Retab docs)
// ============================================================================

function SchemaBuildingProcess() {
  const levers = [
    {
      lever: "Change field names",
      when: "Models mix up grantor vs grantee",
      fix: 'Rename name → grantor_name; clarify: "The party transferring the property"',
      icon: FileCode,
    },
    {
      lever: "Enhance descriptions",
      when: "Loan amounts extracted inconsistently",
      fix: 'Add examples: "Return as integer cents (e.g. 25000000 for $250,000)"',
      icon: FileText,
    },
    {
      lever: "Adjust field types",
      when: "Recording dates vary in format",
      fix: "Use datetime.date for recording_date, require ISO-8601 format",
      icon: Puzzle,
    },
    {
      lever: "Restructure hierarchy",
      when: "Legal description has multiple parts",
      fix: "Break into lot, block, subdivision, plat_book, plat_page",
      icon: GitBranch,
    },
    {
      lever: "Add reasoning prompts",
      when: "Signature verification uncertain",
      fix: 'Add "Check for notary seal near signature block" reasoning',
      icon: Sparkles,
    },
    {
      lever: "Remove problematic fields",
      when: "Field stays low after iterations",
      fix: "Drop non-critical fields like witnesses or defer extraction",
      icon: X,
    },
  ];
  
  return (
    <div className="space-y-4">
      <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
        <h4 className="font-medium text-violet-900 dark:text-violet-300 mb-2">The Schema Building Process</h4>
        <div className="flex items-center gap-2 text-sm text-violet-700 dark:text-violet-400 flex-wrap">
          <span className="px-2 py-1 bg-violet-100 dark:bg-violet-800/30 rounded">1. Define Schema</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-violet-100 dark:bg-violet-800/30 rounded">2. Execute n_consensus=4</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-violet-100 dark:bg-violet-800/30 rounded">3. Review Likelihoods</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-violet-100 dark:bg-violet-800/30 rounded">4. Adjust & Repeat</span>
        </div>
      </div>
      
      <h4 className="text-sm font-medium text-gray-700 dark:text-neutral-300">Schema Improvement Levers</h4>
      <div className="grid md:grid-cols-2 gap-3">
        {levers.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-700 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-gray-600 dark:text-neutral-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-neutral-100">{item.lever}</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">When: {item.when}</p>
                  <p className="text-xs text-gray-600 dark:text-neutral-300 mt-1 font-mono bg-white dark:bg-neutral-700 px-2 py-1 rounded">
                    {item.fix}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// BEST PRACTICES (from Retab docs)
// ============================================================================

function BestPractices() {
  const practices = [
    {
      icon: Layers,
      title: "Cut documents into smaller parts",
      description: "Split large inputs into logical, independent chunks. This reduces latency, avoids provider limits, and improves parallelism.",
      tip: "Keep chunks cohesive and preserve ordering with lightweight metadata if you need to reassemble results."
    },
    {
      icon: RefreshCw,
      title: "Use retries with exponential backoff",
      description: "Retry 5xx/timeout/network errors with exponential backoff and jitter. Avoid retrying 4xx validation errors.",
      tip: "Make operations idempotent (e.g., by using stable IDs) and cap max attempts."
    },
    {
      icon: FileText,
      title: "Don't submit documents that are too long",
      description: "Validate size before sending. If content is too large, chunk it, compress, or pre-trim to essential sections.",
      tip: "Estimate tokens early to prevent hard failures and timeouts."
    },
    {
      icon: Clock,
      title: "Use a long timeout",
      description: "Complex or multi-step processing can take longer than default HTTP timeout. Configure generous timeouts.",
      tip: "Prefer async job flow (enqueue → poll for status) when expected durations are high."
    },
  ];
  
  return (
    <div className="space-y-3">
      {practices.map((practice, i) => {
        const Icon = practice.icon;
        return (
          <div key={i} className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="font-medium text-gray-800 dark:text-neutral-100">{practice.title}</h4>
                <p className="text-sm text-gray-600 dark:text-neutral-300 mt-1">{practice.description}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 flex items-start gap-1">
                  <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
                  {practice.tip}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// CONFIDENCE THRESHOLD GUIDE
// ============================================================================

function ConfidenceThresholdGuide() {
  const thresholds = [
    { range: "≥ 0.90", percent: "90-100%", color: "bg-green-500", status: "Excellent", action: "Auto-approve", description: "High confidence, reliable extraction" },
    { range: "≥ 0.75", percent: "75-89%", color: "bg-emerald-400", status: "Production Ready", action: "Trust with spot-checks", description: "Retab's recommended threshold for production" },
    { range: "0.50-0.74", percent: "50-74%", color: "bg-amber-400", status: "Needs Review", action: "Human verification", description: "Extraction uncertain, likely needs correction" },
    { range: "< 0.50", percent: "0-49%", color: "bg-red-400", status: "Low Confidence", action: "Manual entry", description: "High disagreement between consensus runs" },
  ];
  
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Likelihood scores</strong> indicate how reliably a field was extracted. With consensus mode,
          scores reflect agreement between multiple extraction runs. Higher = more consistent = more reliable.
        </p>
      </div>
      
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-neutral-700">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-neutral-800">
            <tr className="text-left text-sm">
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">Score</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">Status</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">Recommended Action</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">What it means</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-700 bg-white dark:bg-neutral-900">
            {thresholds.map((t, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", t.color)} />
                    <span className="font-mono text-sm text-gray-900 dark:text-neutral-100">{t.range}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-neutral-100">{t.status}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-neutral-300">{t.action}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{t.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// MODEL COMPARISON (pricing from Retab docs: docs.retab.com/core-concepts/Pricing)
// ============================================================================

const RETAB_PRICING = {
  "retab-micro": { creditsPerPage: 0.2, usdPerPage: 0.002 },
  "retab-small": { creditsPerPage: 1.0, usdPerPage: 0.01 },
  "retab-large": { creditsPerPage: 3.0, usdPerPage: 0.03 },
};

function ModelComparison() {
  const models = [
    { name: "retab-micro", speed: "Fastest", accuracy: "Good", useCase: "Simple tasks, high volume, cost-sensitive" },
    { name: "retab-small", speed: "Fast", accuracy: "Better", useCase: "Balanced performance and cost (recommended default)" },
    { name: "retab-large", speed: "Slower", accuracy: "Best", useCase: "Complex tasks, maximum accuracy" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        <strong>1 credit = $0.01.</strong> Extract/Split/Parse/Schema: <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded">total_credits = model_credits × page_count</code>; with consensus: <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded">× n_consensus</code>. Source:{" "}
        <a href="https://docs.retab.com/core-concepts/Pricing" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Retab Pricing</a>.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-800">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">Model</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">Speed</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">Accuracy</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">Credits/page</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">USD/page</th>
              <th className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">Best For</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-700 bg-white dark:bg-neutral-900">
            {models.map((m, i) => {
              const p = RETAB_PRICING[m.name];
              return (
                <tr key={m.name} className={i === 1 ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}>
                  <td className="px-4 py-3 font-mono text-gray-900 dark:text-neutral-100">{m.name}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">{m.speed}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">{m.accuracy}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 dark:text-neutral-300">{p.creditsPerPage}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 dark:text-neutral-300">${p.usdPerPage.toFixed(3)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-neutral-400">
                    {m.useCase}
                    {i === 1 && <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">← Recommended</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// FAQ SECTION
// ============================================================================

function FAQSection() {
  const [openItem, setOpenItem] = useState(null);
  
  const faqs = [
    {
      q: "What file formats are supported?",
      a: "Cortex supports PDF files only. Each PDF can contain multiple documents from a single real estate transaction. The system automatically splits multi-document PDFs into individual documents for extraction."
    },
    {
      q: "How is extraction accuracy measured?",
      a: "Accuracy is measured via likelihood scores (0-1). With consensus mode enabled, multiple extractions are compared—higher agreement means higher likelihood. Retab recommends ≥0.75 for production use. Scores below 0.5 indicate the schema may need improvement."
    },
    {
      q: "What triggers a 'Needs Review' flag?",
      a: "Documents are flagged when: (1) Average likelihood is below 75%, (2) Critical fields are missing or empty, (3) Document type couldn't be classified, or (4) The AI detected potential OCR issues like handwriting or faded text."
    },
    {
      q: "How does consensus mode work?",
      a: "Consensus runs N parallel extractions with the same schema and compares results. Agreement = high confidence. n_consensus=1 is fastest/cheapest but provides no comparison. n_consensus=3 is recommended for production. n_consensus=4-5 is best for schema development to identify problem fields."
    },
    {
      q: "How is pricing calculated?",
      a: "Cost = pages × model tier × consensus level. Example: 10 pages with retab-small and n_consensus=3 costs 3× a single extraction. The accuracy improvement typically justifies the cost for critical documents."
    },
    {
      q: "How do I improve low-likelihood fields?",
      a: "Follow Retab's schema improvement levers: (1) Clarify field names, (2) Add examples to descriptions, (3) Use stricter types (datetime instead of string), (4) Break compound fields into subfields, (5) Add reasoning prompts for calculations."
    },
    {
      q: "What happens if processing fails?",
      a: "Failed documents can be retried individually or together. Common issues: missing API key, network timeout, document too large. Use exponential backoff for retries. For long documents, consider async job flow instead of sync extraction."
    },
    {
      q: "Is my data secure?",
      a: "Documents are processed via secure API calls to Retab. No document data is stored permanently on servers—only extraction results. API keys are stored locally in your browser's localStorage."
    },
  ];
  
  return (
    <div className="space-y-2">
      {faqs.map((faq, index) => (
        <div key={index} className="bg-gray-50 dark:bg-neutral-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpenItem(openItem === index ? null : index)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-neutral-200">{faq.q}</span>
            <ChevronRight className={cn(
              "h-4 w-4 text-gray-400 dark:text-neutral-500 transition-transform shrink-0 ml-2",
              openItem === index && "rotate-90"
            )} />
          </button>
          {openItem === index && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600 dark:text-neutral-300 leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// TECHNICAL REFERENCE (Enterprise architects & senior engineers)
// ============================================================================

const PROXY_ENDPOINTS = [
  { method: "POST", path: "/api/documents/split", description: "Split PDF packet into subdocuments with page ranges", retab: "POST /v1/documents/split" },
  { method: "POST", path: "/api/documents/classify", description: "Classify document into categories (e.g. deed, mortgage)", retab: "POST /v1/documents/classify" },
  { method: "POST", path: "/api/documents/extract", description: "Extract structured data from document using JSON schema", retab: "POST /v1/documents/extract" },
  { method: "POST", path: "/api/documents/parse", description: "Parse document to text/markdown", retab: "POST /v1/documents/parse" },
  { method: "POST", path: "/api/schemas/generate", description: "Generate JSON schema from sample document", retab: "POST /v1/schemas/generate" },
  { method: "POST", path: "/api/jobs", description: "Create async job (extract, etc.)", retab: "POST /v1/jobs" },
  { method: "GET", path: "/api/jobs/:jobId", description: "Get job status and result", retab: "GET /v1/jobs/:id" },
];

const INTERNAL_ENDPOINTS = {
  health: [
    { method: "GET", path: "/health", description: "Health check endpoint" },
    { method: "GET", path: "/api/status", description: "System status with database stats" },
  ],
  sessions: [
    { method: "GET", path: "/api/sessions/active", description: "Get or create active session" },
    { method: "POST", path: "/api/sessions", description: "Create new session" },
    { method: "GET", path: "/api/sessions/:id", description: "Get session by ID" },
    { method: "PATCH", path: "/api/sessions/:id", description: "Update session" },
    { method: "POST", path: "/api/sessions/:id/close", description: "Close session (set status to completed)" },
    { method: "GET", path: "/api/sessions/:id/full", description: "Get full session with packets and documents" },
  ],
  packets: [
    { method: "POST", path: "/api/packets", description: "Create packet(s)" },
    { method: "GET", path: "/api/packets/:id", description: "Get packet by ID" },
    { method: "GET", path: "/api/sessions/:sessionId/packets", description: "Get all packets for a session" },
    { method: "PATCH", path: "/api/packets/:id", description: "Update packet" },
    { method: "POST", path: "/api/packets/:id/complete", description: "Mark packet as complete with results" },
    { method: "DELETE", path: "/api/packets/:id", description: "Delete packet" },
    { method: "POST", path: "/api/upload", description: "Upload PDF file (multipart/form-data)" },
    { method: "GET", path: "/api/packets/:id/file", description: "Get stored PDF file for packet" },
  ],
  documents: [
    { method: "POST", path: "/api/documents", description: "Create document(s)" },
    { method: "GET", path: "/api/documents/:id", description: "Get document by ID" },
    { method: "GET", path: "/api/packets/:packetId/documents", description: "Get all documents for a packet" },
    { method: "GET", path: "/api/sessions/:sessionId/review-queue", description: "Get documents needing review" },
    { method: "POST", path: "/api/documents/:id/review", description: "Submit document review" },
  ],
  history: [
    { method: "GET", path: "/api/history", description: "Get processing history" },
    { method: "POST", path: "/api/history", description: "Create history entry" },
    { method: "DELETE", path: "/api/history/:id", description: "Delete history entry" },
    { method: "DELETE", path: "/api/history", description: "Clear all history" },
  ],
  admin: [
    { method: "GET", path: "/api/admin/metrics", description: "Get admin dashboard metrics" },
    { method: "POST", path: "/api/admin/clear-database", description: "Reset application (password required)" },
  ],
  exportTemplates: [
    { method: "GET", path: "/api/export-templates", description: "Get all export templates" },
    { method: "POST", path: "/api/export-templates", description: "Save export template" },
    { method: "DELETE", path: "/api/export-templates/:name", description: "Delete export template" },
  ],
  usage: [
    { method: "GET", path: "/api/usage", description: "Get usage statistics" },
    { method: "GET", path: "/api/stats/30d", description: "Get 30-day aggregated statistics" },
  ],
};

const ERROR_REMEDIATION = [
  { pattern: "API key not configured", cause: "Missing or invalid Api-Key", fix: "Set API key in Admin → API Key, or localStorage key retab_api_key." },
  { pattern: "401", cause: "Unauthorized", fix: "Check Api-Key header. Ensure key is valid and has not been revoked." },
  { pattern: "429", cause: "Rate limit", fix: "Reduce concurrency, add exponential backoff. Consider retab-small or retab-micro for volume." },
  { pattern: "timeout|ETIMEDOUT|network", cause: "Network or timeout", fix: "Increase client timeout. For large PDFs use async jobs (POST /jobs) and poll." },
  { pattern: "413|payload|too large", cause: "Request body too large", fix: "Server limit is 100MB. Chunk or compress; reduce image_resolution_dpi." },
  { pattern: "422|validation|schema", cause: "Validation error", fix: "Check json_schema shape and field types. Do not retry without fixing request." },
  { pattern: "500|502|503", cause: "Server/upstream error", fix: "Retry with exponential backoff and jitter. Check Retab status page." },
];

// Mermaid diagram renderer for Technical Reference
function MermaidDiagram({ chart, className = "" }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!chart || !containerRef.current) return;
    setError(null);
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        primaryColor: "#f1f5f9",
        primaryTextColor: "#334155",
        primaryBorderColor: "#cbd5e1",
        lineColor: "#64748b",
        secondaryColor: "#e2e8f0",
        tertiaryColor: "#f8fafc",
      },
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
    });
    mermaid
      .run({
        nodes: [containerRef.current],
        suppressErrors: true,
      })
      .catch((err) => {
        setError(err?.message || "Failed to render diagram");
      });
  }, [chart]);

  return (
    <div className={cn("mermaid-diagram", className)}>
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Diagram could not be rendered: {error}
        </div>
      ) : (
        <div ref={containerRef} className="mermaid">
          {chart}
        </div>
      )}
    </div>
  );
}

const ARCHITECTURE_MERMAID = `flowchart LR
  subgraph Browser
    A[React SPA]
    B[Custom Hooks]
    C[(localStorage)]
  end
  subgraph Server
    D[Express API]
    E[Retab Proxy]
  end
  subgraph Storage
    F[(SQLite)]
    G[Temp PDFs]
  end
  A --> B
  B --> C
  B --> D
  D --> F
  D --> G
  E --> H[Retab API]`;

function ArchitectureOverview() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-neutral-400">
        CORTEX is a document processing application for Stewart Title. It runs as a React SPA that communicates with a Node.js Express server. The server acts as both a REST API for persistence and a proxy to the Retab extraction API.
      </p>
      
      {/* Architecture Diagram */}
      <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-slate-50/80 dark:bg-neutral-800 p-6 overflow-x-auto min-h-[180px] flex items-center justify-center">
        <MermaidDiagram chart={ARCHITECTURE_MERMAID} className="flex justify-center py-2 [&_svg]:max-w-full [&_svg]:h-auto [&_.node]:outline-none [&_.edgePath]:stroke-slate-400 dark:[&_.edgePath]:stroke-neutral-500" />
      </div>
      
      {/* Technology Stack */}
      <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-3">Technology Stack</h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-medium text-gray-600 dark:text-neutral-400">Frontend:</span>
            <span className="text-gray-500 dark:text-neutral-500 ml-2">React 18, Vite 5, Tailwind CSS 4</span>
          </div>
          <div>
            <span className="font-medium text-gray-600 dark:text-neutral-400">Backend:</span>
            <span className="text-gray-500 dark:text-neutral-500 ml-2">Node.js, Express 4, better-sqlite3</span>
          </div>
          <div>
            <span className="font-medium text-gray-600 dark:text-neutral-400">External API:</span>
            <span className="text-gray-500 dark:text-neutral-500 ml-2">Retab (api.retab.com/v1)</span>
          </div>
          <div>
            <span className="font-medium text-gray-600 dark:text-neutral-400">Security:</span>
            <span className="text-gray-500 dark:text-neutral-500 ml-2">Helmet, CORS, Rate Limiting</span>
          </div>
        </div>
      </div>
      
      {/* Data Flow */}
      <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 p-4 font-mono text-xs overflow-x-auto">
        <h4 className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2 font-sans">Request Flow</h4>
        <div className="flex items-center gap-2 text-gray-700 dark:text-neutral-300">
          <span className="font-semibold">Browser</span>
          <ArrowRight className="h-4 w-4 text-gray-400 dark:text-neutral-500" />
          <span className="font-semibold">Express Server (:3005)</span>
          <ArrowRight className="h-4 w-4 text-gray-400 dark:text-neutral-500" />
          <span className="font-semibold">Retab API</span>
        </div>
        <div className="mt-2 text-gray-500 dark:text-neutral-400 font-sans">
          API key is sent in <code className="bg-white dark:bg-neutral-700 px-1 rounded font-mono">Api-Key</code> header from client to proxy; proxy forwards it to Retab. No document data is stored on Retab beyond the request/response.
        </div>
      </div>
      
      {/* Component Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
        <div className="p-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
          <div className="flex items-center gap-2 text-gray-700 dark:text-neutral-300 font-medium mb-1"><Database className="h-4 w-4" /> SQLite</div>
          <p className="text-gray-500 dark:text-neutral-400 text-xs">6 tables: sessions, packets, documents, history, usage_daily, export_templates. WAL mode enabled.</p>
        </div>
        <div className="p-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
          <div className="flex items-center gap-2 text-gray-700 dark:text-neutral-300 font-medium mb-1"><Server className="h-4 w-4" /> Express</div>
          <p className="text-gray-500 dark:text-neutral-400 text-xs">35+ REST endpoints. Rate limited: 120 req/min (prod). 100MB body limit for base64 PDFs.</p>
        </div>
        <div className="p-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
          <div className="flex items-center gap-2 text-gray-700 dark:text-neutral-300 font-medium mb-1"><Zap className="h-4 w-4" /> Retab API</div>
          <p className="text-gray-500 dark:text-neutral-400 text-xs">Split, classify, extract, parse, jobs. Models: micro, small, large. Consensus: 1-5x.</p>
        </div>
        <div className="p-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
          <div className="flex items-center gap-2 text-gray-700 dark:text-neutral-300 font-medium mb-1"><FileText className="h-4 w-4" /> Temp Storage</div>
          <p className="text-gray-500 dark:text-neutral-400 text-xs">PDFs stored in ./data/temp-pdfs/. Auto-cleanup after 1 hour. Max 100MB per file.</p>
        </div>
      </div>
    </div>
  );
}

function APIReferenceTable() {
  const [activeSection, setActiveSection] = React.useState("internal");
  
  const methodColors = {
    GET: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30",
    POST: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
    PATCH: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
    DELETE: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30",
  };
  
  const sectionLabels = {
    health: { label: "Health", count: INTERNAL_ENDPOINTS.health.length },
    sessions: { label: "Sessions", count: INTERNAL_ENDPOINTS.sessions.length },
    packets: { label: "Packets", count: INTERNAL_ENDPOINTS.packets.length },
    documents: { label: "Documents", count: INTERNAL_ENDPOINTS.documents.length },
    history: { label: "History", count: INTERNAL_ENDPOINTS.history.length },
    admin: { label: "Admin", count: INTERNAL_ENDPOINTS.admin.length },
    exportTemplates: { label: "Export Templates", count: INTERNAL_ENDPOINTS.exportTemplates.length },
    usage: { label: "Usage/Stats", count: INTERNAL_ENDPOINTS.usage.length },
  };
  
  const totalInternal = Object.values(INTERNAL_ENDPOINTS).reduce((acc, arr) => acc + arr.length, 0);
  
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-neutral-400">
        Base URL: <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded font-mono text-xs">http://localhost:3005</code>. Internal endpoints require no authentication. Retab proxy endpoints require <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded font-mono text-xs">Api-Key</code> header.
      </p>
      
      {/* Section Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection("internal")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
            activeSection === "internal"
              ? "bg-[#9e2339] text-white border-[#9e2339]"
              : "bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700"
          )}
        >
          Internal REST API ({totalInternal})
        </button>
        <button
          onClick={() => setActiveSection("proxy")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
            activeSection === "proxy"
              ? "bg-[#9e2339] text-white border-[#9e2339]"
              : "bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700"
          )}
        >
          Retab Proxy ({PROXY_ENDPOINTS.length})
        </button>
      </div>
      
      {activeSection === "internal" ? (
        <div className="space-y-4">
          {/* Resource Navigation */}
          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
            {Object.entries(sectionLabels).map(([key, { label, count }]) => (
              <a
                key={key}
                href={`#api-${key}`}
                className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-white dark:hover:bg-neutral-700 rounded transition-colors"
              >
                {label} <span className="text-gray-400 dark:text-neutral-500">({count})</span>
              </a>
            ))}
          </div>
          
          {/* Endpoint Tables by Resource */}
          {Object.entries(INTERNAL_ENDPOINTS).map(([key, endpoints]) => (
            <div key={key} id={`api-${key}`} className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100 flex items-center gap-2">
                {sectionLabels[key].label}
                <span className="text-xs font-normal text-gray-400 dark:text-neutral-500">({endpoints.length} endpoints)</span>
              </h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-800">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300 w-20">Method</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Path</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                    {endpoints.map((ep, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                        <td className="px-3 py-2">
                          <span className={cn("px-1.5 py-0.5 rounded text-xs font-mono font-medium", methodColors[ep.method])}>
                            {ep.method}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-neutral-300">{ep.path}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-neutral-400 text-xs">{ep.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-neutral-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-3">
            <strong>Authentication required:</strong> All proxy endpoints require <code className="bg-white dark:bg-neutral-700 px-1 rounded">Api-Key</code> header with your Retab API key.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-800">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300 w-20">Method</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Proxy Path</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Description</th>
                  <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Retab Equivalent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                {PROXY_ENDPOINTS.map((ep, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                    <td className="px-3 py-2">
                      <span className={cn("px-1.5 py-0.5 rounded text-xs font-mono font-medium", methodColors[ep.method])}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-neutral-300">{ep.path}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-neutral-400 text-xs">{ep.description}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-neutral-500">{ep.retab}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            Request/response bodies follow Retab's API spec. For extract: <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded">document.url</code> is a base64 data URL; <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded">json_schema</code> is required; <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded">n_consensus</code> optional (default 1).
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DATABASE SCHEMA DOCUMENTATION
// ============================================================================

const DATABASE_SCHEMA = {
  sessions: {
    description: "Processing session tracking",
    columns: [
      { name: "id", type: "TEXT", pk: true, description: "Unique session ID" },
      { name: "created_at", type: "DATETIME", default: "CURRENT_TIMESTAMP", description: "Creation time" },
      { name: "updated_at", type: "DATETIME", default: "CURRENT_TIMESTAMP", description: "Last update time" },
      { name: "status", type: "TEXT", default: "'active'", description: "Session status (active/completed)" },
      { name: "total_packets", type: "INTEGER", default: "0", description: "Number of packets" },
      { name: "completed_packets", type: "INTEGER", default: "0", description: "Packets completed" },
      { name: "failed_packets", type: "INTEGER", default: "0", description: "Packets failed" },
      { name: "needs_review_packets", type: "INTEGER", default: "0", description: "Packets needing review" },
      { name: "total_credits", type: "REAL", default: "0", description: "Credits used" },
      { name: "total_cost", type: "REAL", default: "0", description: "Cost in USD" },
      { name: "total_pages", type: "INTEGER", default: "0", description: "Pages processed" },
      { name: "api_calls", type: "INTEGER", default: "0", description: "API calls made" },
    ],
  },
  packets: {
    description: "Document packets being processed",
    columns: [
      { name: "id", type: "TEXT", pk: true, description: "Unique packet ID" },
      { name: "session_id", type: "TEXT", fk: "sessions.id", description: "FK → sessions.id (CASCADE)" },
      { name: "filename", type: "TEXT", description: "Original filename" },
      { name: "status", type: "TEXT", default: "'queued'", description: "Processing status" },
      { name: "created_at", type: "DATETIME", default: "CURRENT_TIMESTAMP", description: "Creation time" },
      { name: "started_at", type: "DATETIME", nullable: true, description: "Processing start" },
      { name: "completed_at", type: "DATETIME", nullable: true, description: "Processing end" },
      { name: "retry_count", type: "INTEGER", default: "0", description: "Retry attempts" },
      { name: "error", type: "TEXT", nullable: true, description: "Error message" },
      { name: "total_documents", type: "INTEGER", default: "0", description: "Documents in packet" },
      { name: "completed_documents", type: "INTEGER", default: "0", description: "Documents completed" },
      { name: "needs_review_documents", type: "INTEGER", default: "0", description: "Documents needing review" },
      { name: "failed_documents", type: "INTEGER", default: "0", description: "Documents failed" },
      { name: "total_credits", type: "REAL", default: "0", description: "Credits used" },
      { name: "total_cost", type: "REAL", default: "0", description: "Cost in USD" },
      { name: "temp_file_path", type: "TEXT", nullable: true, description: "Path to temp PDF" },
    ],
    indexes: ["idx_packets_session (session_id)", "idx_packets_status (status)"],
  },
  documents: {
    description: "Individual documents extracted from packets",
    columns: [
      { name: "id", type: "TEXT", pk: true, description: "Unique document ID" },
      { name: "packet_id", type: "TEXT", fk: "packets.id", description: "FK → packets.id (CASCADE)" },
      { name: "session_id", type: "TEXT", fk: "sessions.id", description: "FK → sessions.id (CASCADE)" },
      { name: "document_type", type: "TEXT", nullable: true, description: "Document category" },
      { name: "display_name", type: "TEXT", nullable: true, description: "Human-readable name" },
      { name: "status", type: "TEXT", default: "'pending'", description: "Processing status" },
      { name: "pages", type: "TEXT", nullable: true, description: "JSON array of page numbers" },
      { name: "extraction_data", type: "TEXT", nullable: true, description: "JSON extraction result" },
      { name: "likelihoods", type: "TEXT", nullable: true, description: "JSON field likelihoods" },
      { name: "extraction_confidence", type: "REAL", nullable: true, description: "Average confidence (0-1)" },
      { name: "needs_review", type: "INTEGER", default: "0", description: "Review flag (0/1)" },
      { name: "review_reasons", type: "TEXT", nullable: true, description: "JSON array of reasons" },
      { name: "reviewed_at", type: "DATETIME", nullable: true, description: "Review timestamp" },
      { name: "reviewed_by", type: "TEXT", nullable: true, description: "Reviewer identifier" },
      { name: "reviewer_notes", type: "TEXT", nullable: true, description: "Review notes" },
      { name: "edited_fields", type: "TEXT", nullable: true, description: "JSON of edited values" },
      { name: "credits_used", type: "REAL", default: "0", description: "Credits for this doc" },
      { name: "created_at", type: "DATETIME", default: "CURRENT_TIMESTAMP", description: "Creation time" },
    ],
    indexes: ["idx_documents_packet (packet_id)", "idx_documents_session (session_id)", "idx_documents_needs_review (needs_review)"],
  },
  history: {
    description: "Processing history entries",
    columns: [
      { name: "id", type: "TEXT", pk: true, description: "Unique history ID" },
      { name: "session_id", type: "TEXT", fk: "sessions.id", nullable: true, description: "FK → sessions.id (SET NULL)" },
      { name: "completed_at", type: "DATETIME", default: "CURRENT_TIMESTAMP", description: "Completion time" },
      { name: "total_packets", type: "INTEGER", nullable: true, description: "Packets processed" },
      { name: "total_documents", type: "INTEGER", nullable: true, description: "Documents processed" },
      { name: "completed", type: "INTEGER", nullable: true, description: "Successful documents" },
      { name: "needs_review", type: "INTEGER", nullable: true, description: "Documents needing review" },
      { name: "failed", type: "INTEGER", nullable: true, description: "Failed documents" },
      { name: "total_credits", type: "REAL", nullable: true, description: "Credits used" },
      { name: "total_cost", type: "REAL", nullable: true, description: "Cost in USD" },
      { name: "summary", type: "TEXT", nullable: true, description: "JSON summary data" },
    ],
    indexes: ["idx_history_completed (completed_at)"],
  },
  usage_daily: {
    description: "Daily usage aggregates",
    columns: [
      { name: "date", type: "TEXT", pk: true, description: "Date (YYYY-MM-DD)" },
      { name: "total_credits", type: "REAL", default: "0", description: "Credits used" },
      { name: "total_cost", type: "REAL", default: "0", description: "Cost in USD" },
      { name: "total_pages", type: "INTEGER", default: "0", description: "Pages processed" },
      { name: "api_calls", type: "INTEGER", default: "0", description: "API calls made" },
      { name: "packets_processed", type: "INTEGER", default: "0", description: "Packets completed" },
      { name: "documents_processed", type: "INTEGER", default: "0", description: "Documents completed" },
    ],
  },
  export_templates: {
    description: "Saved export configurations",
    columns: [
      { name: "id", type: "TEXT", pk: true, description: "Unique template ID" },
      { name: "name", type: "TEXT", description: "Template name (UNIQUE)" },
      { name: "config", type: "TEXT", description: "JSON configuration" },
      { name: "created_at", type: "DATETIME", default: "CURRENT_TIMESTAMP", description: "Creation time" },
      { name: "updated_at", type: "DATETIME", default: "CURRENT_TIMESTAMP", description: "Last update" },
    ],
  },
};

function DatabaseSchema() {
  const [activeTable, setActiveTable] = React.useState("sessions");
  const tables = Object.keys(DATABASE_SCHEMA);
  const current = DATABASE_SCHEMA[activeTable];
  
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-neutral-400">
        SQLite database at <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded font-mono text-xs">DB_PATH/sail-idp.db</code>. WAL mode enabled. All queries use parameterized statements.
      </p>
      
      {/* Table selector */}
      <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
        {tables.map((table) => (
          <button
            key={table}
            onClick={() => setActiveTable(table)}
            className={cn(
              "px-2 py-1 text-xs font-medium rounded transition-colors",
              activeTable === table
                ? "bg-[#9e2339] text-white"
                : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-white dark:hover:bg-neutral-700"
            )}
          >
            {table}
          </button>
        ))}
      </div>
      
      {/* Table details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
            {activeTable}
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-neutral-500">
              ({current.columns.length} columns)
            </span>
          </h4>
          <span className="text-xs text-gray-500 dark:text-neutral-400">{current.description}</span>
        </div>
        
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Column</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Type</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Default</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {current.columns.map((col, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-gray-700 dark:text-neutral-300">
                      {col.name}
                      {col.pk && <span className="ml-1 text-amber-600 dark:text-amber-400" title="Primary Key">🔑</span>}
                      {col.fk && <span className="ml-1 text-blue-600 dark:text-blue-400" title={`Foreign Key: ${col.fk}`}>🔗</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-neutral-400">{col.type}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-neutral-400">
                    {col.default || (col.nullable ? <span className="text-gray-400 dark:text-neutral-500">NULL</span> : "—")}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-neutral-400">{col.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {current.indexes && (
          <div className="text-xs text-gray-500 dark:text-neutral-400">
            <strong>Indexes:</strong> {current.indexes.join(", ")}
          </div>
        )}
      </div>
      
      {/* Entity Relationship Summary */}
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50">
        <h5 className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">Entity Relationships</h5>
        <div className="text-xs text-blue-700 dark:text-blue-400 font-mono space-y-1">
          <div>sessions ← packets (1:N, ON DELETE CASCADE)</div>
          <div>sessions ← documents (1:N, ON DELETE CASCADE)</div>
          <div>packets ← documents (1:N, ON DELETE CASCADE)</div>
          <div>sessions ← history (1:N, ON DELETE SET NULL)</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DOCUMENT LIFECYCLE STATE DIAGRAMS
// ============================================================================

const PACKET_STATES = [
  { state: "queued", color: "bg-gray-400", description: "Packet uploaded, waiting to process" },
  { state: "splitting", color: "bg-blue-500", description: "Detecting subdocuments and page ranges" },
  { state: "extracting", color: "bg-amber-500", description: "Running extraction on each document" },
  { state: "completed", color: "bg-green-500", description: "All documents processed successfully" },
  { state: "needs_review", color: "bg-orange-500", description: "Some documents require human review" },
  { state: "failed", color: "bg-red-500", description: "Processing error occurred" },
];

const DOCUMENT_STATES = [
  { state: "processing", color: "bg-blue-500", description: "Extraction in progress" },
  { state: "completed", color: "bg-green-500", description: "Extraction successful, high confidence" },
  { state: "needs_review", color: "bg-orange-500", description: "Flagged for human verification" },
  { state: "failed", color: "bg-red-500", description: "Extraction failed" },
  { state: "reviewed", color: "bg-emerald-500", description: "Human reviewed and approved" },
  { state: "rejected", color: "bg-red-400", description: "Human reviewed and rejected" },
];

const REVIEW_CRITERIA = [
  { criterion: "Average confidence", threshold: "< 75%", action: "Flag entire document" },
  { criterion: "Individual field", threshold: "< 50%", action: "Highlight specific field" },
  { criterion: "Critical field missing", threshold: "Empty/null", action: "Flag with field name" },
  { criterion: "Document type", threshold: "'other'", action: "Flag as unrecognized" },
  { criterion: "OCR issues", threshold: "API flag", action: "Flag for verification" },
];

function DocumentLifecycle() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-neutral-400">
        Documents flow through a series of states during processing. Understanding these states helps with debugging and monitoring.
      </p>
      
      {/* Packet States */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Packet Status Flow</h4>
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
          {/* Visual flow */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {["queued", "splitting", "extracting"].map((state, i) => (
              <React.Fragment key={state}>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-2.5 h-2.5 rounded-full", PACKET_STATES.find(s => s.state === state)?.color)} />
                  <span className="text-xs font-mono text-gray-700 dark:text-neutral-300">{state}</span>
                </div>
                {i < 2 && <ArrowRight className="h-3 w-3 text-gray-400" />}
              </React.Fragment>
            ))}
            <ArrowRight className="h-3 w-3 text-gray-400" />
            <div className="flex flex-col gap-1">
              {["completed", "needs_review", "failed"].map((state) => (
                <div key={state} className="flex items-center gap-1.5">
                  <div className={cn("w-2.5 h-2.5 rounded-full", PACKET_STATES.find(s => s.state === state)?.color)} />
                  <span className="text-xs font-mono text-gray-700 dark:text-neutral-300">{state}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* State descriptions */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PACKET_STATES.map((s) => (
              <div key={s.state} className="flex items-start gap-2 text-xs">
                <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", s.color)} />
                <div>
                  <span className="font-mono font-medium text-gray-700 dark:text-neutral-300">{s.state}</span>
                  <p className="text-gray-500 dark:text-neutral-400">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Document States */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Document Status Flow</h4>
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
          {/* Visual flow */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs font-mono text-gray-700 dark:text-neutral-300">processing</span>
            </div>
            <ArrowRight className="h-3 w-3 text-gray-400" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-xs font-mono text-gray-700 dark:text-neutral-300">completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-xs font-mono text-gray-700 dark:text-neutral-300">needs_review</span>
                </div>
                <ArrowRight className="h-3 w-3 text-gray-400" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-mono text-gray-700 dark:text-neutral-300">reviewed ✓</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span className="text-xs font-mono text-gray-700 dark:text-neutral-300">rejected ✗</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-xs font-mono text-gray-700 dark:text-neutral-300">failed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Review Criteria */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Review Flagging Criteria</h4>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Criterion</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Threshold</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {REVIEW_CRITERIA.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                  <td className="px-3 py-2 text-gray-700 dark:text-neutral-300">{r.criterion}</td>
                  <td className="px-3 py-2 font-mono text-xs text-amber-600 dark:text-amber-400">{r.threshold}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-neutral-400 text-xs">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EnvAndConfig() {
  const envVars = [
    { name: "PORT", default: "3005", description: "Proxy server port" },
    { name: "NODE_ENV", default: "development", description: "development | production" },
    { name: "DB_PATH", default: "./data", description: "Directory for SQLite DB file" },
    { name: "CORS_ORIGIN", default: "*", description: "Allowed origin for CORS (set in production)" },
    { name: "VITE_API_URL", default: "http://localhost:3005", description: "API base URL for frontend" },
  ];
  
  const localStorageKeys = [
    { name: "retab_api_key", preserved: true, description: "Retab API key (never logged, preserved on reset)" },
    { name: "cortex_dark_mode", preserved: true, description: "Dark mode preference (true/false)" },
    { name: "stewart_ingestion_session", preserved: false, description: "Batch queue state (packets, documents, processing state)" },
    { name: "stewart_processing_history", preserved: false, description: "Processing history for History tab" },
    { name: "export_templates", preserved: false, description: "Custom export template configurations" },
    { name: "sail_retab_settings", preserved: false, description: "Retab configuration (model, consensus, DPI, temperature)" },
  ];
  
  const retabDefaults = [
    { setting: "model", default: "retab-small", options: "retab-micro, retab-small, retab-large" },
    { setting: "nConsensus", default: "1", options: "1-5 (multiplies cost)" },
    { setting: "imageDpi", default: "192", options: "96, 150, 192, 300" },
    { setting: "temperature", default: "0", options: "0.0-1.0" },
    { setting: "confidenceThreshold", default: "0.7", options: "0-1 (review threshold)" },
  ];
  
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-neutral-400">
        Server reads environment variables at startup. Client-side settings are stored in localStorage.
      </p>
      
      {/* Environment Variables */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Environment Variables</h4>
        <div className="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Variable</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Default</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {envVars.map((v, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-neutral-300">{v.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-neutral-400">{v.default}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-neutral-400 text-xs">{v.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* localStorage Keys */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">localStorage Keys</h4>
        <div className="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Key</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Reset</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {localStorageKeys.map((k, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-neutral-300">{k.name}</td>
                  <td className="px-3 py-2 text-xs">
                    {k.preserved ? (
                      <span className="text-green-600 dark:text-green-400">Preserved</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Cleared</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-neutral-400 text-xs">{k.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Retab Configuration Defaults */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Retab Configuration Defaults</h4>
        <div className="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Setting</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Default</th>
                <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {retabDefaults.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-neutral-300">{r.setting}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-neutral-400">{r.default}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-neutral-400 text-xs">{r.options}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RATE LIMITING
// ============================================================================

function RateLimiting() {
  const limits = [
    { 
      endpoint: "General API (/api/*)", 
      development: "300 req/min", 
      production: "120 req/min",
      description: "All internal REST endpoints"
    },
    { 
      endpoint: "Retab Proxy (/api/documents/*, /api/schemas/*, /api/jobs/*)", 
      development: "120 req/min", 
      production: "60 req/min",
      description: "Proxied requests to Retab API"
    },
    { 
      endpoint: "Debug (/api/debug/*)", 
      development: "120 req/min", 
      production: "Disabled (404)",
      description: "Debug and diagnostics endpoints"
    },
  ];
  
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-neutral-400">
        Rate limits protect the server and upstream APIs from abuse. Limits are per-IP and reset every minute.
      </p>
      
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-800">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Endpoint Group</th>
              <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Development</th>
              <th className="px-3 py-2 font-medium text-gray-700 dark:text-neutral-300">Production</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
            {limits.map((l, i) => (
              <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-gray-700 dark:text-neutral-300">{l.endpoint}</span>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{l.description}</p>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-neutral-400">{l.development}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-neutral-400">{l.production}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
        <h5 className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">When rate limited (429 Too Many Requests)</h5>
        <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
          <li>Wait for the <code className="bg-white dark:bg-neutral-700 px-1 rounded">Retry-After</code> header (seconds until reset)</li>
          <li>Implement exponential backoff with jitter</li>
          <li>Consider reducing batch size or concurrent requests</li>
          <li>For high-volume workloads, use smaller models (retab-micro) or async jobs</li>
        </ul>
      </div>
    </div>
  );
}

function ErrorCodesTable() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-neutral-400">
        Use these patterns to identify and remediate failures. Prefer idempotent operations and exponential backoff for retriable errors.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-800">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium text-gray-700 dark:text-neutral-300">Pattern / Code</th>
              <th className="px-4 py-2 font-medium text-gray-700 dark:text-neutral-300">Likely cause</th>
              <th className="px-4 py-2 font-medium text-gray-700 dark:text-neutral-300">Remediation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
            {ERROR_REMEDIATION.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-neutral-300">{row.pattern}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-neutral-400">{row.cause}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-neutral-400">{row.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConnectivityCheck() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const check = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/debug/status`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        const isHtml = /^\s*<(!doctype|html)/i.test(text);
        throw new Error(
          isHtml
            ? "Server returned HTML instead of JSON. Is the API running on the correct port (e.g. 3005)?"
            : `Invalid JSON: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}`
        );
      }
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setStatus(data);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
          {loading ? "Checking…" : "Check connectivity"}
        </button>
        {status && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Connected
          </span>
        )}
        {error && (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <WifiOff className="h-4 w-4" />
            {error}
          </span>
        )}
      </div>
      {status && (
        <pre className="p-3 rounded-lg bg-gray-900 text-gray-100 text-xs overflow-x-auto max-h-48 overflow-y-auto">
          {JSON.stringify(status, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ErrorLogViewer() {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [filter, setFilter] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const fetchErrors = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/api/debug/errors?limit=100`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        const isHtml = /^\s*<(!doctype|html)/i.test(text);
        setFetchError(
          isHtml
            ? "Server returned HTML instead of JSON. Is the API running on the correct port (e.g. 3005)?"
            : "Invalid response from server."
        );
        setErrors([]);
        return;
      }
      if (!res.ok) {
        setFetchError(data?.error || `HTTP ${res.status}`);
        setErrors([]);
        return;
      }
      setErrors(data.errors || []);
    } catch (err) {
      setFetchError(err.message || "Failed to load errors");
      setErrors([]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = filter.trim()
    ? errors.filter(e => (e.filename || "").toLowerCase().includes(filter.toLowerCase()) || (e.error || "").toLowerCase().includes(filter.toLowerCase()))
    : errors;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={fetchErrors}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
        <input
          type="text"
          placeholder="Filter by filename or error..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-300 rounded-md"
        />
      </div>
      {fetchError && (
        <p className="text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {fetchError}
        </p>
      )}
      <div className="rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 && !loading && (
            <p className="p-4 text-sm text-gray-500 dark:text-neutral-400 text-center">
              {errors.length === 0 ? "No persisted errors. Run a job that fails to see entries here." : "No entries match the filter."}
            </p>
          )}
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 p-3 border-b border-gray-100 dark:border-neutral-700 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-neutral-700/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-medium text-gray-800 dark:text-neutral-200 truncate">{entry.filename}</span>
                  <span className="text-xs text-gray-500 dark:text-neutral-400">{entry.completed_at || entry.created_at}</span>
                </div>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400 break-all">{entry.error}</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Session: {entry.session_id} · Packet: {entry.id}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(entry.error, entry.id)}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 dark:text-neutral-300"
                title="Copy error message"
              >
                {copiedId === entry.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-neutral-400">
        Errors are persisted when a packet fails (e.g. split/extract error). Admin → Logs shows recent activity; this view shows only failed packets with messages.
      </p>
    </div>
  );
}

function LogsObservability() {
  return (
    <div className="space-y-3">
      <ul className="list-disc list-inside text-sm text-gray-600 dark:text-neutral-400 space-y-1">
        <li><strong>Browser:</strong> Open DevTools → Console. All API calls and client errors log here. Network tab shows request/response for each proxy call.</li>
        <li><strong>Server:</strong> Stdout logs each request (method, path, status, duration). Run with <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded font-mono text-xs">node server.js</code> or your process manager to capture logs.</li>
        <li><strong>Admin → Logs:</strong> In-app activity log (recent packet completions and status). Use for quick triage without leaving the app.</li>
        <li><strong>Help → Technical Reference → Error log viewer:</strong> Persisted failed packets (filename, error message, session). Use for debugging recurring failures.</li>
      </ul>
      <p className="text-sm text-gray-500 dark:text-neutral-400">
        For production, consider shipping server logs to your logging backend (e.g. JSON to stdout and a log aggregator). API key is never logged.
      </p>
    </div>
  );
}

// ============================================================================
// SECURITY (Technical Reference for engineers)
// ============================================================================

function SecurityOverview() {
  const hardening = [
    { area: "Security headers", detail: "Helmet: X-Content-Type-Options nosniff, X-Frame-Options sameorigin, Referrer-Policy strict-origin-when-cross-origin. CSP disabled for SPA/Mermaid; tighten in production if needed." },
    { area: "CORS", detail: "Set CORS_ORIGIN in production to your frontend origin. Default * logs a warning in production." },
    { area: "Rate limiting", detail: "General /api/*: 120 req/min (prod), 300/min (dev). Proxy/debug: 60 req/min (prod), 120/min (dev)." },
    { area: "Debug routes", detail: "/api/debug/status and /api/debug/errors return 404 in production (NODE_ENV=production)." },
    { area: "Secrets", detail: "Api-Key forwarded from client to Retab; request/response bodies and headers are not logged (only method, path, status, duration)." },
  ];
  const apiKey = [
    { where: "Client", detail: "Retab API key in localStorage (retab_api_key). Key only sent to your proxy and Retab." },
    { where: "Proxy", detail: "Server does not store the key; forwards Api-Key header per request and does not log it." },
    { where: "Production", detail: "Prefer same-origin app and API; if adding server-side key injection, avoid key in client bundle." },
  ];
  const prodChecklist = [
    "Set NODE_ENV=production",
    "Set CORS_ORIGIN to your frontend origin (avoid *)",
    "Use HTTPS (reverse proxy with TLS)",
    "Restrict DB_PATH filesystem permissions",
    "Keep dependencies updated (npm audit, npm update)",
    "Debug routes are disabled automatically when NODE_ENV=production",
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-neutral-400">
        Hardening and security practices for CORTEX. See also <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded font-mono text-xs">SECURITY.md</code> in the repo.
      </p>

      <div>
        <h4 className="text-sm font-medium text-gray-800 mb-2">Server hardening (implemented)</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-gray-700 dark:text-neutral-300">Area</th>
                <th className="px-4 py-2 font-medium text-gray-700 dark:text-neutral-300">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {hardening.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                  <td className="px-4 py-2 font-medium text-gray-700 w-36">{row.area}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-neutral-400">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-800 mb-2">API key handling</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-gray-700 dark:text-neutral-300">Where</th>
                <th className="px-4 py-2 font-medium text-gray-700 dark:text-neutral-300">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {apiKey.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-700/50">
                  <td className="px-4 py-2 font-medium text-gray-700 w-28">{row.where}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-neutral-400">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-800 mb-2">Database</h4>
        <p className="text-sm text-gray-600 mb-2">
          SQLite at <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded font-mono text-xs">DB_PATH/sail-idp.db</code> (default <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded font-mono text-xs">./data</code>). All queries use parameterized statements. Restrict filesystem access so only the app can read/write <code className="bg-gray-100 dark:bg-neutral-700 px-1 rounded font-mono text-xs">DB_PATH</code>.
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-800 mb-2">Production checklist</h4>
        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-neutral-400 space-y-1">
          {prodChecklist.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-500 dark:text-neutral-400">
        Report security-sensitive bugs to your internal security or SAIL team, not in public issue trackers.
      </p>
    </div>
  );
}

function TechnicalReferenceContent() {
  const [activeSub, setActiveSub] = useState("architecture");
  const subs = [
    { id: "architecture", label: "Architecture", icon: Database },
    { id: "api", label: "API", icon: FileCode },
    { id: "database", label: "Database", icon: Database },
    { id: "lifecycle", label: "Lifecycle", icon: RefreshCw },
    { id: "env", label: "Config", icon: Settings },
    { id: "rate-limit", label: "Rates", icon: Gauge },
    { id: "errors", label: "Errors", icon: AlertTriangle },
    { id: "debug", label: "Debug", icon: Bug },
    { id: "logs", label: "Logs", icon: Terminal },
    { id: "security", label: "Security", icon: Shield },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {subs.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSub(s.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors",
              activeSub === s.id 
                ? "bg-[#9e2339] text-white border-[#9e2339]" 
                : "bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700"
            )}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>
      {activeSub === "architecture" && <ArchitectureOverview />}
      {activeSub === "api" && <APIReferenceTable />}
      {activeSub === "database" && <DatabaseSchema />}
      {activeSub === "lifecycle" && <DocumentLifecycle />}
      {activeSub === "env" && <EnvAndConfig />}
      {activeSub === "rate-limit" && <RateLimiting />}
      {activeSub === "errors" && <ErrorCodesTable />}
      {activeSub === "debug" && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-800 dark:text-neutral-200 mb-2">Connectivity check</h4>
            <ConnectivityCheck />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 dark:text-neutral-200 mb-2">Error log viewer</h4>
            <ErrorLogViewer />
          </div>
        </div>
      )}
      {activeSub === "logs" && <LogsObservability />}
      {activeSub === "security" && <SecurityOverview />}
    </div>
  );
}

// ============================================================================
// SECTION COMPONENT
// ============================================================================

function Section({ icon: Icon, title, children, defaultOpen = false, badge = null }) {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-none dark:border dark:border-neutral-700">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-neutral-700 flex items-center justify-center">
          <Icon className="h-5 w-5 text-gray-600 dark:text-neutral-400" />
        </div>
        <span className="flex-1 font-medium text-gray-800 dark:text-neutral-100">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
            {badge}
          </span>
        )}
        <ChevronDown className={cn(
          "h-5 w-5 text-gray-400 dark:text-neutral-500 transition-transform",
          !open && "-rotate-90"
        )} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN HELP DOCUMENTATION
// ============================================================================

export function HelpDocumentation({ onClose }) {
  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-neutral-900">
      {/* Header */}
      <div className="px-6 py-5 bg-white dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-neutral-100">Help & Documentation</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
            Complete guide to document processing with Cortex
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
        >
          Close
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Workflow */}
        <Section icon={Zap} title="Processing Workflow" defaultOpen={true}>
          <AnimatedWorkflowDiagram />
        </Section>
        
        {/* Consensus Mode */}
        <Section icon={GitBranch} title="Understanding Consensus Mode" badge="Important">
          <ConsensusExplainer />
        </Section>
        
        {/* Confidence Scores */}
        <Section icon={Target} title="Likelihood & Confidence Scores">
          <ConfidenceThresholdGuide />
        </Section>
        
        {/* Schema Building */}
        <Section icon={FileCode} title="Schema Building Process" badge="From Retab Docs">
          <SchemaBuildingProcess />
        </Section>
        
        {/* Model Selection */}
        <Section icon={Cpu} title="Model Selection">
          <p className="text-sm text-gray-600 dark:text-neutral-300 mb-4">
            Choose the right model based on your speed, accuracy, and cost requirements.
          </p>
          <ModelComparison />
        </Section>
        
        {/* Best Practices */}
        <Section icon={Shield} title="Best Practices" badge="From Retab Docs">
          <BestPractices />
        </Section>
        
        {/* Technical Reference (enterprise architects & senior engineers) */}
        <Section icon={Terminal} title="Technical Reference" badge="Engineers">
          <TechnicalReferenceContent />
        </Section>
        
        {/* FAQ */}
        <Section icon={HelpCircle} title="Frequently Asked Questions">
          <FAQSection />
        </Section>
        
        {/* Contact */}
        <div className="bg-gradient-to-r from-[#9e2339] to-[#c13350] rounded-2xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Need More Help?</h3>
              <p className="text-white/80 text-sm mt-1 mb-3">
                Contact the Stewart AI Lab team for support, feature requests, or custom integration needs.
              </p>
              <a
                href="mailto:philip.snowden@stewart.com?subject=SAIL%20Inquiry%20from%20CORTEX"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#9e2339] rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Contact SAIL
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpDocumentation;
