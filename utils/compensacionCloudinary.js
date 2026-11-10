'use strict';

// El tracker vive solo en la solicitud HTTP y se alimenta de respuestas del
// adaptador Cloudinary, nunca de nombres o URLs enviados por el cliente.
const cloudinary = require('cloudinary').v2;
const db = require('../config/db');

const CLAVE = Symbol('jaguares-cargas-temporales');
const CARPETAS = new Set(['jaguares/atletas', 'jaguares_comprobantes']);
const RECURSOS = new Set(['image', 'raw']);
const TIPOS = new Set(['upload', 'authenticated']);

function estado(req) {
    if (!req[CLAVE]) req[CLAVE] = { archivos: new Map(), confirmado: false, enCurso: null };
    return req[CLAVE];
}

function identidadDeProveedor(info, carpeta) {
    if (!CARPETAS.has(carpeta) || !info || typeof info.filename !== 'string' ||
        typeof info.path !== 'string') return null;

    const nube = process.env.CLOUDINARY_CLOUD_NAME;
    const id = info.filename;
    if (!nube || !/^[A-Za-z0-9_-]+$/.test(nube) ||
        !id.startsWith(carpeta + '/') || id.length > 220) return null;

    const partesId = id.slice(carpeta.length + 1).split('/');
    if (partesId.some(p => !p || p === '.' || p === '..' || !/^[A-Za-z0-9_.-]+$/.test(p))) return null;

    let url;
    try { url = new URL(info.path); } catch { return null; }
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
        url.username || url.password || url.port || url.search || url.hash ||
        url.pathname.includes('%') || url.pathname.includes('//')) return null;
    const segmentos = url.pathname.split('/').slice(1);
    if (segmentos[0] !== nube || !RECURSOS.has(segmentos[1]) ||
        !TIPOS.has(segmentos[2]) || segmentos.length < 5) return null;

    // Solo borramos la identidad informada por Cloudinary; la ruta de entrega
    // puede diferir del public_id por la configuración de carpetas dinámicas.
    const recurso = segmentos[1];
    const tipo = segmentos[2];
    if (carpeta === 'jaguares_comprobantes' && recurso !== 'image') return null;
    if (recurso === 'raw' && !id.endsWith('.pdf')) return null;
    return { publicId: id, recurso, tipo };
}

function registrarCarga(req, info, carpeta) {
    const recurso = identidadDeProveedor(info, carpeta);
    if (!recurso) return false;
    const e = estado(req);
    if (e.confirmado) return false;
    const clave = [recurso.tipo, recurso.recurso, recurso.publicId].join(':');
    e.archivos.set(clave, recurso);
    return true;
}

function confirmarCargas(req) {
    const e = estado(req);
    e.confirmado = true;
    e.archivos.clear();
}

function avisarEstadoIncierto(req, etapa) {
    const e = req[CLAVE];
    if (e && !e.confirmado && e.archivos.size) {
        // Una conexión rota durante COMMIT/INSERT puede dejar una escritura
        // confirmada sin respuesta. JAMÁS borrar el archivo en ese escenario.
        console.warn('CLOUDINARY_COMPENSACION_REVISION_MANUAL', {
            etapa, cantidad: e.archivos.size
        });
    }
}

const SQL_REFERENCIAS = `
SELECT (
    EXISTS (
        SELECT 1 FROM atletas a
        CROSS JOIN unnest($1::text[]) AS ids(valor)
        WHERE strpos(COALESCE(a.foto_url, ''), ids.valor) > 0
           OR strpos(COALESCE(a.cedula_archivo_url, ''), ids.valor) > 0
           OR strpos(COALESCE(a.partida_nacimiento_url, ''), ids.valor) > 0
    )
    OR EXISTS (
        SELECT 1 FROM pagos p
        CROSS JOIN unnest($1::text[]) AS ids(valor)
        WHERE strpos(COALESCE(p.ruta_captura, ''), ids.valor) > 0
    )
) AS referenciado`;

function destruir(recurso) {
    return new Promise((resolve, reject) => {
        let terminado = false;
        const finalizar = (error, resultado) => {
            if (terminado) return;
            terminado = true;
            clearTimeout(limite);
            if (error) return reject(error);
            if (resultado?.result === 'ok' || resultado?.result === 'not found') {
                return resolve();
            }
            reject(new Error('Proveedor no confirmó la eliminación'));
        };
        // En serverless no bloquear indefinidamente la respuesta al usuario.
        // Un timeout NO prueba que el borrado se haya completado.
        const limite = setTimeout(() => finalizar(new Error('Tiempo de eliminación agotado')), 7000);
        try {
            cloudinary.uploader.destroy(recurso.publicId, {
                resource_type: recurso.recurso,
                type: recurso.tipo,
                invalidate: true
            }, finalizar);
        } catch (error) { finalizar(error); }
    });
}

/**
 * Best effort: compensar SOLO una operación que sabemos que NO persistió.
 * Antes de destruir, comprobar en PostgreSQL que ninguna tabla usa las IDs.
 * Si falla esa comprobación, no se borra nada (se requiere revisión manual).
 */
async function compensarCargas(req, etapa = 'fallo_validacion') {
    const e = req[CLAVE];
    if (!e || e.confirmado || !e.archivos.size) return { estado: 'sin_cargas' };
    if (e.enCurso) return e.enCurso;

    e.enCurso = (async () => {
        const archivos = [...e.archivos.entries()];
        try {
            const ids = archivos.map(([, archivo]) => archivo.publicId);
            const { rows } = await db.pool.query(SQL_REFERENCIAS, [ids]);
            if (rows?.[0]?.referenciado !== false) {
                console.warn('CLOUDINARY_COMPENSACION_CONSERVADA', { etapa, cantidad: ids.length });
                return { estado: 'referencia_o_estado_incierto' };
            }
        } catch (error) {
            console.warn('CLOUDINARY_COMPENSACION_SIN_VERIFICACION_SQL', {
                etapa, codigo: error.code || 'INTERNAL', cantidad: archivos.length
            });
            return { estado: 'pendiente_revision' };
        }

        const resultados = await Promise.allSettled(archivos.map(async ([clave, archivo]) => {
            await destruir(archivo);
            e.archivos.delete(clave);
        }));
        const pendientes = resultados.filter(r => r.status === 'rejected').length;
        if (pendientes) {
            console.warn('CLOUDINARY_COMPENSACION_FALLO_PROVEEDOR', {
                etapa, cantidad: pendientes
            });
        }
        return { estado: pendientes ? 'pendiente_revision' : 'eliminado',
            eliminados: archivos.length - pendientes, pendientes };
    })();
    try { return await e.enCurso; }
    finally { e.enCurso = null; }
}

module.exports = {
    registrarCarga, confirmarCargas, avisarEstadoIncierto, compensarCargas
};
