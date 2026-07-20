/*
Purge/archive old audit_uploads rows into audit_uploads_archive.
Usage:
  node scripts/purge_audit.js [--days N] [--batch M] [--dry-run]
Defaults: days=90, batch=1000
*/

const db = require('../config/db');
const argv = require('minimist')(process.argv.slice(2));

const days = parseInt(argv.days || process.env.PURGE_RETENTION_DAYS || '90', 10);
const batch = parseInt(argv.batch || process.env.PURGE_BATCH_SIZE || '1000', 10);
const dryRun = argv['dry-run'] || argv['dryrun'] || false;

const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
console.log(`Purge audit: days=${days}, batch=${batch}, dryRun=${dryRun}, cutoff=${cutoff.toISOString()}`);

function ensureArchiveTable(cb) {
    const sql = `
    CREATE TABLE IF NOT EXISTS audit_uploads_archive (
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
    db.query(sql, (err) => cb(err));
}

function doPurgeOnce(callback) {
    const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');
    console.log('Cutoff SQL timestamp:', cutoffStr);

    if (dryRun) {
        // Count how many rows would be affected
        const countSql = 'SELECT COUNT(*) AS c FROM audit_uploads WHERE ts < ?';
        db.query(countSql, [cutoffStr], (err, rows) => {
            if (err) return callback(err);
            console.log('Rows matching purge condition:', rows[0].c);
            return callback(null);
        });
        return;
    }

    // Insert into archive (limit), then delete same ids using derived table to avoid MySQL limitation
    const insertSql = `INSERT INTO audit_uploads_archive (ts, success, reason, user_id, original_name, stored_filename, ip, meta)
    SELECT ts, success, reason, user_id, original_name, stored_filename, ip, meta
    FROM audit_uploads
    WHERE ts < ?
    LIMIT ?`;

    db.query(insertSql, [cutoffStr, batch], (insErr, insRes) => {
        if (insErr) return callback(insErr);
        const moved = insRes.affectedRows || 0;
        console.log('Rows moved to archive:', moved);
        if (moved === 0) return callback(null);

        // Delete the moved rows by id using derived subquery
        const delSql = `DELETE FROM audit_uploads WHERE id IN (
            SELECT id FROM (SELECT id FROM audit_uploads WHERE ts < ? LIMIT ?) AS t
        )`;
        db.query(delSql, [cutoffStr, batch], (delErr, delRes) => {
            if (delErr) return callback(delErr);
            console.log('Rows deleted from active table:', delRes.affectedRows || 0);
            return callback(null);
        });
    });
}

ensureArchiveTable((err) => {
    if (err) {
        console.error('No se pudo asegurar tabla archive:', err.message);
        process.exit(1);
    }

    doPurgeOnce((pErr) => {
        if (pErr) {
            console.error('Error purgando:', pErr.message);
            process.exit(1);
        }
        console.log('Purge completed.');
        process.exit(0);
    });
});
