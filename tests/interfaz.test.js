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
                const ahora = Date.now();
                return json(res, {
                    success: true,
                    sesion: { id: 'sesion-sintetica-interfaz', servidor: ahora,
                        vence: ahora + 900000, limite: ahora + 43200000 },
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
            if (pathname === '/api/directiva/representantes') return json(res, {
                success:true,datos:[{id_usuario:5,nombres:'Prueba',apellidos:'Representante',cedula:'V-12345678',telefono1:'04141234567'}]
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

test('registro web: no permite teclear cifras en nombres y rechaza contenido pegado', async () => {
    const browser = await chromium.launch({headless: true});
    const page = await browser.newPage({viewport:{width:1360,height:900}});
    await page.route('https://**/*', route => route.abort());
    const errores = [];
    page.on('pageerror', err => errores.push(err.message));
    try {
        await page.goto(baseUrl + '/admin/login.html');
        await page.locator('#tab-register').click();
        const campo = page.locator('#reg-names');
        await campo.fill('Ana');
        await campo.press('End');
        await page.keyboard.type('123💥');
        assert.equal(await campo.inputValue(), 'Ana');
        await campo.evaluate(el => {
            el.value = 'Ana123';
            el.dispatchEvent(new Event('input', {bubbles:true}));
        });
        assert.equal(await campo.evaluate(el => el.validity.customError), true);
        await campo.fill('María José');
        assert.equal(await campo.evaluate(el => el.validity.customError), false);
        assert.deepEqual(errores, []);
    } finally { await browser.close(); }
});

test('perfil web: cédulas, teléfonos y nombres deben ser válidos', async () => {
    const {browser, page, errores} = await abrirPanel({width:390,height:844});
    try {
        await page.evaluate(() => document.querySelector('[data-target="sec-perfil"]').click());
        await page.locator('#perfil-nombres').evaluate(el => {
            el.value = 'Ana123';
            el.dispatchEvent(new Event('input', {bubbles:true}));
        });
        assert.equal(await page.locator('#perfil-nombres').evaluate(el => el.validity.customError), true);
        await page.locator('#perfil-nombres').fill('Ana María');
        assert.equal(await page.locator('#perfil-nombres').evaluate(el => el.validity.customError), false);
        await page.locator('#perfil-cedula').fill('V-12');
        assert.equal(await page.locator('#perfil-cedula').evaluate(el => el.validity.customError), true);
        await page.locator('#perfil-cedula').fill('V-12345678');
        assert.equal(await page.locator('#perfil-cedula').evaluate(el => el.validity.customError), false);
        await page.locator('#perfil-tel1').evaluate(el => {
            el.value = 'abc999';
            el.dispatchEvent(new Event('input', {bubbles:true}));
        });
        assert.equal(await page.locator('#perfil-tel1').evaluate(el => el.validity.customError), true);
        await page.locator('#perfil-tel1').fill('0414 123-4567');
        assert.equal(await page.locator('#perfil-tel1').evaluate(el => el.validity.customError), false);
        assert.deepEqual(errores, []);
    } finally { await browser.close(); }
});

test('directiva web: registro del atleta impide nombres y documentos mal formados', async () => {
    const browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    await page.route('https://**/*', route => route.abort());
    const errores = [];
    page.on('pageerror', err => errores.push(err.message));
    try {
        await page.goto(baseUrl + '/admin/panel-directiva.html');
        await page.waitForFunction(() => document.querySelector('.js-atleta-estado'));
        await page.evaluate(() => document.querySelector('[data-target="sec-registrar"]').click());
        await page.locator('#dir-nombres').evaluate(el => {
            el.value = 'Ángel123';
            el.dispatchEvent(new Event('input', {bubbles:true}));
        });
        assert.equal(await page.locator('#dir-nombres').evaluate(el => el.validity.customError), true);
        await page.locator('#dir-nombres').fill('Ángel José');
        assert.equal(await page.locator('#dir-nombres').evaluate(el => el.validity.customError), false);
        await page.locator('#dir-cedula').fill('123');
        await page.locator('#dir-cedula').press('End');
        await page.keyboard.type('a');
        assert.equal(await page.locator('#dir-cedula').inputValue(), '123');
        assert.equal(await page.locator('#dir-cedula').evaluate(el => el.validity.customError), true);
        assert.deepEqual(errores, []);
    } finally { await browser.close(); }
});


test('inscripción del representante: bloquea fecha 1908, cédula corta y datos incoherentes', async () => {
    const {browser, page, errores} = await abrirPanel({width: 1440, height: 900});
    try {
        await page.evaluate(() => document.querySelector('[data-target="sec-atletas"]').click());
        const comprobar = async (id, valor, resultado) => {
            await page.locator(id).evaluate((el, v) => {
                el.value = v;
                el.dispatchEvent(new Event('input', {bubbles: true}));
            }, valor);
            assert.equal(await page.locator(id).evaluate(el => el.validity.customError), resultado, id + ': ' + valor);
        };
        await comprobar('#atl-cedula', '578546', true);
        await comprobar('#atl-cedula', '12345678', false);
        await comprobar('#atl-fecha-nac', '1908-06-16', true);
        await comprobar('#atl-fecha-nac', '2012-06-16', false);
        await comprobar('#atl-direccion', '2356', true);
        await comprobar('#atl-direccion', 'Barrio 1', false);
        await comprobar('#atl-alergias', 's43678ikjhgf', true);
        await comprobar('#atl-alergias', 'Diabetes tipo 1, 500 mg', false);
        assert.deepEqual(errores, []);
    } finally { await browser.close(); }
});

test('inscripción desde directiva: restricción de edad y cédula de 7 dígitos', async () => {
    const browser = await chromium.launch({headless: true});
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    await page.route('https://**/*', route => route.abort());
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    try {
        await page.goto(baseUrl + '/admin/panel-directiva.html');
        await page.waitForFunction(() => document.querySelector('.js-atleta-estado'));
        await page.evaluate(() => document.querySelector('[data-target="sec-registrar"]').click());
        const fecha = page.locator('#dir-fecha-nac');
        await fecha.evaluate(el => {
            el.value = '1908-06-16';
            el.dispatchEvent(new Event('input', {bubbles: true}));
        });
        assert.equal(await fecha.evaluate(el => el.validity.customError), true);
        await fecha.evaluate(el => {
            el.value = '2012-06-16';
            el.dispatchEvent(new Event('input', {bubbles: true}));
        });
        assert.equal(await fecha.evaluate(el => el.validity.customError), false);
        await page.locator('#dir-cedula').fill('578546');
        assert.equal(await page.locator('#dir-cedula').evaluate(el => el.validity.customError), true);
        assert.deepEqual(errores, []);
    } finally { await browser.close(); }
});

test('inscripción válida del representante: el clic envía el formulario', async () => {
    const {browser,page,errores}=await abrirPanel({width:1440,height:900});
    try {
        await page.locator('[data-target="sec-atletas"]').click();
        for(const [id,valor] of Object.entries({
            'atl-nombres':'Atleta Prueba', 'atl-apellidos':'Sintético',
            'atl-cedula':'81000001', 'atl-fecha-nac':'2014-05-10',
            'atl-direccion':'Calle de pruebas 12', 'atl-telefono':'04141234567'
        })) await page.locator('#'+id).fill(valor);
        const enviada=page.waitForRequest(r=>r.url().endsWith('/api/atletas/registrar-atleta')&&r.method()==='POST',{timeout:3000});
        await page.locator('#form-add-atleta button[type=submit]').click();
        try { await enviada; }
        catch(error) {
            console.log('Diagnóstico de controles:',await page.locator('#form-add-atleta').evaluate(form=>
                [...form.elements].filter(e=>e.willValidate&&!e.validity.valid).map(e=>({id:e.id,mensaje:e.validationMessage}))));
            throw error;
        }
        assert.deepEqual(errores,[]);
    } finally {await browser.close();}
});

test('inscripción del representante: corregir cédula y teléfono eligiendo herencia permite enviar', async () => {
    const {browser,page,errores}=await abrirPanel({width:1440,height:900});
    try {
        await page.locator('[data-target="sec-atletas"]').click();
        for(const [id,valor] of Object.entries({'atl-nombres':'Hermana Prueba','atl-apellidos':'Sintético',
            'atl-fecha-nac':'2014-05-10','atl-direccion':'Calle de pruebas 12',
            'atl-cedula':'123','atl-telefono':'123'})) await page.locator('#'+id).fill(valor);
        await page.locator('#atl-has-cedula').uncheck();
        await page.locator('#atl-has-telefono').uncheck();
        const enviada=page.waitForRequest(r=>r.url().endsWith('/api/atletas/registrar-atleta')&&r.method()==='POST',{timeout:3000});
        await page.locator('#form-add-atleta button[type=submit]').click();
        try {await enviada;}
        catch(error){console.log('Controles que bloquean:',await page.locator('#form-add-atleta').evaluate(form=>
            [...form.elements].filter(e=>e.willValidate&&!e.validity.valid).map(e=>({id:e.id,mensaje:e.validationMessage}))));throw error;}
        assert.deepEqual(errores,[]);
    } finally {await browser.close();}
});

test('inscripción válida de directiva: el clic envía el formulario', async () => {
    const browser=await chromium.launch({headless:true});const page=await browser.newPage();
    await page.route('https://**/*',route=>route.abort());
    try {
        await page.goto(baseUrl+'/admin/panel-directiva.html');
        await page.locator('[data-target="sec-registrar"]').click();
        await page.selectOption('#dir-rep','5');
        for(const [id,valor] of Object.entries({'dir-nombres':'Atleta Directiva','dir-apellidos':'Sintético',
            'dir-fecha-nac':'2014-05-10','dir-direccion':'Calle de pruebas 12',
            'dir-cedula':'81000003','dir-telefono':'04141234567'})) await page.locator('#'+id).fill(valor);
        const enviada=page.waitForRequest(r=>r.url().endsWith('/api/directiva/registrar-atleta')&&r.method()==='POST',{timeout:3000});
        await page.locator('#form-dir-atleta button[type=submit]').click();
        try {await enviada;}
        catch(error){console.log('Controles directiva:',await page.locator('#form-dir-atleta').evaluate(form=>
            [...form.elements].filter(e=>e.willValidate&&!e.validity.valid).map(e=>({id:e.id,mensaje:e.validationMessage}))));throw error;}
    } finally {await browser.close();}
});

test('inscripción: recalcula errores anteriores cuando el navegador completa valores sin evento input', async () => {
    const {browser,page}=await abrirPanel({width:1440,height:900});
    try {
        await page.locator('[data-target="sec-atletas"]').click();
        for(const [id,valor] of Object.entries({'atl-nombres':'Atleta Autocompletada','atl-apellidos':'Sintético',
            'atl-fecha-nac':'2014-05-10','atl-direccion':'Calle de pruebas 12','atl-cedula':'123','atl-telefono':'123'})) {
            await page.locator('#'+id).fill(valor);
        }
        await page.evaluate(()=>{
            document.getElementById('atl-cedula').value='81000007';
            document.getElementById('atl-telefono').value='04140000001';
        });
        const enviada=page.waitForRequest(r=>r.url().endsWith('/api/atletas/registrar-atleta')&&r.method()==='POST');
        await page.locator('#form-add-atleta button[type=submit]').click();
        await enviada;
    } finally {await browser.close();}
});

async function comprobarFechasPanel(browser, { panel, timezoneId, viewport, legacy = false, sinHelper = false }) {
    const context = await browser.newContext({ viewport, timezoneId });
    const page = await context.newPage();
    const errores = [];
    const altas = [];
    page.on('pageerror', error => errores.push(error.message));
    page.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/registrar-atleta')) altas.push(request);
    });
    await page.clock.setFixedTime(new Date('2026-11-03T02:00:00Z')); // Todavía 02/11 en Caracas.
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== baseUrl) return route.abort();
        if (sinHelper && url.pathname.endsWith('/fechas.js')) return route.abort();
        if (['/api/directiva/auditoria', '/api/pagos/historial/5'].includes(url.pathname)) {
            const response = await route.fetch();
            const data = await response.json();
            const sufijo = legacy ? 'T00:00:00.000Z' : '';
            if (data.atletas) {
                data.atletas[0].fecha_nac = '2011-02-01' + sufijo;
                data.pagos[0].fecha_pago = '2026-11-02' + sufijo;
                data.tasa_fecha = '2026-11-02T00:00:00.000Z'; // Instante: 01/11 en Caracas.
            } else data.datos[0].fecha_pago = '2026-11-02' + sufijo;
            return route.fulfill({ response, json: data });
        }
        return route.continue();
    });
    try {
        await page.goto(`${baseUrl}/admin/panel-${panel}.html`);
        const directiva = panel === 'directiva';
        if (directiva) {
            await page.waitForFunction(() => document.querySelector('.js-atleta-estado'));
            assert.equal((await page.locator('#body-atletas tr').first().locator('td').nth(2).textContent()).trim(), '1/2/2011');
            assert.equal((await page.locator('#body-pagos tr').first().locator('td').nth(2).textContent()).trim(), '2/11/2026');
            assert.equal(await page.locator('#stat-tasa-fecha').textContent(), 'Fecha: 1/11/2026');
        } else {
            await page.waitForFunction(() => document.querySelector('#table-my-pagos tbody')?.textContent.includes('Noviembre'));
            assert.equal((await page.locator('#table-my-pagos tbody tr').first().locator('td').first().textContent()).trim(), '2/11/2026');
            await page.evaluate(() => document.querySelector('[data-target="sec-pagos"]').click());
            await page.locator('#pay-metodo').selectOption('Efectivo');
            assert.equal(await page.locator('#pay-fecha-efec').inputValue(), '2026-11-02');
            assert.equal(await page.locator('#pay-fecha-efec').getAttribute('max'), '2026-11-02');
        }
        if (sinHelper) assert.equal(await page.evaluate(() => typeof window.FechasJaguares), 'undefined');
        const seccion = directiva ? 'sec-registrar' : 'sec-atletas';
        await page.evaluate(id => document.querySelector(`[data-target="${id}"]`).click(), seccion);
        const prefijo = directiva ? 'dir' : 'atl';
        const formulario = directiva ? '#form-dir-atleta' : '#form-add-atleta';
        if (directiva) {
            await page.locator('#dir-rep option[value="5"]').waitFor({state:'attached'});
            await page.locator('#dir-rep').selectOption('5');
        }
        for (const [campo, valor] of Object.entries({ nombres:'Atleta Fechas', apellidos:'Sintético',
            cedula:'84000001', direccion:'Calle de pruebas 12', telefono:'04140000001' })) {
            await page.locator(`#${prefijo}-${campo}`).fill(valor);
        }
        const nacimiento = page.locator(`#${prefijo}-fecha-nac`);
        assert.equal(await nacimiento.getAttribute('min'), '2007-11-03');
        assert.equal(await nacimiento.getAttribute('max'), '2021-11-02');
        for (const invalida of ['2007-11-02', '2021-11-03']) {
            await nacimiento.fill(invalida);
            await page.locator(`${formulario} button[type=submit]`).click();
            const mensaje = page.locator(`${formulario} .form-validation-message`);
            await mensaje.waitFor({state:'visible'});
            assert.ok((await mensaje.textContent()).includes('5 y 18'));
            assert.equal(altas.length, 0, 'Una edad de 19 o de 4 años no debe enviar el formulario');
        }
        await nacimiento.fill('2007-11-03');
        assert.equal(await nacimiento.evaluate(campo => campo.validity.valid), true, '18 años cumplidos son válidos');
        await nacimiento.fill('2021-11-02');
        assert.equal(await nacimiento.evaluate(campo => campo.validity.valid), true, 'Cumplir 5 hoy es válido');
        const enviada = page.waitForRequest(request => request.method() === 'POST' &&
            request.url().endsWith('/registrar-atleta'), {timeout:5000});
        await page.locator(`${formulario} button[type=submit]`).click();
        assert.ok((await enviada).postData().includes('2021-11-02'));
        assert.equal(altas.length, 1);
        assert.deepEqual(errores, []);
    } finally { await context.close(); }
}

for (const timezoneId of ['America/Caracas', 'UTC', 'Asia/Tokyo']) {
    test(`fechas civiles ${timezoneId}: mismo día y límites de edad en ambos paneles, escritorio y móvil`, async () => {
        const browser = await chromium.launch({headless:true});
        try {
            for (const legacy of [false, true]) for (const panel of ['representante', 'directiva']) {
                await comprobarFechasPanel(browser, { panel, timezoneId, legacy,
                    viewport: legacy ? {width:390,height:844} : {width:1440,height:900} });
            }
        } finally { await browser.close(); }
    });
}

test('fechas civiles sin helper: validación, formato y envío siguen disponibles en ambos paneles', async () => {
    const browser = await chromium.launch({headless:true});
    try {
        for (const panel of ['representante', 'directiva']) await comprobarFechasPanel(browser, {
            panel, timezoneId:'Asia/Tokyo', viewport:{width:390,height:844}, sinHelper:true
        });
    } finally { await browser.close(); }
});

for (const dispositivo of [
    {nombre: 'escritorio', viewport: {width: 1440, height: 900}},
    {nombre: 'móvil', viewport: {width: 390, height: 844}}
]) {
    test(`eventos ${dispositivo.nombre}: mínimo de Caracas, pasado bloqueado y hoy permitido`, async () => {
        const browser = await chromium.launch({headless: true});
        const context = await browser.newContext({viewport: dispositivo.viewport, timezoneId: 'Asia/Tokyo'});
        const page = await context.newPage();
        const errores = [];
        page.on('pageerror', error => errores.push(error.message));
        await page.clock.setFixedTime(new Date('2026-11-03T02:00:00Z')); // 02/11 en Caracas, 03/11 en Tokio.
        try {
            await page.goto(baseUrl + '/admin/panel-directiva.html');
            await page.waitForFunction(() => document.querySelector('.js-atleta-estado'));
            await page.evaluate(() => document.querySelector('[data-target="sec-cms"]').click());
            const fecha = page.locator('#evento-fecha');
            assert.equal(await fecha.getAttribute('min'), '2026-11-02');
            assert.equal(await fecha.getAttribute('max'), '2027-12-31');
            await fecha.fill('2026-11-01');
            assert.equal(await fecha.evaluate(campo => campo.validity.valid), false);
            await fecha.fill('2028-01-01');
            assert.equal(await fecha.evaluate(campo => campo.validity.valid), false);

            await page.locator('#evento-titulo').fill('Encuentro civil');
            await page.locator('#evento-lugar').fill('Cancha sintética');
            await page.locator('#evento-hora').fill('14:30');
            await fecha.fill('2026-11-02');
            assert.equal(await fecha.evaluate(campo => campo.validity.valid), true);
            const enviada = page.waitForRequest(request =>
                request.method() === 'POST' && request.url().endsWith('/api/cms/admin/eventos'));
            await page.locator('#form-evento button[type=submit]').click();
            assert.equal((await enviada).postDataJSON().fecha_evento, '2026-11-02');
            assert.equal((await enviada).postDataJSON().hora_evento, '14:30');
            assert.deepEqual(errores, []);
        } finally { await browser.close(); }
    });
}

test('calendario público usa el día actual de Caracas aunque el navegador esté en otra zona', async () => {
    const browser = await chromium.launch({headless: true});
    const context = await browser.newContext({viewport: {width: 390, height: 844}, timezoneId: 'Asia/Tokyo'});
    const page = await context.newPage();
    await page.route('https://**/*', route => route.abort());
    await page.clock.setFixedTime(new Date('2026-11-03T02:00:00Z'));
    try {
        await page.goto(baseUrl + '/index.html');
        await page.locator('#calendar-days .cal-day.today').waitFor();
        assert.equal((await page.locator('#month-year').textContent()).trim(), 'Noviembre 2026');
        assert.equal((await page.locator('#calendar-days .cal-day.today').textContent()).trim(), '2');
    } finally { await browser.close(); }
});
