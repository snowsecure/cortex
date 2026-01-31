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
      <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 mb-4">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-t-2xl overflow-hidden">
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
                    isPast ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-500"
                  )}>
                    {isPast && !isActive ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    isActive ? "text-gray-900" : "text-gray-500"
                  )}>
                    {step.title}
                  </span>
                </button>
                
                {index < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-1 rounded transition-colors",
                    index < activeStep ? "bg-green-400" : "bg-gray-200"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Active step detail */}
        <div className={cn("rounded-xl p-5 transition-colors", activeStepData.lightBg)}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br",
              activeStepData.color
            )}>
              <ActiveIcon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{activeStepData.title}</h3>
                <span className="text-sm text-gray-500">— {activeStepData.subtitle}</span>
              </div>
              <p className="text-gray-600">{activeStepData.description}</p>
              
            </div>
          </div>
          
          {/* Always show details - compact */}
          <div className="mt-3 pt-3 border-t border-gray-200/50 grid md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <div>
                <span className="font-semibold text-gray-500 uppercase">What: </span>
                <span className="text-gray-600">{activeStepData.details.what}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-500 uppercase">How: </span>
                <span className="text-gray-600">{activeStepData.details.how}</span>
              </div>
            </div>
            <div>
              <span className="font-semibold text-gray-500 uppercase">Tips: </span>
              <span className="text-gray-600">{activeStepData.details.tips.join(" · ")}</span>
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isPlaying ? "bg-gray-200 text-gray-700" : "bg-gray-900 text-white"
            )}
          >
            {isPlaying ? <Timer className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <span className="text-xs text-gray-500">
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
      <div className="p-4 bg-blue-50 rounded-xl">
        <p className="text-sm text-blue-800">
          <strong>Consensus</strong> is Retab's approach to extraction validation. It runs multiple parallel 
          AI requests using the same schema and compares results. When responses disagree, it reveals 
          ambiguities in the extraction.
        </p>
        <p className="text-xs text-blue-600 mt-2">
          Retab docs:{" "}
          <a href="https://docs.retab.com/overview/Build-your-Schema" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">Build your Schema</a>
          {" · "}
          <a href="https://docs.retab.com/overview/Best-practices" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">Best practices</a>
        </p>
      </div>
      
      {/* Level selector */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
        <span className="text-sm font-medium text-gray-700">n_consensus =</span>
        <div className="flex gap-2">
          {[1, 3, 5].map(level => (
            <button
              key={level}
              onClick={() => setConsensusLevel(level)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                consensusLevel === level 
                  ? "bg-gray-900 text-white" 
                  : "bg-white text-gray-600 hover:bg-gray-100"
              )}
            >
              {level}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500">
          Cost: <strong>{current.cost}</strong> · {current.recommendation}
        </span>
      </div>
      
      {/* Visual comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            {consensusLevel} Parallel Extraction{consensusLevel > 1 ? 's' : ''}
          </h4>
          <div className="space-y-2">
            {current.responses.slice(0, 3).map((response, i) => (
              <div key={i} className="p-3 bg-white rounded-lg border border-gray-200 text-xs font-mono">
                <span className="text-gray-400">Response #{i + 1}:</span>
                <div className="mt-1 text-gray-700">
                  grantor: "{response.grantor}"<br/>
                  recording_date: "{response.recording_date}"<br/>
                  loan_amount: "{response.loan_amount}"
                </div>
              </div>
            ))}
            {current.responses.length > 3 && (
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  +{current.responses.length - 3} more identical responses
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Likelihood Scores</h4>
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2">Field</th>
                  <th className="pb-2">Likelihood</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(current.likelihoods).map(([field, score]) => (
                  <tr key={field} className="border-t border-gray-100">
                    <td className="py-2 font-mono text-gray-700">{field}</td>
                    <td className="py-2 font-medium">{score}</td>
                    <td className="py-2">
                      {score.includes("✓") && <span className="text-green-600">Good</span>}
                      {score.includes("⚠") && <span className="text-amber-600">Needs work</span>}
                      {score.includes("✗") && <span className="text-red-600">Poor</span>}
                      {score === "N/A" && <span className="text-gray-400">No comparison</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-3 p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-800">
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
      <div className="p-4 bg-violet-50 rounded-xl">
        <h4 className="font-medium text-violet-900 mb-2">The Schema Building Process</h4>
        <div className="flex items-center gap-2 text-sm text-violet-700 flex-wrap">
          <span className="px-2 py-1 bg-violet-100 rounded">1. Define Schema</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-violet-100 rounded">2. Execute n_consensus=4</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-violet-100 rounded">3. Review Likelihoods</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-violet-100 rounded">4. Adjust & Repeat</span>
        </div>
      </div>
      
      <h4 className="text-sm font-medium text-gray-700">Schema Improvement Levers</h4>
      <div className="grid md:grid-cols-2 gap-3">
        {levers.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.lever}</p>
                  <p className="text-xs text-gray-500 mt-0.5">When: {item.when}</p>
                  <p className="text-xs text-gray-600 mt-1 font-mono bg-white px-2 py-1 rounded">
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
          <div key={i} className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-800">{practice.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{practice.description}</p>
                <p className="text-xs text-emerald-700 mt-2 flex items-start gap-1">
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
      <div className="p-4 bg-blue-50 rounded-xl">
        <p className="text-sm text-blue-800">
          <strong>Likelihood scores</strong> indicate how reliably a field was extracted. With consensus mode,
          scores reflect agreement between multiple extraction runs. Higher = more consistent = more reliable.
        </p>
      </div>
      
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm">
              <th className="px-4 py-3 font-medium text-gray-700">Score</th>
              <th className="px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 font-medium text-gray-700">Recommended Action</th>
              <th className="px-4 py-3 font-medium text-gray-700">What it means</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {thresholds.map((t, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", t.color)} />
                    <span className="font-mono text-sm">{t.range}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{t.status}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{t.action}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{t.description}</td>
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
      <p className="text-xs text-gray-500">
        <strong>1 credit = $0.01.</strong> Extract/Split/Parse/Schema: <code className="bg-gray-100 px-1 rounded">total_credits = model_credits × page_count</code>; with consensus: <code className="bg-gray-100 px-1 rounded">× n_consensus</code>. Source:{" "}
        <a href="https://docs.retab.com/core-concepts/Pricing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Retab Pricing</a>.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium text-gray-700">Model</th>
              <th className="px-4 py-3 font-medium text-gray-700">Speed</th>
              <th className="px-4 py-3 font-medium text-gray-700">Accuracy</th>
              <th className="px-4 py-3 font-medium text-gray-700">Credits/page</th>
              <th className="px-4 py-3 font-medium text-gray-700">USD/page</th>
              <th className="px-4 py-3 font-medium text-gray-700">Best For</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {models.map((m, i) => {
              const p = RETAB_PRICING[m.name];
              return (
                <tr key={m.name} className={i === 1 ? "bg-emerald-50" : ""}>
                  <td className="px-4 py-3 font-mono">{m.name}</td>
                  <td className="px-4 py-3">{m.speed}</td>
                  <td className="px-4 py-3">{m.accuracy}</td>
                  <td className="px-4 py-3 font-mono">{p.creditsPerPage}</td>
                  <td className="px-4 py-3 font-mono">${p.usdPerPage.toFixed(3)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.useCase}
                    {i === 1 && <span className="ml-2 text-xs text-emerald-600 font-medium">← Recommended</span>}
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
        <div key={index} className="bg-gray-50 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpenItem(openItem === index ? null : index)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <span className="text-sm font-medium text-gray-700">{faq.q}</span>
            <ChevronRight className={cn(
              "h-4 w-4 text-gray-400 transition-transform shrink-0 ml-2",
              openItem === index && "rotate-90"
            )} />
          </button>
          {openItem === index && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
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
  { method: "POST", path: "/documents/split", description: "Split PDF packet into subdocuments with page ranges", retab: "POST /v1/documents/split" },
  { method: "POST", path: "/documents/classify", description: "Classify document into categories (e.g. deed, mortgage)", retab: "POST /v1/documents/classify" },
  { method: "POST", path: "/documents/extract", description: "Extract structured data from document using JSON schema", retab: "POST /v1/documents/extract" },
  { method: "POST", path: "/documents/parse", description: "Parse document to text/markdown", retab: "POST /v1/documents/parse" },
  { method: "POST", path: "/schemas/generate", description: "Generate JSON schema from sample document", retab: "POST /v1/schemas/generate" },
  { method: "POST", path: "/jobs", description: "Create async job (extract, etc.)", retab: "POST /v1/jobs" },
  { method: "GET", path: "/jobs/:jobId", description: "Get job status and result", retab: "GET /v1/jobs/:id" },
];

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
  A[CORTEX] -->|request| B[Proxy]
  B -->|forward| D[Retab API]
  D -->|response| B
  B -->|response| A
  B <-->|persist| C[(SQLite)]`;

function ArchitectureOverview() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        CORTEX runs as a client-side React app that talks to a local Node proxy. The proxy forwards requests to the Retab API and persists session/packet/document state in SQLite.
      </p>
      <div className="rounded-xl border border-gray-200 bg-slate-50/80 p-6 overflow-x-auto min-h-[140px] flex items-center justify-center">
        <MermaidDiagram chart={ARCHITECTURE_MERMAID} className="flex justify-center py-2 [&_svg]:max-w-full [&_svg]:h-auto [&_.node]:outline-none [&_.edgePath]:stroke-slate-400" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-xs overflow-x-auto">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="font-semibold">Browser</span>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <span className="font-semibold">Node proxy (Express)</span>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <span className="font-semibold">Retab API (api.retab.com)</span>
        </div>
        <div className="mt-2 text-gray-500">
          API key is sent in <code className="bg-white px-1 rounded">Api-Key</code> header from client to proxy; proxy forwards it to Retab. No document data is stored on Retab beyond the request/response.
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="p-3 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center gap-2 text-gray-700 font-medium mb-1"><Database className="h-4 w-4" /> SQLite</div>
          <p className="text-gray-500 text-xs">Sessions, packets, documents, history, usage. Path: <code className="bg-gray-100 px-1 rounded">DB_PATH/sail-idp.db</code> (default <code className="bg-gray-100 px-1 rounded">./data</code>).</p>
        </div>
        <div className="p-3 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center gap-2 text-gray-700 font-medium mb-1"><Server className="h-4 w-4" /> Proxy</div>
          <p className="text-gray-500 text-xs">CORS, request logging, 100MB JSON limit. Port: <code className="bg-gray-100 px-1 rounded">PORT</code> (default 3001).</p>
        </div>
        <div className="p-3 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center gap-2 text-gray-700 font-medium mb-1"><Zap className="h-4 w-4" /> Retab</div>
          <p className="text-gray-500 text-xs">Split, classify, extract, parse, jobs. Base: <code className="bg-gray-100 px-1 rounded">https://api.retab.com/v1</code>.</p>
        </div>
      </div>
    </div>
  );
}

function APIReferenceTable() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        All proxy endpoints are relative to the app origin (e.g. <code className="bg-gray-100 px-1 rounded font-mono text-xs">http://localhost:3001</code>). Authentication: <code className="bg-gray-100 px-1 rounded font-mono text-xs">Api-Key: &lt;your-key&gt;</code> in request headers.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium text-gray-700">Method</th>
              <th className="px-4 py-2 font-medium text-gray-700">Proxy path</th>
              <th className="px-4 py-2 font-medium text-gray-700">Description</th>
              <th className="px-4 py-2 font-medium text-gray-700">Retab equivalent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {PROXY_ENDPOINTS.map((ep, i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-4 py-2 font-mono text-xs font-medium text-emerald-700">{ep.method}</td>
                <td className="px-4 py-2 font-mono text-xs">{ep.path}</td>
                <td className="px-4 py-2 text-gray-600">{ep.description}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{ep.retab}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        Request/response bodies follow Retab’s API spec. For extract: <code className="bg-gray-100 px-1 rounded">document.url</code> is a base64 data URL; <code className="bg-gray-100 px-1 rounded">json_schema</code> is required; <code className="bg-gray-100 px-1 rounded">n_consensus</code> optional (default 1).
      </p>
    </div>
  );
}

function EnvAndConfig() {
  const envVars = [
    { name: "PORT", default: "3001", description: "Proxy server port" },
    { name: "NODE_ENV", default: "development", description: "development | production" },
    { name: "DB_PATH", default: "./data", description: "Directory for SQLite DB file" },
    { name: "CORS_ORIGIN", default: "*", description: "Allowed origin for CORS (set in production)" },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Server reads these at startup. API key is not an env var; it is set in the client (Admin or <code className="bg-gray-100 px-1 rounded font-mono text-xs">localStorage.retab_api_key</code>).
      </p>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium text-gray-700">Variable</th>
              <th className="px-4 py-2 font-medium text-gray-700">Default</th>
              <th className="px-4 py-2 font-medium text-gray-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {envVars.map((v, i) => (
              <tr key={i}>
                <td className="px-4 py-2 font-mono text-xs">{v.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{v.default}</td>
                <td className="px-4 py-2 text-gray-600">{v.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorCodesTable() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Use these patterns to identify and remediate failures. Prefer idempotent operations and exponential backoff for retriable errors.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium text-gray-700">Pattern / Code</th>
              <th className="px-4 py-2 font-medium text-gray-700">Likely cause</th>
              <th className="px-4 py-2 font-medium text-gray-700">Remediation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ERROR_REMEDIATION.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-4 py-2 font-mono text-xs text-gray-700">{row.pattern}</td>
                <td className="px-4 py-2 text-gray-600">{row.cause}</td>
                <td className="px-4 py-2 text-gray-600">{row.fix}</td>
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
            ? "Server returned HTML instead of JSON. Is the API running on the correct port (e.g. 3001)?"
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
            ? "Server returned HTML instead of JSON. Is the API running on the correct port (e.g. 3001)?"
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
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 && !loading && (
            <p className="p-4 text-sm text-gray-500 text-center">
              {errors.length === 0 ? "No persisted errors. Run a job that fails to see entries here." : "No entries match the filter."}
            </p>
          )}
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-medium text-gray-800 truncate">{entry.filename}</span>
                  <span className="text-xs text-gray-500">{entry.completed_at || entry.created_at}</span>
                </div>
                <p className="mt-1 text-sm text-red-700 break-all">{entry.error}</p>
                <p className="text-xs text-gray-400 mt-0.5">Session: {entry.session_id} · Packet: {entry.id}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(entry.error, entry.id)}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                title="Copy error message"
              >
                {copiedId === entry.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Errors are persisted when a packet fails (e.g. split/extract error). Admin → Logs shows recent activity; this view shows only failed packets with messages.
      </p>
    </div>
  );
}

function LogsObservability() {
  return (
    <div className="space-y-3">
      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
        <li><strong>Browser:</strong> Open DevTools → Console. All API calls and client errors log here. Network tab shows request/response for each proxy call.</li>
        <li><strong>Server:</strong> Stdout logs each request (method, path, status, duration). Run with <code className="bg-gray-100 px-1 rounded font-mono text-xs">node server.js</code> or your process manager to capture logs.</li>
        <li><strong>Admin → Logs:</strong> In-app activity log (recent packet completions and status). Use for quick triage without leaving the app.</li>
        <li><strong>Help → Technical Reference → Error log viewer:</strong> Persisted failed packets (filename, error message, session). Use for debugging recurring failures.</li>
      </ul>
      <p className="text-sm text-gray-500">
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
      <p className="text-sm text-gray-600">
        Hardening and security practices for CORTEX. See also <code className="bg-gray-100 px-1 rounded font-mono text-xs">SECURITY.md</code> in the repo.
      </p>

      <div>
        <h4 className="text-sm font-medium text-gray-800 mb-2">Server hardening (implemented)</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-gray-700">Area</th>
                <th className="px-4 py-2 font-medium text-gray-700">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hardening.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-medium text-gray-700 w-36">{row.area}</td>
                  <td className="px-4 py-2 text-gray-600">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-800 mb-2">API key handling</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-gray-700">Where</th>
                <th className="px-4 py-2 font-medium text-gray-700">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apiKey.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-medium text-gray-700 w-28">{row.where}</td>
                  <td className="px-4 py-2 text-gray-600">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-800 mb-2">Database</h4>
        <p className="text-sm text-gray-600 mb-2">
          SQLite at <code className="bg-gray-100 px-1 rounded font-mono text-xs">DB_PATH/sail-idp.db</code> (default <code className="bg-gray-100 px-1 rounded font-mono text-xs">./data</code>). All queries use parameterized statements. Restrict filesystem access so only the app can read/write <code className="bg-gray-100 px-1 rounded font-mono text-xs">DB_PATH</code>.
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-800 mb-2">Production checklist</h4>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          {prodChecklist.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-500">
        Report security-sensitive bugs to your internal security or SAIL team, not in public issue trackers.
      </p>
    </div>
  );
}

function TechnicalReferenceContent() {
  const [activeSub, setActiveSub] = useState("architecture");
  const subs = [
    { id: "architecture", label: "Architecture", icon: Database },
    { id: "api", label: "API reference", icon: FileCode },
    { id: "env", label: "Environment", icon: Settings },
    { id: "errors", label: "Error codes", icon: AlertTriangle },
    { id: "debug", label: "Debug tools", icon: Bug },
    { id: "logs", label: "Logs & observability", icon: Terminal },
    { id: "security", label: "Security", icon: Shield },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {subs.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSub(s.id)}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
              activeSub === s.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            )}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
      </div>
      {activeSub === "architecture" && <ArchitectureOverview />}
      {activeSub === "api" && <APIReferenceTable />}
      {activeSub === "env" && <EnvAndConfig />}
      {activeSub === "errors" && <ErrorCodesTable />}
      {activeSub === "debug" && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-2">Connectivity check</h4>
            <ConnectivityCheck />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-2">Error log viewer</h4>
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
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
        <span className="flex-1 font-medium text-gray-800">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            {badge}
          </span>
        )}
        <ChevronDown className={cn(
          "h-5 w-5 text-gray-400 transition-transform",
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
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="px-6 py-5 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Help & Documentation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete guide to document processing with Cortex
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
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
          <p className="text-sm text-gray-600 mb-4">
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
