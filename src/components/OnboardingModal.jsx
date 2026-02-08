import { useState } from "react";
import {
  Upload,
  Cpu,
  ClipboardCheck,
  Download,
  ArrowRight,
  ArrowLeft,
  User,
  KeyRound,
  Lock,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

const TOTAL_STEPS = 4;

/**
 * Step indicator dots
 */
function StepDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? "w-6 bg-[#9e2339]"
              : i < current
              ? "w-1.5 bg-[#9e2339]/40"
              : "w-1.5 bg-gray-300 dark:bg-neutral-600"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Workflow step card for the quick start guide
 */
function WorkflowStep({ icon: Icon, label, description, accent }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 flex-1 min-w-0">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center ${
          accent
            ? "bg-[#9e2339]/10 dark:bg-[#9e2339]/20"
            : "bg-gray-100 dark:bg-neutral-800"
        }`}
      >
        <Icon
          className={`h-5 w-5 ${
            accent ? "text-[#9e2339]" : "text-gray-500 dark:text-neutral-400"
          }`}
        />
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
        {label}
      </p>
      <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

/**
 * Onboarding modal — shown when no API key or username is set.
 * 4-step guided flow: Welcome → Identity → API Key → Quick Start
 */
export default function OnboardingModal({
  usernameInput,
  setUsernameInput,
  apiKeyInput,
  setApiKeyInput,
  onComplete,
  showWarning,
  setShowWarning,
}) {
  const [step, setStep] = useState(0);

  const canAdvance = () => {
    if (step === 1) return usernameInput.trim().length > 0;
    if (step === 2) return apiKeyInput.trim().length > 0;
    return true;
  };

  const next = () => {
    if (!canAdvance()) {
      setShowWarning(true);
      return;
    }
    setShowWarning(false);
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    }
  };

  const back = () => {
    setShowWarning(false);
    if (step > 0) setStep(step - 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") next();
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70" />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Stewart Red accent bar */}
        <div className="h-1 bg-linear-to-r from-[#9e2339] via-[#c4354d] to-[#9e2339]" />

        {/* Content */}
        <div className="px-8 pt-8 pb-6">
          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="text-center">
              <p
                className="text-[10px] tracking-[0.3em] uppercase text-gray-400 dark:text-neutral-500 mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Stewart
              </p>
              <h1
                className="text-5xl tracking-tight text-gray-900 dark:text-neutral-100 mb-1"
                style={{ fontFamily: "Inter, sans-serif", fontWeight: 900 }}
              >
                CORTEX
              </h1>
              <p
                className="text-[10px] tracking-[0.25em] uppercase text-gray-400 dark:text-neutral-500 mb-6"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Structured Data, On Demand
              </p>

              <p className="text-sm text-gray-600 dark:text-neutral-300 mb-6 leading-relaxed max-w-sm mx-auto">
                Intelligent document processing for title &amp; escrow.
                Upload PDFs, extract structured data, review with confidence.
              </p>

              {/* POWERED BY SAIL */}
              <div className="flex items-center justify-center gap-1.5 mb-8">
                <span className="text-[11px] tracking-wide text-gray-400 dark:text-neutral-500">
                  POWERED BY
                </span>
                <span className="text-[11px] tracking-wide font-bold text-[#9e2339]">
                  SAIL
                </span>
              </div>

              <button
                onClick={next}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#9e2339] hover:bg-[#7a1b2d] text-white text-sm font-medium transition-colors shadow-sm"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-lg bg-[#9e2339]/10 dark:bg-[#9e2339]/20 flex items-center justify-center">
                  <User className="h-4.5 w-4.5 text-[#9e2339]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">
                    Your Name
                  </h2>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mb-5 ml-12">
                Used to track who uploaded and processed documents.
              </p>

              <div className="space-y-2 mb-4">
                <input
                  type="text"
                  placeholder="e.g. Philip Snowden"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setShowWarning(false);
                  }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 text-sm placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#9e2339]/30 focus:border-[#9e2339]/50 transition-colors"
                />
              </div>

              {showWarning && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-4">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Please enter your name to continue
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: API Key ── */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-lg bg-[#9e2339]/10 dark:bg-[#9e2339]/20 flex items-center justify-center">
                  <KeyRound className="h-4.5 w-4.5 text-[#9e2339]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">
                    Retab API Key
                  </h2>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mb-5 ml-12">
                Required for document processing.{" "}
                <a
                  href="https://retab.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[#9e2339] hover:underline"
                >
                  Get your key
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>

              <div className="space-y-2 mb-4">
                <input
                  type="password"
                  placeholder="Paste your API key"
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setShowWarning(false);
                  }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 text-sm placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#9e2339]/30 focus:border-[#9e2339]/50 transition-colors"
                />
              </div>

              <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-neutral-500 mb-4">
                <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Stored locally in your browser — never sent to our servers.
                </span>
              </div>

              {showWarning && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-4">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Please enter a valid API key to continue
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Quick Start ── */}
          {step === 3 && (
            <div>
              <h2
                className="text-lg font-bold text-gray-900 dark:text-neutral-100 text-center mb-1"
              >
                How CORTEX Works
              </h2>
              <p className="text-sm text-gray-500 dark:text-neutral-400 text-center mb-6">
                Four steps from PDF to structured data.
              </p>

              <div className="grid grid-cols-4 gap-3 mb-8">
                <WorkflowStep
                  icon={Upload}
                  label="Upload"
                  description="Drop PDFs — single or multi-document files"
                  accent
                />
                <WorkflowStep
                  icon={Cpu}
                  label="Process"
                  description="AI splits, classifies, and extracts data"
                />
                <WorkflowStep
                  icon={ClipboardCheck}
                  label="Review"
                  description="Verify flagged fields with low confidence"
                />
                <WorkflowStep
                  icon={Download}
                  label="Export"
                  description="TPS Export, Raw Data, or Populate Forms"
                />
              </div>

              <button
                onClick={handleComplete}
                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#9e2339] hover:bg-[#7a1b2d] text-white text-sm font-medium transition-colors shadow-sm"
              >
                Start Using CORTEX
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer: navigation + step dots */}
        {step > 0 && step < 3 && (
          <div className="px-8 pb-6 flex items-center justify-between">
            <button
              onClick={back}
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <StepDots current={step} total={TOTAL_STEPS} />
            <button
              onClick={next}
              className="flex items-center gap-1 text-sm font-medium text-[#9e2339] hover:text-[#7a1b2d] transition-colors"
            >
              Continue
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Step dots only for welcome (no nav buttons) */}
        {step === 0 && (
          <div className="px-8 pb-6">
            <StepDots current={step} total={TOTAL_STEPS} />
          </div>
        )}

        {/* Step dots only for final step (no nav buttons besides CTA) */}
        {step === 3 && (
          <div className="px-8 pb-6 flex items-center justify-between">
            <button
              onClick={back}
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <StepDots current={step} total={TOTAL_STEPS} />
            <div className="w-12" /> {/* spacer for alignment */}
          </div>
        )}
      </div>
    </div>
  );
}
