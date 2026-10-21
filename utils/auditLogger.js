const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'upload_audit.log');

try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
} catch (e) {
}

function safeString(v) {
    if (v === undefined || v === null) return null;
    try { return String(v); } catch (e) { return null; }
}

// Postgres (Supabase) — sin AUTO_INCREMENT / ENGINE
const createTableSql = `
CREATE TABLE IF NOT EXISTS audit_uploads (
  id              SERIAL PRIMARY KEY,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success         BOOLEAN NOT NULL DEFAULT false,
  reason          VARCHAR(255),
  user_id         INTEGER,
  original_name   VARCHAR(255),
  stored_filename VARCHAR(255),
  ip              VARCHAR(64),
  meta            TEXT
);
`;

try {
    db.query(createTableSql, (err) => {
        if (err) {
            console.error('No se pudo crear la tabla audit_uploads:', err.message);
            return;
        }
        db.query(
            'CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_uploads (ts)',
            () => {}
        );
        db.query(
            'CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_uploads (user_id)',
            () => {}
        );
    });
} catch (e) {
    console.error('Error creando tabla audit_uploads:', e.message);
}

function logUploadEvent(data) {
    const entry = {
        timestamp: new Date().toISOString(),
        success: !!data.success,
        reason: safeString(data.reason),
        userId: data.userId || null,
        originalName: safeString(data.originalName),
        storedFilename: safeString(data.storedFilename),
        ip: safeString(data.ip),
        extra: data.extra || null
    };

    try {
        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
    } catch (err) {
        // Ignore en serverless
    }

    try {
        const sql = `
            INSERT INTO audit_uploads
              (ts, success, reason, user_id, original_name, stored_filename, ip, meta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            new Date(),
            entry.success,
            entry.reason,
            entry.userId,
            entry.originalName,
            entry.storedFilename,
            entry.ip,
            entry.extra ? JSON.stringify(entry.extra) : null
        ];
        db.query(sql, params, (err) => {
            if (err) console.error('Fallo insert audit_uploads:', err.message);
        });
    } catch (e) {
        console.error('Error insertando en audit_uploads:', e.message);
    }
}

module.exports = { logUploadEvent, logFile };
