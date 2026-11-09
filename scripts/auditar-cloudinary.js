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

// Conexión única: config/db.js hace un ping al importarse, y enmascara
// errores locales. Este script abre solo una sesión de lectura.
const { diagnosticoEntorno, clasificarError, DESCRIPCIONES } = require('../utils/diagnosticoInventario');

async function auditar({ entorno = process.env, crearCliente, escribir = texto => process.stdout.write(texto) } = {}) {
    const estado = diagnosticoEntorno(entorno);
    if (estado.database_url === 'ausente' || estado.cloudinary_cloud_name === 'ausente') {
        throw Object.assign(new Error('Falta configuración'), {
            fase: 'configuracion', categoria: 'CONFIG_FALTANTE'
        });
    }
    if (estado.tipo_conexion === 'configuracion_invalida') {
        throw Object.assign(new Error('URL de configuración inválida'), {
            fase: 'configuracion', categoria: 'CONFIG_INVALIDA'
        });
    }

    let cliente;
    let transaccion = false;
    let fase = 'conexion';
    try {
        const fabrica = crearCliente || (opciones => new (require('pg').Client)(opciones));
        cliente = fabrica({
            connectionString: entorno.DATABASE_URL.trim(),
            // Mantiene la configuración TLS de config/db.js.
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 20000
        });
        await cliente.connect();
        await cliente.query('BEGIN READ ONLY');
        transaccion = true;

        fase = 'consulta_atletas';
        const atletas = await cliente.query(
            'SELECT foto_url, cedula_archivo_url, partida_nacimiento_url FROM atletas'
        );
        fase = 'consulta_pagos';
        const pagos = await cliente.query('SELECT ruta_captura FROM pagos');
        const resultado = resumir([
            ['fotos', 'jaguares/atletas', atletas.rows.map(row => row.foto_url)],
            ['cedulas', 'jaguares/atletas', atletas.rows.map(row => row.cedula_archivo_url)],
            ['partidas', 'jaguares/atletas', atletas.rows.map(row => row.partida_nacimiento_url)],
            ['comprobantes', 'jaguares_comprobantes', pagos.rows.map(row => row.ruta_captura)]
        ]);
        fase = 'cierre_lectura';
        await cliente.query('ROLLBACK');
        transaccion = false;
        escribir(JSON.stringify({
            descripcion: 'Resumen anonimizado de URLs guardadas. Solo lectura; SIN migracion.',
            advertencia: 'Verificar metadata real y CDN antes de cambiar assets.',
            colecciones: resultado
        }, null, 2) + '\n');
        return resultado;
    } catch (original) {
        // Nunca incluir error.message/stack ni URL/hostname/credenciales en
        // el diagnóstico. Solo una categoría de un catálogo finito.
        const diagnostico = clasificarError(original, fase);
        throw Object.assign(new Error('Inventario no completado'), diagnostico);
    } finally {
        if (cliente) {
            if (transaccion) {
                try { await cliente.query('ROLLBACK'); } catch {}
            }
            try { await cliente.end(); } catch {}
        }
    }
}

if (require.main === module) {
    if (process.argv.includes('--diagnostico')) {
        // No conecta con Supabase ni imprime hostname o contraseñas.
        process.stdout.write(JSON.stringify(diagnosticoEntorno(), null, 2) + '\n');
    } else {
        auditar().catch(error => {
            const fase = typeof error.fase === 'string' &&
                /^[a-z_]{1,40}$/.test(error.fase) ? error.fase : 'configuracion';
            const categoria = Object.hasOwn(DESCRIPCIONES, error.categoria)
                ? error.categoria : 'CONFIG_INVALIDA';
            console.error('Inventario no completado: etapa=' + fase +
                ' categoria=' + categoria + '. ' + DESCRIPCIONES[categoria]);
            process.exitCode = 1;
        });
    }
}

module.exports = { clasificar, resumir, auditar };
