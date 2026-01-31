/**
 * Retab API Client
 * Handles document extraction and schema generation
 * Uses local proxy server to avoid CORS issues
 */

const RETAB_API_BASE = "http://localhost:3001/api";

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
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  // Build request body - only include optional params when not default
  const requestBody = {
    document: {
      filename: filename,
      url: document,  // Data URL (data:application/pdf;base64,...)
    },
    model,
    json_schema: jsonSchema,
    temperature,
    image_resolution_dpi: imageDpi,
  };
  
  // Only include n_consensus if > 1 (API default is 1)
  if (nConsensus > 1) {
    requestBody.n_consensus = nConsensus;
  }

  const response = await fetch(`${RETAB_API_BASE}/documents/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.detail || errorData.error || errorData.message || `API error: ${response.status}`;
    console.error("Extraction API error:", response.status, errorData);
    throw new Error(errorMsg);
  }

  return response.json();
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
