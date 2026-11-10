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

test('panel: crear y renombrar los tres catálogos sin usar innerHTML para nombres',async()=>{
    const context=await browser.newContext({viewport:{width:1366,height:850}});
    await context.route('**/*', r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errores.push(e.message));
    try {
        await page.goto(base+'/admin/panel-directiva.html');
        await page.locator('[data-target="sec-deportes"]').click();
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
        await page.locator('#mobile-menu-btn').click();
        await page.locator('[data-target="sec-deportes"]').click();
        await page.locator('#deportes-lista-equipos').waitFor({state:'visible'});
        assert.equal(await page.locator('#sec-deportes').evaluate(el=>el.classList.contains('active')),true);
    }finally{await context.close();}
});
