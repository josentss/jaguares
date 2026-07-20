require('dotenv').config();

const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'club_jaguares'
});

db.connect((err) => {
    if (err) console.error('Error conectando a BD:', err);
    else console.log('Conectado a la base de datos');
});

module.exports = db;
