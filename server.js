/**
 * SAIL-IDP Backend Server
 * - Retab API proxy (avoids CORS issues)
 * - SQLite database for persistent storage
 * - REST API for session/packet/document management
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./db/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const RETAB_API_BASE = "https://api.retab.com/v1";
const isProduction = process.env.NODE_ENV === "production";

// Initialize database
db.initializeDatabase();

// Enable CORS for all origins (configure for production)
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));

// Parse JSON bodies (with increased limit for base64 documents)
app.use(express.json({ limit: "100mb" }));

// Request logging (simple)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (!req.path.includes("/health")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// ============================================================================
// HEALTH & STATUS
// ============================================================================

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/status", (req, res) => {
  try {
    const stats = db.getDbStats();
    const usage = db.getTotalUsage();
    res.json({
      status: "ok",
      database: "connected",
      stats,
      usage,
      version: "0.2.0",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

// Get or create active session
app.get("/api/sessions/active", (req, res) => {
  try {
    let session = db.getActiveSession();
    if (!session) {
      const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      session = db.createSession(id);
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session by ID
app.get("/api/sessions/:id", (req, res) => {
  try {
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new session
app.post("/api/sessions", (req, res) => {
  try {
    const id = req.body.id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = db.createSession(id);
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update session
app.patch("/api/sessions/:id", (req, res) => {
  try {
    const session = db.updateSession(req.params.id, req.body);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close session
app.post("/api/sessions/:id/close", (req, res) => {
  try {
    const session = db.closeSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get full session data (session + packets + documents)
app.get("/api/sessions/:id/full", (req, res) => {
  try {
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const packets = db.getPacketsBySession(req.params.id);
    const documents = db.getDocumentsBySession(req.params.id);
    
    // Attach documents to packets
    const packetsWithDocs = packets.map(p => ({
      ...p,
      documents: documents.filter(d => d.packet_id === p.id),
    }));
    
    res.json({
      session,
      packets: packetsWithDocs,
      documents,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PACKET MANAGEMENT
// ============================================================================

// Create packet(s)
app.post("/api/packets", (req, res) => {
  try {
    const { packets, session_id } = req.body;
    
    if (Array.isArray(packets)) {
      const created = db.createPackets(packets.map(p => ({ ...p, session_id })));
      res.status(201).json(created);
    } else {
      const packet = db.createPacket({ ...req.body, session_id });
      res.status(201).json(packet);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get packet
app.get("/api/packets/:id", (req, res) => {
  try {
    const packet = db.getPacket(req.params.id);
    if (!packet) {
      return res.status(404).json({ error: "Packet not found" });
    }
    res.json(packet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get packets by session
app.get("/api/sessions/:sessionId/packets", (req, res) => {
  try {
    const packets = db.getPacketsBySession(req.params.sessionId);
    res.json(packets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update packet
app.patch("/api/packets/:id", (req, res) => {
  try {
    const packet = db.updatePacket(req.params.id, req.body);
    if (!packet) {
      return res.status(404).json({ error: "Packet not found" });
    }
    res.json(packet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete packet with results
app.post("/api/packets/:id/complete", (req, res) => {
  try {
    const packet = db.completePacket(req.params.id, req.body);
    if (!packet) {
      return res.status(404).json({ error: "Packet not found" });
    }
    res.json(packet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete packet
app.delete("/api/packets/:id", (req, res) => {
  try {
    const success = db.deletePacket(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Packet not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DOCUMENT MANAGEMENT
// ============================================================================

// Create document(s)
app.post("/api/documents", (req, res) => {
  try {
    const { documents } = req.body;
    
    if (Array.isArray(documents)) {
      const created = db.createDocuments(documents);
      res.status(201).json(created);
    } else {
      const doc = db.createDocument(req.body);
      res.status(201).json(doc);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get document
app.get("/api/documents/:id", (req, res) => {
  try {
    const doc = db.getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get documents by packet
app.get("/api/packets/:packetId/documents", (req, res) => {
  try {
    const docs = db.getDocumentsByPacket(req.params.packetId);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get documents needing review
app.get("/api/sessions/:sessionId/review-queue", (req, res) => {
  try {
    const docs = db.getDocumentsNeedingReview(req.params.sessionId);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Review document (approve/reject)
app.post("/api/documents/:id/review", (req, res) => {
  try {
    const doc = db.reviewDocument(req.params.id, req.body);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// HISTORY
// ============================================================================

// Get history
app.get("/api/history", (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = db.getHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create history entry
app.post("/api/history", (req, res) => {
  try {
    const id = req.body.id || `history_${Date.now()}`;
    const entry = db.createHistoryEntry({ ...req.body, id });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete history entry
app.delete("/api/history/:id", (req, res) => {
  try {
    db.deleteHistoryEntry(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all history
app.delete("/api/history", (req, res) => {
  try {
    db.clearHistory();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// USAGE STATS
// ============================================================================

app.get("/api/usage", (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const daily = db.getUsageStats(days);
    const total = db.getTotalUsage();
    res.json({ daily, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// EXPORT TEMPLATES
// ============================================================================

app.get("/api/export-templates", (req, res) => {
  try {
    const templates = db.getExportTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/export-templates", (req, res) => {
  try {
    const template = db.saveExportTemplate(req.body);
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/export-templates/:name", (req, res) => {
  try {
    db.deleteExportTemplate(req.params.name);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for document extraction
app.post("/api/documents/extract", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    console.log("Extract request schema name:", req.body.json_schema?.name || "unnamed");

    const response = await fetch(`${RETAB_API_BASE}/documents/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    console.log("Extract response keys:", Object.keys(data));
    if (data.likelihoods) {
      console.log("Extract likelihoods sample:", Object.entries(data.likelihoods).slice(0, 3));
    }
    
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

// Proxy endpoint for document splitting
app.post("/api/documents/split", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    console.log("Split request subdocuments:", req.body.subdocuments?.map(s => s.name));

    const response = await fetch(`${RETAB_API_BASE}/documents/split`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    console.log("Split response:", JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Document split error:", error);
    res.status(500).json({ error: error.message || "Document split failed" });
  }
});

// Proxy endpoint for document classification
app.post("/api/documents/classify", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    console.log("Classify request categories:", req.body.categories?.map(c => c.name));

    const response = await fetch(`${RETAB_API_BASE}/documents/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    console.log("Classify response:", JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Document classify error:", error);
    res.status(500).json({ error: error.message || "Document classification failed" });
  }
});

// Proxy endpoint for document parsing
app.post("/api/documents/parse", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    const response = await fetch(`${RETAB_API_BASE}/documents/parse`, {
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
    console.error("Document parse error:", error);
    res.status(500).json({ error: error.message || "Document parsing failed" });
  }
});

// ============================================================================
// STATIC FILES (Production)
// ============================================================================

if (isProduction) {
  // Serve built frontend
  app.use(express.static(path.join(__dirname, "dist")));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/health") {
      return next();
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  const dbPath = process.env.DB_PATH || "./data";
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  SAIL-IDP Backend Server v0.2.0                              ║
╠══════════════════════════════════════════════════════════════╣
║  Mode:          ${isProduction ? "Production" : "Development"}                                    ║
║  API Server:    http://localhost:${PORT}                        ║
║  Health Check:  http://localhost:${PORT}/health                 ║
║  Status:        http://localhost:${PORT}/api/status             ║
╠══════════════════════════════════════════════════════════════╣
║  Database:      SQLite (${dbPath}/sail-idp.db)${" ".repeat(Math.max(0, 19 - dbPath.length))}║
╚══════════════════════════════════════════════════════════════╝
  `);
});
