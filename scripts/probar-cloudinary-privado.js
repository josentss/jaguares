#!/usr/bin/env node
'use strict';
require('dotenv').config();

// Prueba manual explícita con activos SINTÉTICOS. NO consulta Supabase,
// NO cambia los archivos históricos y NO activa cargas privadas en Vercel.
const cloudinary = require('cloudinary').v2;
const { randomUUID } = require('node:crypto');
const { deflateSync } = require('node:zlib');
const { analizarAssetGuardado, enlaceAutorizado } = require('../utils/cloudinaryPrivado');

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function partePng(tipo, datos) {
    const tipoBuffer = Buffer.from(tipo, 'ascii');
    const longitud = Buffer.alloc(4);
    longitud.writeUInt32BE(datos.length, 0);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([tipoBuffer, datos])), 0);
    return Buffer.concat([longitud, tipoBuffer, datos, checksum]);
}

function pngSintetico() {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(4, 0);
    ihdr.writeUInt32BE(4, 4);
    ihdr[8] = 8; // profundidad
    ihdr[9] = 2; // RGB
    const fila = Buffer.from([0, ...Array.from({ length: 4 }, () => [40, 140, 180]).flat()]);
    return Buffer.concat([
        Buffer.from('89504e470d0a1a0a', 'hex'),
        partePng('IHDR', ihdr),
        partePng('IDAT', deflateSync(Buffer.concat(Array(4).fill(fila)))),
        partePng('IEND', Buffer.alloc(0))
    ]);
}

function pdfSintetico() {
    const texto = 'BT /F1 14 Tf 30 140 Td (Prueba sintetica Jaguares) Tj ET';
    const objetos = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        '<< /Length ' + Buffer.byteLength(texto) + ' >>\nstream\n' + texto + '\nendstream',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    let archivo = '%PDF-1.4\n';
    const desplazamientos = [0];
    for (let i = 0; i < objetos.length; i++) {
        desplazamientos.push(Buffer.byteLength(archivo));
        archivo += (i + 1) + ' 0 obj\n' + objetos[i] + '\nendobj\n';
    }
    const xref = Buffer.byteLength(archivo);
    archivo += 'xref\n0 ' + (objetos.length + 1) + '\n0000000000 65535 f \n';
    for (const pos of desplazamientos.slice(1)) {
        archivo += String(pos).padStart(10, '0') + ' 00000 n \n';
    }
    archivo += 'trailer\n<< /Root 1 0 R /Size ' + (objetos.length + 1) +
        ' >>\nstartxref\n' + xref + '\n%%EOF\n';
    return Buffer.from(archivo, 'ascii');
}

const PRUEBAS = Object.freeze([
    { nombre: 'foto', carpeta: 'jaguares/atletas', extension: 'png', mime: 'image/png' },
    { nombre: 'documento_pdf', carpeta: 'jaguares/atletas', extension: 'pdf', mime: 'application/pdf' },
    { nombre: 'comprobante', carpeta: 'jaguares_comprobantes', extension: 'png', mime: 'image/png' }
]);

function configPresente(env) {
    return ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
        .every(key => typeof env[key] === 'string' && !!env[key].trim());
}

function datosSinteticos(prueba) {
    return prueba.extension === 'pdf' ? pdfSintetico() : pngSintetico();
}

function esContenidoEsperado(bytes, extension) {
    const buffer = Buffer.from(bytes);
    if (extension === 'pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    return buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
}

function categoriaError(error) {
    if (error && typeof error.code === 'string' && /^[A-Z_]{2,32}$/.test(error.code)) {
        return error.code;
    }
    return 'PRUEBA_INCOMPLETA';
}

async function comprobarRespuesta(url, fetcher, extension, debeEstarDisponible) {
    const respuesta = await fetcher(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
        headers: { 'Cache-Control': 'no-cache' }
    });
    if (!debeEstarDisponible) return [401, 403, 404].includes(respuesta.status);
    if (respuesta.status !== 200) return false;
    return esContenidoEsperado(await respuesta.arrayBuffer(), extension);
}

async function pruebaSintetica({
    client = cloudinary,
    fetcher = fetch,
    env = process.env,
    crearId = randomUUID,
    firmar = enlaceAutorizado
} = {}) {
    const resultado = {
        modo: 'ejecucion_explicita', aprobada: false,
        pruebas: [], limpieza: { eliminados: 0, pendientes: 0 }
    };
    if (!configPresente(env)) {
        resultado.error = 'CONFIG_FALTANTE';
        return resultado;
    }
    const cloud = env.CLOUDINARY_CLOUD_NAME;
    if (!/^[a-zA-Z0-9_-]+$/.test(cloud)) {
        resultado.error = 'CLOUD_INVALIDO';
        return resultado;
    }
    // Debe coincidir con el nombre configurado que utiliza cloudinaryPrivado.
    if (process.env.CLOUDINARY_CLOUD_NAME !== cloud) {
        resultado.error = 'CLOUD_DISTINTO';
        return resultado;
    }

    client.config({
        cloud_name: cloud,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET
    });
    const creados = [];
    let fallo = null;

    try {
        for (const prueba of PRUEBAS) {
            const id = String(crearId()).replace(/[^a-zA-Z0-9_-]/g, '');
            if (id.length < 10 || id.length > 90) throw Object.assign(new Error('ID inválido'), { code: 'ID_INVALIDO' });
            const publicId = prueba.carpeta + '/_pruebas_privacidad/jaguares_test_' + id + '_' + prueba.nombre;
            const contenido = datosSinteticos(prueba);
            const datos = 'data:' + prueba.mime + ';base64,' + contenido.toString('base64');
            const subido = await client.uploader.upload(datos, {
                public_id: publicId,
                overwrite: false,
                resource_type: 'image',
                type: 'authenticated',
                tags: ['jaguares_pruebas_privacidad']
            });
            // Se marca para limpieza únicamente lo creado por esta ejecución.
            if (!subido || subido.public_id !== publicId ||
                subido.type !== 'authenticated' || subido.resource_type !== 'image') {
                throw Object.assign(new Error('Metadata inesperada'), { code: 'METADATA_INCORRECTA' });
            }
            creados.push({ publicId, resource_type: 'image' });

            const asset = analizarAssetGuardado(subido.secure_url, prueba.carpeta);
            if (!asset || asset.delivery_type !== 'authenticated' ||
                asset.public_id !== publicId || asset.format !== prueba.extension) {
                throw Object.assign(new Error('URL del asset no reconocida'), { code: 'URL_INCOMPATIBLE' });
            }
            const metadata = await client.api.resource(publicId, {
                resource_type: 'image', type: 'authenticated'
            });
            if (metadata.type !== 'authenticated' || metadata.public_id !== publicId) {
                throw Object.assign(new Error('Metadata de Admin API distinta'), { code: 'METADATA_INCORRECTA' });
            }

            const sinFirma = await comprobarRespuesta(subido.secure_url, fetcher, prueba.extension, false);
            const firmado = await comprobarRespuesta(
                firmar(subido.secure_url, prueba.carpeta, Date.now()),
                fetcher, prueba.extension, true
            );
            const vencido = await comprobarRespuesta(
                firmar(subido.secure_url, prueba.carpeta, Date.now() - 360000),
                fetcher, prueba.extension, false
            );
            resultado.pruebas.push({
                tipo: prueba.nombre,
                metadata: 'authenticated',
                sin_firma_bloqueado: sinFirma,
                firmado_descargable: firmado,
                vencido_bloqueado: vencido
            });
            if (!sinFirma || !firmado || !vencido) {
                throw Object.assign(new Error('Comprobación de entrega fallida'), { code: 'ENTREGA_INCORRECTA' });
            }
        }
        resultado.aprobada = true;
    } catch (error) {
        fallo = categoriaError(error);
    } finally {
        // Nunca borrar por carpeta, tag ni prefijo general: solo public_id
        // de uploads confirmados en la ejecución actual.
        for (const asset of creados.reverse()) {
            try {
                const borrado = await client.uploader.destroy(asset.publicId, {
                    type: 'authenticated', resource_type: asset.resource_type, invalidate: true
                });
                if (borrado.result === 'ok') resultado.limpieza.eliminados++;
                else resultado.limpieza.pendientes++;
            } catch {
                resultado.limpieza.pendientes++;
            }
        }
    }
    if (fallo) resultado.error = fallo;
    if (resultado.limpieza.pendientes) {
        resultado.aprobada = false;
        resultado.error = resultado.error || 'LIMPIEZA_PENDIENTE';
    }
    return resultado;
}

async function main() {
    if (!process.argv.includes('--ejecutar')) {
        process.stdout.write(JSON.stringify({
            modo: 'sin_cambios',
            mensaje: 'No se subio ni elimino ningun archivo. Usar --ejecutar para probar solo archivos sinteticos.',
            credenciales_presentes: configPresente(process.env)
        }, null, 2) + '\n');
        return;
    }
    const resultado = await pruebaSintetica();
    // No imprimir error.message, URL, identificadores ni secretos.
    process.stdout.write(JSON.stringify(resultado, null, 2) + '\n');
    if (!resultado.aprobada) process.exitCode = 1;
}

if (require.main === module) {
    main().catch(() => {
        console.error('Prueba sintetica incompleta. No compartir logs con credenciales.');
        process.exitCode = 1;
    });
}

module.exports = { pngSintetico, pdfSintetico, pruebaSintetica, configPresente, esContenidoEsperado };
