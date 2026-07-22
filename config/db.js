require('dotenv').config();

const mysql = require('mysql2');

// Cambiamos createConnection por createPool para soportar la nube
const db = mysql.createPool({
    host: (process.env.DB_HOST || 'localhost').trim(),
    user: (process.env.DB_USER || 'root').trim(),
    password: (process.env.DB_PASSWORD || '').trim(),
    database: (process.env.DB_NAME || 'club_jaguares').trim(),
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('Pool de conexiones a la base de datos listo');

module.exports = db;
