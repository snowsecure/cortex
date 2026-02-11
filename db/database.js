/**
 * SQLite Database Module for SAIL-IDP (CORTEX)
 * Enterprise-ready persistence layer
 *
 * Key design decisions:
 * - WAL journal mode for concurrent read/write
 * - synchronous=NORMAL (safe with WAL, fast)
 * - All multi-statement writes wrapped in db.transaction()
 * - JSON columns deserialized through a shared helper
 * - auto_vacuum=INCREMENTAL to reclaim space without full VACUUM
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Database file location (configurable via env)
const DB_DIR = process.env.DB_PATH || "./data";
const DB_FILE = path.join(DB_DIR, "sail-idp.db");

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database connection
const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");
db.pragma("auto_vacuum = INCREMENTAL"); // Reclaim space incrementally

// ============================================================================
// JSON HELPERS
// ============================================================================

/**
 * Safely parse a JSON string, returning fallback on failure.
 */
function tryParseJson(str, fallback = null) {
  if (str == null) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Deserialize a raw document row from SQLite into a JS-friendly object.
 * Centralizes all JSON parsing and type coercion so it's never duplicated.
 */
function deserializeDocument(row) {
  if (!row) return null;
  return {
    ...row,
    pages: tryParseJson(row.pages, []),
    extraction_data: tryParseJson(row.extraction_data, {}),
    likelihoods: tryParseJson(row.likelihoods, {}),
    review_reasons: tryParseJson(row.review_reasons, []),
    edited_fields: tryParseJson(row.edited_fields, null),
    category_override: tryParseJson(row.category_override, null),
    extraction_confidence: row.extraction_confidence ?? null,
    needs_review: !!row.needs_review,
  };
}

// ============================================================================
// VALID STATUS VALUES (for runtime validation)
// ============================================================================

const VALID_SESSION_STATUSES = new Set(["active", "completed"]);
const VALID_PACKET_STATUSES = new Set([
  "queued", "splitting", "classifying", "extracting", "processing",
  "completed", "needs_review", "failed", "retrying",
]);
const VALID_DOCUMENT_STATUSES = new Set([
  "pending", "completed", "needs_review", "failed", "reviewed", "approved", "retrying",
]);

// ============================================================================
// SCHEMA INITIALIZATION
// ============================================================================

export function initializeDatabase() {
  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active',
      total_packets INTEGER DEFAULT 0,
      completed_packets INTEGER DEFAULT 0,
      failed_packets INTEGER DEFAULT 0,
      needs_review_packets INTEGER DEFAULT 0,
      total_credits REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      total_pages INTEGER DEFAULT 0,
      api_calls INTEGER DEFAULT 0
    )
  `);

  // Packets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS packets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      retry_count INTEGER DEFAULT 0,
      error TEXT,
      total_documents INTEGER DEFAULT 0,
      completed_documents INTEGER DEFAULT 0,
      needs_review_documents INTEGER DEFAULT 0,
      failed_documents INTEGER DEFAULT 0,
      total_credits REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      temp_file_path TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
  // Migration: add temp_file_path if table existed without it
  try {
    db.exec(`ALTER TABLE packets ADD COLUMN temp_file_path TEXT`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }

  // Documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      packet_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      document_type TEXT,
      display_name TEXT,
      status TEXT DEFAULT 'pending',
      pages TEXT,
      extraction_data TEXT,
      likelihoods TEXT,
      extraction_confidence REAL,
      needs_review INTEGER DEFAULT 0,
      review_reasons TEXT,
      reviewed_at DATETIME,
      reviewed_by TEXT,
      reviewer_notes TEXT,
      edited_fields TEXT,
      credits_used REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (packet_id) REFERENCES packets(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Processing history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_packets INTEGER,
      total_documents INTEGER,
      completed INTEGER,
      needs_review INTEGER,
      failed INTEGER,
      total_credits REAL,
      total_cost REAL,
      summary TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
    )
  `);

  // Usage tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_daily (
      date TEXT PRIMARY KEY,
      total_credits REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      total_pages INTEGER DEFAULT 0,
      api_calls INTEGER DEFAULT 0,
      packets_processed INTEGER DEFAULT 0,
      documents_processed INTEGER DEFAULT 0
    )
  `);

  // Export templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS export_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      config TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes — covering all common query patterns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_packets_session ON packets(session_id);
    CREATE INDEX IF NOT EXISTS idx_packets_status ON packets(status);
    CREATE INDEX IF NOT EXISTS idx_packets_completed ON packets(completed_at);
    CREATE INDEX IF NOT EXISTS idx_packets_session_status ON packets(session_id, status);
    CREATE INDEX IF NOT EXISTS idx_packets_created ON packets(created_at);
    CREATE INDEX IF NOT EXISTS idx_documents_packet ON documents(packet_id);
    CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);
    CREATE INDEX IF NOT EXISTS idx_documents_needs_review ON documents(needs_review);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_documents_packet_status ON documents(packet_id, status);
    CREATE INDEX IF NOT EXISTS idx_documents_session_review ON documents(session_id, needs_review);
    CREATE INDEX IF NOT EXISTS idx_documents_reviewed ON documents(reviewed_at);
    CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
    CREATE INDEX IF NOT EXISTS idx_history_completed ON history(completed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_session ON history(session_id);
  `);

  // Migration: add created_by column to all main tables (must run AFTER all tables are created)
  for (const table of ["history", "sessions", "packets", "documents"]) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN created_by TEXT`);
    } catch (e) {
      if (!/duplicate column name/i.test(e.message)) throw e;
    }
  }

  // Migration: add category_override column to documents (stores reviewer-assigned category)
  try {
    db.exec(`ALTER TABLE documents ADD COLUMN category_override TEXT`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }

  // Migration: add split_data column to packets (stores split results for pipeline resume)
  try {
    db.exec(`ALTER TABLE packets ADD COLUMN split_data TEXT`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }

  // Migration: add pipeline_stage column to packets (tracks current processing stage)
  try {
    db.exec(`ALTER TABLE packets ADD COLUMN pipeline_stage TEXT`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }

  // Migration: add processing_config column to packets (stores user config for resume)
  try {
    db.exec(`ALTER TABLE packets ADD COLUMN processing_config TEXT`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }

  console.log("Database initialized:", DB_FILE);
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

export function createSession(id, createdBy) {
  db.prepare(`INSERT INTO sessions (id, created_by) VALUES (?, ?)`).run(id, createdBy || null);
  return getSession(id);
}

export function getSession(id) {
  return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
}

export function getActiveSession() {
  return db.prepare(`
    SELECT * FROM sessions WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1
  `).get();
}

// Whitelist of columns that can be updated via the generic update functions.
// This prevents SQL injection through dynamic column names.
const SESSION_UPDATABLE_COLUMNS = new Set([
  "status", "total_packets", "completed_packets", "failed_packets",
  "needs_review_packets", "total_credits", "total_cost", "total_pages",
  "api_calls", "created_by",
]);

const PACKET_UPDATABLE_COLUMNS = new Set([
  "status", "filename", "started_at", "completed_at", "retry_count",
  "error", "total_documents", "completed_documents", "needs_review_documents",
  "failed_documents", "total_credits", "total_cost", "temp_file_path", "created_by",
  "split_data", "pipeline_stage", "processing_config",
]);

export function updateSession(id, data) {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "updated_at") continue;
    if (!SESSION_UPDATABLE_COLUMNS.has(key)) {
      console.warn(`[DB] updateSession: ignoring unknown column "${key}"`);
      continue;
    }
    // Status validation
    if (key === "status" && !VALID_SESSION_STATUSES.has(value)) {
      console.warn(`[DB] updateSession: ignoring invalid status "${value}"`);
      continue;
    }
    fields.push(`${key} = ?`);
    values.push(value);
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  db.prepare(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getSession(id);
}

export function closeSession(id) {
  return updateSession(id, { status: "completed" });
}

// ============================================================================
// PACKET OPERATIONS
// ============================================================================

/**
 * Create a single packet. Transactional: INSERT packet + UPDATE session count.
 */
export const createPacket = db.transaction((packet) => {
  db.prepare(`
    INSERT INTO packets (id, session_id, filename, status, temp_file_path, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    packet.id,
    packet.session_id,
    packet.filename,
    packet.status || "queued",
    packet.temp_file_path ?? null,
    packet.created_by || null
  );

  db.prepare(`
    UPDATE sessions SET total_packets = total_packets + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(packet.session_id);

  return getPacket(packet.id);
});

/**
 * Batch-create packets. Transactional: INSERT all + UPDATE session count.
 * Returns all created packets in a single SELECT (no N+1).
 */
export const createPackets = db.transaction((packets) => {
  const insert = db.prepare(`
    INSERT INTO packets (id, session_id, filename, status, temp_file_path, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const p of packets) {
    insert.run(p.id, p.session_id, p.filename, p.status || "queued", p.temp_file_path ?? null, p.created_by || null);
  }

  if (packets.length > 0) {
    db.prepare(`
      UPDATE sessions SET total_packets = total_packets + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(packets.length, packets[0].session_id);
  }

  // Batch fetch instead of N individual getPacket calls
  const ids = packets.map(p => p.id);
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM packets WHERE id IN (${placeholders}) ORDER BY created_at ASC`).all(...ids);
});

export function getPacket(id) {
  return db.prepare(`SELECT * FROM packets WHERE id = ?`).get(id);
}

export function getPacketsBySession(sessionId) {
  return db.prepare(`SELECT * FROM packets WHERE session_id = ? ORDER BY created_at ASC`).all(sessionId);
}

export function getPacketsWithTempFilesOlderThan(maxAgeSeconds) {
  return db.prepare(`
    SELECT id, temp_file_path FROM packets
    WHERE temp_file_path IS NOT NULL AND temp_file_path != ''
    AND datetime(created_at) <= datetime('now', '-' || ? || ' seconds')
  `).all(Math.floor(maxAgeSeconds));
}

export function getRecentFailedPackets(limit = 100) {
  return db.prepare(`
    SELECT id, session_id, filename, status, error, created_at, completed_at
    FROM packets
    WHERE status = 'failed' AND error IS NOT NULL AND error != ''
    ORDER BY COALESCE(completed_at, created_at) DESC
    LIMIT ?
  `).all(limit);
}

export function updatePacket(id, data) {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "session_id") continue;
    if (!PACKET_UPDATABLE_COLUMNS.has(key)) {
      console.warn(`[DB] updatePacket: ignoring unknown column "${key}"`);
      continue;
    }
    // Status validation
    if (key === "status" && !VALID_PACKET_STATUSES.has(value)) {
      console.warn(`[DB] updatePacket: ignoring invalid status "${value}"`);
      continue;
    }
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return getPacket(id);

  values.push(id);
  db.prepare(`UPDATE packets SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getPacket(id);
}

/**
 * Complete a packet. Transactional: UPDATE packet + UPDATE session + UPSERT usage_daily.
 */
export const completePacket = db.transaction((id, result) => {
  const packet = getPacket(id);
  if (!packet) return null;

  const status = result.hasNeedsReview ? "needs_review" :
                 result.hasFailed ? "failed" : "completed";

  db.prepare(`
    UPDATE packets SET
      status = ?,
      completed_at = CURRENT_TIMESTAMP,
      total_documents = ?,
      completed_documents = ?,
      needs_review_documents = ?,
      failed_documents = ?,
      total_credits = ?,
      total_cost = ?
    WHERE id = ?
  `).run(
    status,
    result.stats?.totalDocuments ?? 0,
    result.stats?.completed ?? 0,
    result.stats?.needsReview ?? 0,
    result.stats?.failed ?? 0,
    result.usage?.totalCredits ?? 0,
    result.usage?.totalCost ?? 0,
    id
  );

  // Update session stats
  db.prepare(`
    UPDATE sessions SET
      completed_packets = completed_packets + CASE WHEN ? = 'completed' THEN 1 ELSE 0 END,
      needs_review_packets = needs_review_packets + CASE WHEN ? = 'needs_review' THEN 1 ELSE 0 END,
      failed_packets = failed_packets + CASE WHEN ? = 'failed' THEN 1 ELSE 0 END,
      total_credits = total_credits + ?,
      total_cost = total_cost + ?,
      total_pages = total_pages + ?,
      api_calls = api_calls + ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status, status, status,
    result.usage?.totalCredits ?? 0,
    result.usage?.totalCost ?? 0,
    result.usage?.totalPages ?? 0,
    result.usage?.apiCalls ?? 0,
    packet.session_id
  );

  // Update daily usage
  const today = new Date().toISOString().split("T")[0];
  db.prepare(`
    INSERT INTO usage_daily (date, total_credits, total_cost, total_pages, api_calls, packets_processed, documents_processed)
    VALUES (?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_credits = total_credits + excluded.total_credits,
      total_cost = total_cost + excluded.total_cost,
      total_pages = total_pages + excluded.total_pages,
      api_calls = api_calls + excluded.api_calls,
      packets_processed = packets_processed + 1,
      documents_processed = documents_processed + excluded.documents_processed
  `).run(
    today,
    result.usage?.totalCredits ?? 0,
    result.usage?.totalCost ?? 0,
    result.usage?.totalPages ?? 0,
    result.usage?.apiCalls ?? 0,
    result.stats?.totalDocuments ?? 0
  );

  return getPacket(id);
});

/**
 * Atomically complete a packet AND create its documents in a single transaction.
 */
export const completePacketAtomic = db.transaction((id, result, docs) => {
  const packet = completePacket(id, result);
  if (!packet) return null;

  if (docs && docs.length > 0) {
    const insert = db.prepare(`
      INSERT INTO documents (
        id, packet_id, session_id, document_type, display_name, status,
        pages, extraction_data, likelihoods, extraction_confidence,
        needs_review, review_reasons, credits_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const doc of docs) {
      insert.run(
        doc.id,
        doc.packet_id,
        doc.session_id,
        doc.document_type,
        doc.display_name,
        doc.status || "completed",
        JSON.stringify(doc.pages || []),
        JSON.stringify(doc.extraction_data || {}),
        JSON.stringify(doc.likelihoods || {}),
        doc.extraction_confidence ?? null,
        doc.needs_review ? 1 : 0,
        JSON.stringify(doc.review_reasons || []),
        doc.credits_used ?? 0
      );
    }
  }

  return packet;
});

/**
 * Delete a packet. Transactional: DELETE packet + UPDATE session count.
 */
export const deletePacket = db.transaction((id) => {
  const packet = getPacket(id);
  if (!packet) return false;

  db.prepare(`DELETE FROM packets WHERE id = ?`).run(id);
  db.prepare(`
    UPDATE sessions SET total_packets = MAX(0, total_packets - 1), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(packet.session_id);

  return true;
});

// ============================================================================
// GLOBAL QUERIES (cross-session)
// ============================================================================

export function getAllPackets(limit = 500) {
  return db.prepare(`SELECT * FROM packets ORDER BY created_at DESC LIMIT ?`).all(limit);
}

export function getAllDocuments(limit = 5000) {
  return db.prepare(`SELECT * FROM documents ORDER BY created_at DESC LIMIT ?`).all(limit).map(deserializeDocument);
}

/**
 * Batch-fetch documents for multiple packet IDs in one query (avoids N+1).
 */
export function getDocumentsByPacketIds(packetIds) {
  if (!packetIds || packetIds.length === 0) return [];
  const placeholders = packetIds.map(() => "?").join(",");
  return db.prepare(`
    SELECT * FROM documents WHERE packet_id IN (${placeholders}) ORDER BY created_at ASC
  `).all(...packetIds).map(deserializeDocument);
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

export function createDocument(doc) {
  db.prepare(`
    INSERT INTO documents (
      id, packet_id, session_id, document_type, display_name, status,
      pages, extraction_data, likelihoods, extraction_confidence,
      needs_review, review_reasons, credits_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    doc.id,
    doc.packet_id,
    doc.session_id,
    doc.document_type,
    doc.display_name,
    doc.status || "completed",
    JSON.stringify(doc.pages || []),
    JSON.stringify(doc.extraction_data || {}),
    JSON.stringify(doc.likelihoods || {}),
    doc.extraction_confidence ?? null,
    doc.needs_review ? 1 : 0,
    JSON.stringify(doc.review_reasons || []),
    doc.credits_used ?? 0
  );

  return getDocument(doc.id);
}

/**
 * Batch-create documents. Transactional.
 * Returns all created documents in a single SELECT (no N+1).
 */
export const createDocuments = db.transaction((docs) => {
  const insert = db.prepare(`
    INSERT INTO documents (
      id, packet_id, session_id, document_type, display_name, status,
      pages, extraction_data, likelihoods, extraction_confidence,
      needs_review, review_reasons, credits_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const doc of docs) {
    insert.run(
      doc.id,
      doc.packet_id,
      doc.session_id,
      doc.document_type,
      doc.display_name,
      doc.status || "completed",
      JSON.stringify(doc.pages || []),
      JSON.stringify(doc.extraction_data || {}),
      JSON.stringify(doc.likelihoods || {}),
      doc.extraction_confidence ?? null,
      doc.needs_review ? 1 : 0,
      JSON.stringify(doc.review_reasons || []),
      doc.credits_used ?? 0
    );
  }

  // Batch fetch instead of N individual getDocument calls
  const ids = docs.map(d => d.id);
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM documents WHERE id IN (${placeholders}) ORDER BY created_at ASC`).all(...ids).map(deserializeDocument);
});

/**
 * Upsert a document — insert if new, update if exists.
 * Used by server-side pipeline for incremental saves during processing.
 */
export function upsertDocument(doc) {
  db.prepare(`
    INSERT INTO documents (
      id, packet_id, session_id, document_type, display_name, status,
      pages, extraction_data, likelihoods, extraction_confidence,
      needs_review, review_reasons, credits_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      extraction_data = excluded.extraction_data,
      likelihoods = excluded.likelihoods,
      extraction_confidence = excluded.extraction_confidence,
      needs_review = excluded.needs_review,
      review_reasons = excluded.review_reasons,
      credits_used = excluded.credits_used,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    doc.id,
    doc.packet_id,
    doc.session_id,
    doc.document_type,
    doc.display_name,
    doc.status || "pending",
    JSON.stringify(doc.pages || []),
    JSON.stringify(doc.extraction_data || {}),
    JSON.stringify(doc.likelihoods || {}),
    doc.extraction_confidence ?? null,
    doc.needs_review ? 1 : 0,
    JSON.stringify(doc.review_reasons || []),
    doc.credits_used ?? 0
  );

  return getDocument(doc.id);
}

export function getDocument(id) {
  return deserializeDocument(db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id));
}

export function getDocumentsByPacket(packetId) {
  return db.prepare(`SELECT * FROM documents WHERE packet_id = ? ORDER BY created_at ASC`).all(packetId).map(deserializeDocument);
}

export function getDocumentsBySession(sessionId) {
  return db.prepare(`SELECT * FROM documents WHERE session_id = ? ORDER BY created_at ASC`).all(sessionId).map(deserializeDocument);
}

export function getDocumentsNeedingReview(sessionId) {
  return db.prepare(`
    SELECT * FROM documents
    WHERE session_id = ? AND needs_review = 1 AND reviewed_at IS NULL
    ORDER BY created_at ASC
  `).all(sessionId).map(deserializeDocument);
}

export function updateDocumentExtraction(id, { status, extractionData, likelihoods, extractionConfidence, needsReview, reviewReasons, creditsUsed }) {
  db.prepare(`
    UPDATE documents SET
      status = ?,
      extraction_data = ?,
      likelihoods = ?,
      extraction_confidence = ?,
      needs_review = ?,
      review_reasons = ?,
      credits_used = credits_used + ?,
      reviewed_at = NULL,
      reviewed_by = NULL,
      reviewer_notes = NULL,
      edited_fields = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status || "completed",
    JSON.stringify(extractionData || {}),
    JSON.stringify(likelihoods || {}),
    extractionConfidence ?? null,
    needsReview ? 1 : 0,
    JSON.stringify(reviewReasons || []),
    creditsUsed ?? 0,
    id
  );

  return getDocument(id);
}

export const reviewDocument = db.transaction((id, { status, reviewerNotes, editedFields, reviewedBy, categoryOverride }) => {
  db.prepare(`
    UPDATE documents SET
      status = ?,
      needs_review = 0,
      reviewed_at = CURRENT_TIMESTAMP,
      reviewed_by = ?,
      reviewer_notes = ?,
      edited_fields = ?,
      category_override = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status || "approved",
    reviewedBy || null,
    reviewerNotes || null,
    editedFields ? JSON.stringify(editedFields) : null,
    categoryOverride ? JSON.stringify(categoryOverride) : null,
    id
  );

  return getDocument(id);
});

// ============================================================================
// HISTORY OPERATIONS
// ============================================================================

export function createHistoryEntry(entry) {
  db.prepare(`
    INSERT INTO history (
      id, session_id, total_packets, total_documents,
      completed, needs_review, failed, total_credits, total_cost, summary, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.session_id || null,
    entry.total_packets ?? 0,
    entry.total_documents ?? 0,
    entry.completed ?? 0,
    entry.needs_review ?? 0,
    entry.failed ?? 0,
    entry.total_credits ?? 0,
    entry.total_cost ?? 0,
    JSON.stringify(entry.summary || {}),
    entry.created_by || null
  );

  return getHistoryEntry(entry.id);
}

export function getHistoryEntry(id) {
  const entry = db.prepare(`SELECT * FROM history WHERE id = ?`).get(id);
  if (entry) {
    entry.summary = tryParseJson(entry.summary, {});
  }
  return entry;
}

export function getHistory(limit = 50) {
  return db.prepare(`SELECT * FROM history ORDER BY completed_at DESC LIMIT ?`).all(limit).map(entry => {
    entry.summary = tryParseJson(entry.summary, {});
    return entry;
  });
}

export function deleteHistoryEntry(id) {
  const result = db.prepare(`DELETE FROM history WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function clearHistory() {
  db.prepare(`DELETE FROM history`).run();
  return true;
}

// ============================================================================
// USAGE & STATS
// ============================================================================

export function getUsageStats(days = 30) {
  return db.prepare(`
    SELECT * FROM usage_daily
    WHERE date >= date('now', '-' || ? || ' days')
    ORDER BY date DESC
  `).all(days);
}

export function getTotalUsage() {
  return db.prepare(`
    SELECT
      COALESCE(SUM(total_credits), 0) as total_credits,
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(total_pages), 0) as total_pages,
      COALESCE(SUM(api_calls), 0) as api_calls,
      COALESCE(SUM(packets_processed), 0) as packets_processed,
      COALESCE(SUM(documents_processed), 0) as documents_processed
    FROM usage_daily
  `).get();
}

export function getStats30Days(days = 30) {
  const usage = db.prepare(`
    SELECT
      COALESCE(SUM(total_pages), 0) as total_pages,
      COALESCE(SUM(packets_processed), 0) as packets_processed,
      COALESCE(SUM(documents_processed), 0) as documents_processed,
      COALESCE(SUM(total_cost), 0) as total_cost
    FROM usage_daily
    WHERE date >= date('now', '-' || ? || ' days')
  `).get(days);

  const docStats = db.prepare(`
    SELECT
      COUNT(*) as total_documents,
      SUM(CASE WHEN d.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN d.needs_review = 1 OR d.status = 'needs_review' THEN 1 ELSE 0 END) as needs_review,
      SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM documents d
    INNER JOIN packets p ON d.packet_id = p.id
    WHERE p.completed_at IS NOT NULL
      AND p.completed_at >= datetime('now', '-' || ? || ' days')
  `).get(days);

  const avgTime = db.prepare(`
    SELECT AVG((julianday(completed_at) - julianday(started_at)) * 86400) as avg_seconds
    FROM packets
    WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
      AND completed_at >= datetime('now', '-' || ? || ' days')
  `).get(days);

  const totalDocs = Number(docStats?.total_documents ?? 0) || 0;
  const completed = Number(docStats?.completed ?? 0) || 0;
  const needsReview = Number(docStats?.needs_review ?? 0) || 0;

  return {
    totalPages: Number(usage?.total_pages ?? 0) || 0,
    packetsProcessed: Number(usage?.packets_processed ?? 0) || 0,
    documentsProcessed: Number(usage?.documents_processed ?? 0) || 0,
    totalCost: Number(usage?.total_cost ?? 0) || 0,
    totalDocuments: totalDocs,
    completed,
    needsReview,
    failed: Number(docStats?.failed ?? 0) || 0,
    accuracyPercent: totalDocs > 0 ? Math.round((completed / totalDocs) * 100) : null,
    reviewPercent: totalDocs > 0 ? Math.round((needsReview / totalDocs) * 100) : null,
    avgProcessingSeconds: avgTime?.avg_seconds != null ? Math.round(Number(avgTime.avg_seconds)) : null,
  };
}

/**
 * Admin dashboard metrics — aggregated entirely in SQL (no full-table JS loops).
 */
export function getAdminDashboardMetrics() {
  const packetCount = db.prepare(`SELECT COUNT(*) as count FROM packets`).get();
  const docAgg = db.prepare(`
    SELECT
      COUNT(*) as total_documents,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN needs_review = 1 OR status = 'needs_review' THEN 1 ELSE 0 END) as needs_review,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM documents
  `).get();

  const totalDocuments = Number(docAgg?.total_documents ?? 0) || 0;
  const completedDocuments = Number(docAgg?.completed ?? 0) || 0;
  const needsReviewCount = Number(docAgg?.needs_review ?? 0) || 0;
  const failedCount = Number(docAgg?.failed ?? 0) || 0;
  const totalPackets = Number(packetCount?.count ?? 0) || 0;

  // Usage: cascade through sources (usage_daily → history → packets → sessions → documents)
  const usage = getTotalUsage();
  let totalCredits = Number(usage?.total_credits ?? 0) || 0;
  let totalCost = Number(usage?.total_cost ?? 0) || 0;
  if (totalCredits === 0 && totalCost === 0) {
    const fallback = db.prepare(`
      SELECT
        COALESCE(SUM(total_credits), 0) as tc, COALESCE(SUM(total_cost), 0) as tco FROM history
    `).get();
    totalCredits = Number(fallback?.tc ?? 0) || 0;
    totalCost = Number(fallback?.tco ?? 0) || 0;
  }
  if (totalCredits === 0 && totalCost === 0) {
    const fallback = db.prepare(`
      SELECT COALESCE(SUM(total_credits), 0) as tc, COALESCE(SUM(total_cost), 0) as tco FROM packets
    `).get();
    totalCredits = Number(fallback?.tc ?? 0) || 0;
    totalCost = Number(fallback?.tco ?? 0) || 0;
  }
  if (totalCredits === 0 && totalCost === 0) {
    const fallback = db.prepare(`
      SELECT COALESCE(SUM(total_credits), 0) as tc, COALESCE(SUM(total_cost), 0) as tco FROM sessions
    `).get();
    totalCredits = Number(fallback?.tc ?? 0) || 0;
    totalCost = Number(fallback?.tco ?? 0) || 0;
  }
  if (totalCredits === 0 && totalCost === 0) {
    const credits = Number(db.prepare(`SELECT COALESCE(SUM(credits_used), 0) as c FROM documents`).get()?.c ?? 0) || 0;
    if (credits > 0) {
      totalCredits = credits;
      totalCost = credits * 0.01;
    }
  }

  // Confidence: aggregate in SQL instead of loading all rows into memory
  const confDist = db.prepare(`
    SELECT
      COUNT(CASE WHEN extraction_confidence >= 0.9 THEN 1 END) as high,
      COUNT(CASE WHEN extraction_confidence >= 0.7 AND extraction_confidence < 0.9 THEN 1 END) as medium,
      COUNT(CASE WHEN extraction_confidence > 0 AND extraction_confidence < 0.7 THEN 1 END) as low,
      AVG(extraction_confidence) as avg_confidence,
      MIN(extraction_confidence) as min_confidence,
      MAX(extraction_confidence) as max_confidence
    FROM documents
    WHERE extraction_confidence IS NOT NULL
  `).get();

  const avgConfidence = Number(confDist?.avg_confidence ?? 0) || 0;
  const minConfidence = Number(confDist?.min_confidence ?? 0) || 0;
  const maxConfidence = Number(confDist?.max_confidence ?? 0) || 0;

  // Review reasons: aggregate top reasons in SQL using a limited scan
  const topReasonRows = db.prepare(`
    SELECT review_reasons FROM documents
    WHERE needs_review = 1 AND review_reasons IS NOT NULL AND review_reasons != '[]'
    LIMIT 500
  `).all();
  const reviewReasons = {};
  for (const row of topReasonRows) {
    const reasons = tryParseJson(row.review_reasons, []);
    for (const r of (Array.isArray(reasons) ? reasons : [])) {
      const key = String(r);
      reviewReasons[key] = (reviewReasons[key] || 0) + 1;
    }
  }
  const reviewReasonsSorted = Object.entries(reviewReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const reviewRate = totalDocuments > 0 ? needsReviewCount / totalDocuments : 0;
  const errorRate = totalDocuments > 0 ? failedCount / totalDocuments : 0;

  // Processing time: aggregate in SQL
  const timeAgg = db.prepare(`
    SELECT
      AVG((julianday(completed_at) - julianday(started_at)) * 86400) as avg_seconds,
      MIN((julianday(completed_at) - julianday(started_at)) * 86400) as min_seconds,
      MAX((julianday(completed_at) - julianday(started_at)) * 86400) as max_seconds
    FROM packets
    WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
  `).get();

  const avgProcessingTime = Number(timeAgg?.avg_seconds ?? 0) || 0;
  const minProcessingTime = Number(timeAgg?.min_seconds ?? 0) || 0;
  const maxProcessingTime = Number(timeAgg?.max_seconds ?? 0) || 0;

  const usage30d = getUsageStats(30);
  const stats30d = getStats30Days(30);
  const recentHistory = getHistory(20);

  return {
    totalPackets,
    totalDocuments,
    completedDocuments,
    needsReviewCount,
    failedCount,
    avgConfidence,
    minConfidence,
    maxConfidence,
    confidenceDistribution: {
      high: Number(confDist?.high ?? 0),
      medium: Number(confDist?.medium ?? 0),
      low: Number(confDist?.low ?? 0),
    },
    fieldStats: [], // Removed: field-level stats required loading all JSON blobs — too expensive
    lowConfidenceFields: 0,
    reviewRate,
    reviewReasons: reviewReasonsSorted,
    avgProcessingTime,
    minProcessingTime,
    maxProcessingTime,
    totalCredits,
    totalCost,
    avgCreditsPerDoc: completedDocuments > 0 ? totalCredits / completedDocuments : 0,
    errorRate,
    usage30d,
    stats30d,
    recentHistory,
  };
}

// ============================================================================
// EXPORT TEMPLATES
// ============================================================================

export function saveExportTemplate(template) {
  const id = template.id || `template_${Date.now()}`;
  db.prepare(`
    INSERT INTO export_templates (id, name, config)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      config = excluded.config,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, template.name, JSON.stringify(template.config));
  return getExportTemplate(template.name);
}

export function getExportTemplate(name) {
  const template = db.prepare(`SELECT * FROM export_templates WHERE name = ?`).get(name);
  if (template) {
    template.config = tryParseJson(template.config, {});
  }
  return template;
}

export function getExportTemplates() {
  return db.prepare(`SELECT * FROM export_templates ORDER BY name`).all().map(t => {
    t.config = tryParseJson(t.config, {});
    return t;
  });
}

export function deleteExportTemplate(name) {
  const result = db.prepare(`DELETE FROM export_templates WHERE name = ?`).run(name);
  return result.changes > 0;
}

// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================

/**
 * Delete completed sessions older than N days.
 * Packets and documents CASCADE-delete with them.
 */
export function cleanupOldSessions(daysOld = 30) {
  const result = db.prepare(`
    DELETE FROM sessions
    WHERE status = 'completed'
    AND updated_at < datetime('now', '-' || ? || ' days')
  `).run(daysOld);
  return result.changes;
}

/**
 * Delete usage_daily rows older than N days.
 */
export function cleanupOldUsage(daysOld = 365) {
  const result = db.prepare(`
    DELETE FROM usage_daily WHERE date < date('now', '-' || ? || ' days')
  `).run(daysOld);
  return result.changes;
}

/**
 * Cap history entries — keep only the most recent N entries.
 */
export function cleanupOldHistory(keepCount = 200) {
  const result = db.prepare(`
    DELETE FROM history WHERE id NOT IN (
      SELECT id FROM history ORDER BY completed_at DESC LIMIT ?
    )
  `).run(keepCount);
  return result.changes;
}

/**
 * Run incremental vacuum to reclaim free pages.
 * Safe to call periodically — does nothing if no free pages exist.
 */
export function runIncrementalVacuum(pages = 100) {
  try {
    db.pragma(`incremental_vacuum(${Math.floor(pages)})`);
  } catch (e) {
    console.warn("[DB] Incremental vacuum failed:", e.message);
  }
}

/**
 * Run all maintenance tasks. Intended to be called from a periodic timer.
 */
export function runMaintenance() {
  const sessionsDeleted = cleanupOldSessions(30);
  const usageDeleted = cleanupOldUsage(365);
  const historyDeleted = cleanupOldHistory(200);
  runIncrementalVacuum(100);

  if (sessionsDeleted > 0 || usageDeleted > 0 || historyDeleted > 0) {
    console.log(`[DB] Maintenance: cleaned ${sessionsDeleted} sessions, ${usageDeleted} usage rows, ${historyDeleted} history entries`);
  }
}

export function getDbStats() {
  const sessions = db.prepare(`SELECT COUNT(*) as count FROM sessions`).get();
  const packets = db.prepare(`SELECT COUNT(*) as count FROM packets`).get();
  const documents = db.prepare(`SELECT COUNT(*) as count FROM documents`).get();
  const history = db.prepare(`SELECT COUNT(*) as count FROM history`).get();
  const usage = getTotalUsage();

  return {
    sessions: sessions.count,
    packets: packets.count,
    documents: documents.count,
    history: history.count,
    usage,
    dbPath: DB_FILE,
    dbSize: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
  };
}

// ============================================================================
// CLEAR ALL DATA (admin action)
// ============================================================================

export const clearAllData = db.transaction(() => {
  const tables = ["documents", "packets", "sessions", "history", "usage_daily"];
  for (const table of tables) {
    db.exec(`DELETE FROM ${table}`);
  }
  console.log("[DB] All data cleared");
  return { success: true, tablesCleared: tables };
});

// ============================================================================
// INTEGRITY & BACKUP
// ============================================================================

/**
 * Run PRAGMA integrity_check on startup. Returns true if the database is OK.
 */
export function checkIntegrity() {
  try {
    const result = db.pragma("integrity_check");
    const ok = result?.[0]?.integrity_check === "ok";
    if (!ok) console.error("[DB] Integrity check FAILED:", result);
    else console.log("[DB] Integrity check passed");
    return ok;
  } catch (err) {
    console.error("[DB] Integrity check error:", err.message);
    return false;
  }
}

/**
 * Create a backup of the database using SQLite's backup API.
 * Keeps the last `keep` copies (rotated by filename).
 * Returns a Promise that resolves to the backup file path (or null on failure).
 */
export async function createBackup(keep = 7) {
  const backupDir = path.join(DB_DIR, "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupFile = path.join(backupDir, `sail-idp-${timestamp}.db`);

  try {
    await db.backup(backupFile);
    console.log(`[DB] Backup created: ${backupFile}`);

    // Rotate: remove oldest backups beyond `keep`
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith("sail-idp-") && f.endsWith(".db"))
      .sort()
      .reverse();
    for (let i = keep; i < files.length; i++) {
      const old = path.join(backupDir, files[i]);
      fs.unlinkSync(old);
      console.log(`[DB] Rotated old backup: ${files[i]}`);
    }
    return backupFile;
  } catch (err) {
    console.error("[DB] Backup failed:", err.message);
    return null;
  }
}

// ============================================================================
// ZOMBIE PACKET RECOVERY
// ============================================================================

/**
 * Reset packets that are stuck in 'processing' or 'splitting'/'extracting' status.
 * These are zombies from a previous server/browser crash. Re-queue them so they
 * can be retried on the next processing run.
 */
export function resetZombiePackets() {
  const zombieStatuses = ["processing", "splitting", "classifying", "extracting"];
  const placeholders = zombieStatuses.map(() => "?").join(",");
  const result = db.prepare(`
    UPDATE packets SET status = 'queued', started_at = NULL, pipeline_stage = NULL
    WHERE status IN (${placeholders})
  `).run(...zombieStatuses);

  if (result.changes > 0) {
    console.log(`[DB] Reset ${result.changes} zombie packet(s) to 'queued'`);
  }
  return result.changes;
}

/**
 * Get packets that are currently queued for processing (used by server-side queue on startup).
 */
export function getQueuedPackets() {
  return db.prepare(`SELECT * FROM packets WHERE status = 'queued' ORDER BY created_at ASC`).all();
}

// ============================================================================
// PROCESS EXIT HANDLERS
// ============================================================================

process.on("exit", () => db.close());
process.on("SIGINT", () => { db.close(); process.exit(0); });
process.on("SIGTERM", () => { db.close(); process.exit(0); });

export default db;
