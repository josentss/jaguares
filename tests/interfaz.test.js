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
            if (pathname === '/api/auth/me') {
                const esDirectiva = (req.headers.referer || '').includes('panel-directiva.html');
                return json(res, {
                    success: true,
                    usuario: { id_usuario: esDirectiva ? 9 : 5,
                        rol: esDirectiva ? 'directiva' : 'representante',
                        nombres: 'Prueba', apellidos: esDirectiva ? 'Directiva' : 'Representante' }
                });
            }
            if (pathname === '/api/directiva/auditoria') return json(res, {
                metricas: {activos: 1, espera: 0, pagos_pendientes: 1},
                tasa_bcv: 36.5, tasa_fecha: null,
                atletas: [{
                    id_atleta: 11, id_representante: 5,
                    nombres: atletaXss, apellidos: 'Activo', estado: 'espera',
                    fecha_nac: '2011-02-01', rep_nombres: atletaXss,
                    rep_apellidos: 'Representante', rep_telefono1: null
                }],
                pagos: [{
                    id_pago: 1, id_representante: 5, atl_nombres: atletaXss,
                    atl_apellidos: 'Activo', mes_pagado: 'Noviembre',
                    metodo_pago: 'Efectivo', fecha_pago: '2026-11-02',
                    monto: '25.50', moneda: 'USD', estado_pago: 'pendiente'
                }]
            });
            if (pathname === '/api/directiva/pendientes') return json(res, {
                success: true, datos: [{id_usuario: 21, nombres: atletaXss,
                    apellidos: 'Pendiente', correo: 'rep@example.org'}]
            });
            if (pathname === '/api/cms/admin/eventos') return json(res, {
                success: true, eventos: []
            });
            if (pathname === '/api/directiva/atleta/estado') {
                res.writeHead(409, {'Content-Type': 'application/json'});
                return res.end(JSON.stringify({
                    success: false,
                    message: 'No se puede activar <img src=x onerror=alert(1)>'
                }));
            }
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

for (const dispositivo of [
    {nombre: 'escritorio', viewport: {width: 1440, height: 900}},
    {nombre: 'movil', viewport: {width: 390, height: 844}}
]) {
    test('directiva ' + dispositivo.nombre + ': datos seguros y mensaje de rechazo', async () => {
        const browser = await chromium.launch({headless: true});
        const page = await browser.newPage({viewport: dispositivo.viewport});
        await page.route('https://**/*', route => route.abort());
        const errores = [];
        page.on('pageerror', err => errores.push(err.message));
        page.on('dialog', dialog => dialog.accept());
        try {
            await page.goto(baseUrl + '/admin/panel-directiva.html');
            await page.waitForFunction(() => document.querySelector('.js-atleta-estado'));
            assert.equal(await page.locator('#body-atletas img').count(), 0);
            assert.equal(await page.locator('#body-solicitudes img').count(), 0);
            assert.equal(await page.locator('#body-pagos img').count(), 0);
            assert.equal(await page.locator('.js-atleta-estado').first().getAttribute('onclick'), null);
            await page.evaluate(() => document.querySelector('.js-atleta-estado').click());
            await page.waitForFunction(() =>
                document.querySelector('.toast-message')?.textContent.includes('No se puede activar')
            );
            assert.equal(await page.locator('#toast-container img').count(), 0);
            await fs.mkdir('test-artifacts', {recursive: true});
            await page.screenshot({
                path: 'test-artifacts/directiva-' + dispositivo.nombre + '.png',
                fullPage: true
            });
            assert.deepEqual(errores, []);
        } finally { await browser.close(); }
    });
}
