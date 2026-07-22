require('dotenv').config();

const mysql = require('mysql2');

const host = (process.env.DB_HOST || 'localhost').trim();
const isTiDB = host.includes('tidbcloud.com');

const db = mysql.createPool({
    host: host,
    user: (process.env.DB_USER || 'root').trim(),
    password: (process.env.DB_PASSWORD || '').trim(),
    database: (process.env.DB_NAME || 'club_jaguares').trim(),
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: isTiDB ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : false
});

// ── Prueba de conexión al arrancar el servidor ──────────────────────────────
db.query('SELECT 1', (err) => {
    if (err) {
        console.error('❌ ERROR GRAVE DE CONEXIÓN A BD:', err.message);
        console.error('Detalles del error:', err);
    } else {
        console.log('✅ CONEXIÓN EXITOSA A LA BASE DE DATOS');
    }
});

module.exports = db;
