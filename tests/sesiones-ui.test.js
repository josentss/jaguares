const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const publicRoot = path.resolve(__dirname, '../public');
const state = { requests: [], role: 'directiva', autenticada: true, esperaMe: null, meStatus: 200, cierres: [], atletas: [] };
let server;
let baseUrl;

function json(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
}

function reiniciarEstado(role = 'directiva') {
    state.requests = [];
    state.role = role;
    state.autenticada = true;
    state.esperaMe = null;
    state.meStatus = 200;
    state.cierres = [];
    state.atletas = [];
}

test.before(async () => {
    server = http.createServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname.startsWith('/api/')) {
            state.requests.push({ method: req.method, pathname });
            if (pathname === '/api/auth/login' && req.method === 'POST') {
                res.setHeader('Set-Cookie', 'token=synthetic-session-fixture; Path=/; HttpOnly; SameSite=Lax');
                return json(res, 200, { success: true, usuario: {
                    id_usuario: 9001, rol: state.role,
                    nombres: 'Prueba', apellidos: 'Sintetica', correo: 'sesiones@example.org'
                } });
            }
            if (pathname === '/api/auth/me') {
                if (state.esperaMe) await state.esperaMe;
                if (state.meStatus !== 200) return json(res, state.meStatus, { success: false });
                if (!state.autenticada || !req.headers.cookie?.includes('token=synthetic-session-fixture')) {
                    return json(res, 401, { success: false });
                }
                return json(res, 200, { success: true, usuario: {
                    id_usuario: 9001, rol: state.role,
                    nombres: 'Prueba', apellidos: 'Sintetica', correo: 'sesiones@example.org'
                } });
            }
            if (pathname === '/api/auth/logout') {
                const comportamiento = state.cierres.shift() || { status: 200 };
                if (comportamiento.espera) await comportamiento.espera;
                if (comportamiento.status !== 200) {
                    return json(res, comportamiento.status, { success: false });
                }
                state.autenticada = false;
                res.setHeader('Set-Cookie', 'token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
                return json(res, 200, { success: true });
            }
            if (!state.autenticada) return json(res, 401, { success: false });
            if (pathname === '/api/directiva/auditoria') return json(res, 200, {
                metricas: { activos: 0, espera: 0, pagos_pendientes: 0 },
                tasa_bcv: 36.5, tasa_fecha: null, atletas: [], pagos: []
            });
            if (pathname === '/api/directiva/pendientes') return json(res, 200, { success: true, datos: [] });
            if (pathname === '/api/cms/admin/eventos') return json(res, 200, { success: true, eventos: [] });
            if (pathname === '/api/usuarios/perfil/9001') return json(res, 200, {
                success: true, perfil: {
                    nombres: 'Prueba', apellidos: 'Sintetica', correo: 'sesiones@example.org',
                    cedula: 'V-99000001', telefono1: '04140000001'
                }
            });
            if (pathname === '/api/atletas/representante/9001') return json(res, 200, { success: true, atletas: state.atletas });
            if (pathname === '/api/pagos/historial/9001') return json(res, 200, { success: true, datos: [] });
            if (pathname === '/api/notificaciones/9001') return json(res, 200, { success: true, notificaciones: [] });
            return json(res, 200, { success: true, datos: [], atletas: [], pagos: [], eventos: [], notificaciones: [] });
        }

        const filePath = path.resolve(publicRoot, '.' + decodeURI(pathname === '/' ? '/index.html' : pathname));
        if (!filePath.startsWith(publicRoot + path.sep)) {
            res.writeHead(403); return res.end();
        }
        try {
            const body = await fs.readFile(filePath);
            const contentType = {
                '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
                '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
            }[path.extname(filePath)] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
            res.end(body);
        } catch {
            res.writeHead(404); res.end('No encontrado');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = 'http://127.0.0.1:' + server.address().port;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
});

async function abrirPanel(context, role) {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(baseUrl + '/admin/panel-' + role + '.html');
    return { page, pageErrors };
}

async function esperarRuta(pathname, cantidad = 1) {
    const limite = Date.now() + 5000;
    while (state.requests.filter(request => request.pathname === pathname).length < cantidad && Date.now() < limite) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(state.requests.filter(request => request.pathname === pathname).length >= cantidad, `no se recibió ${pathname}`);
}

async function nuevoContexto(viewport, autenticado = true) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport });
    if (autenticado) {
        await context.addCookies([{
            name: 'token', value: 'synthetic-session-fixture', url: baseUrl,
            httpOnly: true, sameSite: 'Lax'
        }]);
    }
    return { browser, context };
}

for (const dispositivo of [
    { nombre: 'escritorio', viewport: { width: 1440, height: 900 } },
    { nombre: 'movil', viewport: { width: 390, height: 844 } }
]) {
    for (const role of ['directiva', 'representante']) {
        test(`${role} ${dispositivo.nombre}: no muestra el panel mientras valida la sesión`, async () => {
            reiniciarEstado(role);
            let liberar;
            state.esperaMe = new Promise(resolve => { liberar = resolve; });
            const { browser, context } = await nuevoContexto(dispositivo.viewport, false);
            try {
                const { page } = await abrirPanel(context, role);
                await esperarRuta('/api/auth/me');
                assert.equal(await page.locator('.main-content').isVisible(), false);
                assert.equal(await page.locator('#sidebar').isVisible(), false);
                assert.equal(await page.locator('#session-gate').isVisible(), true);
                assert.deepEqual(state.requests.map(request => request.pathname), ['/api/auth/me']);
                liberar();
                await page.waitForURL('**/admin/login.html');
                assert.equal(state.requests.some(request => request.pathname !== '/api/auth/me'), false);
            } finally {
                liberar?.();
                await context.close();
                await browser.close();
            }
        });
    }
}

test('una respuesta temporal fallida ofrece reintentar sin mostrar datos del panel', async () => {
    reiniciarEstado('representante');
    state.meStatus = 503;
    const { browser, context } = await nuevoContexto({ width: 390, height: 844 }, false);
    try {
        const { page } = await abrirPanel(context, 'representante');
        await page.waitForFunction(() => document.body.dataset.sessionState === 'error');
        assert.equal(await page.locator('.main-content').isVisible(), false);
        assert.equal(await page.locator('#session-gate-retry').isVisible(), true);

        state.meStatus = 200;
        state.autenticada = true;
        await context.addCookies([{
            name: 'token', value: 'synthetic-session-fixture', url: baseUrl,
            httpOnly: true, sameSite: 'Lax'
        }]);
        await page.locator('#session-gate-retry').click();
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        assert.equal(await page.locator('.main-content').isVisible(), true);
    } finally {
        await context.close();
        await browser.close();
    }
});

for (const role of ['directiva', 'representante']) {
    test(`${role} móvil: el menú funciona después de una verificación lenta`, async () => {
        reiniciarEstado(role);
        let liberar;
        state.esperaMe = new Promise(resolve => { liberar = resolve; });
        const { browser, context } = await nuevoContexto({ width: 390, height: 844 });
        try {
            const { page } = await abrirPanel(context, role);
            await esperarRuta('/api/auth/me');
            const menu = page.locator(role === 'directiva' ? '#mobile-menu-btn' : '#menu-toggle');
            assert.equal(await menu.isVisible(), false);
            liberar();
            await page.locator('.main-content').waitFor({ state: 'visible' });
            await menu.click();
            await page.locator('[data-target="sec-pagos"]').click();
            assert.equal(await page.locator('#sec-pagos').isVisible(), true);
        } finally {
            liberar?.();
            await context.close();
            await browser.close();
        }
    });
}

for (const dispositivo of [
    { nombre: 'escritorio', viewport: { width: 1440, height: 900 } },
    { nombre: 'movil', viewport: { width: 390, height: 844 } }
]) {
    for (const role of ['directiva', 'representante']) {
        test(`${role} ${dispositivo.nombre}: cierre fallido permite reintentar y cierre correcto retira la cookie`, async () => {
            reiniciarEstado(role);
            let liberar;
            state.cierres = [
                { status: 503, espera: new Promise(resolve => { liberar = resolve; }) },
                { status: 200 }
            ];
            const { browser, context } = await nuevoContexto(dispositivo.viewport);
            try {
                const { page, pageErrors } = await abrirPanel(context, role);
                await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
                await page.evaluate(() => {
                    localStorage.setItem('usuario', JSON.stringify({ id_usuario: 9001 }));
                    localStorage.setItem('preferencia-sintetica', 'conservar');
                });
                if (dispositivo.nombre === 'movil') {
                    await page.locator(role === 'directiva' ? '#mobile-menu-btn' : '#menu-toggle').click();
                }
                const logout = page.locator('#btn-logout');
                const primeraSolicitud = page.waitForRequest(request => new URL(request.url()).pathname === '/api/auth/logout');
                await logout.click();
                await primeraSolicitud;
                await logout.dispatchEvent('click');
                assert.equal(state.requests.filter(request => request.pathname === '/api/auth/logout').length, 1);
                assert.equal(await page.locator('.toast.error').count(), 0);
                liberar();
                await page.locator('.toast.error').waitFor({ state: 'visible' });
                assert.equal(page.url().endsWith('/admin/panel-' + role + '.html'), true);
                assert.equal(await page.evaluate(() => document.body.dataset.sessionState), 'ready');
                assert.equal((await context.cookies()).some(cookie => cookie.name === 'token'), true);
                assert.notEqual(await page.evaluate(() => localStorage.getItem('usuario')), null);

                await logout.click();
                await page.waitForURL('**/admin/login.html');
                assert.equal((await context.cookies()).some(cookie => cookie.name === 'token'), false);
                assert.equal(await page.evaluate(() => localStorage.getItem('usuario')), null);
                assert.equal(await page.evaluate(() => localStorage.getItem('preferencia-sintetica')), 'conservar');
                assert.deepEqual(pageErrors, []);
            } finally {
                liberar?.();
                await context.close();
                await browser.close();
            }
        });
    }
}

test('revalida al volver a una pestaña y redirige si la sesión fue revocada', async () => {
    reiniciarEstado('directiva');
    const { browser, context } = await nuevoContexto({ width: 390, height: 844 });
    try {
        const { page } = await abrirPanel(context, 'directiva');
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        state.autenticada = false;
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await page.waitForURL('**/admin/login.html');
    } finally {
        await context.close();
        await browser.close();
    }
});

for (const role of ['directiva', 'representante']) {
    test(`${role}: oculta los datos mientras revalida al volver a la pestaña`, async () => {
        reiniciarEstado(role);
        const { browser, context } = await nuevoContexto({ width: 390, height: 844 });
        let liberar;
        try {
            const { page } = await abrirPanel(context, role);
            await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
            await page.bringToFront();
            const anteriores = state.requests.filter(request => request.pathname === '/api/auth/me').length;
            state.esperaMe = new Promise(resolve => { liberar = resolve; });
            await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
            await esperarRuta('/api/auth/me', anteriores + 1);
            assert.equal(await page.locator('.main-content').isVisible(), false);
            assert.equal(await page.locator('#session-gate').isVisible(), true);
            liberar();
            await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
            assert.equal(await page.locator('.main-content').isVisible(), true);
        } finally {
            liberar?.();
            await context.close();
            await browser.close();
        }
    });
}

test('un error al revalidar oculta el panel y permite recuperar la sesión', async () => {
    reiniciarEstado('representante');
    const { browser, context } = await nuevoContexto({ width: 390, height: 844 });
    try {
        const { page } = await abrirPanel(context, 'representante');
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        await page.bringToFront();
        state.meStatus = 503;
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await page.waitForFunction(() => document.body.dataset.sessionState === 'error');
        assert.equal(await page.locator('.main-content').isVisible(), false);
        assert.equal(await page.locator('#session-gate-retry').isVisible(), true);
        state.meStatus = 200;
        await page.locator('#session-gate-retry').click();
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        assert.equal(await page.locator('.main-content').isVisible(), true);
    } finally {
        await context.close();
        await browser.close();
    }
});

test('login, perfil y reporte de pago funcionan si no se puede guardar usuario en localStorage', async () => {
    reiniciarEstado('representante');
    state.atletas = [{ id_atleta: 77, nombres: 'Atleta', apellidos: 'Sintetico', estado: 'activo', cedula: 'V-99000003' }];
    const { browser, context } = await nuevoContexto({ width: 1440, height: 900 }, false);
    try {
        const page = await context.newPage();
        const errores = [];
        page.on('pageerror', error => errores.push(error.message));
        await page.addInitScript(() => {
            const originalGet = Storage.prototype.getItem;
            const originalSet = Storage.prototype.setItem;
            Storage.prototype.getItem = function (key) {
                if (key === 'usuario') throw new Error('Almacenamiento sintético bloqueado');
                return originalGet.call(this, key);
            };
            Storage.prototype.setItem = function (key, value) {
                if (key === 'usuario') throw new Error('Almacenamiento sintético bloqueado');
                return originalSet.call(this, key, value);
            };
        });
        await page.route('https://**/*', route => route.abort());
        await page.goto(baseUrl + '/admin/login.html');
        await page.locator('#login-email').fill('sesiones@example.org');
        await page.locator('#login-password').fill('ClaveSintetica123');
        await page.locator('#form-login button[type="submit"]').click();
        await page.waitForURL('**/admin/panel-representante.html');
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        await page.locator('#pay-atleta option[value="77"]').waitFor({ state: 'attached' });

        await page.locator('[data-target="sec-perfil"]').click();
        const perfilActualizado = page.waitForResponse(response =>
            new URL(response.url()).pathname === '/api/usuarios/perfil' && response.request().method() === 'PUT');
        await page.locator('#form-mi-perfil button[type="submit"]').click();
        assert.equal((await perfilActualizado).status(), 200);
        await page.getByText('¡Perfil actualizado!').waitFor({ state: 'visible' });

        await page.locator('[data-target="sec-pagos"]').click();
        await page.locator('#pay-atleta').selectOption('77');
        await page.locator('#pay-mes').selectOption('Enero');
        await page.locator('#pay-metodo').selectOption('Efectivo');
        await page.locator('#pay-monto-efec').fill('10');
        await page.locator('#pay-moneda-efec').selectOption('USD');
        await page.locator('#pay-fecha-efec').fill('2020-01-01');
        const pago = page.waitForResponse(response =>
            new URL(response.url()).pathname === '/api/pagos/reportar' && response.request().method() === 'POST');
        await page.locator('#form-report-pago button[type="submit"]').click();
        assert.equal((await pago).status(), 200);
        await page.getByText('Pago reportado con éxito').waitFor({ state: 'visible' });
        assert.deepEqual(errores, []);
    } finally {
        await context.close();
        await browser.close();
    }
});

test('401 de una API protegida cierra la vista abierta', async () => {
    reiniciarEstado('directiva');
    const { browser, context } = await nuevoContexto({ width: 1440, height: 900 });
    try {
        const { page } = await abrirPanel(context, 'directiva');
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        state.autenticada = false;
        await page.evaluate(() => apiFetch('/api/directiva/auditoria'));
        await page.waitForURL('**/admin/login.html');
    } finally {
        await context.close();
        await browser.close();
    }
});

test('un rol ajeno al panel se redirige sin cargar los datos de directiva', async () => {
    reiniciarEstado('representante');
    const { browser, context } = await nuevoContexto({ width: 1440, height: 900 });
    try {
        const { page } = await abrirPanel(context, 'directiva');
        await page.waitForURL('**/admin/login.html');
        assert.equal(state.requests.some(request => request.pathname.startsWith('/api/directiva/')), false);
    } finally {
        await context.close();
        await browser.close();
    }
});

for (const role of ['admin', 'staff']) {
    test(`${role} conserva acceso al panel de directiva`, async () => {
        reiniciarEstado(role);
        const { browser, context } = await nuevoContexto({ width: 1440, height: 900 });
        try {
            const { page } = await abrirPanel(context, 'directiva');
            await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
            assert.equal(await page.locator('.main-content').isVisible(), true);
        } finally {
            await context.close();
            await browser.close();
        }
    });
}

test('si no carga la hoja de estilos, el panel sigue oculto durante la verificación', async () => {
    reiniciarEstado('directiva');
    let liberar;
    state.esperaMe = new Promise(resolve => { liberar = resolve; });
    const { browser, context } = await nuevoContexto({ width: 390, height: 844 }, false);
    try {
        const page = await context.newPage();
        await page.route('https://**/*', route => route.abort());
        await page.route('**/admin-style.css?*', route => route.abort());
        await page.goto(baseUrl + '/admin/panel-directiva.html');
        await esperarRuta('/api/auth/me');
        assert.equal(await page.locator('.main-content').isVisible(), false);
        assert.equal(await page.locator('#session-gate').isVisible(), true);
        liberar();
        await page.waitForURL('**/admin/login.html');
    } finally {
        liberar?.();
        await context.close();
        await browser.close();
    }
});

for (const role of ['directiva', 'representante']) {
    test(`${role}: si falla el cliente de sesión, informa el error y permite reintentar`, async () => {
        reiniciarEstado(role);
        const { browser, context } = await nuevoContexto({ width: 1440, height: 900 });
        try {
            const page = await context.newPage();
            const errores = [];
            page.on('pageerror', error => errores.push(error.message));
            await page.route('https://**/*', route => route.abort());
            await page.route('**/api-client.js?*', route => route.abort());
            await page.goto(baseUrl + '/admin/panel-' + role + '.html');
            assert.equal(await page.locator('.main-content').isVisible(), false);
            assert.equal(await page.locator('#session-gate-retry').isVisible(), true);
            assert.match(await page.locator('#session-gate-message').textContent(), /no se pudo cargar/i);
            assert.equal(state.requests.length, 0);
            assert.deepEqual(errores, []);
            await page.unroute('**/api-client.js?*');
            await page.locator('#session-gate-retry').click();
            await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
            assert.equal(await page.locator('.main-content').isVisible(), true);
        } finally {
            await context.close();
            await browser.close();
        }
    });
}

test('con JavaScript desactivado, el panel permanece oculto y ofrece volver al login', async () => {
    reiniciarEstado('directiva');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    try {
        const { page } = await abrirPanel(context, 'directiva');
        assert.equal(await page.locator('.main-content').isVisible(), false);
        assert.equal(await page.getByRole('link', { name: 'Ir al inicio de sesión' }).isVisible(), true);
        assert.equal(state.requests.length, 0);
    } finally {
        await context.close();
        await browser.close();
    }
});

test('al restaurar una página en caché, oculta el contenido hasta revalidar', async () => {
    reiniciarEstado('directiva');
    const { browser, context } = await nuevoContexto({ width: 1440, height: 900 });
    let liberar;
    try {
        const { page } = await abrirPanel(context, 'directiva');
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        const anteriores = state.requests.filter(request => request.pathname === '/api/auth/me').length;
        state.esperaMe = new Promise(resolve => { liberar = resolve; });
        await page.evaluate(() => {
            window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        });
        await esperarRuta('/api/auth/me', anteriores + 1);
        assert.equal(await page.locator('.main-content').isVisible(), false);
        liberar();
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        assert.equal(await page.locator('.main-content').isVisible(), true);
    } finally {
        liberar?.();
        await context.close();
        await browser.close();
    }
});

test('una respuesta anterior no vuelve a mostrar el panel después de una revocación al restaurarlo', async () => {
    reiniciarEstado('directiva');
    const { browser, context } = await nuevoContexto({ width: 1440, height: 900 });
    let liberar;
    try {
        const { page } = await abrirPanel(context, 'directiva');
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        await page.waitForLoadState('networkidle');
        await page.bringToFront();
        assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
        let recibida;
        const primeraRecibida = new Promise(resolve => { recibida = resolve; });
        const espera = new Promise(resolve => { liberar = resolve; });
        let solicitudes = 0;
        await page.route('**/api/auth/me', async route => {
            solicitudes += 1;
            if (solicitudes === 1) {
                recibida();
                await espera;
                await route.fulfill({ json: { success: true, usuario: { id_usuario: 9001, rol: 'directiva' } } }).catch(() => {});
                return;
            }
            await route.fulfill({ status: 401, json: { success: false } });
        });
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        let timeout;
        try {
            await Promise.race([
                primeraRecibida,
                new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('No inició la revalidación')), 5000); })
            ]);
        } finally { clearTimeout(timeout); }
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        await page.waitForURL('**/admin/login.html');
        liberar();
        assert.equal(page.url().endsWith('/admin/login.html'), true);
    } finally {
        liberar?.();
        await context.close();
        await browser.close();
    }
});

test('volver atrás tras revocar la sesión redirige de nuevo al login', async () => {
    reiniciarEstado('directiva');
    const { browser, context } = await nuevoContexto({ width: 1440, height: 900 });
    try {
        const { page } = await abrirPanel(context, 'directiva');
        await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        await page.goto(baseUrl + '/admin/login.html');
        state.autenticada = false;
        await page.goBack({ waitUntil: 'commit' });
        await page.waitForURL('**/admin/login.html');
    } finally {
        await context.close();
        await browser.close();
    }
});

test('cerrar sesión en una pestaña redirige otra pestaña del mismo navegador', async () => {
    reiniciarEstado('directiva');
    const { browser, context } = await nuevoContexto({ width: 1440, height: 900 });
    try {
        const primera = await abrirPanel(context, 'directiva');
        await primera.page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        const segunda = await abrirPanel(context, 'directiva');
        await segunda.page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
        await primera.page.bringToFront();
        await primera.page.locator('#btn-logout').click();
        await Promise.all([
            primera.page.waitForURL('**/admin/login.html'),
            segunda.page.waitForURL('**/admin/login.html')
        ]);
        assert.equal((await context.cookies()).some(cookie => cookie.name === 'token'), false);
    } finally {
        await context.close();
        await browser.close();
    }
});
