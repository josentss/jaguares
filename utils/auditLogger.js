const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'upload_audit.log');

try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
} catch (e) {
    // FS limitado en Vercel — best-effort
}

function safeString(v) {
    if (v === undefined || v === null) return null;
    try { return String(v); } catch (e) { return null; }
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
        // ignore
    }

    // Solo INSERT (la tabla ya existe en Supabase). Fallo = log, no tumba la app.
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

    try {
        db.query(sql, params, (err) => {
            if (err) console.error('Fallo insert audit_uploads:', err.message);
        });
    } catch (e) {
        console.error('Error insertando en audit_uploads:', e.message);
    }
}

module.exports = { logUploadEvent, logFile };
