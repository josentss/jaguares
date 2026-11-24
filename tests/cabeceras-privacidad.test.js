const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'synthetic-session-header-test-secret';
process.env.DATABASE_URL = 'postgres://fixture:fixture@127.0.0.1:1/jaguares_test';
process.env.TRUST_PROXY = '0';
const dbPath = require.resolve('../config/db');
const noDatabase = () => { throw new Error('Esta prueba no debe consultar la base de datos'); };
require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: { query: noDatabase, promise: noDatabase, pool: { connect: noDatabase } }
};
const app = require('../index');

let server;
let baseUrl;

test.before(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = 'http://127.0.0.1:' + server.address().port;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
});

for (const panel of ['directiva', 'representante']) {
    test(`el HTML del panel ${panel} lleva Cache-Control no-store`, async () => {
        const response = await fetch(baseUrl + '/admin/panel-' + panel + '.html', { redirect: 'manual' });
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/admin/login.html');
        assert.equal(response.headers.get('cache-control'), 'no-store');
    });
}

test('las APIs no almacenan respuestas de sesión, incluso al rechazar una solicitud anónima', async () => {
    const response = await fetch(baseUrl + '/api/auth/me');
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('el cierre real responde con una cookie de sesión caducada', async () => {
    const response = await fetch(baseUrl + '/api/auth/logout', {
        method: 'POST', headers: { Cookie: 'token=synthetic-session-fixture' }
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
    assert.match(response.headers.get('set-cookie'), /token=;.*expires=Thu, 01 Jan 1970/i);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('un JSON inválido también recibe Cache-Control no-store', async () => {
    const response = await fetch(baseUrl + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
    });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('404 institucional y API JSON sin reflejar datos de la ruta', async () => {
    for (const ruta of ['/no-existe', '/admin/no-existe.html', '/private_uploads/no-existe.png',
        '/logs/admin_requests.log', '/.env', '/admin/panel-directiva.html/']) {
        const r = await fetch(baseUrl + ruta);
        assert.equal(r.status, 404, ruta);
        assert.match(r.headers.get('content-type'), /text\/html/);
        assert.equal(r.headers.get('cache-control'), 'no-store');
        const html = await r.text();
        assert.match(html, /Página no encontrada/);
        assert.doesNotMatch(html, /Cannot GET/);
    }
    for (const ruta of ['/api/no-existe', '/API/no-existe', '/api//auth/me', '/api/auth/%ZZ']) {
        const r = await fetch(baseUrl + ruta);
        assert.equal(r.status, 404, ruta);
        assert.match(r.headers.get('content-type'), /application\/json/);
        assert.deepEqual(await r.json(), {success:false, message:'Ruta no encontrada'});
    }
    const reflejo = await fetch(baseUrl + '/ruta-secreta-sintetica%3Cscript%3E');
    assert.equal(reflejo.status, 404);
    assert.doesNotMatch(await reflejo.text(), /ruta-secreta-sintetica/);
});

test('entradas y recursos legítimos permanecen disponibles con cabeceras seguras', async () => {
    for (const ruta of ['/', '/index.html', '/galeria.html', '/admin/login.html',
        '/style.css', '/admin/api-client.js', '/img/logo-favicon.ico', '/robots.txt', '/sitemap.xml']) {
        const r = await fetch(baseUrl + ruta);
        assert.equal(r.status, 200, ruta);
        assert.equal(r.headers.get('x-powered-by'), null);
        assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(r.headers.get('x-frame-options'), 'DENY');
        assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
        assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
        await r.arrayBuffer();
    }
    const head = await fetch(baseUrl + '/no-existe', {method:'HEAD'});
    assert.equal(head.status, 404);
    assert.equal(await head.text(), '');
});

test('mayúsculas de API no evitan comprobación de origen ni no-store', async () => {
    for (const ruta of ['/api/auth/logout', '/API/auth/logout', '/Api/AUTH/logout']) {
        const r = await fetch(baseUrl + ruta, {
            method: 'POST', headers: {Origin:'https://externo.example'}
        });
        assert.equal(r.status, 403, ruta);
        assert.equal(r.headers.get('cache-control'), 'no-store');
    }
    const r = await fetch(baseUrl + '/API/auth/me');
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('alias de panel privado siguen protegidos, nunca estáticos', async () => {
    for (const ruta of ['/admin/%70anel-directiva.html', '/ADMIN/PANEL-REPRESENTANTE.HTML',
        '/admin%2fpanel-directiva.html', '/admin//panel-representante.html']) {
        const r = await fetch(baseUrl + ruta, {redirect:'manual'});
        assert.equal(r.status, 302, ruta);
        assert.equal(r.headers.get('location'), '/admin/login.html');
        assert.equal(r.headers.get('cache-control'), 'no-store');
    }
});
