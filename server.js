/**
 * SAIL-IDP Backend Server
 * - Retab API proxy (avoids CORS issues)
 * - SQLite database for persistent storage
 * - REST API for session/packet/document management
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as db from "./db/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1); // Trust first proxy (Caddy/nginx) for correct client IP in rate limiter
const PORT = process.env.PORT || 3005;
const RETAB_API_BASE = "https://api.retab.com/v1";
const isProduction = process.env.NODE_ENV === "production";

// ============================================================================
// FETCH WITH RETRY (exponential backoff + jitter for Retab API calls)
// ============================================================================

async function fetchWithRetry(url, options, { maxRetries = 2, baseDelay = 1000 } = {}) {
  // Extract the timeout from the original signal so we can create a fresh one per attempt.
  // Once an AbortSignal fires it stays aborted — reusing it would make every retry fail instantly.
  const timeoutMs = options?.signal?.timeout ?? null;
  const hasTimeoutSignal = options?.signal instanceof AbortSignal && timeoutMs == null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a fresh signal for each attempt to avoid reusing an already-aborted signal
      const attemptOptions = { ...options };
      if (options?.signal) {
        // If the original signal already aborted (from a prior attempt), make a new one.
        // AbortSignal.timeout creates a fresh signal each call.
        if (options.signal.aborted || attempt > 0) {
          // Re-derive timeout: use 10 minutes as a safe default for Retab API calls
          attemptOptions.signal = AbortSignal.timeout(600000);
        }
      }
      const response = await fetch(url, attemptOptions);

      // Don't retry on success or client errors (except 429 rate limit)
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }

      // Retriable: 5xx or 429
      if (attempt < maxRetries) {
        let delay;
        if (response.status === 429) {
          // Honor Retry-After header if present (value in seconds)
          const retryAfter = response.headers.get("retry-after");
          delay = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 60000) : baseDelay * Math.pow(2, attempt);
        } else {
          delay = baseDelay * Math.pow(2, attempt);
        }
        // Add jitter (0-25% of delay)
        delay += Math.random() * delay * 0.25;
        console.warn(`Retab API ${response.status} on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Exhausted retries, return the last response as-is
      return response;
    } catch (error) {
      // Network error (fetch threw) -- retry if attempts remain
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * baseDelay * 0.25;
        console.warn(`Retab API network error on attempt ${attempt + 1}/${maxRetries + 1}: ${error.message}, retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a value is a non-empty string, optionally within a max length.
 */
function isNonEmptyString(val, maxLen = 1000) {
  return typeof val === "string" && val.trim().length > 0 && val.length <= maxLen;
}

/**
 * Validate that a value is a string or nullish (optional field).
 */
function isOptionalString(val, maxLen = 1000) {
  if (val == null || val === "") return true;
  return typeof val === "string" && val.length <= maxLen;
}

/**
 * Sanitize a string: trim and truncate to maxLen.
 */
function sanitizeString(val, maxLen = 1000) {
  if (val == null) return null;
  return String(val).trim().slice(0, maxLen);
}

/**
 * Return a 400 response with a validation error message.
 */
function validationError(res, message) {
  return res.status(400).json({ error: `Validation error: ${message}` });
}

// Initialize database
db.initializeDatabase();

// Temp PDF storage (14-day TTL); same base as DB so data/ is one place
const DATA_DIR = process.env.DB_PATH || "./data";
const TEMP_PDF_DIR = path.join(DATA_DIR, "temp-pdfs");
if (!fs.existsSync(TEMP_PDF_DIR)) {
  fs.mkdirSync(TEMP_PDF_DIR, { recursive: true });
}

const uploadMulter = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_PDF_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".pdf";
      cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new Error("Only PDF files are allowed"));
  },
});

// ---------------------------------------------------------------------------
// SECURITY HARDENING
// ---------------------------------------------------------------------------

// Security headers (no strict CSP so SPA and Mermaid work; tune in production)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: "sameorigin" }));
app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));

// CORS: restrict in production (set CORS_ORIGIN to your frontend origin)
const corsOrigin = process.env.CORS_ORIGIN || "*";
if (isProduction && corsOrigin === "*") {
  console.warn("Security: CORS_ORIGIN is * in production. Set CORS_ORIGIN to your frontend origin.");
}
app.use(
  cors({
    origin: corsOrigin === "*" ? "*" : corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
  })
);

// Rate limiting: general API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 120 : 300,
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

// Stricter limit for proxy (document) and debug endpoints
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 60 : 120,
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/documents/", proxyLimiter);
app.use("/api/schemas/", proxyLimiter);
app.use("/api/jobs", proxyLimiter);
app.use("/api/debug/", proxyLimiter);

// Disable debug routes in production (avoid leaking stats/env/errors)
app.use("/api/debug/", (req, res, next) => {
  if (isProduction) {
    return res.status(404).json({ error: "Not found" });
  }
  next();
});

// Parse JSON bodies (with increased limit for base64 documents)
app.use(express.json({ limit: "100mb" }));

// Request logging (no headers/body to avoid logging Api-Key)
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
      version: "0.3.5",
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
      const createdBy = sanitizeString(req.query.created_by, 200);
      session = db.createSession(id, createdBy);
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
    if (req.body.id != null && !isNonEmptyString(req.body.id, 200)) {
      return validationError(res, "id must be a non-empty string (max 200 chars)");
    }
    if (!isOptionalString(req.body.created_by, 200)) {
      return validationError(res, "created_by must be a string (max 200 chars)");
    }
    const id = sanitizeString(req.body.id, 200) || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdBy = sanitizeString(req.body.created_by, 200);
    const session = db.createSession(id, createdBy);
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update session
app.patch("/api/sessions/:id", (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
      return validationError(res, "Request body must be a non-empty object");
    }
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
    
    // Attach documents to packets and set hasServerFile flag
    const packetsWithDocs = packets.map(p => ({
      ...p,
      hasServerFile: !!p.temp_file_path, // Set flag for frontend to know file is on server
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

// Get all packets (cross-session, for global views)
app.get("/api/packets/all", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
    const packets = db.getAllPackets(limit);
    // Attach documents and hasServerFile flag for each packet
    const enriched = packets.map((p) => {
      const docs = db.getDocumentsByPacket(p.id);
      const hasServerFile = !!(p.temp_file_path && fs.existsSync(p.temp_file_path));
      return { ...p, documents: docs, hasServerFile };
    });
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create packet(s)
app.post("/api/packets", (req, res) => {
  try {
    const { packets, session_id, created_by } = req.body;
    
    if (!isNonEmptyString(session_id, 200)) {
      return validationError(res, "session_id is required (non-empty string, max 200 chars)");
    }
    if (!isOptionalString(created_by, 200)) {
      return validationError(res, "created_by must be a string (max 200 chars)");
    }
    
    if (Array.isArray(packets)) {
      // Validate each packet in the array has an id and filename
      for (let i = 0; i < packets.length; i++) {
        const p = packets[i];
        if (!isNonEmptyString(p.id, 200)) {
          return validationError(res, `packets[${i}].id is required (non-empty string)`);
        }
        if (!isNonEmptyString(p.filename, 500)) {
          return validationError(res, `packets[${i}].filename is required (non-empty string)`);
        }
      }
      const sanitizedBy = sanitizeString(created_by, 200);
      const created = db.createPackets(packets.map(p => ({ ...p, session_id, created_by: sanitizedBy })));
      res.status(201).json(created);
    } else {
      if (!isNonEmptyString(req.body.id, 200)) {
        return validationError(res, "id is required for single packet creation");
      }
      if (!isNonEmptyString(req.body.filename, 500)) {
        return validationError(res, "filename is required for packet creation");
      }
      const packet = db.createPacket({ ...req.body, session_id, created_by: sanitizeString(created_by, 200) });
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
    // Include hasServerFile flag
    res.json({
      ...packet,
      hasServerFile: !!packet.temp_file_path,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get packets by session
app.get("/api/sessions/:sessionId/packets", (req, res) => {
  try {
    const packets = db.getPacketsBySession(req.params.sessionId);
    // Include hasServerFile flag for each packet
    const packetsWithFlag = packets.map(p => ({
      ...p,
      hasServerFile: !!p.temp_file_path,
    }));
    res.json(packetsWithFlag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update packet
app.patch("/api/packets/:id", (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
      return validationError(res, "Request body must be a non-empty object");
    }
    const packet = db.updatePacket(req.params.id, req.body);
    if (!packet) {
      return res.status(404).json({ error: "Packet not found" });
    }
    res.json(packet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete packet with results.
// When `documents` array is included in the body, packet completion and document
// creation happen in a single SQLite transaction — no data loss if the server
// crashes between the two operations.
app.post("/api/packets/:id/complete", (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return validationError(res, "Request body must be an object with result data");
    }
    const { documents, ...result } = req.body;
    let packet;

    if (Array.isArray(documents) && documents.length > 0) {
      // Atomic path: packet + documents in one transaction
      packet = db.completePacketAtomic(req.params.id, result, documents);
    } else {
      // Legacy path: packet only (documents created via separate endpoint)
      packet = db.completePacket(req.params.id, result);
    }

    if (!packet) {
      return res.status(404).json({ error: "Packet not found" });
    }
    res.json(packet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete packet (also cleans up the server-side temp file)
app.delete("/api/packets/:id", (req, res) => {
  try {
    // Look up the packet first to get the temp file path before deleting the record
    const packet = db.getPacket(req.params.id);
    const success = db.deletePacket(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Packet not found" });
    }
    // Clean up temp file if it exists
    if (packet?.temp_file_path) {
      fs.unlink(packet.temp_file_path, (err) => {
        if (err && err.code !== "ENOENT") {
          console.warn(`Failed to delete temp file ${packet.temp_file_path}:`, err.message);
        }
      });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload PDF for a packet (store temp file so work continues if user leaves)
app.post("/api/upload", uploadMulter.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const sessionId = req.body.session_id;
  if (!sessionId) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "session_id required" });
  }
  try {
    const packetId = `pkt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const filename = req.file.originalname || "document.pdf";
    const finalPath = path.join(TEMP_PDF_DIR, `${packetId}.pdf`);
    fs.renameSync(req.file.path, finalPath);
    const createdBy = req.body.created_by || null;
    const packet = db.createPacket({
      id: packetId,
      session_id: sessionId,
      filename,
      status: "queued",
      temp_file_path: finalPath,
      created_by: createdBy,
    });
    res.status(201).json(packet);
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: error.message });
  }
});

// Get stored PDF for a packet (for processing when user returns)
app.get("/api/packets/:id/file", (req, res) => {
  try {
    const packet = db.getPacket(req.params.id);
    if (!packet || !packet.temp_file_path) {
      return res.status(404).json({ error: "File not found" });
    }
    // Resolve to absolute path for res.sendFile
    const absolutePath = path.resolve(packet.temp_file_path);
    if (!fs.existsSync(absolutePath)) {
      db.updatePacket(packet.id, { temp_file_path: null });
      return res.status(404).json({ error: "File expired or removed" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(packet.filename || "document.pdf")}"`);
    res.sendFile(absolutePath);
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
    
    const validateDoc = (doc, label) => {
      if (!isNonEmptyString(doc.id, 200)) return `${label}.id is required`;
      if (!isNonEmptyString(doc.packet_id, 200)) return `${label}.packet_id is required`;
      if (!isNonEmptyString(doc.session_id, 200)) return `${label}.session_id is required`;
      return null;
    };
    
    if (Array.isArray(documents)) {
      for (let i = 0; i < documents.length; i++) {
        const err = validateDoc(documents[i], `documents[${i}]`);
        if (err) return validationError(res, err);
      }
      const created = db.createDocuments(documents);
      res.status(201).json(created);
    } else {
      const err = validateDoc(req.body, "document");
      if (err) return validationError(res, err);
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

// Update document extraction data (e.g., after document-level retry)
app.patch("/api/documents/:id", (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return validationError(res, "Request body must be an object");
    }
    const doc = db.updateDocumentExtraction(req.params.id, req.body);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Review document (approve/reject)
app.post("/api/documents/:id/review", (req, res) => {
  try {
    const { status, editedFields, reviewerNotes, reviewedBy } = req.body;
    const validStatuses = ["reviewed", "approved", "rejected"];
    if (status && !validStatuses.includes(status)) {
      return validationError(res, `status must be one of: ${validStatuses.join(", ")}`);
    }
    if (editedFields != null && typeof editedFields !== "object") {
      return validationError(res, "editedFields must be an object");
    }
    if (!isOptionalString(reviewerNotes, 2000)) {
      return validationError(res, "reviewerNotes must be a string (max 2000 chars)");
    }
    if (!isOptionalString(reviewedBy, 200)) {
      return validationError(res, "reviewedBy must be a string (max 200 chars)");
    }
    const doc = db.reviewDocument(req.params.id, {
      status,
      editedFields,
      reviewerNotes: sanitizeString(reviewerNotes, 2000),
      reviewedBy: sanitizeString(reviewedBy, 200),
    });
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
    if (!req.body || typeof req.body !== "object") {
      return validationError(res, "Request body must be an object");
    }
    if (!isOptionalString(req.body.created_by, 200)) {
      return validationError(res, "created_by must be a string (max 200 chars)");
    }
    const id = sanitizeString(req.body.id, 200) || `history_${Date.now()}`;
    const entry = db.createHistoryEntry({
      ...req.body,
      id,
      created_by: sanitizeString(req.body.created_by, 200),
    });
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
// ADMIN METRICS (persistent storage for admin panel)
// ============================================================================

app.get("/api/admin/metrics", (req, res) => {
  try {
    const metrics = db.getAdminDashboardMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Password-protected database clear
const ADMIN_CLEAR_PASSWORD = "stewart";

app.post("/api/admin/clear-database", (req, res) => {
  if (!req.body || typeof req.body.password !== "string") {
    return validationError(res, "password is required (string)");
  }
  const password = req.body.password.trim().slice(0, 100);
  if (password !== ADMIN_CLEAR_PASSWORD) {
    return res.status(403).json({ error: "Invalid password" });
  }
  try {
    const result = db.clearAllData();
    res.json({ success: true, message: "Database cleared", ...result });
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

app.get("/api/stats/30d", (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const stats = db.getStats30Days(days);
    res.json(stats);
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
    if (!isNonEmptyString(req.body.name, 200)) {
      return validationError(res, "name is required (non-empty string, max 200 chars)");
    }
    if (!req.body.config || typeof req.body.config !== "object") {
      return validationError(res, "config is required and must be an object");
    }
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

    // Retab API requires temperature > 0 when n_consensus > 1; enforce before forwarding
    const body = { ...req.body };
    const nConsensus = body.n_consensus ?? 1;
    const temp = Number(body.temperature);
    if (nConsensus > 1 && (temp === 0 || Number.isNaN(temp) || temp < 0.01)) {
      body.temperature = 0.1;
    }

    const isStreaming = !!body.stream;

    const response = await fetchWithRetry(`${RETAB_API_BASE}/documents/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600000), // 10 min for large documents
    });

    // Streaming mode: pipe the Retab SSE response directly to the client,
    // but ONLY if the upstream actually returned SSE. Some models/doc types
    // return application/json even when stream=true was requested. In that
    // case, fall through to the normal JSON response path below.
    const upstreamContentType = response.headers.get("content-type") || "";
    const isActuallySSE = upstreamContentType.includes("text/event-stream");

    if (isStreaming && isActuallySSE && response.ok && response.body) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

      // Use Node.js readable stream from fetch response body
      const reader = response.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              return;
            }
            // Write chunk to Express response; respect backpressure
            if (!res.write(value)) {
              await new Promise((resolve) => res.once("drain", resolve));
            }
          }
        } catch (streamError) {
          console.error("Streaming pipe error:", streamError);
          if (!res.headersSent) {
            res.status(500).json({ error: "Streaming failed" });
          } else {
            res.end();
          }
        }
      };

      // If client disconnects, cancel the reader
      res.on("close", () => {
        reader.cancel().catch(() => {});
      });

      return pump();
    }

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

    const response = await fetchWithRetry(`${RETAB_API_BASE}/schemas/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(600000), // 10 min for large documents
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

    const response = await fetchWithRetry(`${RETAB_API_BASE}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(600000), // 10 min for large documents
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
      signal: AbortSignal.timeout(60000), // 1 min for status checks
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

    const response = await fetchWithRetry(`${RETAB_API_BASE}/documents/split`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(600000), // 10 min for large documents
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

    const response = await fetchWithRetry(`${RETAB_API_BASE}/documents/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(600000), // 10 min for large documents
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

    const response = await fetchWithRetry(`${RETAB_API_BASE}/documents/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(600000), // 10 min for large documents
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
// EDIT API PROXY ENDPOINTS (form filling)
// ============================================================================

// Agent Fill: AI-powered form filling (PDF, DOCX, XLSX, PPTX)
// Supports both /documents/edit (current) and legacy /edit/agent/fill paths.
// The upstream Retab API consolidated the endpoint to /v1/documents/edit.
app.post("/api/edit/agent/fill", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    console.log("Edit Agent Fill request");

    // Try the current endpoint first, fall back to legacy if 404
    let response = await fetchWithRetry(`${RETAB_API_BASE}/documents/edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(600000), // 10 min for complex forms
    }, { maxRetries: 0 });

    // If /documents/edit returns 404, try the legacy /edit/agent/fill path
    if (response.status === 404) {
      console.log("Edit endpoint /documents/edit returned 404, trying legacy /edit/agent/fill...");
      response = await fetchWithRetry(`${RETAB_API_BASE}/edit/agent/fill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(600000),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Edit Agent Fill error:", error);
    res.status(500).json({ error: error.message || "Form filling failed" });
  }
});

// Generate Template: detect form fields in a PDF
app.post("/api/edit/templates/generate", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    console.log("Edit Template Generate request");

    const response = await fetchWithRetry(`${RETAB_API_BASE}/edit/templates/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(600000),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Edit Template Generate error:", error);
    res.status(500).json({ error: error.message || "Template generation failed" });
  }
});

// Fill Template: fill using a pre-defined template (fast, PDF only)
app.post("/api/edit/templates/fill", async (req, res) => {
  try {
    const apiKey = req.headers["api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    console.log("Edit Template Fill request");

    const response = await fetchWithRetry(`${RETAB_API_BASE}/edit/templates/fill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(600000),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Edit Template Fill error:", error);
    res.status(500).json({ error: error.message || "Template fill failed" });
  }
});

// ============================================================================
// DEBUG & OBSERVABILITY (Technical docs / enterprise support)
// ============================================================================

app.get("/api/debug/status", (req, res) => {
  try {
    const stats = db.getDbStats();
    const usage = db.getTotalUsage();
    const activeSession = db.getActiveSession();
    res.json({
      status: "ok",
      database: "connected",
      stats,
      usage,
      activeSession: activeSession ? { id: activeSession.id, status: activeSession.status } : null,
      version: "0.3.5",
      env: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(500).json({ status: "error", error: error.message });
  }
});

app.get("/api/debug/errors", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const errors = db.getRecentFailedPackets(limit);
    res.json({ errors, count: errors.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TEMP FILE CLEANUP (14-day TTL)
// ============================================================================

const TEMP_FILE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // every 1 hour

function runTempFileCleanup() {
  try {
    const old = db.getPacketsWithTempFilesOlderThan(TEMP_FILE_MAX_AGE_SECONDS);
    for (const row of old) {
      if (row.temp_file_path && fs.existsSync(row.temp_file_path)) {
        fs.unlink(row.temp_file_path, () => {});
      }
      db.updatePacket(row.id, { temp_file_path: null });
    }
    if (old.length > 0) {
      console.log(`Temp file cleanup: removed ${old.length} expired file(s)`);
    }
  } catch (e) {
    console.warn("Temp file cleanup error:", e.message);
  }
}

setInterval(runTempFileCleanup, CLEANUP_INTERVAL_MS);
runTempFileCleanup();

// ============================================================================
// STATIC FILES (Production)
// ============================================================================

if (isProduction) {
  // Serve built frontend
  app.use(express.static(path.join(__dirname, "dist")));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get("/{*splat}", (req, res, next) => {
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
║  SAIL-IDP Backend Server v0.3.5                              ║
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
