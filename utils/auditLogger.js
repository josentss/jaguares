const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'upload_audit.log');

if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

function safeString(v) {
    if (v === undefined) return null;
    try { return String(v); } catch (e) { return null; }
}

// Ensure audit table exists. Best-effort: failure to create should not break app.
const createTableSql = `
CREATE TABLE IF NOT EXISTS audit_uploads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ts DATETIME NOT NULL,
  success TINYINT(1) NOT NULL,
  reason VARCHAR(255),
  user_id INT,
  original_name VARCHAR(255),
  stored_filename VARCHAR(255),
  ip VARCHAR(64),
  meta TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
try {
    db.query(createTableSql, (err) => {
        if (err) console.error('No se pudo crear la tabla audit_uploads:', err.message);
        else {
            // Create helpful indexes (best-effort; ignore errors)
            try {
                db.query('CREATE INDEX idx_audit_ts ON audit_uploads(ts)', () => {});
                db.query('CREATE INDEX idx_audit_user ON audit_uploads(user_id)', () => {});
            } catch (idxErr) {
                // ignore
            }
        }
    });
} catch (e) {
    console.error('Error creando tabla audit_uploads:', e.message);
}

// data: { success: boolean, reason: string, userId, originalName, storedFilename, ip, extra }
function logUploadEvent(data) {
    const entry = Object.assign({}, {
        timestamp: new Date().toISOString(),
        success: !!data.success,
        reason: safeString(data.reason) || null,
        userId: data.userId || null,
        originalName: safeString(data.originalName) || null,
        storedFilename: safeString(data.storedFilename) || null,
        ip: safeString(data.ip) || null,
        extra: data.extra || null
    });

    try {
        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
    } catch (err) {
        console.error('Fallo al escribir audit log:', err.message);
    }

    // Also insert into DB (best-effort)
    try {
        const sql = `INSERT INTO audit_uploads (ts, success, reason, user_id, original_name, stored_filename, ip, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [new Date(), entry.success ? 1 : 0, entry.reason, entry.userId, entry.originalName, entry.storedFilename, entry.ip, entry.extra ? JSON.stringify(entry.extra) : null];
        db.query(sql, params, (err) => {
            if (err) {
                // Log DB insert error to stderr but don't throw
                console.error('Fallo insert audit_uploads:', err.message);
            }
        });
    } catch (e) {
        console.error('Error insertando en audit_uploads:', e.message);
    }
}

module.exports = { logUploadEvent, logFile };