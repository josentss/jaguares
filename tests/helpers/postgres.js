const { randomBytes } = require('node:crypto');

function validarDestinoTemporal(connectionString) {
    let destino;
    try { destino = new URL(connectionString); } catch { /* Denegar antes de importar config/db. */ }
    if (!destino || !['postgres:', 'postgresql:'].includes(destino.protocol) ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(destino.hostname) ||
        destino.pathname !== '/jaguares_test' ||
        [...destino.searchParams].some(([clave, valor]) => clave !== 'sslmode' || valor !== 'disable')) {
        throw new Error('Las pruebas requieren DATABASE_URL explícita: PostgreSQL local desechable, base jaguares_test');
    }
}

function configurarPostgresTemporal() {
    validarDestinoTemporal(process.env.DATABASE_URL);
    const esquema = `jaguares_test_${randomBytes(12).toString('hex')}`;
    process.env.PGOPTIONS = `-c search_path=${esquema}`;
    return esquema;
}

module.exports = { validarDestinoTemporal, configurarPostgresTemporal };
