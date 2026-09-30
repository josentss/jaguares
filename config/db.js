require('dotenv').config();

const mysql = require('mysql2');

const host = (process.env.DB_HOST || 'localhost').trim();
const isTiDB = host.includes('tidbcloud.com');
const isPlanetScale = host.includes('psdb.cloud') || host.includes('planetscale');
const needsSSL = isTiDB || isPlanetScale || process.env.DB_SSL === '1';

const db = mysql.createPool({
    host: host,
    user: (process.env.DB_USER || 'root').trim(),
    password: (process.env.DB_PASSWORD || '').trim(),
    database: (process.env.DB_NAME || 'club_jaguares').trim(),
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: needsSSL
        ? { minVersion: 'TLSv1.2', rejectUnauthorized: false }
        : false
});

// Solo loguear, nunca tumbar la función
db.query('SELECT 1', (err) => {
    if (err) {
        console.error('❌ ERROR DE CONEXIÓN A BD:', err.code, err.message);
    } else {
        console.log('✅ CONEXIÓN EXITOSA A LA BASE DE DATOS');
    }
});

module.exports = db;
