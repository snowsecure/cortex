/**
 * SQLite Database Module for SAIL-IDP
 * Enterprise-ready persistence layer
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
db.pragma("journal_mode = WAL"); // Better concurrent access
db.pragma("foreign_keys = ON");

/**
 * Initialize database schema
 */
export function initializeDatabase() {
  // Sessions table - tracks processing batches
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

  // Packets table - document packets being processed
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
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Documents table - individual documents extracted from packets
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      packet_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      document_type TEXT,
      display_name TEXT,
      status TEXT DEFAULT 'pending',
      pages TEXT, -- JSON array of page numbers
      extraction_data TEXT, -- JSON extraction result
      likelihoods TEXT, -- JSON field likelihoods
      extraction_confidence REAL,
      needs_review INTEGER DEFAULT 0,
      review_reasons TEXT, -- JSON array
      reviewed_at DATETIME,
      reviewed_by TEXT,
      reviewer_notes TEXT,
      edited_fields TEXT, -- JSON object of edited field values
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
      summary TEXT, -- JSON summary data
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
    )
  `);

  // Usage tracking table - per-day aggregates
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
      config TEXT NOT NULL, -- JSON config
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_packets_session ON packets(session_id);
    CREATE INDEX IF NOT EXISTS idx_packets_status ON packets(status);
    CREATE INDEX IF NOT EXISTS idx_documents_packet ON documents(packet_id);
    CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);
    CREATE INDEX IF NOT EXISTS idx_documents_needs_review ON documents(needs_review);
    CREATE INDEX IF NOT EXISTS idx_history_completed ON history(completed_at);
  `);

  console.log("Database initialized:", DB_FILE);
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

export function createSession(id) {
  const stmt = db.prepare(`
    INSERT INTO sessions (id) VALUES (?)
  `);
  stmt.run(id);
  return getSession(id);
}

export function getSession(id) {
  const stmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
  return stmt.get(id);
}

export function getActiveSession() {
  const stmt = db.prepare(`
    SELECT * FROM sessions 
    WHERE status = 'active' 
    ORDER BY updated_at DESC 
    LIMIT 1
  `);
  return stmt.get();
}

export function updateSession(id, data) {
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (key !== "id") {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);
  
  const stmt = db.prepare(`
    UPDATE sessions SET ${fields.join(", ")} WHERE id = ?
  `);
  stmt.run(...values);
  return getSession(id);
}

export function closeSession(id) {
  return updateSession(id, { status: "completed" });
}

// ============================================================================
// PACKET OPERATIONS
// ============================================================================

export function createPacket(packet) {
  const stmt = db.prepare(`
    INSERT INTO packets (id, session_id, filename, status)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(packet.id, packet.session_id, packet.filename, packet.status || "queued");
  
  // Update session packet count
  db.prepare(`
    UPDATE sessions SET total_packets = total_packets + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(packet.session_id);
  
  return getPacket(packet.id);
}

export function createPackets(packets) {
  const insert = db.prepare(`
    INSERT INTO packets (id, session_id, filename, status)
    VALUES (?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((packets) => {
    for (const p of packets) {
      insert.run(p.id, p.session_id, p.filename, p.status || "queued");
    }
    
    // Update session packet count
    if (packets.length > 0) {
      db.prepare(`
        UPDATE sessions SET total_packets = total_packets + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(packets.length, packets[0].session_id);
    }
  });
  
  insertMany(packets);
  return packets.map(p => getPacket(p.id));
}

export function getPacket(id) {
  const stmt = db.prepare(`SELECT * FROM packets WHERE id = ?`);
  return stmt.get(id);
}

export function getPacketsBySession(sessionId) {
  const stmt = db.prepare(`
    SELECT * FROM packets WHERE session_id = ? ORDER BY created_at ASC
  `);
  return stmt.all(sessionId);
}

export function updatePacket(id, data) {
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (key !== "id" && key !== "session_id") {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) return getPacket(id);
  
  values.push(id);
  
  const stmt = db.prepare(`
    UPDATE packets SET ${fields.join(", ")} WHERE id = ?
  `);
  stmt.run(...values);
  return getPacket(id);
}

export function completePacket(id, result) {
  const packet = getPacket(id);
  if (!packet) return null;
  
  const update = db.prepare(`
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
  `);
  
  const status = result.hasNeedsReview ? "needs_review" : 
                 result.hasFailed ? "failed" : "completed";
  
  update.run(
    status,
    result.stats?.totalDocuments || 0,
    result.stats?.completed || 0,
    result.stats?.needsReview || 0,
    result.stats?.failed || 0,
    result.usage?.totalCredits || 0,
    result.usage?.totalCost || 0,
    id
  );
  
  // Update session stats
  const sessionUpdate = db.prepare(`
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
  `);
  
  sessionUpdate.run(
    status, status, status,
    result.usage?.totalCredits || 0,
    result.usage?.totalCost || 0,
    result.usage?.totalPages || 0,
    result.usage?.apiCalls || 0,
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
    result.usage?.totalCredits || 0,
    result.usage?.totalCost || 0,
    result.usage?.totalPages || 0,
    result.usage?.apiCalls || 0,
    result.stats?.totalDocuments || 0
  );
  
  return getPacket(id);
}

export function deletePacket(id) {
  const packet = getPacket(id);
  if (!packet) return false;
  
  db.prepare(`DELETE FROM packets WHERE id = ?`).run(id);
  
  // Update session count
  db.prepare(`
    UPDATE sessions SET total_packets = total_packets - 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(packet.session_id);
  
  return true;
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

export function createDocument(doc) {
  const stmt = db.prepare(`
    INSERT INTO documents (
      id, packet_id, session_id, document_type, display_name, status,
      pages, extraction_data, likelihoods, extraction_confidence,
      needs_review, review_reasons, credits_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    doc.id,
    doc.packet_id,
    doc.session_id,
    doc.document_type,
    doc.display_name,
    doc.status || "completed",
    JSON.stringify(doc.pages || []),
    JSON.stringify(doc.extraction_data || {}),
    JSON.stringify(doc.likelihoods || {}),
    doc.extraction_confidence || null,
    doc.needs_review ? 1 : 0,
    JSON.stringify(doc.review_reasons || []),
    doc.credits_used || 0
  );
  
  return getDocument(doc.id);
}

export function createDocuments(docs) {
  const insert = db.prepare(`
    INSERT INTO documents (
      id, packet_id, session_id, document_type, display_name, status,
      pages, extraction_data, likelihoods, extraction_confidence,
      needs_review, review_reasons, credits_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((docs) => {
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
        doc.extraction_confidence || null,
        doc.needs_review ? 1 : 0,
        JSON.stringify(doc.review_reasons || []),
        doc.credits_used || 0
      );
    }
  });
  
  insertMany(docs);
  return docs.map(d => getDocument(d.id));
}

export function getDocument(id) {
  const stmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
  const doc = stmt.get(id);
  if (doc) {
    doc.pages = JSON.parse(doc.pages || "[]");
    doc.extraction_data = JSON.parse(doc.extraction_data || "{}");
    doc.likelihoods = JSON.parse(doc.likelihoods || "{}");
    doc.review_reasons = JSON.parse(doc.review_reasons || "[]");
    doc.edited_fields = doc.edited_fields ? JSON.parse(doc.edited_fields) : null;
    doc.needs_review = !!doc.needs_review;
  }
  return doc;
}

export function getDocumentsByPacket(packetId) {
  const stmt = db.prepare(`
    SELECT * FROM documents WHERE packet_id = ? ORDER BY created_at ASC
  `);
  return stmt.all(packetId).map(doc => {
    doc.pages = JSON.parse(doc.pages || "[]");
    doc.extraction_data = JSON.parse(doc.extraction_data || "{}");
    doc.likelihoods = JSON.parse(doc.likelihoods || "{}");
    doc.review_reasons = JSON.parse(doc.review_reasons || "[]");
    doc.edited_fields = doc.edited_fields ? JSON.parse(doc.edited_fields) : null;
    doc.needs_review = !!doc.needs_review;
    return doc;
  });
}

export function getDocumentsBySession(sessionId) {
  const stmt = db.prepare(`
    SELECT * FROM documents WHERE session_id = ? ORDER BY created_at ASC
  `);
  return stmt.all(sessionId).map(doc => {
    doc.pages = JSON.parse(doc.pages || "[]");
    doc.extraction_data = JSON.parse(doc.extraction_data || "{}");
    doc.likelihoods = JSON.parse(doc.likelihoods || "{}");
    doc.review_reasons = JSON.parse(doc.review_reasons || "[]");
    doc.edited_fields = doc.edited_fields ? JSON.parse(doc.edited_fields) : null;
    doc.needs_review = !!doc.needs_review;
    return doc;
  });
}

export function getDocumentsNeedingReview(sessionId) {
  const stmt = db.prepare(`
    SELECT * FROM documents 
    WHERE session_id = ? AND needs_review = 1 AND reviewed_at IS NULL
    ORDER BY created_at ASC
  `);
  return stmt.all(sessionId).map(doc => {
    doc.pages = JSON.parse(doc.pages || "[]");
    doc.extraction_data = JSON.parse(doc.extraction_data || "{}");
    doc.likelihoods = JSON.parse(doc.likelihoods || "{}");
    doc.review_reasons = JSON.parse(doc.review_reasons || "[]");
    doc.edited_fields = doc.edited_fields ? JSON.parse(doc.edited_fields) : null;
    doc.needs_review = !!doc.needs_review;
    return doc;
  });
}

export function reviewDocument(id, { status, reviewerNotes, editedFields, reviewedBy }) {
  const stmt = db.prepare(`
    UPDATE documents SET
      status = ?,
      needs_review = 0,
      reviewed_at = CURRENT_TIMESTAMP,
      reviewed_by = ?,
      reviewer_notes = ?,
      edited_fields = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  stmt.run(
    status || "approved",
    reviewedBy || null,
    reviewerNotes || null,
    editedFields ? JSON.stringify(editedFields) : null,
    id
  );
  
  return getDocument(id);
}

// ============================================================================
// HISTORY OPERATIONS
// ============================================================================

export function createHistoryEntry(entry) {
  const stmt = db.prepare(`
    INSERT INTO history (
      id, session_id, total_packets, total_documents,
      completed, needs_review, failed, total_credits, total_cost, summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    entry.id,
    entry.session_id || null,
    entry.total_packets || 0,
    entry.total_documents || 0,
    entry.completed || 0,
    entry.needs_review || 0,
    entry.failed || 0,
    entry.total_credits || 0,
    entry.total_cost || 0,
    JSON.stringify(entry.summary || {})
  );
  
  return getHistoryEntry(entry.id);
}

export function getHistoryEntry(id) {
  const stmt = db.prepare(`SELECT * FROM history WHERE id = ?`);
  const entry = stmt.get(id);
  if (entry) {
    entry.summary = JSON.parse(entry.summary || "{}");
  }
  return entry;
}

export function getHistory(limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM history ORDER BY completed_at DESC LIMIT ?
  `);
  return stmt.all(limit).map(entry => {
    entry.summary = JSON.parse(entry.summary || "{}");
    return entry;
  });
}

export function deleteHistoryEntry(id) {
  db.prepare(`DELETE FROM history WHERE id = ?`).run(id);
  return true;
}

export function clearHistory() {
  db.prepare(`DELETE FROM history`).run();
  return true;
}

// ============================================================================
// USAGE & STATS
// ============================================================================

export function getUsageStats(days = 30) {
  const stmt = db.prepare(`
    SELECT * FROM usage_daily 
    WHERE date >= date('now', '-' || ? || ' days')
    ORDER BY date DESC
  `);
  return stmt.all(days);
}

export function getTotalUsage() {
  const stmt = db.prepare(`
    SELECT 
      SUM(total_credits) as total_credits,
      SUM(total_cost) as total_cost,
      SUM(total_pages) as total_pages,
      SUM(api_calls) as api_calls,
      SUM(packets_processed) as packets_processed,
      SUM(documents_processed) as documents_processed
    FROM usage_daily
  `);
  return stmt.get();
}

// ============================================================================
// EXPORT TEMPLATES
// ============================================================================

export function saveExportTemplate(template) {
  const stmt = db.prepare(`
    INSERT INTO export_templates (id, name, config)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      config = excluded.config,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  const id = template.id || `template_${Date.now()}`;
  stmt.run(id, template.name, JSON.stringify(template.config));
  return getExportTemplate(template.name);
}

export function getExportTemplate(name) {
  const stmt = db.prepare(`SELECT * FROM export_templates WHERE name = ?`);
  const template = stmt.get(name);
  if (template) {
    template.config = JSON.parse(template.config || "{}");
  }
  return template;
}

export function getExportTemplates() {
  const stmt = db.prepare(`SELECT * FROM export_templates ORDER BY name`);
  return stmt.all().map(t => {
    t.config = JSON.parse(t.config || "{}");
    return t;
  });
}

export function deleteExportTemplate(name) {
  db.prepare(`DELETE FROM export_templates WHERE name = ?`).run(name);
  return true;
}

// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================

export function cleanupOldSessions(daysOld = 30) {
  const stmt = db.prepare(`
    DELETE FROM sessions 
    WHERE status = 'completed' 
    AND updated_at < datetime('now', '-' || ? || ' days')
  `);
  const result = stmt.run(daysOld);
  return result.changes;
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

// Close database connection on process exit
process.on("exit", () => db.close());
process.on("SIGINT", () => {
  db.close();
  process.exit();
});

export default db;
