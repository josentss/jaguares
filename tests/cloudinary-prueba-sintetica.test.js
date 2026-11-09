'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const {
    pngSintetico, pdfSintetico, pruebaSintetica, configPresente, esContenidoEsperado
} = require('../scripts/probar-cloudinary-privado');

const env = {
    CLOUDINARY_CLOUD_NAME: 'nube-sintetica',
    CLOUDINARY_API_KEY: 'clave-prueba-sintetica',
    CLOUDINARY_API_SECRET: 'secreto-prueba-sintetica'
};
process.env.CLOUDINARY_CLOUD_NAME = env.CLOUDINARY_CLOUD_NAME;
const prefijo = 'https://res.cloudinary.com/nube-sintetica/image/authenticated/v123/';

function clienteSimulado({ publicacion = 'authenticated', fallarEnSegundo = false } = {}) {
    const acciones = { subidas: [], borrados: [], lecturas: [], configuraciones: [] };
    return {
        acciones,
        config(config) { acciones.configuraciones.push(Object.keys(config).sort()); },
        uploader: {
            async upload(data, opts) {
                if (fallarEnSegundo && acciones.subidas.length === 1) {
                    throw Object.assign(new Error('no incluir secretos del proveedor'), { code: 'TEST_UPLOAD' });
                }
                assert.match(data, /^data:(image\/png|application\/pdf);base64,/);
                assert.equal(opts.overwrite, false);
                assert.equal(opts.type, 'authenticated');
                assert.ok(opts.public_id.includes('/_pruebas_privacidad/jaguares_test_'));
                acciones.subidas.push(opts.public_id);
                const ext = data.startsWith('data:application/pdf') ? 'pdf' : 'png';
                return {
                    public_id: opts.public_id,
                    type: publicacion,
                    resource_type: 'image',
                    secure_url: prefijo.replace('/authenticated/','/' + publicacion + '/') +
                        opts.public_id + '.' + ext
                };
            },
            async destroy(publicId, opts) {
                acciones.borrados.push({publicId, opts});
                return { result: 'ok' };
            }
        },
        api: {
            async resource(publicId, opts) {
                acciones.lecturas.push(publicId);
                assert.equal(opts.type, 'authenticated');
                return { public_id: publicId, type: 'authenticated' };
            }
        }
    };
}

function firmarFalso(url, carpeta, fecha) {
    assert.match(url, /^https:\/\/res\.cloudinary\.com\/nube-sintetica\/image\/authenticated\//);
    assert.ok(['jaguares/atletas', 'jaguares_comprobantes'].includes(carpeta));
    const formato = url.split('.').at(-1);
    return 'https://api.cloudinary.com/prueba/download?format=' + formato +
        '&expires_at=' + (Math.floor(fecha / 1000) + 120);
}

async function fetchSimulado(url) {
    const u = new URL(url);
    if (u.hostname === 'res.cloudinary.com') {
        return {status: 401};
    }
    assert.equal(u.hostname, 'api.cloudinary.com');
    if (Number(u.searchParams.get('expires_at')) < Math.floor(Date.now() / 1000)) {
        return {status: 401};
    }
    const contenido = u.searchParams.get('format') === 'pdf' ?
        pdfSintetico() : pngSintetico();
    return {
        status: 200,
        async arrayBuffer() { return Uint8Array.from(contenido).buffer; }
    };
}

test('PNG y PDF sintéticos contienen encabezados válidos sin datos personales', () => {
    const png = pngSintetico();
    const pdf = pdfSintetico();
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.ok(pdf.includes(Buffer.from('xref\n')));
    assert.equal(esContenidoEsperado(png, 'png'), true);
    assert.equal(esContenidoEsperado(pdf, 'pdf'), true);
    assert.equal(esContenidoEsperado(pdf, 'png'), false);
});

test('Sin --ejecutar no se sube nada aunque existan variables', () => {
    assert.equal(configPresente(env), true);
    assert.equal(configPresente({ CLOUDINARY_CLOUD_NAME: 'una-nube' }), false);
    const script = resolve(__dirname, '../scripts/probar-cloudinary-privado.js');
    const salida = execFileSync(process.execPath, [script], {
        env: { ...process.env, ...env },
        encoding: 'utf8',
        timeout: 10000
    });
    assert.equal(JSON.parse(salida).modo, 'sin_cambios');
    assert.match(salida, /No se subio ni elimino ningun archivo/);
    assert.doesNotMatch(salida, /secreto-prueba-sintetica/);
});

test('prueba completa: foto, PDF y recibo con denegación, entrega firmada, vencimiento y limpieza', async () => {
    const client = clienteSimulado();
    let consecutivo = 0;
    const res = await pruebaSintetica({
        client, env, fetcher: fetchSimulado, firmar: firmarFalso,
        crearId: () => 'prueba00000000000' + (++consecutivo)
    });
    assert.equal(res.aprobada, true, JSON.stringify(res));
    assert.equal(res.pruebas.length, 3);
    assert.equal(res.limpieza.eliminados, 3);
    assert.equal(res.limpieza.pendientes, 0);
    assert.equal(client.acciones.subidas.length, 3);
    assert.equal(client.acciones.borrados.length, 3);
    assert.ok(client.acciones.borrados.every(x =>
        x.opts.type === 'authenticated' && x.opts.invalidate === true));
    assert.ok(client.acciones.lecturas.length === 3);
    assert.ok(res.pruebas.every(x =>
        x.sin_firma_bloqueado && x.firmado_descargable && x.vencido_bloqueado));
    assert.doesNotMatch(JSON.stringify(res), /nube-sintetica|clave-prueba|secreto-prueba|prueba00000000000/);
});

test('error de metadata no elimina otros assets y limpia el creado que tenga tipo upload', async () => {
    const client = clienteSimulado({ publicacion:'upload' });
    const res = await pruebaSintetica({
        client, env, fetcher: fetchSimulado, firmar: firmarFalso,
        crearId: () => 'id_para_prueba_123456'
    });
    assert.equal(res.aprobada, false);
    assert.equal(res.error, 'METADATA_INCORRECTA');
    assert.equal(client.acciones.borrados.length, 1);
    assert.equal(client.acciones.borrados[0].opts.type, 'upload');
    assert.equal(res.limpieza.eliminados, 1);
});

test('si falla el segundo upload, limpia solo el primero y no divulga error remoto', async () => {
    const client = clienteSimulado({ fallarEnSegundo: true });
    let consecutivo = 0;
    const res = await pruebaSintetica({
        client, env, fetcher: fetchSimulado, firmar: firmarFalso,
        crearId: () => 'prueba00000000000' + (++consecutivo)
    });
    assert.equal(res.aprobada, false);
    assert.equal(res.error, 'PRUEBA_INCOMPLETA');
    assert.equal(client.acciones.subidas.length, 1);
    assert.equal(client.acciones.borrados.length, 1);
    assert.equal(res.limpieza.eliminados, 1);
    assert.doesNotMatch(JSON.stringify(res), /no incluir secretos|secreto-prueba/);
});

test('sin credenciales no se llama a Cloudinary', async () => {
    let llamado = false;
    const res = await pruebaSintetica({
        env: {CLOUDINARY_CLOUD_NAME:'nube-sintetica'},
        client: {config() {llamado=true;}}
    });
    assert.equal(res.aprobada, false);
    assert.equal(res.error, 'CONFIG_FALTANTE');
    assert.equal(llamado, false);
});
