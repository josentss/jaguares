const db = require('../config/db');

class ErrorIntegridad extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// All application identity writers share this transaction-scoped lock. Unlike
// an in-memory mutex it coordinates different Node/Vercel processes. It does not
// replace constraints against SQL writers outside these application paths.
async function conIdentidades(operacion) {
    const client = await db.pool.connect();
    let descartar;
    let commitIniciado = false;
    try {
        await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query('SELECT pg_advisory_xact_lock(74219, 1)');
        const resultado = await operacion(client);
        commitIniciado = true;
        await client.query('COMMIT');
        return resultado;
    } catch (error) {
        let rollbackConfirmado = false;
        try {
            await client.query('ROLLBACK');
            rollbackConfirmado = true;
        } catch (rollbackError) { descartar = rollbackError; }
        // El estado tras iniciar COMMIT es potencialmente ambiguo si se
        // perdió la conexión. Solo autorizar compensación antes de COMMIT
        // y cuando PostgreSQL haya confirmado el ROLLBACK.
        if (error && typeof error === 'object') {
            error.compensacionConfirmada = !commitIniciado && rollbackConfirmado;
        }
        throw error;
    } finally {
        client.release(descartar);
    }
}

async function comprobarUsuario(client, { correo, cedula, excluirId = null }) {
    const { rows } = await client.query(`
        SELECT id_usuario FROM usuarios
        WHERE ($1::text IS NOT NULL AND LOWER(TRIM(correo)) = $1)
           OR ($2::text IS NOT NULL AND UPPER(TRIM(cedula)) = $2
               AND ($3::integer IS NULL OR id_usuario <> $3))
        LIMIT 1`, [correo || null, cedula || null, excluirId]);
    if (rows.length) throw new ErrorIntegridad(409, 'Ese correo o cédula ya están registrados');
}

function responderError(res, error) {
    if (error instanceof ErrorIntegridad) {
        return res.status(error.status).json({ success: false, message: error.message });
    }
    if (['23505', 'ER_DUP_ENTRY'].includes(error.code)) {
        return res.status(409).json({ success: false, message: 'Ese correo o cédula ya están registrados' });
    }
    // Never log SQL parameters, document URLs or PostgreSQL detail (may hold PII).
    console.error('Error de integridad:', error.code || 'INTERNAL');
    const status = ['55P03', '40P01', '40001'].includes(error.code) ? 503 : 500;
    return res.status(status).json({ success: false, message: status === 503
        ? 'Registro ocupado. Inténtalo de nuevo.' : 'No se pudo completar la operación' });
}

module.exports = { conIdentidades, comprobarUsuario, ErrorIntegridad, responderError };
