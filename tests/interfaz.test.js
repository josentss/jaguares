const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const raiz = path.resolve(__dirname, '../public');
const atletaXss = '<img src=x onerror=alert(1)>';
const atletas = [
    { id_atleta: 11, nombres: atletaXss, apellidos: 'Activo', cedula: 'V-12345678', estado: 'activo' },
    { id_atleta: 12, nombres: 'Atleta', apellidos: 'Inactivo', cedula: 'V-12345679', estado: 'inactivo' },
    { id_atleta: 13, nombres: 'Atleta', apellidos: 'Pendiente', cedula: 'V-12345680', estado: 'espera' }
];
const json = (res, data) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
};
let server;
let baseUrl;

test.before(async () => {
    server = http.createServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname.startsWith('/api/')) {
            const soloInactivos = (req.headers.referer || '').includes('inactivos=1');
            if (pathname === '/api/auth/me') return json(res, {
                success: true, usuario: { id_usuario: 5, rol: 'representante',
                    nombres: 'Prueba', apellidos: 'Representante' }
            });
            if (pathname === '/api/usuarios/perfil/5') return json(res, {
                success: true, perfil: { nombres: 'Prueba', apellidos: 'Representante',
                    cedula: 'V-12345678', telefono1: '04141234567', correo: 'rep@example.org' }
            });
            if (pathname === '/api/atletas/representante/5') return json(res, {
                success: true, atletas: soloInactivos ? atletas.slice(1) : atletas
            });
            if (pathname === '/api/pagos/historial/5') return json(res, {
                success: true, datos: [{
                    id_pago: 1, atl_nombres: atletaXss, atl_apellidos: 'Activo',
                    mes_pagado: 'Noviembre', monto: '25.50', moneda: 'USD',
                    estado_pago: 'pendiente', fecha_pago: '2026-11-02'
                }]
            });
            if (pathname === '/api/notificaciones/5') return json(res, { success: true, notificaciones: [] });
            return json(res, { success: true });
        }
        const archivo = path.resolve(raiz, '.' + decodeURI(pathname === '/' ? '/index.html' : pathname));
        if (!archivo.startsWith(raiz + path.sep)) {
            res.writeHead(403); return res.end();
        }
        try {
            const data = await fs.readFile(archivo);
            const ext = path.extname(archivo);
            const tipo = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.ico': 'image/x-icon', '.png': 'image/png' }[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': tipo + '; charset=utf-8' });
            res.end(data);
        } catch {
            res.writeHead(404); res.end('No encontrado');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = 'http://127.0.0.1:' + server.address().port;
});

test.after(async () => { await new Promise(resolve => server.close(resolve)); });

async function abrirPanel(viewport, query = '') {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport });
    await page.route('https://**/*', route => route.abort());
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.goto(baseUrl + '/admin/panel-representante.html' + query);
    await page.waitForFunction(() => document.querySelectorAll('#table-my-atletas tbody tr').length >= 2);
    return {browser, page, errores};
}

for (const dispositivo of [
    {nombre: 'escritorio', viewport: {width: 1440, height: 900}},
    {nombre: 'movil', viewport: {width: 390, height: 844}}
]) {
    test('representante ' + dispositivo.nombre + ': solo atletas activos y datos sin XSS', async () => {
        const {browser, page, errores} = await abrirPanel(dispositivo.viewport);
        try {
            const opciones = await page.locator('#pay-atleta option').allTextContents();
            assert.equal(opciones.length, 2);
            assert.ok(opciones.some(x => x.includes(atletaXss)));
            assert.equal(opciones.some(x => x.includes('Inactivo')), false);
            assert.equal(opciones.some(x => x.includes('Pendiente')), false);
            assert.equal(await page.locator('#table-my-atletas tbody img').count(), 0);
            await page.waitForFunction(() =>
                document.querySelector('#table-my-pagos tbody')?.textContent.includes('Noviembre')
            );
            assert.equal(await page.locator('#table-my-pagos tbody img').count(), 0);
            assert.equal(await page.locator('#form-report-pago button[type=submit]').isDisabled(), false);
            await fs.mkdir('test-artifacts', {recursive: true});
            await page.screenshot({path: 'test-artifacts/representante-' + dispositivo.nombre + '.png', fullPage: true});
            assert.deepEqual(errores, []);
        } finally { await browser.close(); }
    });
}

test('sin atletas activos: deshabilitar reporte en pantalla', async () => {
    const {browser, page, errores} = await abrirPanel({width: 1440, height: 900}, '?inactivos=1');
    try {
        assert.equal(await page.locator('#pay-atleta option').count(), 1);
        assert.equal(await page.locator('#form-report-pago button[type=submit]').isDisabled(), true);
        assert.deepEqual(errores, []);
    } finally { await browser.close(); }
});
