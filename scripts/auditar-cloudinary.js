#!/usr/bin/env node
'use strict';

// El script se ejecuta directamente desde la terminal, fuera del arranque de
// Express. Debe cargar el .env local antes de verificar la configuración.
require('dotenv').config();

// Inventario SIN ESCRITURAS: no imprime URL, public_id, ID de atleta,
// cédula, datos bancarios ni otros datos personales.
const { analizarAssetGuardado } = require('../utils/cloudinaryPrivado');

function clasificar(url, carpeta) {
    if (url === null || url === undefined || url === '') return 'sin_archivo';
    const asset = analizarAssetGuardado(url, carpeta);
    if (asset) return asset.delivery_type === 'authenticated' ? 'autenticado' : 'publico';
    if (carpeta === 'jaguares_comprobantes' &&
        typeof url === 'string' && /^jaguares_comprobantes\/[a-zA-Z0-9_.-]+$/.test(url)) {
        return 'referencia_legacy_sin_url';
    }
    return 'revisar_manual';
}

function resumir(documentos) {
    const resultado = {};
    for (const [nombre, carpeta, urls] of documentos) {
        const conteo = { total: 0, sin_archivo: 0, publico: 0, autenticado: 0,
            referencia_legacy_sin_url: 0, revisar_manual: 0 };
        for (const url of urls) {
            conteo.total++;
            conteo[clasificar(url, carpeta)]++;
        }
        resultado[nombre] = conteo;
    }
    return resultado;
}

async function auditar() {
    if (!process.env.DATABASE_URL || !process.env.CLOUDINARY_CLOUD_NAME) {
        throw new Error('Configura DATABASE_URL y CLOUDINARY_CLOUD_NAME sin publicarlos.');
    }
    const db = require('../config/db');
    const cliente = await db.pool.connect();
    try {
        await cliente.query('BEGIN READ ONLY');
        const atletas = await cliente.query(
            'SELECT foto_url, cedula_archivo_url, partida_nacimiento_url FROM atletas'
        );
        const pagos = await cliente.query('SELECT ruta_captura FROM pagos');
        const resultado = resumir([
            ['fotos', 'jaguares/atletas', atletas.rows.map(row => row.foto_url)],
            ['cedulas', 'jaguares/atletas', atletas.rows.map(row => row.cedula_archivo_url)],
            ['partidas', 'jaguares/atletas', atletas.rows.map(row => row.partida_nacimiento_url)],
            ['comprobantes', 'jaguares_comprobantes', pagos.rows.map(row => row.ruta_captura)]
        ]);
        await cliente.query('ROLLBACK');
        // El inventario SOLO clasifica cadenas almacenadas. No confirma el
        // delivery type real en Cloudinary y no comprueba la caché CDN.
        process.stdout.write(JSON.stringify({
            descripcion: 'Resumen anonimizado de URLs guardadas. Solo lectura; SIN migracion.',
            advertencia: 'Verificar metadata real y CDN antes de cambiar assets.',
            colecciones: resultado
        }, null, 2) + '\n');
    } catch (error) {
        try { await cliente.query('ROLLBACK'); } catch {}
        throw error;
    } finally {
        cliente.release();
        await db.pool.end();
    }
}

if (require.main === module) {
    auditar().catch(error => {
        // No imprimir SQL ni enlaces potencialmente sensibles en errores.
        console.error('No se pudo completar el inventario de solo lectura:', error.code || 'INTERNAL');
        process.exitCode = 1;
    });
}

module.exports = { clasificar, resumir };
