import { useState, useCallback, useRef } from "react";
import { extractDocument, createExtractionJob, getJobStatus } from "../lib/retab";

/**
 * Status types for extraction
 */
export const ExtractionStatus = {
  IDLE: "idle",
  UPLOADING: "uploading",
  PROCESSING: "processing",
  EXTRACTING: "extracting",
  COMPLETE: "complete",
  ERROR: "error",
};

/**
 * Hook for document extraction with progress tracking
 */
export function useRetabExtract() {
  const [status, setStatus] = useState(ExtractionStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);
  const jobIdRef = useRef(null);

  /**
   * Reset the extraction state
   */
  const reset = useCallback(() => {
    abortRef.current = true;
    jobIdRef.current = null;
    setStatus(ExtractionStatus.IDLE);
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  /**
   * Poll for job status
   */
  const pollJobStatus = useCallback(async (jobId, maxAttempts = 120) => {
    let attempts = 0;
    const pollInterval = 2000; // 2 seconds

    while (attempts < maxAttempts && !abortRef.current) {
      try {
        const jobStatus = await getJobStatus(jobId);
        
        // Update progress based on status
        switch (jobStatus.status) {
          case "validating":
            setProgress(10);
            setStatus(ExtractionStatus.UPLOADING);
            break;
          case "queued":
            setProgress(20);
            setStatus(ExtractionStatus.PROCESSING);
            break;
          case "processing":
            setProgress(40 + Math.min(attempts * 2, 40)); // Progress from 40% to 80%
            setStatus(ExtractionStatus.EXTRACTING);
            break;
          case "completed":
            setProgress(100);
            setStatus(ExtractionStatus.COMPLETE);
            return jobStatus.result;
          case "failed":
            throw new Error(jobStatus.error?.message || "Extraction failed");
          case "cancelled":
            throw new Error("Extraction was cancelled");
          case "expired":
            throw new Error("Extraction job expired");
          default:
            break;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        attempts++;
      } catch (err) {
        throw err;
      }
    }

    throw new Error("Extraction timed out");
  }, []);

  /**
   * Extract data from a document using sync API
   */
  const extractSync = useCallback(async ({ document, filename, jsonSchema, model, nConsensus }) => {
    abortRef.current = false;
    setError(null);
    setResult(null);

    try {
      // Phase 1: Uploading
      setStatus(ExtractionStatus.UPLOADING);
      setProgress(10);

      // Phase 2: Processing
      setStatus(ExtractionStatus.PROCESSING);
      setProgress(30);

      // Phase 3: Extracting
      setStatus(ExtractionStatus.EXTRACTING);
      setProgress(50);

      const response = await extractDocument({
        document,
        filename: filename || "document.pdf",
        jsonSchema,
        model: model || "retab-small",
        temperature: nConsensus > 1 ? 0.1 : 0,
        nConsensus: nConsensus || 1,
      });

      if (abortRef.current) return null;

      // Phase 4: Complete
      setProgress(100);
      setStatus(ExtractionStatus.COMPLETE);
      setResult(response);
      return response;
    } catch (err) {
      if (abortRef.current) return null;
      setStatus(ExtractionStatus.ERROR);
      setError(err.message || "Extraction failed");
      throw err;
    }
  }, []);

  /**
   * Extract data from a document using async Jobs API
   */
  const extractAsync = useCallback(async ({ document, filename, jsonSchema, model, nConsensus }) => {
    abortRef.current = false;
    setError(null);
    setResult(null);

    try {
      // Phase 1: Creating job
      setStatus(ExtractionStatus.UPLOADING);
      setProgress(5);

      const job = await createExtractionJob({
        document,
        filename: filename || "document.pdf",
        jsonSchema,
        model: model || "retab-small",
        temperature: nConsensus > 1 ? 0.1 : 0,
        nConsensus: nConsensus || 1,
      });

      if (abortRef.current) return null;

      jobIdRef.current = job.id;
      setProgress(10);

      // Phase 2-4: Poll for status
      const response = await pollJobStatus(job.id);

      if (abortRef.current) return null;

      setResult(response);
      return response;
    } catch (err) {
      if (abortRef.current) return null;
      setStatus(ExtractionStatus.ERROR);
      setError(err.message || "Extraction failed");
      throw err;
    }
  }, [pollJobStatus]);

  /**
   * Main extract function - uses sync for small docs, async for larger ones
   */
  const extract = useCallback(async ({ document, filename, jsonSchema, model, nConsensus, useAsync = false }) => {
    if (useAsync) {
      return extractAsync({ document, filename, jsonSchema, model, nConsensus });
    }
    return extractSync({ document, filename, jsonSchema, model, nConsensus });
  }, [extractSync, extractAsync]);

  /**
   * Cancel ongoing extraction
   */
  const cancel = useCallback(() => {
    abortRef.current = true;
    setStatus(ExtractionStatus.IDLE);
    setProgress(0);
  }, []);

  return {
    status,
    progress,
    result,
    error,
    extract,
    extractSync,
    extractAsync,
    reset,
    cancel,
    isLoading: status !== ExtractionStatus.IDLE && 
               status !== ExtractionStatus.COMPLETE && 
               status !== ExtractionStatus.ERROR,
    isComplete: status === ExtractionStatus.COMPLETE,
    isError: status === ExtractionStatus.ERROR,
  };
}

export default useRetabExtract;
