require('dotenv').config();
const { Pool } = require('pg');

const connectionString = (process.env.DATABASE_URL || '').trim();

if (!connectionString) {
    console.error('❌ Falta DATABASE_URL (Supabase). Configúrala en Vercel / .env');
}

const pool = new Pool({
    connectionString: connectionString || undefined,
    ssl: connectionString ? { rejectUnauthorized: false } : false,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 20000
});

/** Convierte ? → $1, $2, ... */
function toPgParams(sql) {
    let i = 0;
    return String(sql).replace(/\?/g, () => `$${++i}`);
}

/**
 * Si es INSERT sin RETURNING, añade RETURNING * para poder exponer insertId.
 * Detecta la PK más probable por nombre de tabla.
 */
function ensureReturning(sql) {
    const s = sql.trim();
    if (!/^INSERT\s+/i.test(s)) return s;
    if (/\bRETURNING\b/i.test(s)) return s;

    const m = s.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
    const table = (m && m[1]) ? m[1].toLowerCase() : null;
    const pkMap = {
        usuarios: 'id_usuario',
        atletas: 'id_atleta',
        pagos: 'id_pago',
        notificaciones: 'id_notificacion',
        noticias: 'id_noticia',
        eventos: 'id_evento'
    };
    const pk = pkMap[table] || 'id';
    return s.replace(/;?\s*$/, '') + ` RETURNING ${pk}`;
}

function buildMeta(result, originalSql) {
    const rows = result.rows || [];
    const rowCount = typeof result.rowCount === 'number' ? result.rowCount : rows.length;
    const isInsert = /^\s*INSERT/i.test(originalSql);
    const isUpdateOrDelete = /^\s*(UPDATE|DELETE)/i.test(originalSql);

    let insertId = 0;
    if (isInsert && rows[0]) {
        const first = rows[0];
        insertId =
            first.id_usuario ||
            first.id_atleta ||
            first.id_pago ||
            first.id_notificacion ||
            first.id_noticia ||
            first.id_evento ||
            first.id ||
            0;
    }

    // Forma ResultSetHeader-like de mysql2 para INSERTs/UPDATEs
    if (isInsert || isUpdateOrDelete) {
        return {
            insertId: Number(insertId) || 0,
            affectedRows: rowCount,
            rowCount
        };
    }
    return { insertId: 0, affectedRows: 0, rowCount };
}

function runQuery(sql, params = []) {
    const original = sql;
    const withReturning = ensureReturning(original);
    const text = toPgParams(withReturning);
    return pool.query(text, params).then((result) => {
        const meta = buildMeta(result, original);
        const isWrite = /^\s*(INSERT|UPDATE|DELETE)/i.test(original);
        // mysql2: SELECT → rows[]; INSERT/UPDATE → ResultSetHeader
        if (isWrite) {
            return { rows: result.rows, meta };
        }
        return { rows: result.rows, meta };
    });
}

/** API estilo mysql2 callback */
function query(sql, params, cb) {
    if (typeof params === 'function') {
        cb = params;
        params = [];
    }
    params = params || [];

    runQuery(sql, params)
        .then(({ rows, meta }) => {
            const isWrite = /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
            if (typeof cb === 'function') {
                // mysql2: (err, results) — results es array en SELECT, header en write
                cb(null, isWrite ? meta : rows);
            }
        })
        .catch((err) => {
            // Mapear unique violation a código que algunos controllers miran
            if (err && err.code === '23505') {
                err.code = 'ER_DUP_ENTRY';
            }
            console.error('DB ERROR:', err.code, err.message);
            if (typeof cb === 'function') cb(err);
        });
}

/** API estilo mysql2.promise() */
function promiseQuery(sql, params = []) {
    return runQuery(sql, params).then(({ rows, meta }) => {
        const isWrite = /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
        // mysql2 promise: [rows|ResultSetHeader, fields]
        return [isWrite ? meta : rows, undefined];
    }).catch((err) => {
        if (err && err.code === '23505') err.code = 'ER_DUP_ENTRY';
        throw err;
    });
}

const db = {
    query,
    promise() {
        return { query: promiseQuery };
    },
    pool
};

// Ping al arrancar (no tumba Vercel)
if (connectionString) {
    pool.query('SELECT 1')
        .then(() => console.log('✅ CONEXIÓN EXITOSA A SUPABASE (Postgres)'))
        .catch((err) => console.error('❌ ERROR DE CONEXIÓN A BD:', err.code, err.message));
}

module.exports = db;
