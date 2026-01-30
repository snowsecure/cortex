/**
 * Simple proxy server to forward requests to Retab API
 * This avoids CORS issues when calling the API from the browser
 */

import express from "express";
import cors from "cors";

const app = express();
const PORT = 3001;
const RETAB_API_BASE = "https://api.retab.com/v1";

// Enable CORS for all origins (dev only)
app.use(cors());

// Parse JSON bodies (with increased limit for base64 documents)
app.use(express.json({ limit: "100mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Proxy endpoint for document extraction
app.post("/api/documents/extract", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    const response = await fetch(`${RETAB_API_BASE}/documents/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Extraction error:", error);
    res.status(500).json({ error: error.message || "Extraction failed" });
  }
});

// Proxy endpoint for schema generation
app.post("/api/schemas/generate", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    const response = await fetch(`${RETAB_API_BASE}/schemas/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Schema generation error:", error);
    res.status(500).json({ error: error.message || "Schema generation failed" });
  }
});

// Proxy endpoint for jobs (create)
app.post("/api/jobs", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    const response = await fetch(`${RETAB_API_BASE}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Job creation error:", error);
    res.status(500).json({ error: error.message || "Job creation failed" });
  }
});

// Proxy endpoint for jobs (status)
app.get("/api/jobs/:jobId", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    const response = await fetch(`${RETAB_API_BASE}/jobs/${req.params.jobId}`, {
      method: "GET",
      headers: {
        "Api-Key": apiKey,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Job status error:", error);
    res.status(500).json({ error: error.message || "Failed to get job status" });
  }
});

app.listen(PORT, () => {
  console.log(`Retab proxy server running at http://localhost:${PORT}`);
});
