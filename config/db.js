require('dotenv').config();

const mysql = require('mysql2');

// Cambiamos createConnection por createPool para soportar la nube
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'club_jaguares',
    port: process.env.DB_PORT || 3306, // ¡Importante! Lee el puerto 4000 de TiDB en Render o usa 3306 en local
    waitForConnections: true,
    connectionLimit: 10, // Permite hasta 10 conexiones simultáneas
    queueLimit: 0
});

console.log('Pool de conexiones a la base de datos listo');

module.exports = db;
