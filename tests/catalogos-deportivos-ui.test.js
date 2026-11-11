'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const raiz = path.join(__dirname, '../public');
const colecciones = { temporadas:[], categorias:[], equipos:[] };
const pk = { temporadas:'id_temporada', categorias:'id_categoria', equipos:'id_equipo' };
let atletasFixture = [];
let server, base, browser;
const errores = [];

const responder = (res, status, body) => {
    res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify(body));
};

test.before(async () => {
    server = http.createServer(async (req,res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/api/auth/me') {
            return responder(res,200,{success:true,
                usuario:{id_usuario:5,rol:'directiva',nombres:'Directiva',apellidos:'Prueba'},
                sesion:{id:'fixture-deportivo',servidor:Date.now(),
                    vence:Date.now()+900000,limite:Date.now()+43200000}});
        }
        if (url.pathname === '/api/directiva/auditoria') {
            return responder(res, 200, { success: true, atletas: atletasFixture, pagos: [],
                metricas: { activos: 0, espera: 0, pagos_pendientes: 0 }, tasa_bcv: 36.5 });
        }
        if (url.pathname === '/api/directiva/deportes/catalogo') {
            return responder(res,200,{success:true,...colecciones});
        }
        const m = /^\/api\/directiva\/deportes\/(temporadas|categorias|equipos)(?:\/(\d+))?$/.exec(url.pathname);
        if (m && (req.method === 'POST' || req.method === 'PUT')) {
            let texto = '';
            for await (const pedazo of req) texto += pedazo;
            const body = JSON.parse(texto);
            const tipo = m[1];
            let fila;
            if (req.method === 'POST') {
                fila = {[pk[tipo]]:colecciones[tipo].length+1,nombre:body.nombre};
                if (tipo === 'categorias') fila.id_temporada = Number(body.id_temporada);
                if (tipo === 'equipos') fila.id_categoria = Number(body.id_categoria);
                colecciones[tipo].push(fila);
            } else {
                fila = colecciones[tipo].find(x => x[pk[tipo]] === Number(m[2]));
                if (fila) fila.nombre = body.nombre;
            }
            return responder(res,fila ? (req.method==='POST' ? 201:200) :404,{success:!!fila,registro:fila});
        }
        if (url.pathname.startsWith('/api/')) {
            return responder(res,200,{success:true,
                metricas:{activos:0,espera:0,pagos_pendientes:0},
                atletas:[],pagos:[],eventos:[],solicitudes:[],tasa_bcv:36.5});
        }
        const destino = path.resolve(raiz, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!destino.startsWith(raiz+path.sep)) return res.writeHead(403).end();
        try {
            const content=await fs.readFile(destino);
            const ext=path.extname(destino);
            const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon'}[ext]||'application/octet-stream';
            res.writeHead(200,{'Content-Type':mime});res.end(content);
        } catch {res.writeHead(404);res.end('No encontrado');}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    base='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({headless:true});
});
test.after(async()=>{
    if(browser)await browser.close();
    if(server)await new Promise(resolve=>server.close(resolve));
    assert.deepEqual(errores,[]);
});

async function abrirApartado(page, id) {
    const toggleMovil = page.locator('#mobile-menu-btn');
    if (await toggleMovil.isVisible() && !(await page.locator('#sidebar').evaluate(x => x.classList.contains('open')))) {
        await toggleMovil.click();
    }
    const item = page.locator('[data-target="' + id + '"]');
    const grupo = item.locator('xpath=ancestor::li[contains(concat(" ", normalize-space(@class), " "), " sidebar-group ")]');
    if (await grupo.count()) {
        const boton = grupo.locator('.sidebar-group__toggle');
        if (await boton.getAttribute('aria-expanded') !== 'true') await boton.click();
    }
    await item.click();
}

test('panel: crear y renombrar los tres catálogos sin usar innerHTML para nombres',async()=>{
    const context=await browser.newContext({viewport:{width:1366,height:850}});
    await context.route('**/*', r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errores.push(e.message));
    try {
        await page.goto(base+'/admin/panel-directiva.html');
        await abrirApartado(page, 'sec-deportes');
        await page.locator('#deportes-form-temporadas input[name=nombre]').fill('2026–2027');
        await page.locator('#deportes-form-temporadas [data-guardar]').click();
        await page.locator('#deportes-lista-temporadas strong').filter({hasText:'2026–2027'}).waitFor();

        await page.locator('#deportes-form-categorias select').selectOption('1');
        await page.locator('#deportes-form-categorias input[name=nombre]').fill('Sub-14');
        await page.locator('#deportes-form-categorias [data-guardar]').click();
        await page.locator('#deportes-lista-categorias strong').filter({hasText:'Sub-14'}).waitFor();

        await page.locator('#deportes-form-equipos select').selectOption('1');
        await page.locator('#deportes-form-equipos input[name=nombre]').fill('Jaguares A');
        await page.locator('#deportes-form-equipos [data-guardar]').click();
        await page.locator('#deportes-lista-equipos strong').filter({hasText:'Jaguares A'}).waitFor();

        await page.locator('#deportes-lista-equipos button[data-id]').click();
        await page.locator('#deportes-form-equipos input[name=nombre]').fill('Jaguares Principal');
        await page.locator('#deportes-form-equipos [data-guardar]').click();
        await page.locator('#deportes-lista-equipos strong').filter({hasText:'Jaguares Principal'}).waitFor();

        assert.equal(colecciones.temporadas.length,1);
        assert.equal(colecciones.categorias[0].id_temporada,1);
        assert.equal(colecciones.equipos[0].id_categoria,1);
        assert.equal(colecciones.equipos[0].nombre,'Jaguares Principal');
    }finally{await context.close();}
});

test('panel móvil: organización deportiva se puede abrir desde el menú',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:820}});
    await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errores.push(e.message));
    try{
        await page.goto(base+'/admin/panel-directiva.html');
        await abrirApartado(page, 'sec-deportes');
        await page.locator('#deportes-lista-equipos').waitFor({state:'visible'});
        assert.equal(await page.locator('#sec-deportes').evaluate(el=>el.classList.contains('active')),true);
    }finally{await context.close();}
});

test('inscripción directiva: edad muestra la categoría sin selector y señala elegibilidad pendiente', async () => {
    const context=await browser.newContext({viewport:{width:1366,height:850}});
    await context.route('**/*', r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errores.push(e.message));
    try {
        await page.goto(base+'/admin/panel-directiva.html');
        await abrirApartado(page, 'sec-registrar');
        const anio=await page.evaluate(() => Number(window.JaguaresCategoriasFormativas.hoyCaracasISO().slice(0,4)));
        await page.locator('#dir-fecha-nac').fill((anio-10)+'-01-01');
        await page.waitForFunction(() => document.getElementById('dir-categoria-nombre').textContent === 'U-11 Formación');
        assert.equal(await page.locator('#dir-categoria-automatica').getAttribute('data-estado'),'orientativa');
        await page.locator('#dir-fecha-nac').fill((anio-14)+'-01-01');
        await page.waitForFunction(() => document.getElementById('dir-categoria-nombre').textContent === 'U-15 Infantil (M)');
        assert.equal(await page.locator('#dir-categoria-automatica').getAttribute('data-estado'),'requiere_validacion');
        await page.locator('#dir-fecha-nac').fill((anio-17)+'-01-01');
        await page.waitForFunction(() => document.getElementById('dir-categoria-nombre').textContent === 'Pendiente de clasificación');
        assert.equal(await page.locator('#dir-categoria-automatica').getAttribute('data-estado'),'sin_categoria_publicada');
        assert.equal(await page.locator('#form-dir-atleta [name="categoria"]').count(),0);
    } finally { await context.close(); }
});

test('panel deportivo: diseño actualizado muestra resúmenes y estructura sin perder nombres', async () => {
    const context=await browser.newContext({viewport:{width:390,height:820}});
    await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errores.push(e.message));
    try {
        await page.goto(base+'/admin/panel-directiva.html');
        await page.locator('#mobile-menu-btn').click();
        await abrirApartado(page, 'sec-deportes');
        await page.waitForFunction(() => document.getElementById('deportes-total-equipos').textContent === '1');
        assert.equal(await page.locator('.deportes-hero').count(),0);
        assert.equal(await page.locator('.deportes-cabecera').count(),1);
        assert.equal(await page.locator('#deportes-total-temporadas').innerText(),'1');
        assert.equal(await page.locator('#deportes-total-categorias').innerText(),'1');
        assert.equal(await page.locator('#deportes-total-equipos').innerText(),'1');
        assert.equal(await page.locator('#deportes-lista-equipos strong').innerText(),'Jaguares Principal');
    } finally { await context.close(); }
});

test('directiva: filtrar categorías, estado y búsqueda sin alterar el catálogo ni exportar datos', async () => {
    const entrada = (id, nombre, estado, codigo, titulo) => ({
        id_atleta: id, id_representante: 2, nombres: nombre, apellidos: 'Sintético',
        rep_nombres: 'Representante', rep_apellidos: 'Sintético',
        fecha_nac: '2018-06-10', estado,
        clasificacion: codigo === 'sin_categoria'
            ? {estado:'sin_categoria_publicada', categoria:null}
            : {estado:'orientativa', categoria:{codigo, nombre:titulo}}
    });
    atletasFixture = [
        entrada(11, 'Ana', 'activo', 'u9', 'U-9 Iniciación'),
        entrada(12, 'Luis', 'espera', 'u13', 'U-13 Mini Voleibol'),
        entrada(13, 'Eva', 'activo', 'sin_categoria', '')
    ];
    const context = await browser.newContext({viewport:{width:1280,height:820}});
    await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page = await context.newPage();
    page.on('pageerror', e=>errores.push(e.message));
    try {
        await page.goto(base+'/admin/panel-directiva.html');
        await abrirApartado(page, 'sec-atletas');
        await page.waitForFunction(() => document.querySelectorAll('#body-atletas tr').length === 3);
        await page.locator('#filter-categoria-atletas').selectOption('u9');
        await page.waitForFunction(() => document.getElementById('atletas-resultado-filtro').textContent.includes('1 de 3'));
        assert.equal(await page.locator('#body-atletas tr:visible').count(),1);
        assert.match(await page.locator('#body-atletas tr:visible').innerText(), /Ana/);
        await page.locator('#filter-estado-atletas').selectOption('espera');
        assert.equal(await page.locator('#body-atletas tr:visible').count(),0);
        await page.locator('#filter-estado-atletas').selectOption('activo');
        await page.locator('#search-atletas').fill('Ana');
        assert.equal(await page.locator('#body-atletas tr:visible').count(),1);
        await page.locator('#search-atletas').fill('Luis');
        assert.equal(await page.locator('#body-atletas tr:visible').count(),0);
        await page.locator('#search-atletas').fill('');
        await page.locator('#filter-categoria-atletas').selectOption('sin_categoria');
        assert.equal(await page.locator('#body-atletas tr:visible').count(),1);
        assert.match(await page.locator('#body-atletas tr:visible').innerText(), /Eva/);
        assert.equal(await page.locator('button').filter({hasText:'Planilla general'}).count(),0);
    } finally {
        atletasFixture = [];
        await context.close();
    }
});

test('UX operativa: menú agrupado accesible, nombre proporcionado y categoría compacta', async () => {
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errores.push(e.message));
    try {
        await page.goto(base+'/admin/panel-directiva.html');
        const grupo=page.locator('[aria-controls="nav-club-secciones"]');
        assert.equal(await grupo.getAttribute('aria-expanded'),'false');
        await grupo.click();
        assert.equal(await grupo.getAttribute('aria-expanded'),'true');
        await page.locator('[data-target="sec-registrar"]').click();
        assert.equal(await page.locator('#sec-registrar').isVisible(),true);
        const nombre = await page.locator('#dir-nombres').boundingBox();
        const contenedor = await page.locator('#form-dir-atleta').boundingBox();
        assert.ok(nombre.width < contenedor.width * .45, 'Nombre no debe ocupar media hoja');
        await page.locator('#dir-fecha-nac').fill('2016-02-01');
        await page.waitForFunction(() => document.getElementById('dir-categoria-nombre').textContent === 'U-11 Formación');
        const insignia = await page.locator('#dir-categoria-automatica').boundingBox();
        assert.ok(insignia.height < 100, 'Categoría ocupa demasiado espacio');
        await abrirApartado(page, 'sec-deportes');
        assert.equal(await page.locator('.deportes-hero').count(),0);
        const alturas = await page.locator('.deportes-card').evaluateAll(cards=>cards.map(c=>Math.round(c.getBoundingClientRect().height)));
        assert.equal(Math.max(...alturas)-Math.min(...alturas),0,'Tarjetas no alineadas en desktop');
    }finally {await context.close();}
});

test('directiva móvil: navegación de grupos y tarjetas de catálogos sin desbordamiento', async () => {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errores.push(e.message));
    try {
        await page.goto(base+'/admin/panel-directiva.html');
        await abrirApartado(page, 'sec-atletas');
        assert.equal(await page.locator('#filter-categoria-atletas').isVisible(),true);
        assert.ok((await page.locator('#filter-categoria-atletas option').count()) >= 7);
        await abrirApartado(page, 'sec-deportes');
        await page.locator('.deportes-card').first().waitFor({state:'visible'});
        const visibles = await page.locator('.deportes-card').evaluateAll(cards => cards.map(c => {
            const rect=c.getBoundingClientRect();
            return {izquierda:rect.left,derecha:rect.right,ancho:rect.width};
        }));
        assert.equal(visibles.length,3);
        assert.ok(visibles.every(r=>r.izquierda >= -1 && r.derecha <= 392),'Tarjetas deben caber en teléfono');
        const grupos=page.locator('.sidebar-group__toggle');
        assert.equal(await grupos.count(),2);
    }finally{await context.close();}
});

test('Organización Deportiva: acciones Agregar alineadas sin perder Edición', async () => {
    const context = await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page = await context.newPage();
    page.on('pageerror', e=>errores.push(e.message));
    try {
        await page.goto(base+'/admin/panel-directiva.html');
        await abrirApartado(page, 'sec-deportes');
        await page.locator('#deportes-form-equipos [data-guardar]').waitFor({state:'visible'});
        const posiciones = await page.locator('.deportes-form [data-guardar]').evaluateAll(botones =>
            botones.map(b => {
                const r=b.getBoundingClientRect();
                return { y:r.top, alto:r.height };
            }));
        assert.equal(posiciones.length,3);
        assert.ok(Math.max(...posiciones.map(p=>p.y))-Math.min(...posiciones.map(p=>p.y)) < 4,
            'Agregar debe estar en la misma línea en las tres tarjetas');
        assert.equal(await page.locator('#deportes-lista-equipos .deportes-editar').count(),1);
    } finally { await context.close(); }
});

test('Gestión de atletas: reutilizar SVG de pagos y respetar acciones según estado', async () => {
    const crear = (id, estado) => ({
        id_atleta:id, id_representante:2, nombres:'Atleta '+id, apellidos:'Sintético',
        rep_nombres:'Familia', rep_apellidos:'Prueba', rep_telefono1:'04141234567',
        fecha_nac:'2018-02-10', estado,
        clasificacion:{estado:'orientativa',categoria:{codigo:'u9',nombre:'U-9 Iniciación'}}
    });
    atletasFixture = [crear(51,'espera'),crear(52,'activo'),crear(53,'inactivo')];
    const context = await browser.newContext({viewport:{width:1400,height:900}});
    await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page = await context.newPage();
    page.on('pageerror',e=>errores.push(e.message));
    try {
        await page.goto(base+'/admin/panel-directiva.html');
        await abrirApartado(page,'sec-atletas');
        await page.waitForFunction(() => document.querySelectorAll('#body-atletas tr').length === 3);
        const filas = page.locator('#body-atletas tr');
        assert.equal(await filas.nth(0).locator('.acciones-atletas .pago-icono').count(),4);
        assert.equal(await filas.nth(1).locator('.acciones-atletas .pago-icono').count(),3);
        assert.equal(await filas.nth(2).locator('.acciones-atletas .pago-icono').count(),3);
        assert.equal(await filas.nth(0).locator('button[aria-label^="Aprobar"]').count(),1);
        assert.equal(await filas.nth(1).locator('button[aria-label^="Aprobar"]').count(),0);
        assert.equal(await filas.nth(2).locator('button[aria-label^="Inactivar"]').count(),0);
        assert.equal(await filas.nth(0).locator('.pago-icono svg').count(),3);
        assert.equal(await filas.nth(0).locator('a.pago-icono--whatsapp').count(),1);
        assert.equal(await filas.nth(0).locator('button[title="Ver planilla"]').count(),1);
        assert.equal(await filas.nth(0).locator('button[title="Ver planilla"]').innerText(),'');
    } finally {
        atletasFixture = [];
        await context.close();
    }
});

test('directiva: nombre, apellido, cédula y segunda fila de datos alineados',async()=>{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errores.push(e.message));
    try{
        await page.goto(base+'/admin/panel-directiva.html');
        await abrirApartado(page,'sec-registrar');
        const grupos=await page.evaluate(()=>{
            const ids=['dir-nombres','dir-apellidos','dir-cedula',
                'dir-fecha-nac','dir-direccion','dir-telefono'];
            return ids.map(id=>{
                const rect=document.getElementById(id).closest('.form-group-panel').getBoundingClientRect();
                return {x:rect.left,y:rect.top};
            });
        });
        assert.ok(grupos[0].x<grupos[1].x && grupos[1].x<grupos[2].x);
        assert.ok(grupos[3].x<grupos[4].x && grupos[4].x<grupos[5].x);
        assert.ok(Math.abs(grupos[0].y-grupos[2].y)<5);
        assert.ok(Math.abs(grupos[3].y-grupos[5].y)<5);
        await page.locator('#dir-fecha-nac').fill('2021-11-10');
        await page.waitForFunction(()=>document.getElementById('dir-categoria-nombre').textContent.includes('U-7'));
        assert.ok((await page.locator('#dir-categoria-automatica').boundingBox()).height<85);
    }finally{await context.close();}
});
