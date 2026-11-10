'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const codigoVisor = fs.readFileSync(path.join(__dirname, '../public/admin/comprobantes-ui.js'), 'utf8');

function prepararVisor(resolverSolicitud) {
    const elementos = new Map();
    for (const clase of ['.comprobante-dialog-estado', '.comprobante-dialog-imagen',
        '.comprobante-dialog-abrir', '.comprobante-dialog-cerrar']) {
        elementos.set(clase, {
            hidden: true,
            textContent: '',
            attrs: {},
            addEventListener(nombre, callback) { this['on' + nombre] = callback; },
            removeAttribute(nombre) { delete this.attrs[nombre]; },
            setAttribute(nombre, valor) { this.attrs[nombre] = valor; },
            set src(valor) { this.attrs.src = valor; },
            get src() { return this.attrs.src; },
            set href(valor) { this.attrs.href = valor; },
            get href() { return this.attrs.href; }
        });
    }
    const dialogo = {
        open: false,
        innerHTML: '',
        eventos: {},
        setAttribute() {},
        querySelector(clase) { return elementos.get(clase); },
        addEventListener(nombre, fn) { this.eventos[nombre] = fn; },
        showModal() { this.open = true; },
        close() { this.open = false; this.eventos.close?.(); }
    };
    const solicitudes = [];
    const window = {
        apiFetch: async ruta => {
            solicitudes.push(ruta);
            const respuesta = await resolverSolicitud(ruta);
            return {
                ok: respuesta.status >= 200 && respuesta.status < 300,
                json: async () => respuesta.data
            };
        }
    };
    vm.runInNewContext(codigoVisor, {
        document: {createElement: () => dialogo, body: {appendChild() {}}},
        window,
        Number,
        Object,
        Error,
        Promise
    }, {filename: 'comprobantes-ui.js'});
    return {window, dialogo, elementos, solicitudes};
}

for (const [nombre, url] of [
    ['authenticated', 'https://api.cloudinary.com/v1_1/solo-pruebas/image/download?public_id=privado&api_key=ejemplo'],
    ['histórico upload', 'https://res.cloudinary.com/solo-pruebas/image/upload/v1/jaguares_comprobantes/anterior.png']
]) {
    test('visor ' + nombre + ': usa exclusivamente la ruta interna autorizada', async () => {
        const visor = prepararVisor(async () => ({status: 200, data: {success: true, url}}));
        await visor.window.JaguaresComprobantes.abrir(21);
        const imagen = visor.elementos.get('.comprobante-dialog-imagen');
        const enlace = visor.elementos.get('.comprobante-dialog-abrir');
        assert.deepEqual(visor.solicitudes, ['/api/pagos/captura/21']);
        assert.equal(imagen.src, '/api/pagos/captura/21?abrir=1');
        assert.equal(enlace.href, '/api/pagos/captura/21?abrir=1');
        assert.equal(enlace.hidden, false);
        assert.equal(imagen.referrerPolicy, 'no-referrer');
        assert.equal(visor.dialogo.open, true);
        imagen.onload();
        assert.equal(imagen.hidden, false);
        assert.equal(visor.elementos.get('.comprobante-dialog-estado').textContent, '');
        visor.dialogo.close();
        assert.equal(imagen.src, undefined);
        assert.equal(enlace.href, undefined);
    });
}

for (const [nombre, status, mensaje] of [
    ['ajeno', 403, 'No tienes permiso para ver este comprobante'],
    ['sin sesión', 401, 'Acceso denegado. Inicia sesión.'],
    ['indisponible', 503, 'Comprobante no disponible']
]) {
    test('visor ' + nombre + ': no construye enlaces de apertura tras rechazo', async () => {
        const visor = prepararVisor(async () => ({status, data: {success: false, message: mensaje}}));
        await visor.window.JaguaresComprobantes.abrir(21);
        assert.deepEqual(visor.solicitudes, ['/api/pagos/captura/21']);
        assert.equal(visor.elementos.get('.comprobante-dialog-estado').textContent, mensaje);
        assert.equal(visor.elementos.get('.comprobante-dialog-imagen').src, undefined);
        assert.equal(visor.elementos.get('.comprobante-dialog-abrir').href, undefined);
        assert.equal(visor.elementos.get('.comprobante-dialog-abrir').hidden, true);
    });
}

test('visor: IDs inválidos no generan solicitudes', async () => {
    const visor = prepararVisor(async () => { throw new Error('no debe llamarse'); });
    await visor.window.JaguaresComprobantes.abrir('no-es-numero');
    await visor.window.JaguaresComprobantes.abrir(0);
    assert.deepEqual(visor.solicitudes, []);
});

test('visor: una respuesta tardía no reabre un comprobante después de cerrar', async () => {
    let resolver;
    const visor = prepararVisor(() => new Promise(resolve => { resolver = resolve; }));
    const promesa = visor.window.JaguaresComprobantes.abrir(21);
    visor.dialogo.close();
    resolver({status: 200, data: {success: true, url: 'https://api.cloudinary.com/download'}});
    await promesa;
    assert.equal(visor.elementos.get('.comprobante-dialog-imagen').src, undefined);
    assert.equal(visor.elementos.get('.comprobante-dialog-abrir').href, undefined);
});
