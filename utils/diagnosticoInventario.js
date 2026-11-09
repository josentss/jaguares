'use strict';

// Clasificaciones FINITAS: nunca imprimen el error original, la URL, el
// hostname, la consulta SQL ni información de archivos y usuarios.
const DESCRIPCIONES = Object.freeze({
    CONFIG_FALTANTE: 'Faltan DATABASE_URL o CLOUDINARY_CLOUD_NAME en el entorno local.',
    CONFIG_INVALIDA: 'DATABASE_URL no tiene un formato PostgreSQL válido.',
    AUTENTICACION: 'La base de datos rechazó las credenciales. Revisa la conexión local.',
    BASE_INEXISTENTE: 'La base indicada no está disponible con esas credenciales.',
    DNS: 'No se pudo resolver el servidor de base de datos.',
    RED_NO_ALCANZABLE: 'La red local no pudo alcanzar el servidor de base de datos.',
    CONEXION_RECHAZADA: 'El destino rechazó la conexión de PostgreSQL.',
    TIEMPO_AGOTADO: 'La conexión o consulta superó el tiempo permitido.',
    TLS: 'No se pudo establecer la conexión segura con PostgreSQL.',
    CONEXIONES_AGOTADAS: 'No hay conexiones disponibles temporalmente.',
    TABLA_FALTANTE: 'Falta una tabla requerida por el inventario o no es accesible con ese esquema.',
    COLUMNA_FALTANTE: 'Falta una columna requerida por el inventario.',
    PERMISOS: 'El usuario PostgreSQL no tiene permisos suficientes para esta consulta.',
    ERROR_SQL: 'PostgreSQL devolvió un error SQL no clasificado.',
    CONEXION_NO_IDENTIFICADA: 'No se pudo establecer conexión; la causa requiere revisión local.',
    CONSULTA_NO_IDENTIFICADA: 'La consulta falló; se necesita diagnóstico local sin compartir datos.'
});

function codigoSinDatos(error) {
    const porRevisar = [error];
    const vistos = new Set();
    const codigos = [];
    while (porRevisar.length && vistos.size < 16) {
        const actual = porRevisar.shift();
        if (!actual || typeof actual !== 'object' || vistos.has(actual)) continue;
        vistos.add(actual);
        if (typeof actual.code === 'string' && /^[A-Za-z0-9_]{2,50}$/.test(actual.code)) {
            codigos.push(actual.code.toUpperCase());
        }
        if (actual.cause) porRevisar.push(actual.cause);
        if (Array.isArray(actual.errors)) porRevisar.push(...actual.errors.slice(0, 12));
    }
    return codigos;
}

function clasificarError(error, fase = 'conexion') {
    const codigos = codigoSinDatos(error);
    const tiene = (...valores) => valores.some(valor => codigos.includes(valor));
    let categoria;
    if (tiene('28P01','28000')) categoria = 'AUTENTICACION';
    else if (tiene('3D000')) categoria = 'BASE_INEXISTENTE';
    else if (tiene('42P01')) categoria = 'TABLA_FALTANTE';
    else if (tiene('42703')) categoria = 'COLUMNA_FALTANTE';
    else if (tiene('42501')) categoria = 'PERMISOS';
    else if (tiene('53300','53400')) categoria = 'CONEXIONES_AGOTADAS';
    else if (tiene('ENOTFOUND','EAI_AGAIN')) categoria = 'DNS';
    else if (tiene('ENETUNREACH','EHOSTUNREACH','EADDRNOTAVAIL')) categoria = 'RED_NO_ALCANZABLE';
    else if (tiene('ECONNREFUSED','ECONNRESET','EPIPE','08001','08006')) categoria = 'CONEXION_RECHAZADA';
    else if (tiene('ETIMEDOUT','ETIMEOUT','57014')) categoria = 'TIEMPO_AGOTADO';
    else if (codigos.some(c => c.startsWith('ERR_TLS_') || c.startsWith('CERT_') || c.startsWith('DEPTH_'))) {
        categoria = 'TLS';
    } else if (codigos.some(c => /^[A-Z0-9]{5}$/.test(c))) categoria = 'ERROR_SQL';
    else categoria = fase === 'conexion' ? 'CONEXION_NO_IDENTIFICADA' : 'CONSULTA_NO_IDENTIFICADA';
    return { fase, categoria, explicacion: DESCRIPCIONES[categoria] };
}

function tipoConexion(url) {
    try {
        const parsed = new URL(url);
        if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
            return 'configuracion_invalida';
        }
        const host = parsed.hostname.toLowerCase();
        if (host.endsWith('.pooler.supabase.com')) {
            if (parsed.port === '5432') return 'pooler_sesion_ipv4';
            if (parsed.port === '6543') return 'pooler_transaccion_ipv4';
            return 'pooler_puerto_no_identificado';
        }
        if (/^db\.[a-z0-9-]+\.supabase\.co$/.test(host)) return 'directa_ipv6_habitual';
        return 'otro_postgresql';
    } catch {
        return 'configuracion_invalida';
    }
}

function diagnosticoEntorno(entorno = process.env) {
    // Nunca exponer el contenido de variables de entorno ni hostname.
    const tieneDatabase = typeof entorno.DATABASE_URL === 'string' && !!entorno.DATABASE_URL.trim();
    const tieneCloud = typeof entorno.CLOUDINARY_CLOUD_NAME === 'string' && !!entorno.CLOUDINARY_CLOUD_NAME.trim();
    return {
        database_url: tieneDatabase ? 'presente' : 'ausente',
        cloudinary_cloud_name: tieneCloud ? 'presente' : 'ausente',
        tipo_conexion: tieneDatabase ? tipoConexion(entorno.DATABASE_URL) : 'sin_configurar'
    };
}

module.exports = { clasificarError, tipoConexion, diagnosticoEntorno, DESCRIPCIONES };
