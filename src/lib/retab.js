/**
 * Retab API Client
 * Handles document extraction and schema generation
 * Uses local proxy server to avoid CORS issues
 */

// Default to "" (relative / same-origin) so production & Docker work without VITE_API_URL.
// For local dev the Vite proxy forwards /api → localhost:3005 automatically.
const RETAB_API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

/**
 * Get API key from localStorage
 */
export function getApiKey() {
  return localStorage.getItem("retab_api_key") || "";
}

/**
 * Set API key in localStorage
 */
export function setApiKey(key) {
  localStorage.setItem("retab_api_key", key);
}

/**
 * Check if API key is configured
 */
export function hasApiKey() {
  return !!getApiKey();
}

// ============================================================================
// USERNAME (stored in localStorage, like API key)
// ============================================================================

const USERNAME_KEY = "cortex_username";

/**
 * Get username from localStorage
 */
export function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || "";
}

/**
 * Set username in localStorage
 */
export function setUsername(name) {
  localStorage.setItem(USERNAME_KEY, name);
}

/**
 * Check if username is configured
 */
export function hasUsername() {
  return !!localStorage.getItem(USERNAME_KEY);
}

/**
 * Convert file to base64 data URL
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Extract structured data from a document
 * @param {Object} options
 * @param {string} options.document - Base64 data URL of the document
 * @param {Object} options.jsonSchema - JSON schema for extraction
 * @param {string} options.model - Model to use (default: "retab-small")
 * @param {number} options.temperature - Temperature (default: 0)
 * @param {number} options.nConsensus - Number of consensus runs (default: 1)
 * @param {number} options.imageDpi - Image resolution DPI (default: 192)
 * @param {boolean} options.stream - Stream extraction results (default: false)
 * @param {string[]|null} options.chunkingKeys - Array field keys for parallel OCR (default: null)
 * @returns {Promise<Object>} Extraction response
 */
export async function extractDocument({
  document,
  filename = "document.pdf",
  jsonSchema,
  model = "retab-small",
  temperature = 0,
  nConsensus = 1,
  imageDpi = 192,
  stream = false,
  chunkingKeys = null,
  signal = null, // AbortSignal for external cancellation (e.g., pause)
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  // API requires temperature > 0 when n_consensus > 1 (consensus needs variation between runs)
  const t = Number(temperature);
  const needNonZeroTemp = nConsensus > 1 && (t === 0 || Number.isNaN(t) || t < 0.01);
  const effectiveTemperature = needNonZeroTemp ? 0.1 : (typeof temperature === "number" ? temperature : (Number.isNaN(t) ? 0 : t));

  // Build request body - only include optional params when not default
  const requestBody = {
    document: {
      filename: filename,
      url: document,  // Data URL (data:application/pdf;base64,...)
    },
    model,
    json_schema: jsonSchema,
    temperature: effectiveTemperature,
    image_resolution_dpi: imageDpi,
  };
  
  // Only include n_consensus if > 1 (API default is 1)
  if (nConsensus > 1) {
    requestBody.n_consensus = nConsensus;
  }

  // Streaming extraction
  if (stream) {
    requestBody.stream = true;
  }

  // Chunking keys for parallel OCR on long lists/tables
  if (chunkingKeys && chunkingKeys.length > 0) {
    requestBody.chunking_keys = chunkingKeys;
  }

  const response = await fetch(`${RETAB_API_BASE}/documents/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify(requestBody),
    signal: signal || undefined,
  });

  if (!response.ok) {
    // For streaming, errors may still come as JSON
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.detail || errorData.error || errorData.message || `API error: ${response.status}`;
    console.error("Extraction API error:", response.status, errorData);
    throw new Error(errorMsg);
  }

  // Streaming: read SSE stream and accumulate into final result
  if (stream) {
    return handleStreamingResponse(response, signal);
  }

  return response.json();
}

/**
 * Handle a streaming extraction response (SSE / text/event-stream).
 * Accumulates streamed chunks and returns the final extraction result
 * in the same shape as a non-streaming response.
 *
 * Includes an inactivity timeout: if no data arrives for 60 seconds the
 * stream is cancelled and an error is thrown. This prevents the client
 * from hanging forever when the server or upstream Retab API stops
 * sending data without closing the connection.
 *
 * Also respects an optional external AbortSignal so callers (e.g., the
 * pause button) can cancel mid-stream.
 */
async function handleStreamingResponse(response, externalSignal = null) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastData = null;

  // Inactivity timeout: if no chunk arrives for this long, assume the stream is hung
  const INACTIVITY_TIMEOUT_MS = 60_000; // 60 seconds
  let inactivityTimer = null;

  const clearInactivityTimer = () => {
    if (inactivityTimer !== null) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
  };

  const resetInactivityTimer = () => {
    clearInactivityTimer();
    inactivityTimer = setTimeout(() => {
      console.warn("Streaming extraction timed out: no data received for 60s");
      reader.cancel("Inactivity timeout").catch(() => {});
    }, INACTIVITY_TIMEOUT_MS);
  };

  // If the caller aborts (e.g., user pauses), cancel the reader immediately
  const onExternalAbort = () => {
    clearInactivityTimer();
    reader.cancel("Aborted by caller").catch(() => {});
  };

  // Attach the abort listener FIRST, then check if already aborted.
  // This closes the race window where the signal fires between the
  // aborted check and addEventListener — the event would be missed,
  // leaving the reader hanging forever.
  if (externalSignal) {
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    if (externalSignal.aborted) {
      reader.cancel("Aborted before start").catch(() => {});
      throw new Error("Extraction aborted");
    }
  }

  try {
    resetInactivityTimer();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Data received — reset the inactivity timer
      resetInactivityTimer();

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;
          try {
            lastData = JSON.parse(jsonStr);
          } catch {
            // Ignore malformed chunks
          }
        }
      }
    }
  } catch (err) {
    // Surface a clean message for abort/timeout instead of a cryptic stream error
    if (err.name === "AbortError" || externalSignal?.aborted) {
      throw new Error("Extraction aborted");
    }
    // Reader.cancel("Inactivity timeout") causes a TypeError in some browsers
    if (String(err).includes("Inactivity timeout")) {
      throw new Error("Streaming extraction timed out (no data for 60s)");
    }
    throw err;
  } finally {
    clearInactivityTimer();
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  // Process any remaining buffer
  if (buffer.trim().startsWith("data: ")) {
    const jsonStr = buffer.trim().slice(6);
    if (jsonStr !== "[DONE]") {
      try {
        lastData = JSON.parse(jsonStr);
      } catch {
        // Ignore
      }
    }
  }

  if (!lastData) {
    throw new Error("Streaming extraction returned no data");
  }

  return lastData;
}

/**
 * Generate a JSON schema from a document
 * @param {Object} options
 * @param {string} options.document - Base64 data URL of the document
 * @param {string} options.model - Model to use (default: "gpt-5-mini")
 * @param {string} options.instructions - Optional instructions for schema generation
 * @returns {Promise<Object>} Schema generation response
 */
export async function generateSchema({
  document,
  filename = "document.pdf",
  model = "gpt-5-mini",
  instructions = null,
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const body = {
    documents: [{ filename: filename, url: document }],
    model,
    temperature: 0,
  };

  if (instructions) {
    body.instructions = instructions;
  }

  const response = await fetch(`${RETAB_API_BASE}/schemas/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.detail || errorData.error || errorData.message || `API error: ${response.status}`;
    console.error("Schema generation API error:", response.status, errorData);
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Create an extraction job (async processing)
 * @param {Object} options - Same as extractDocument
 * @returns {Promise<Object>} Job creation response with job_id
 */
export async function createExtractionJob({
  document,
  filename = "document.pdf",
  jsonSchema,
  model = "retab-small",
  temperature = 0,
  nConsensus = 1,
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  // Build extraction body - only include optional params when not default
  const extractionBody = {
    document: {
      filename: filename,
      url: document,
    },
    model,
    json_schema: jsonSchema,
    temperature,
  };
  
  // Only include n_consensus if > 1 (API default is 1)
  if (nConsensus > 1) {
    extractionBody.n_consensus = nConsensus;
  }

  const response = await fetch(`${RETAB_API_BASE}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      endpoint: "/v1/documents/extract",
      body: extractionBody,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get job status
 * @param {string} jobId - Job ID to check
 * @returns {Promise<Object>} Job status response
 */
export async function getJobStatus(jobId) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const response = await fetch(`${RETAB_API_BASE}/jobs/${jobId}`, {
    method: "GET",
    headers: {
      "Api-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Split a document packet into subdocuments
 * @param {Object} options
 * @param {string} options.document - Base64 data URL of the document
 * @param {string} options.filename - Filename of the document
 * @param {Array} options.subdocuments - Array of subdocument type definitions
 * @param {string} options.model - Model to use (default: "retab-small")
 * @param {string} options.context - Additional context for splitting
 * @returns {Promise<Object>} Split response with page ranges
 */
export async function splitDocument({
  document,
  filename = "document.pdf",
  subdocuments,
  model = "retab-small",
  imageDpi = 192,
  context = null,
  signal = null, // AbortSignal for external cancellation (e.g., pause)
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const body = {
    document: { filename, url: document },
    subdocuments,
    model,
    image_resolution_dpi: imageDpi,
  };

  if (context) {
    body.context = context;
  }

  const response = await fetch(`${RETAB_API_BASE}/documents/split`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify(body),
    signal: signal || undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.detail || errorData.error || errorData.message || `API error: ${response.status}`;
    console.error("Split API error:", response.status, errorData);
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Classify a document into categories
 * @param {Object} options
 * @param {string} options.document - Base64 data URL of the document
 * @param {string} options.filename - Filename of the document
 * @param {Array} options.categories - Array of category definitions with name and description
 * @param {string} options.model - Model to use (default: "retab-small")
 * @param {number} options.firstNPages - Only use first N pages for classification
 * @param {string} options.context - Additional context for classification
 * @returns {Promise<Object>} Classification response with category and confidence
 */
export async function classifyDocument({
  document,
  filename = "document.pdf",
  categories,
  model = "retab-small",
  firstNPages = null,
  context = null,
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const body = {
    document: { filename, url: document },
    categories,
    model,
  };

  if (firstNPages) {
    body.first_n_pages = firstNPages;
  }

  if (context) {
    body.context = context;
  }

  const response = await fetch(`${RETAB_API_BASE}/documents/classify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.detail || errorData.error || errorData.message || `API error: ${response.status}`;
    console.error("Classify API error:", response.status, errorData);
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Parse a document to text/markdown
 * @param {Object} options
 * @param {string} options.document - Base64 data URL of the document
 * @param {string} options.filename - Filename of the document
 * @param {string} options.model - Model to use (default: "retab-small")
 * @param {string} options.tableParsingFormat - Format for tables (html, markdown, etc.)
 * @returns {Promise<Object>} Parse response with text content
 */
export async function parseDocument({
  document,
  filename = "document.pdf",
  model = "retab-small",
  tableParsingFormat = "html",
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const response = await fetch(`${RETAB_API_BASE}/documents/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      document: { filename, url: document },
      model,
      table_parsing_format: tableParsingFormat,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.detail || errorData.error || errorData.message || `API error: ${response.status}`;
    console.error("Parse API error:", response.status, errorData);
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Create an async job for any supported endpoint
 * @param {Object} options
 * @param {string} options.endpoint - The API endpoint (e.g., "/v1/documents/extract")
 * @param {Object} options.request - The request body for the endpoint
 * @param {Object} options.metadata - Optional metadata for tracking
 * @returns {Promise<Object>} Job creation response with job ID
 */
export async function createJob({
  endpoint,
  request,
  metadata = null,
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const body = {
    endpoint,
    request,
  };

  if (metadata) {
    body.metadata = metadata;
  }

  const response = await fetch(`${RETAB_API_BASE}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.detail || errorData.error || errorData.message || `API error: ${response.status}`;
    console.error("Job creation API error:", response.status, errorData);
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Poll a job until completion
 * @param {string} jobId - Job ID to poll
 * @param {Object} options - Polling options
 * @param {number} options.pollInterval - Interval between polls in ms (default: 2000)
 * @param {number} options.maxAttempts - Maximum poll attempts (default: 120)
 * @param {Function} options.onProgress - Callback for progress updates
 * @returns {Promise<Object>} Job result when complete
 */
export async function pollJobUntilComplete(jobId, {
  pollInterval = 2000,
  maxAttempts = 120,
  onProgress = null,
} = {}) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const job = await getJobStatus(jobId);
    
    if (onProgress) {
      onProgress(job);
    }

    switch (job.status) {
      case "completed":
        return job.response;
      case "failed":
        throw new Error(job.error?.message || "Job failed");
      case "cancelled":
        throw new Error("Job was cancelled");
      case "expired":
        throw new Error("Job expired");
      default:
        // Still processing (validating, queued, processing)
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
    }
  }

  throw new Error("Job polling timed out");
}

// ============================================================================
// EDIT API (Form Filling)
// ============================================================================

/**
 * Fill a document using AI agent (one-off, any format: PDF, DOCX, XLSX, PPTX)
 * @param {Object} options
 * @param {string} options.document - Base64 data URL of the blank form
 * @param {string} options.filename - Filename of the document
 * @param {string} options.instructions - Natural language or JSON instructions for filling
 * @param {string} options.model - Model to use (default: "retab-small")
 * @param {string} options.color - Hex color for filled text (default: "#000080")
 * @returns {Promise<Object>} EditResponse with form_data and filled_document
 */
export async function agentFillDocument({
  document,
  filename = "form.pdf",
  instructions,
  model = "retab-small",
  color = "#000080",
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API key not configured");

  // Build request body matching the Retab Edit API spec.
  // The `color` parameter belongs inside the `config` object.
  const requestBody = {
    document: { filename, url: document },
    instructions,
    model,
  };

  // Only include config when non-default color is specified
  if (color && color !== "#000080") {
    requestBody.config = { color };
  }

  const response = await fetch(`${RETAB_API_BASE}/edit/agent/fill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate a reusable form template from a blank PDF (detects form fields)
 * @param {Object} options
 * @param {string} options.document - Base64 data URL of the blank form
 * @param {string} options.filename - Filename
 * @param {string} options.model - Model to use (default: "retab-small")
 * @returns {Promise<Object>} InferFormSchemaResponse with form_schema, annotated_pdf, field_count
 */
export async function generateFormTemplate({
  document,
  filename = "form.pdf",
  model = "retab-small",
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API key not configured");

  const response = await fetch(`${RETAB_API_BASE}/edit/templates/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      document: { filename, url: document },
      model,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fill using a pre-existing template (fast, PDF only)
 * @param {Object} options
 * @param {string} options.templateId - Template ID (e.g., "edittplt_abc123")
 * @param {string} options.instructions - Instructions to fill the form
 * @param {string} options.model - Model to use (default: "retab-small")
 * @returns {Promise<Object>} EditResponse with form_data and filled_document
 */
export async function fillFormTemplate({
  templateId,
  instructions,
  model = "retab-small",
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API key not configured");

  const response = await fetch(`${RETAB_API_BASE}/edit/templates/fill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      template_id: templateId,
      instructions,
      model,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}
