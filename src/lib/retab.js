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
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const response = await fetch(`${RETAB_API_BASE}/documents/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      document: {
        filename: filename,
        url: document,  // Data URL (data:application/pdf;base64,...)
      },
      model,
      json_schema: jsonSchema,
      temperature,
      n_consensus: nConsensus,
    }),
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

  const response = await fetch(`${RETAB_API_BASE}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      endpoint: "/v1/documents/extract",
      body: {
        document: {
          filename: filename,
          url: document,
        },
        model,
        json_schema: jsonSchema,
        temperature,
        n_consensus: nConsensus,
      },
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
