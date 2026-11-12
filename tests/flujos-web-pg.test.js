const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const { Writable } = require('node:stream');
const { configurarPostgresTemporal } = require('./helpers/postgres');

const esquema = configurarPostgresTemporal();
// Contrato civil independiente de la zona horaria de la conexión PostgreSQL.
process.env.PGOPTIONS += ' -c TimeZone=Asia/Tokyo';
process.env.JWT_SECRET = 'clave-sintetica-flujos-locales';
process.env.NODE_ENV = 'test';
process.env.TRUST_PROXY = '0';
process.env.CLOUDINARY_CLOUD_NAME = 'solo-pruebas';
process.env.CLOUDINARY_API_KEY = 'solo-pruebas';
process.env.CLOUDINARY_API_SECRET = 'solo-pruebas';
process.env.CLOUDINARY_AUTHENTICATED_UPLOADS = '1';
const db = require('../config/db');
const bcrypt = require('bcrypt');
const { chromium } = require('playwright');
const cloudinary = require('cloudinary').v2;

// Solo los proveedores externos están simulados. HTML, JS, login/cookies,
// Express, autorización, Multer, controladores y PostgreSQL son los reales.
const fetchOriginal = global.fetch;
const uploadOriginal = cloudinary.uploader.upload_stream;
const destroyOriginal = cloudinary.uploader.destroy;
let fallarCarga = false;
let numeroCarga = 0;
const eliminacionesCompensadas = [];
global.fetch = (url, options) => {
    if (String(url).startsWith('https://v6.exchangerate-api.com/')) {
        return Promise.resolve(new Response(JSON.stringify({result:'success',conversion_rates:{VES:1}})));
    }
    return fetchOriginal(url, options);
};
cloudinary.uploader.upload_stream = (options, callback) => {
    const id = `archivo-sintetico-${++numeroCarga}`;
    const publicId = `${options.folder}/${id}`;
    let bytes = 0;
    const partes = [];
    return new Writable({
        write(chunk, encoding, next) { bytes += chunk.length; partes.push(chunk); next(); },
        final(next) {
            if (fallarCarga) callback(new Error('Proveedor de archivos de prueba no disponible'));
            else {
                const formato = Buffer.concat(partes).subarray(0,5).toString('ascii') === '%PDF-'
                    ? 'pdf' : 'png';
                const recurso = options.resource_type === 'auto' ? 'image' : (options.resource_type || 'image');
                callback(null, {
                    secure_url:`https://res.cloudinary.com/solo-pruebas/${recurso}/authenticated/v123456/otra_carpeta/${id}.${formato}`,
                    public_id:publicId,resource_type:recurso,type:'authenticated',format:formato,
                    version:123456,bytes
                });
            }
            next();
        }
    });
};
cloudinary.uploader.destroy = (id, options, callback) => {
    eliminacionesCompensadas.push({ id, tipo: options.type, recurso: options.resource_type });
    callback(null, {result:'ok'});
};

const clave = 'ClaveSintetica123';
let browser, server, base, creado = false;
let secuencia = 0;
const cedulaLibre = () => String(92000000 + ++secuencia);
const errores = [];

test.before(async () => {
    await db.pool.query(`CREATE SCHEMA ${esquema}`);
    creado = true;
    assert.equal((await db.pool.query("SELECT current_setting('TimeZone') AS tz")).rows[0].tz, 'Asia/Tokyo');
    await db.pool.query(`
        CREATE TABLE usuarios (
            id_usuario SERIAL PRIMARY KEY, nombres TEXT, apellidos TEXT,
            correo TEXT UNIQUE, cedula TEXT UNIQUE, telefono1 TEXT, telefono2 TEXT,
            password_hash TEXT, rol TEXT NOT NULL, estado TEXT NOT NULL
        );
        CREATE TABLE atletas (
            id_atleta SERIAL PRIMARY KEY, id_representante INTEGER NOT NULL REFERENCES usuarios(id_usuario),
            nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE, cedula_heredada INTEGER,
            fecha_nacimiento DATE, direccion TEXT, telefono TEXT, alergias_medicas TEXT,
            foto_url TEXT, cedula_archivo_url TEXT, partida_nacimiento_url TEXT, estado TEXT NOT NULL
        );
        CREATE TABLE pagos (
            id_pago SERIAL PRIMARY KEY, id_atleta INTEGER NOT NULL REFERENCES atletas(id_atleta),
            mes_pagado TEXT, metodo_pago TEXT, fecha_pago DATE, monto NUMERIC(12,2),
            moneda TEXT, referencia TEXT, ruta_captura TEXT, estado_pago TEXT
        );
        CREATE TABLE notificaciones (
            id_notificacion SERIAL PRIMARY KEY, id_usuario INTEGER REFERENCES usuarios(id_usuario),
            mensaje TEXT, tipo TEXT, fecha TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE eventos (id_evento SERIAL PRIMARY KEY, titulo TEXT, fecha_evento TIMESTAMPTZ NOT NULL, lugar TEXT, estado TEXT);
        CREATE TABLE noticias (id_noticia SERIAL PRIMARY KEY, titulo TEXT, resumen TEXT, contenido TEXT,
            imagen_url TEXT, fecha_publicacion TIMESTAMPTZ DEFAULT now(), estado TEXT);
        CREATE TABLE audit_uploads (id SERIAL PRIMARY KEY, ts TIMESTAMPTZ, success BOOLEAN, reason TEXT,
            user_id INTEGER, original_name TEXT, stored_filename TEXT, ip TEXT, meta JSONB);
    `);
    await db.pool.query(await fs.readFile(require('node:path').join(__dirname,
        '../migrations/2026-11-12_cuentas_por_cobrar_base.sql'),'utf8'));
    await db.pool.query(await fs.readFile(require('node:path').join(__dirname,
        '../migrations/2026-11-12_catalogo_y_tasas_cobro.sql'),'utf8'));
    await db.pool.query("INSERT INTO eventos (titulo, fecha_evento, lugar, estado) VALUES ('Histórico sin hora', TIMESTAMPTZ '2020-01-01 00:00:00+00', 'Cancha', 'completado')");
    await db.pool.query(await fs.readFile(require('node:path').join(__dirname, '../migrations/2026-11-05_eventos_hora.sql'), 'utf8'));
    assert.equal((await db.pool.query("SELECT hora_evento FROM eventos WHERE titulo='Histórico sin hora'")).rows[0].hora_evento, null);
    const hash = await bcrypt.hash(clave,10);
    for (const [correo,nombres,cedula,rol] of [
        ['directiva@example.org','Directiva Prueba','V-91000001','directiva'],
        ['alfa@example.org','Representante Alfa','V-91000002','representante'],
        ['beta@example.org','Representante Beta','V-91000003','representante']
    ]) await db.pool.query(`INSERT INTO usuarios (nombres,apellidos,correo,cedula,telefono1,password_hash,rol,estado)
        VALUES ($1,'Sintético',$2,$3,'04140000001',$4,$5,'aprobado')`,[nombres,correo,cedula,hash,rol]);
    server = http.createServer();
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    process.env.CORS_ORIGIN = base;
    server.on('request',require('../index'));
    browser = await chromium.launch({headless:true});
});

test.after(async () => {
    try {
        if (browser) await browser.close();
        if (server) await new Promise(resolve => server.close(resolve));
        // Esperar las notificaciones de mejor esfuerzo antes de quitar el esquema.
        while (db.pool.waitingCount || db.pool.idleCount !== db.pool.totalCount) {
            await new Promise(resolve => setTimeout(resolve,10));
        }
        if (creado) await db.pool.query(`DROP SCHEMA ${esquema} CASCADE`);
    } finally {
        await db.pool.end();
        global.fetch = fetchOriginal;
        cloudinary.uploader.upload_stream = uploadOriginal;
        cloudinary.uploader.destroy = destroyOriginal;
    }
    assert.deepEqual(errores,[],'No debe haber excepciones JavaScript en los flujos reales');
});

test('CORS real: preflight propio funciona, un dominio ajeno no recibe acceso ni ejecuta POST', async () => {
    const propio = await fetch(base + '/api/auth/login', {
        method: 'OPTIONS',
        headers: { Origin: base, 'Access-Control-Request-Method': 'POST' }
    });
    assert.equal(propio.status, 204);
    assert.equal(propio.headers.get('access-control-allow-origin'), base);
    assert.equal(propio.headers.get('access-control-allow-credentials'), 'true');

    const ajeno = 'https://atacante.vercel.app';
    const preflight = await fetch(base + '/api/auth/login', {
        method: 'OPTIONS',
        headers: { Origin: ajeno, 'Access-Control-Request-Method': 'POST' }
    });
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);

    const rechazado = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { Origin: ajeno, 'Content-Type': 'application/json' },
        body: '{}'
    });
    assert.equal(rechazado.status, 403);
    assert.equal((await rechazado.json()).message, 'Origen de solicitud no autorizado');

    const sinOrigin = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/json' },
        body: '{}'
    });
    assert.equal(sinOrigin.status, 403);

    const mismoOrigen = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { Origin: base, 'Content-Type': 'application/json' },
        body: '{}'
    });
    assert.notEqual(mismoOrigen.status, 403);

    const lectura = await fetch(base + '/api/cms/public/eventos', { headers: {Origin:ajeno} });
    assert.equal(lectura.headers.get('access-control-allow-origin'), null);
});

async function pagina(viewport = {width:1440,height:900}, sinValidador = false, timezoneId = 'America/Caracas') {
    const context = await browser.newContext({viewport,timezoneId});
    await context.route('**/*',route => {
        const url = route.request().url();
        if (sinValidador && new URL(url).pathname.endsWith('/validacion-formularios.js')) return route.abort();
        return url.startsWith(base+'/') ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror',error => errores.push(error.message));
    page.on('dialog',dialog => dialog.accept());
    return page;
}

async function entrar(correo, viewport, sinValidador = false, timezoneId = 'America/Caracas') {
    const page = await pagina(viewport, sinValidador, timezoneId);
    await page.goto(base+'/admin/login.html');
    await page.locator('#login-email').fill(correo);
    await page.locator('#login-password').fill(clave);
    const respuesta = page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');
    await page.locator('#form-login button[type=submit]').click();
    assert.equal((await respuesta).status(),200);
    await page.waitForURL('**/panel-*.html');
    await page.waitForFunction(()=>document.querySelector('#user-info strong'));
    return page;
}

async function seccion(page, id) {
    // El mismo elemento del menú, con clic físico también en el viewport móvil.
    await page.locator('.main-content').waitFor({ state: 'visible' });
    const menu = page.locator('.mobile-menu-toggle');
    const item = page.locator(`[data-target="${id}"]`);
    if (await menu.isVisible() && !(await page.locator('#sidebar').evaluate(e=>e.classList.contains('open')))) {
        await menu.click();
    }
    // En directiva, la navegación está agrupada y cada grupo se abre
    // antes de elegir una sección. Representante conserva el menú anterior.
    const grupo = item.locator('xpath=ancestor::li[contains(concat(" ", normalize-space(@class), " "), " sidebar-group ")]');
    if (await grupo.count()) {
        const boton = grupo.locator('.sidebar-group__toggle');
        if (await boton.getAttribute('aria-expanded') !== 'true') await boton.click();
    }
    await item.click();
}

test('sesiones reales: permite dos navegadores y cerrar uno conserva el acceso del otro', async () => {
    const primera = await entrar('directiva@example.org');
    const segunda = await entrar('directiva@example.org');
    let segundaCerrada = false;
    try {
        const cookies1 = await primera.context().cookies();
        const cookies2 = await segunda.context().cookies();
        assert.notEqual(cookies1.find(c=>c.name==='token').value,cookies2.find(c=>c.name==='token').value);
        assert.ok(cookies1.some(c=>c.name.startsWith('jaguares_actividad_')));
        await segunda.context().close();
        segundaCerrada = true;
        await primera.reload();
        await primera.locator('.main-content').waitFor({state:'visible'});
        assert.equal(await primera.evaluate(async()=> (await apiFetch('/api/auth/me')).status),200);
    } finally {
        await primera.context().close();
        if (!segundaCerrada) await segunda.context().close();
    }
});

async function rellenarAtleta(page, prefijo, nombres, numero = cedulaLibre()) {
    for (const [campo,valor] of Object.entries({nombres,apellidos:'Núñez',
        'fecha-nac':'2014-05-10',direccion:'Calle de pruebas 12',telefono:'04140000001',cedula:numero})) {
        await page.locator(`#${prefijo}-${campo}`).fill(valor);
    }
    return numero;
}

async function enviar(page, form, ruta, status = 200) {
    const boton = page.locator(`${form} button[type=submit]`);
    const pendiente = page.waitForResponse(r=>r.url()===base+ruta&&r.request().method()==='POST',{timeout:6000});
    await boton.click();
    const respuesta = await pendiente;
    if (ruta === '/api/auth/login' && status === 200) {
        assert.equal(respuesta.status(),200);
        await page.waitForURL('**/panel-*.html');
        return {};
    }
    const body = await respuesta.json();
    assert.equal(respuesta.status(),status,body.message||body.error);
    await page.waitForFunction(selector=>!document.querySelector(selector)?.disabled,`${form} button[type=submit]`);
    return body;
}

async function representanteNuevo(page, sufijo) {
    await page.locator('label.seg-op').filter({has:page.locator('[value="nuevo"]')}).click();
    for (const [campo,valor] of Object.entries({nombres:'Representante Prueba',apellidos:'Núñez',
        cedula:cedulaLibre(),telefono:'04140000001',correo:`nuevo-${sufijo}@example.org`,pass:clave})) {
        await page.locator('#dir-rep-'+campo).fill(valor);
    }
}

for (const [nombre,viewport] of [
    ['Escritorio',{width:1440,height:900}], ['Móvil',{width:390,height:844}]
]) {
    test(`flujo real ${nombre}: validar, corregir, heredar y registrar dos atletas desde representante`, async () => {
        const page = await entrar('alfa@example.org',viewport);
        try {
            await page.waitForFunction(()=>document.querySelector('#perfil-cedula')?.value==='V-91000002');
            await seccion(page,'sec-atletas');
            await rellenarAtleta(page,'atl','Hermana '+nombre);
            await page.locator('#atl-direccion').fill('2356');
            await page.locator('#form-add-atleta button[type=submit]').click();
            await page.locator('#form-add-atleta .form-validation-message').waitFor({state:'visible'});
            const antes = await db.pool.query('SELECT count(*)::int AS n FROM atletas WHERE nombres=$1',['Hermana '+nombre]);
            assert.equal(antes.rows[0].n,0);
            await page.locator('#atl-direccion').fill('Calle de pruebas 12');
            await page.locator('#atl-cedula').fill('123');
            await page.locator('#atl-telefono').fill('123');
            await page.locator('#atl-has-cedula').uncheck();
            await page.locator('#atl-has-telefono').uncheck();
            const alta = await enviar(page,'#form-add-atleta','/api/atletas/registrar-atleta');
            const {rows} = await db.pool.query('SELECT id_representante,estado,cedula,telefono FROM atletas WHERE id_atleta=$1',[alta.id_atleta]);
            assert.equal(rows[0].id_representante,2);
            assert.equal(rows[0].estado,'espera');
            assert.match(rows[0].cedula,/^V-91000002-\d+$/);
            assert.equal(rows[0].telefono,'04140000001');
            await seccion(page,'sec-atletas');
            await rellenarAtleta(page,'atl','Hermano '+nombre);
            const otra = await enviar(page,'#form-add-atleta','/api/atletas/registrar-atleta');
            assert.notEqual(otra.id_atleta,alta.id_atleta);
            await page.reload();
            await page.waitForFunction(n=>document.querySelector('#table-my-atletas')?.textContent.includes(n),'Hermano '+nombre);
            assert.equal(await page.locator(`#pay-atleta option[value="${alta.id_atleta}"]`).count(),0);
            assert.equal(await page.locator(`#pay-atleta option[value="${otra.id_atleta}"]`).count(),0);
            await fs.mkdir('test-artifacts',{recursive:true});
            await page.screenshot({path:`test-artifacts/inscripcion-real-${nombre==='Móvil'?'movil':'escritorio'}.png`,fullPage:true});
        } finally {await page.context().close();}
    });

    test(`flujo real ${nombre}: directiva registra con representante existente y nuevo sin campos ocultos bloqueantes`, async () => {
        const page = await entrar('directiva@example.org',viewport);
        try {
            await seccion(page,'sec-registrar');
            await page.locator('#dir-rep option[value="2"]').waitFor({state:'attached'});
            await page.selectOption('#dir-rep','2');
            await rellenarAtleta(page,'dir','Directiva '+nombre);
            await page.locator('#dir-cedula').fill('123');
            await page.locator('#dir-telefono').fill('123');
            await page.locator('#dir-has-cedula').uncheck();
            await page.locator('#dir-has-telefono').uncheck();
            const existente = await enviar(page,'#form-dir-atleta','/api/directiva/registrar-atleta');
            assert.equal((await db.pool.query('SELECT estado FROM atletas WHERE id_atleta=$1',[existente.id_atleta])).rows[0].estado,'activo');
            await representanteNuevo(page,nombre==='Móvil'?'movil':'escritorio');
            await rellenarAtleta(page,'dir','Nueva Familia '+nombre);
            const nuevo = await enviar(page,'#form-dir-atleta','/api/directiva/registrar-atleta');
            assert.ok(nuevo.representante.id_usuario);
            const {rows} = await db.pool.query(`SELECT a.id_representante,a.estado,u.estado AS cuenta FROM atletas a
                JOIN usuarios u ON u.id_usuario=a.id_representante WHERE a.id_atleta=$1`,[nuevo.id_atleta]);
            assert.equal(rows[0].id_representante,nuevo.representante.id_usuario);
            assert.equal(rows[0].estado,'activo');assert.equal(rows[0].cuenta,'aprobado');
            const familia = await entrar(nuevo.representante.correo,viewport);
            await familia.waitForFunction(n=>document.querySelector('#table-my-atletas')?.textContent.includes(n),'Nueva Familia '+nombre);
            await familia.context().close();
        } finally {await page.context().close();}
    });
}

test('flujo real: fallo SQL del alta compuesta muestra error, revierte y permite reintentar', async () => {
    const page = await entrar('directiva@example.org');
    try {
        await seccion(page,'sec-registrar');
        await representanteNuevo(page,'rollback');
        await rellenarAtleta(page,'dir','Fallo Reintentable');
        await db.pool.query(`CREATE FUNCTION fallar_inscripcion() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'Fallo SQL sintetico'; END; $$;
            CREATE TRIGGER fallo_sintetico BEFORE INSERT ON atletas FOR EACH ROW EXECUTE FUNCTION fallar_inscripcion()`);
        try {
            await enviar(page,'#form-dir-atleta','/api/directiva/registrar-atleta',500);
            assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM usuarios WHERE correo='nuevo-rollback@example.org'")).rows[0].n,0);
            assert.equal(await page.locator('#dir-nombres').inputValue(),'Fallo Reintentable');
            await page.waitForFunction(()=>document.querySelector('#toast-container')?.textContent.includes('No se pudo completar'));
        } finally {await db.pool.query('DROP TRIGGER fallo_sintetico ON atletas; DROP FUNCTION fallar_inscripcion()');}
        const alta = await enviar(page,'#form-dir-atleta','/api/directiva/registrar-atleta');
        assert.ok(alta.id_atleta);assert.ok(alta.representante.id_usuario);
    } finally {await page.context().close();}
});

test('flujo real: archivos suplantados se rechazan antes de Cloudinary y de SQL', async () => {
    const representante = await entrar('alfa@example.org');
    const directiva = await entrar('directiva@example.org');
    try {
        const imagenFalsa = {name:'identidad.png', mimeType:'image/png',
            buffer:Buffer.from('<html>archivo sintético que no es una imagen</html>')};
        const documentoFalso = {name:'partida.pdf', mimeType:'application/pdf',
            buffer:Buffer.from('<html>archivo sintético que no es PDF</html>')};
        const inicio = numeroCarga;
        const alta = await representante.request.post(base+'/api/atletas/registrar-atleta', {
            multipart: {foto:imagenFalsa, partida_nacimiento:documentoFalso}
        });
        assert.equal(alta.status(),400);
        assert.equal(numeroCarga,inicio);

        const recibo = await representante.request.post(base+'/api/pagos/reportar', {
            multipart: {captura:imagenFalsa}
        });
        assert.equal(recibo.status(),400);
        assert.equal(numeroCarga,inicio);

        const noticia = await directiva.request.post(base+'/api/cms/admin/noticias', {
            multipart: {imagen_noticia:imagenFalsa}
        });
        assert.equal(noticia.status(),400);
        assert.equal(numeroCarga,inicio);
    } finally {
        await representante.context().close();
        await directiva.context().close();
    }
});

test('flujo privado: inscripción guarda URL canónica y protege foto y PDF por propietario', async () => {
    const page = await entrar('alfa@example.org');
    const directiva = await entrar('directiva@example.org');
    const ajeno = await entrar('beta@example.org');
    try {
        await page.waitForFunction(()=>document.querySelector('#perfil-cedula')?.value);
        await seccion(page,'sec-atletas');
        await rellenarAtleta(page,'atl','Documentos Sintéticos');
        await page.locator('#atl-foto').setInputFiles({name:'foto-prueba.png',mimeType:'image/png',
            buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64')});
        await page.locator('#atl-partida').setInputFiles({name:'partida-prueba.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nDOCUMENTO SINTETICO\n%%EOF')});
        fallarCarga = true;
        try {await enviar(page,'#form-add-atleta','/api/atletas/registrar-atleta',400);}
        finally {fallarCarga = false;}
        assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM atletas WHERE nombres='Documentos Sintéticos'")).rows[0].n,0);
        const alta = await enviar(page,'#form-add-atleta','/api/atletas/registrar-atleta');
        const {rows} = await db.pool.query('SELECT foto_url,partida_nacimiento_url FROM atletas WHERE id_atleta=$1',[alta.id_atleta]);
        assert.match(rows[0].foto_url,/^https:\/\/res\.cloudinary\.com\/solo-pruebas\/image\/authenticated\/v123456\/jaguares\/atletas\/archivo-sintetico-\d+\.png$/);
        assert.match(rows[0].partida_nacimiento_url,/^https:\/\/res\.cloudinary\.com\/solo-pruebas\/image\/authenticated\/v123456\/jaguares\/atletas\/archivo-sintetico-\d+\.pdf$/);
        assert.notEqual(rows[0].foto_url,rows[0].partida_nacimiento_url);
        for (const [tipo,formato] of [['foto','png'],['partida_nacimiento','pdf']]) {
            const ruta = `${base}/api/atletas/${alta.id_atleta}/documentos/${tipo}`;
            for (const autorizado of [page,directiva]) {
                const respuesta = await autorizado.request.get(ruta,{maxRedirects:0});
                assert.equal(respuesta.status(),302);
                const url = new URL(respuesta.headers().location);
                assert.match(url.searchParams.get('public_id'),/^jaguares\/atletas\/archivo-sintetico-\d+$/);
                assert.equal(url.searchParams.get('format'),formato);
            }
            assert.equal((await ajeno.request.get(ruta,{maxRedirects:0})).status(),403);
            assert.equal((await fetch(ruta,{redirect:'manual'})).status,401);
        }
    } finally {
        await page.context().close();
        await directiva.context().close();
        await ajeno.context().close();
    }
});

test('compensación real: rechazo de atleta duplicado elimina SOLO documentos nuevos', async () => {
    const page = await entrar('alfa@example.org');
    try {
        const actual = (await db.pool.query(
            "SELECT nombres,apellidos,fecha_nacimiento,direccion FROM atletas WHERE nombres='Documentos Sintéticos' AND id_representante=2 LIMIT 1"
        )).rows[0];
        assert.ok(actual, 'El ensayo de foto/PDF debe existir');
        const comienzo = eliminacionesCompensadas.length;
        const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
        const respuesta = await page.request.post(base+'/api/atletas/registrar-atleta', {
            multipart: {
                nombres: actual.nombres, apellidos: actual.apellidos,
                fecha_nac: actual.fecha_nacimiento, direccion: actual.direccion,
                hereda_cedula: '1', allergies_medicas: '',
                foto: { name:'foto-compensacion.png', mimeType:'image/png', buffer: PNG },
                partida_nacimiento: { name:'partida-compensacion.pdf',
                    mimeType:'application/pdf', buffer: Buffer.from('%PDF-1.4\nSINTETICO\n%%EOF') }
            }
        });
        assert.equal(respuesta.status(),409);
        const nuevos = eliminacionesCompensadas.slice(comienzo);
        assert.equal(nuevos.length,2, 'Las dos cargas temporales son eliminadas');
        assert.ok(nuevos.every(x => x.tipo === 'authenticated' && x.id.startsWith('jaguares/atletas/')));
        assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM atletas WHERE nombres='Documentos Sintéticos' AND id_representante=2")).rows[0].n,1);
    } finally { await page.context().close(); }
});

test('compensación real: pago de atleta en espera revierte captura y no crea pago', async () => {
    const page = await entrar('alfa@example.org');
    try {
        const {rows} = await db.pool.query("SELECT id_atleta FROM atletas WHERE nombres='Documentos Sintéticos' AND id_representante=2 AND estado='espera' LIMIT 1");
        assert.equal(rows.length,1);
        const comienzo = eliminacionesCompensadas.length;
        const respuesta = await page.request.post(base+'/api/pagos/reportar', {
            multipart: {
                id_atleta: String(rows[0].id_atleta), mes: 'Enero',
                metodo: 'Transferencia Bancaria', fecha_pago: '2026-11-09',
                monto: '12.50', moneda: 'Bs', referencia: 'SOLO-ENSAYO-COMPENSACION',
                captura: { name:'comprobante-compensacion.png', mimeType:'image/png',
                    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64') }
            }
        });
        assert.equal(respuesta.status(),409);
        const nuevos = eliminacionesCompensadas.slice(comienzo);
        assert.equal(nuevos.length,1);
        assert.equal(nuevos[0].tipo,'authenticated');
        assert.ok(nuevos[0].id.startsWith('jaguares_comprobantes/'));
        assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM pagos WHERE referencia='SOLO-ENSAYO-COMPENSACION'")).rows[0].n,0);
    } finally { await page.context().close(); }
});

test('flujo real: registro pendiente, aprobación, perfil, inscripción, activación, pago y permisos entre familias', async () => {
    const rep = await pagina();
    const dir = await entrar('directiva@example.org');
    let beta;
    try {
        await rep.goto(base+'/admin/login.html');
        await rep.locator('#tab-register').click();
        for (const [campo,valor] of Object.entries({names:'Registro Nuevo',lastnames:'Sintético',
            email:'registro-web@example.org',password:clave})) await rep.locator('#reg-'+campo).fill(valor);
        const registro = await enviar(rep,'#form-register','/api/auth/register');
        assert.ok(registro.id_usuario);
        assert.equal((await db.pool.query('SELECT estado FROM usuarios WHERE id_usuario=$1',[registro.id_usuario])).rows[0].estado,'pendiente');
        await rep.locator('#tab-login').click();
        await rep.locator('#login-email').fill('registro-web@example.org');
        await rep.locator('#login-password').fill(clave);
        await enviar(rep,'#form-login','/api/auth/login',403);
        assert.equal((await rep.context().cookies()).some(c=>c.name==='token'),false);
        await rep.waitForFunction(()=>document.querySelector('#auth-feedback')?.textContent.includes('pendiente'));
        await dir.reload();
        await seccion(dir,'sec-solicitudes');
        const solicitud = dir.locator('#body-solicitudes tr').filter({hasText:'registro-web@example.org'});
        const aprobacion = dir.waitForResponse(r=>r.url().endsWith('/api/directiva/gestionar-aprobacion')&&r.request().method()==='POST');
        await solicitud.getByRole('button',{name:'Aprobar',exact:true}).click();
        assert.equal((await aprobacion).status(),200);
        await enviar(rep,'#form-login','/api/auth/login');
        await rep.waitForURL('**/panel-representante.html');
        await rep.locator('#onboardingModal').waitFor({state:'visible'});
        await rep.locator('#ob-cedula').fill('V-93000001');
        await rep.locator('#ob-tel1').fill('04140000002');
        const perfil = rep.waitForResponse(r=>r.url().endsWith('/api/usuarios/perfil')&&r.request().method()==='PUT');
        await rep.locator('#form-onboarding button[type=submit]').click();
        assert.equal((await perfil).status(),200);
        await rep.locator('#onboardingModal').waitFor({state:'hidden'});
        await seccion(rep,'sec-atletas');
        await rellenarAtleta(rep,'atl','Atleta En Espera');
        const atleta = await enviar(rep,'#form-add-atleta','/api/atletas/registrar-atleta');
        assert.equal((await db.pool.query('SELECT estado FROM atletas WHERE id_atleta=$1',[atleta.id_atleta])).rows[0].estado,'espera');
        await dir.reload();
        await seccion(dir,'sec-atletas');
        const activacion = dir.waitForResponse(r=>r.url().endsWith('/api/directiva/atleta/estado')&&r.request().method()==='PUT');
        await dir.locator(`.js-atleta-estado[data-id="${atleta.id_atleta}"][data-estado="activo"]`).click();
        assert.equal((await activacion).status(),200);
        await rep.reload();
        await rep.locator(`#pay-atleta option[value="${atleta.id_atleta}"]`).waitFor({state:'attached'});
        await seccion(rep,'sec-pagos');
        await rep.selectOption('#pay-atleta',String(atleta.id_atleta));
        await rep.getByText('No hay cargos pendientes asignados.').waitFor();
        assert.equal(await rep.locator('#form-report-pago button[type=submit]').isDisabled(),true);

        // Compatibilidad: la API legacy sigue admitiendo el reporte histórico
        // solo antes de que Directiva configure obligaciones para el atleta.
        const pagoLegacy={
            id_atleta:String(atleta.id_atleta),mes:'Noviembre',
            metodo:'Efectivo',monto:'25.50',moneda:'USD',fecha_pago:'2026-11-02'
        };
        const invalido=await rep.request.post(base+'/api/pagos/reportar',{
            multipart:{...pagoLegacy,monto:'0'}
        });
        assert.equal(invalido.status(),400);
        assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM pagos WHERE id_atleta=$1',[atleta.id_atleta])).rows[0].n,0);
        const creado=await rep.request.post(base+'/api/pagos/reportar',{
            multipart:pagoLegacy
        });
        assert.equal(creado.status(),200);
        const pago = (await db.pool.query('SELECT id_pago,estado_pago,monto FROM pagos WHERE id_atleta=$1',[atleta.id_atleta])).rows[0];
        assert.equal(pago.estado_pago,'pendiente');assert.equal(pago.monto,'25.50');
        await dir.reload();
        await seccion(dir,'sec-pagos');
        const aprobarPago = dir.waitForResponse(r=>r.url().endsWith('/api/directiva/pago/estado')&&r.request().method()==='PUT');
        await dir.locator(`.js-pago-estado[data-id="${pago.id_pago}"][data-estado="aprobado"]`).click();
        assert.equal((await aprobarPago).status(),200);
        await rep.reload();
        await seccion(rep,'sec-historial');
        await rep.waitForFunction(()=>document.querySelector('#table-my-pagos')?.textContent.toLowerCase().includes('aprobado'));
        beta = await entrar('beta@example.org');
        for (const ruta of [`/api/usuarios/perfil/${registro.id_usuario}`,`/api/atletas/${atleta.id_atleta}`,
            `/api/pagos/historial/${registro.id_usuario}`,`/api/notificaciones/${registro.id_usuario}`]) {
            assert.equal((await beta.request.get(base+ruta)).status(),403,ruta);
        }
        await seccion(rep,'sec-pagos');
        await rep.selectOption('#pay-atleta',String(atleta.id_atleta));
        await seccion(dir,'sec-atletas');
        const desactivar = dir.waitForResponse(r=>r.url().endsWith('/api/directiva/atleta/estado')&&r.request().method()==='PUT');
        await dir.locator(`.js-atleta-estado[data-id="${atleta.id_atleta}"][data-estado="inactivo"]`).click();
        assert.equal((await desactivar).status(),200);
        const denegado=await rep.request.post(base+'/api/pagos/reportar',{
            multipart:{id_atleta:String(atleta.id_atleta),mes:'Noviembre',
                metodo:'Efectivo',monto:'20',moneda:'Bs',fecha_pago:'2026-11-02'}
        });
        assert.equal(denegado.status(),409);
        assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM pagos WHERE id_atleta=$1',[atleta.id_atleta])).rows[0].n,1);
        const notificaciones = await rep.request.get(base+`/api/notificaciones/${registro.id_usuario}`);
        assert.equal((await notificaciones.json()).notificaciones.some(n=>n.mensaje.includes('pago de Noviembre')),true);
        await db.pool.query("UPDATE usuarios SET estado='inactivo' WHERE id_usuario=$1",[registro.id_usuario]);
        assert.equal((await rep.request.get(base+'/api/auth/me')).status(),403);
    } finally {
        await rep.context().close();await dir.context().close();
        if (beta) await beta.context().close();
    }
});

test('flujo real: calendario crea y elimina el evento desde directiva y actualiza la consulta pública', async () => {
    const page = await entrar('directiva@example.org');
    try {
        await seccion(page,'sec-cms');
        const hoy = await page.evaluate(() => window.FechasJaguares.hoyVenezuela());
        const maximo = `${Number(hoy.slice(0,4))+1}-12-31`;
        assert.equal(await page.locator('#evento-fecha').getAttribute('min'), hoy);
        assert.equal(await page.locator('#evento-fecha').getAttribute('max'), maximo);
        assert.equal((await page.request.post(base+'/api/cms/admin/eventos', {data: {
            titulo: 'Fecha imposible', fecha_evento: '2026-02-30', hora_evento: '14:30', lugar: 'Cancha de pruebas'
        }})).status(), 400);
        assert.equal((await page.request.post(base+'/api/cms/admin/eventos', {data: {
            titulo: 'Fecha demasiado lejana', fecha_evento: `${Number(hoy.slice(0,4))+2}-01-01`, hora_evento: '14:30', lugar: 'Cancha de pruebas'
        }})).status(), 400);
        for (const hora_evento of [undefined, '24:00', '14:30Z', '02:00', '04:55', '22:05', '14:02']) {
            assert.equal((await page.request.post(base+'/api/cms/admin/eventos', {data: {
                titulo: 'Hora inválida', fecha_evento: hoy, hora_evento, lugar: 'Cancha de pruebas'
            }})).status(), 400);
        }
        await db.pool.query("INSERT INTO eventos (titulo, fecha_evento, lugar, estado) VALUES ('Evento vencido', '2020-01-01', 'Cancha', 'proximo')");
        await page.locator('#eventos-tab-historial').click();
        const historico = page.locator('#body-eventos tr').filter({hasText:'Histórico sin hora'});
        await historico.waitFor();
        assert.equal((await historico.textContent()).includes('undefined'), false);
        const admin = (await (await page.request.get(base+'/api/cms/admin/eventos')).json()).eventos;
        assert.equal(admin.find(e=>e.titulo==='Histórico sin hora').fecha_evento, '2020-01-01');
        await page.locator('#evento-titulo').fill('Encuentro de Prueba');
        await page.locator('#evento-lugar').fill('Cancha de pruebas');
        await page.locator('#evento-fecha').fill(hoy);
        await page.locator('#evento-hora-boton').click();
        await page.locator('#evento-reloj-hora').selectOption('2'); // p. m. por defecto
        await page.locator('#evento-reloj-minutos [data-minuto="30"]').click();
        assert.equal(await page.locator('#evento-hora').inputValue(), '14:30');
        await page.locator('#eventos-tab-proximos').click();
        const creado = await enviar(page,'#form-evento','/api/cms/admin/eventos',201);
        const guardado = await db.pool.query('SELECT fecha_evento FROM eventos WHERE id_evento=$1',[creado.id_evento]);
        assert.equal(guardado.rows[0].fecha_evento.toISOString(), `${hoy}T00:00:00.000Z`);
        const publico = async () => (await (await page.request.get(base+'/api/cms/public/eventos')).json()).eventos;
        assert.equal((await publico()).some(e=>e.titulo==='Evento vencido'),false);
        assert.equal((await publico()).some(e=>e.id_evento===creado.id_evento),true);
        assert.equal((await publico()).find(e=>e.id_evento===creado.id_evento).hora_evento,'14:30');
        assert.equal((await publico()).find(e=>e.id_evento===creado.id_evento).fecha_evento,hoy);
        const fila = page.locator('#body-eventos tr').filter({hasText:'Encuentro de Prueba'});
        await fila.getByText('14:30 (Venezuela)').waitFor();
        for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
            const rep = await entrar('alfa@example.org', viewport, false, 'Asia/Tokyo');
            try {
                await seccion(rep,'sec-eventos');
                await rep.locator('#table-eventos-representante tbody').getByText('14:30 (Venezuela)').waitFor();
            } finally { await rep.context().close(); }
            const publica = await pagina(viewport, false, 'Asia/Tokyo');
            try {
                await publica.goto(base+'/index.html');
                await publica.locator('#lista-eventos-publicos').getByText('14:30', {exact:false}).waitFor();
            } finally { await publica.context().close(); }
        }
        const representante = await entrar('alfa@example.org', {width: 390, height: 844});
        try {
            const denegado = await representante.request.delete(base+'/api/cms/admin/eventos/'+creado.id_evento);
            assert.equal(denegado.status(), 403);
        } finally { await representante.context().close(); }
        const borrado = page.waitForResponse(r=>r.url().endsWith('/api/cms/admin/eventos/'+creado.id_evento)&&r.request().method()==='DELETE');
        await page.locator('#body-eventos tr').filter({hasText:'Encuentro de Prueba'})
            .getByRole('button',{name:'Eliminar evento: Encuentro de Prueba'}).click();
        assert.equal((await borrado).status(), 200);
        assert.equal((await publico()).some(e=>e.id_evento===creado.id_evento),false);
        assert.equal((await db.pool.query('SELECT count(*) AS n FROM eventos WHERE id_evento=$1',[creado.id_evento])).rows[0].n, '0');
    } finally {await page.context().close();}
});

test('flujo real: cuerpos de inscripción ausentes o con tipo incorrecto reciben 400', async () => {
    for (const [correo,ruta] of [['alfa@example.org','/api/atletas/registrar-atleta'],
        ['directiva@example.org','/api/directiva/registrar-atleta']]) {
        const page = await entrar(correo);
        try {
            for (const options of [{},{data:[]},{data:'null',headers:{'Content-Type':'application/json'}},
                {data:'{',headers:{'Content-Type':'application/json'}}]) {
                assert.equal((await page.request.post(base+ruta,options)).status(),400);
            }
            assert.equal((await page.request.post(base+ruta,{data:{nombres:'x'.repeat(1024*1024)}})).status(),413);
        } finally {await page.context().close();}
    }
});

test('flujo real: transferencia exige captura y persiste el comprobante tras cambiar de método', async () => {
    const page = await entrar('alfa@example.org');
    try {
        const {rows} = await db.pool.query("SELECT id_atleta FROM atletas WHERE id_representante=2 AND estado='activo' LIMIT 1");
        await page.locator(`#pay-atleta option[value="${rows[0].id_atleta}"]`).waitFor({state:'attached'});
        await seccion(page,'sec-pagos');
        await page.selectOption('#pay-atleta',String(rows[0].id_atleta));
        await page.getByText('No hay cargos pendientes asignados.').waitFor();
        assert.equal(await page.locator('#form-report-pago button[type=submit]').isDisabled(),true);
        // El endpoint histórico no pierde la validación de comprobantes privados.
        const sinComprobante=await page.request.post(base+'/api/pagos/reportar',{
            multipart:{id_atleta:String(rows[0].id_atleta),mes:'Noviembre',
                metodo:'Transferencia Bancaria',monto:'35.50',moneda:'Bs',
                fecha_pago:'2026-11-02',referencia:'REFERENCIA-SINTETICA'}
        });
        assert.equal(sinComprobante.status(),400);
        const reporte=await page.request.post(base+'/api/pagos/reportar',{
            multipart:{id_atleta:String(rows[0].id_atleta),mes:'Noviembre',
                metodo:'Transferencia Bancaria',monto:'35.50',moneda:'Bs',
                fecha_pago:'2026-11-02',referencia:'REFERENCIA-SINTETICA',
                captura:{name:'comprobante-prueba.png',mimeType:'image/png',
                    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64')}
            }
        });
        assert.equal(reporte.status(),200);
        const pago = (await db.pool.query('SELECT id_pago,moneda,ruta_captura FROM pagos WHERE referencia=$1',['REFERENCIA-SINTETICA'])).rows[0];
        assert.equal(pago.moneda,'Bs');
        assert.match(pago.ruta_captura,/^https:\/\/res\.cloudinary\.com\/solo-pruebas\/image\/authenticated\/v123456\/jaguares_comprobantes\/archivo-sintetico-\d+\.png$/);
        const ruta = `${base}/api/pagos/captura/${pago.id_pago}?abrir=1`;
        const propio = await page.request.get(ruta,{maxRedirects:0});
        assert.equal(propio.status(),302);
        const firmado = new URL(propio.headers().location);
        assert.match(firmado.searchParams.get('public_id'),/^jaguares_comprobantes\/archivo-sintetico-\d+$/);
        assert.equal(firmado.searchParams.get('format'),'png');
        const directiva = await entrar('directiva@example.org');
        const ajeno = await entrar('beta@example.org');
        try {
            assert.equal((await directiva.request.get(ruta,{maxRedirects:0})).status(),302);
            assert.equal((await ajeno.request.get(ruta,{maxRedirects:0})).status(),403);
            assert.equal((await fetch(ruta,{redirect:'manual'})).status,401);
        } finally {
            await directiva.context().close();
            await ajeno.context().close();
        }
        assert.equal(await page.locator('#pay-monto-trans').isDisabled(),true);
        assert.equal(await page.locator('#pay-monto-efec').isDisabled(),true);
    } finally {await page.context().close();}
});

test('pagos rechazados: permisos, estados y eliminación SQL desde directiva', async () => {
    const atleta = await db.pool.query(
        "INSERT INTO atletas (id_representante, nombres, cedula, estado) VALUES (2,'Pago Sintético',$1,'activo') RETURNING id_atleta",
        [cedulaLibre()]
    );
    const idAtleta = atleta.rows[0].id_atleta;
    const ids = [];
    for (const estado of ['rechazado', 'pendiente', 'aprobado']) {
        const pago = await db.pool.query(
            "INSERT INTO pagos (id_atleta,mes_pagado,metodo_pago,fecha_pago,monto,moneda,estado_pago,ruta_captura) " +
            "VALUES ($1,'Noviembre','Efectivo','2026-11-08',12.50,'USD',$2,NULL) RETURNING id_pago",
            [idAtleta, estado]
        );
        ids.push(pago.rows[0].id_pago);
    }
    const [rechazado, pendiente, aprobado] = ids;
    const ruta = '/api/directiva/pago/' + rechazado;
    assert.equal((await fetch(base + ruta, {method:'DELETE'})).status, 401);
    const rep = await entrar('alfa@example.org');
    try {
        assert.equal((await rep.request.delete(base + ruta)).status(), 403);
    } finally {await rep.context().close();}

    const hash = await bcrypt.hash(clave, 10);
    await db.pool.query(
        "INSERT INTO usuarios (nombres, apellidos, correo, password_hash, rol, estado) " +
        "VALUES ('Staff','Prueba','staff-pagos@example.org',$1,'staff','aprobado')", [hash]
    );
    const staff = await entrar('staff-pagos@example.org');
    try {
        assert.equal((await staff.request.delete(base + ruta)).status(), 403);
    } finally {await staff.context().close();}

    const dir = await entrar('directiva@example.org',{width:390,height:844});
    try {
        assert.equal((await dir.request.delete(base + '/api/directiva/pago/invalido')).status(), 400);
        assert.equal((await dir.request.delete(base + '/api/directiva/pago/99999999')).status(), 404);
        for(const id of [pendiente,aprobado]) {
            assert.equal((await dir.request.delete(base + '/api/directiva/pago/' + id)).status(), 409);
            assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM pagos WHERE id_pago=$1',[id])).rows[0].n,1);
        }
        await seccion(dir,'sec-pagos');
        await dir.selectOption('#filter-estado-pagos','todos');
        const borrar = dir.locator('#body-pagos button.js-pago-eliminar[data-id="' + rechazado + '"]');
        await borrar.waitFor({state:'visible'});
        assert.equal(await dir.locator('#body-pagos button.js-pago-eliminar[data-id="' + pendiente + '"]').count(),0);
        assert.equal(await dir.locator('#body-pagos button.js-pago-eliminar[data-id="' + aprobado + '"]').count(),0);
        const respuesta = dir.waitForResponse(r => r.url().endsWith(ruta) && r.request().method()==='DELETE');
        await borrar.click();
        assert.equal((await respuesta).status(), 200);
        assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM pagos WHERE id_pago=$1',[rechazado])).rows[0].n,0);
        assert.equal((await dir.request.delete(base + ruta)).status(), 404);
        assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM pagos WHERE id_pago=ANY($1::int[])',
            [[pendiente, aprobado]])).rows[0].n, 2);
    } finally {await dir.context().close();}
});

test('pagos rechazados: si otro operador cambia el estado, no se elimina', async () => {
    const a = await db.pool.query(
        "INSERT INTO atletas (id_representante,nombres,cedula,estado) VALUES (2,'Atleta Conflicto',$1,'activo') RETURNING id_atleta",
        [cedulaLibre()]
    );
    const p = await db.pool.query(
        "INSERT INTO pagos (id_atleta,estado_pago) VALUES ($1,'rechazado') RETURNING id_pago",
        [a.rows[0].id_atleta]
    );
    const id = p.rows[0].id_pago;
    const dir = await entrar('directiva@example.org');
    try {
        await db.pool.query("UPDATE pagos SET estado_pago='aprobado' WHERE id_pago=$1",[id]);
        const r = await dir.request.delete(base + '/api/directiva/pago/' + id);
        assert.equal(r.status(),409);
        assert.equal((await db.pool.query('SELECT estado_pago FROM pagos WHERE id_pago=$1',[id])).rows[0].estado_pago,'aprobado');
    } finally {await dir.context().close();}
});

test('flujo real: si no carga el validador, ambos paneles envían y el backend valida los datos', async () => {
    for (const [correo,prefijo,seccionId,ruta] of [
        ['alfa@example.org','atl','sec-atletas','/api/atletas/registrar-atleta'],
        ['directiva@example.org','dir','sec-registrar','/api/directiva/registrar-atleta']
    ]) {
        const page = await entrar(correo,undefined,true);
        try {
            await page.waitForFunction(()=>document.querySelector('#user-info strong'));
            await seccion(page,seccionId);
            if(prefijo==='dir') {
                await page.locator('#dir-rep option[value="2"]').waitFor({state:'attached'});
                await page.selectOption('#dir-rep','2');
            }
            await rellenarAtleta(page,prefijo,'Validador No Disponible '+(prefijo==='dir'?'Directiva':'Representante'));
            await page.locator(`#${prefijo}-nombres`).fill('Nombre123');
            await enviar(page,prefijo==='dir'?'#form-dir-atleta':'#form-add-atleta',ruta,400);
            await page.locator(`#${prefijo}-nombres`).fill('Respaldo '+(prefijo==='dir'?'Directiva':'Representante'));
            const alta = await enviar(page,prefijo==='dir'?'#form-dir-atleta':'#form-add-atleta',ruta);
            assert.ok(alta.id_atleta);
        } finally {await page.context().close();}
    }
});

for (const [nombre,viewport,timezoneId] of [
    ['Escritorio',{width:1440,height:900},'America/Caracas'],
    ['Móvil',{width:390,height:844},'Asia/Tokyo']
]) {
    test(`fechas civiles reales ${nombre} ${timezoneId}: nacimiento, duplicado y pagos conservan el día`, async () => {
        const rep = await entrar('alfa@example.org',viewport,false,timezoneId);
        const dir = await entrar('directiva@example.org',viewport,false,timezoneId);
        const nombres = 'Fechas Civiles '+nombre;
        const nacimiento = '2014-05-10';
        const fechaPago = '2026-11-02';
        try {
            await rep.waitForFunction(()=>document.querySelector('#perfil-cedula')?.value==='V-91000002');
            await seccion(rep,'sec-atletas');
            await rellenarAtleta(rep,'atl',nombres);
            const alta = await enviar(rep,'#form-add-atleta','/api/atletas/registrar-atleta');
            const persistida = await db.pool.query('SELECT fecha_nacimiento FROM atletas WHERE id_atleta=$1',[alta.id_atleta]);
            assert.equal(persistida.rows[0].fecha_nacimiento,nacimiento);

            // Cambiar la cédula no convierte una misma identidad familiar en otro atleta.
            await seccion(rep,'sec-atletas');
            await rellenarAtleta(rep,'atl',nombres);
            await enviar(rep,'#form-add-atleta','/api/atletas/registrar-atleta',409);
            const conteo = await db.pool.query(`SELECT count(*)::int AS total FROM atletas
                WHERE id_representante=2 AND nombres=$1`,[nombres]);
            assert.equal(conteo.rows[0].total,1);
            await rep.waitForFunction(()=>document.querySelector('#toast-container')?.textContent.includes('ya está registrado'));

            const listado = await (await rep.request.get(base+'/api/atletas/representante/2')).json();
            assert.equal(listado.atletas.find(a=>a.id_atleta===alta.id_atleta).fecha_nacimiento,nacimiento);
            const ficha = await (await dir.request.get(base+`/api/atletas/${alta.id_atleta}`)).json();
            assert.equal(ficha.atleta.fecha_nacimiento,nacimiento);
            await dir.reload();
            await seccion(dir,'sec-atletas');
            const filaAtleta = dir.locator('#body-atletas tr').filter({hasText:nombres+' Núñez'});
            await filaAtleta.waitFor({state:'visible'});
            assert.equal((await filaAtleta.locator('td').nth(2).innerText()).trim(),'10/5/2014');
            await filaAtleta.getByRole('button',{name:/^Ver planilla de /}).click();
            const fechaPlanilla = dir.locator('#planillaModal .planilla-table tr').filter({hasText:'Fecha de nacimiento'}).locator('td');
            await fechaPlanilla.waitFor({state:'visible'});
            assert.equal((await fechaPlanilla.innerText()).trim(),'10/5/2014');
            await dir.locator('#planillaModal').getByRole('button',{name:'Cerrar',exact:true}).click();

            const activacion = dir.waitForResponse(r=>r.url().endsWith('/api/directiva/atleta/estado')&&r.request().method()==='PUT');
            await dir.locator(`.js-atleta-estado[data-id="${alta.id_atleta}"][data-estado="activo"]`).click();
            assert.equal((await activacion).status(),200);
            await rep.reload();
            await rep.locator(`#pay-atleta option[value="${alta.id_atleta}"]`).waitFor({state:'attached'});
            await seccion(rep,'sec-pagos');
            await rep.selectOption('#pay-atleta',String(alta.id_atleta));
            await rep.getByText('No hay cargos pendientes asignados.').waitFor();
            for (const metodo of ['Efectivo','Transferencia Bancaria']) {
                const body={
                    id_atleta:String(alta.id_atleta),mes:'Noviembre',metodo,
                    monto:metodo==='Efectivo'?'10.00':'35.50',
                    moneda:metodo==='Efectivo'?'USD':'Bs',
                    fecha_pago:fechaPago
                };
                if (metodo==='Transferencia Bancaria') {
                    body.referencia='REFERENCIA-FECHAS-'+nombre;
                    body.captura={name:'comprobante-fechas.png',mimeType:'image/png',
                        buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64')};
                }
                const r=await rep.request.post(base+'/api/pagos/reportar',{multipart:body});
                assert.equal(r.status(),200);
            }

            const pagosSQL = await db.pool.query('SELECT fecha_pago FROM pagos WHERE id_atleta=$1 ORDER BY id_pago',[alta.id_atleta]);
            assert.deepEqual(pagosSQL.rows.map(p=>p.fecha_pago),[fechaPago,fechaPago]);
            const historial = await (await rep.request.get(base+'/api/pagos/historial/2')).json();
            assert.deepEqual(historial.datos.filter(p=>p.id_atleta===alta.id_atleta).map(p=>p.fecha_pago),[fechaPago,fechaPago]);
            await seccion(rep,'sec-historial');
            await rep.waitForFunction(n=>[...document.querySelectorAll('#table-my-pagos tbody tr')]
                .filter(f=>f.textContent.includes(n)).length===2,nombres);
            const filasRep = rep.locator('#table-my-pagos tbody tr').filter({hasText:nombres+' Núñez'});
            assert.deepEqual((await filasRep.locator('td:first-child').allTextContents()).map(x=>x.trim()),['2/11/2026','2/11/2026']);

            const auditoria = await (await dir.request.get(base+'/api/directiva/auditoria')).json();
            assert.equal(auditoria.atletas.find(a=>a.id_atleta===alta.id_atleta).fecha_nac,nacimiento);
            assert.deepEqual(auditoria.pagos.filter(p=>p.atl_nombres===nombres).map(p=>p.fecha_pago),[fechaPago,fechaPago]);
            await dir.reload();
            await seccion(dir,'sec-pagos');
            const filasDir = dir.locator('#body-pagos tr').filter({hasText:nombres+' Núñez'});
            await filasDir.first().waitFor({state:'visible'});
            assert.equal(await filasDir.count(),2);
            assert.deepEqual((await filasDir.locator('td:nth-child(3)').allTextContents()).map(x=>x.trim()),['2/11/2026','2/11/2026']);
        } finally {
            await rep.context().close();
            await dir.context().close();
        }
    });
}
