'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const raiz = path.resolve(__dirname, '../public');
const catalogo = {
    success: true,
    temporadas: [{id_temporada:1,nombre:'2026-2027'}],
    categorias: [{id_categoria:1,id_temporada:1,nombre:'Categoría manual'}],
    equipos: [{id_equipo:1,id_categoria:1,nombre:'Equipo A'},
        {id_equipo:2,id_categoria:1,nombre:'Equipo B'}]
};
const atletas = [
    {id_atleta:11,nombres:'Ana',apellidos:'Sintética',fecha_nacimiento:'2018-05-11',estado:'activo'},
    {id_atleta:12,nombres:'Luis',apellidos:'Sintético',fecha_nacimiento:'2018-05-11',estado:'inactivo'}
];
let servidor, base, movimientos = [], siguienteId = 1, enviados = [];

function responder(res, cuerpo, estado = 200) {
    res.writeHead(estado, {'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify(cuerpo));
}

test.before(async () => {
    servidor = http.createServer(async (req,res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/api/auth/me') {
            const rol = (req.headers.referer || '').includes('rol=staff') ? 'staff' : 'directiva';
            return responder(res,{success:true,usuario:{id_usuario:1,rol,nombres:'Personal',apellidos:'Sintético'},
                sesion:{id:'sesion-asignaciones',servidor:Date.now(),
                    vence:Date.now()+900000,limite:Date.now()+43200000}});
        }
        if (url.pathname === '/api/directiva/deportes/catalogo') return responder(res,catalogo);
        if (url.pathname === '/api/directiva/deportes/asignaciones') {
            if (req.method === 'GET') return responder(res,{success:true,atletas,movimientos});
            let contenido = '';
            for await (const fragmento of req) contenido += fragmento;
            const body = JSON.parse(contenido);
            enviados.push(body);
            const ahora = '2026-11-11T18:00:00Z';
            const actual = movimientos.find(fila => fila.id_atleta===body.id_atleta && !fila.fin_en);
            if (actual) actual.fin_en = ahora;
            const equipo = catalogo.equipos.find(fila => fila.id_equipo===body.id_equipo);
            movimientos.unshift({id_asignacion:siguienteId++,id_atleta:body.id_atleta,id_equipo:body.id_equipo,
                id_temporada:1,inicio_en:ahora,fin_en:null,atleta_nombres:'Ana',atleta_apellidos:'Sintética',
                atleta_estado:'activo',equipo_nombre:equipo.nombre,categoria_nombre:'Categoría manual',
                temporada_nombre:'2026-2027'});
            return responder(res,{success:true,movimiento:!!actual},201);
        }
        if (url.pathname === '/api/directiva/auditoria') return responder(res,{success:true,
            metricas:{activos:1,espera:0,pagos_pendientes:0},atletas:[],pagos:[],tasa_bcv:36.5});
        if (url.pathname.startsWith('/api/')) return responder(res,{success:true,datos:[]});
        const archivo = path.resolve(raiz, '.' + decodeURI(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!archivo.startsWith(raiz + path.sep)) { res.writeHead(403); return res.end(); }
        try {
            const datos = await fs.readFile(archivo);
            const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript',
                '.png':'image/png'}[path.extname(archivo)] || 'application/octet-stream';
            res.writeHead(200,{'Content-Type':mime}); return res.end(datos);
        } catch { res.writeHead(404); return res.end(); }
    });
    await new Promise(resolve => servidor.listen(0,'127.0.0.1',resolve));
    base = 'http://127.0.0.1:' + servidor.address().port;
});

test.after(async () => {
    if (servidor) await new Promise(resolve => servidor.close(resolve));
});

async function abrir(viewport, rol = 'directiva') {
    const browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport});
    const errores = [];
    page.on('pageerror', error => errores.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.route('https://**/*', route => route.abort());
    await page.goto(base + '/admin/panel-directiva.html?rol=' + rol);
    await page.waitForFunction(() => document.body.dataset.sessionState === 'ready');
    await page.evaluate(() => document.querySelector('[data-target="sec-asignaciones"]').click());
    return {browser,page,errores};
}

test('directiva asigna, cambia equipo y conserva el historial sin asignar por edad', async () => {
    movimientos = []; siguienteId = 1; enviados = [];
    const {browser,page,errores} = await abrir({width:1440,height:900});
    try {
        assert.equal(await page.locator('#asignaciones-panel').evaluate(panel => panel.closest('.panel-section').id),
            'sec-asignaciones');
        const filasFormulario = await page.locator('#asignaciones-form').evaluate(form => {
            const top = selector => Math.round(form.querySelector(selector).closest('label').getBoundingClientRect().top);
            return {temporada:top('#asignaciones-temporada'),equipo:top('#asignaciones-equipo'),
                buscar:top('#asignaciones-buscar-atleta'),atleta:top('#asignaciones-atleta')};
        });
        assert.ok(Math.abs(filasFormulario.temporada-filasFormulario.equipo)<=2);
        assert.ok(Math.abs(filasFormulario.buscar-filasFormulario.atleta)<=2);
        assert.ok(filasFormulario.buscar>filasFormulario.temporada);
        assert.equal(await page.locator('#asignaciones-temporada').inputValue(),'1');
        assert.equal(await page.locator('#asignaciones-atleta option[value="12"]').count(),0);
        assert.match(await page.locator('#asignaciones-atleta option[value="11"]').innerText(),/sin equipo/);
        await page.locator('#asignaciones-buscar-atleta').fill('Sin coincidencia');
        assert.equal(await page.locator('#asignaciones-atleta option[value="11"]').count(),0);
        assert.match(await page.locator('#asignaciones-total-atletas').innerText(),/0 de 1/);
        await page.locator('#asignaciones-buscar-atleta').fill('Ana');
        await page.locator('#asignaciones-temporada').selectOption('1');
        await page.locator('#asignaciones-atleta').selectOption('11');
        await page.locator('#asignaciones-equipo').selectOption('1');
        assert.match(await page.locator('#asignaciones-aviso').innerText(),/Verifica la categoría/);
        assert.match(await page.locator('#asignaciones-aviso').innerText(),/U-9 Iniciación/);
        await page.locator('#asignaciones-guardar').click();
        await page.getByText('Equipo actual: Equipo A').waitFor();
        assert.deepEqual(enviados[0],{id_atleta:11,id_equipo:1,id_asignacion_actual:null});
        assert.equal(await page.locator('#asignaciones-guardar').isDisabled(),true);
        assert.equal(await page.locator('#asignaciones-guardar').innerText(),'Equipo actual');
        await page.locator('#asignaciones-equipo').selectOption('2');
        assert.equal(await page.locator('#asignaciones-guardar').innerText(),'Cambiar equipo');
        await page.locator('#asignaciones-guardar').click();
        await page.getByText('Equipo actual: Equipo B').waitFor();
        assert.deepEqual(enviados[1],{id_atleta:11,id_equipo:2,id_asignacion_actual:1});
        assert.equal(await page.locator('#asignaciones-historial li').count(),2);
        assert.match(await page.locator('#asignaciones-historial').innerText(),/Equipo A/);
        assert.deepEqual(errores,[]);
    } finally { await browser.close(); }
});

test('staff no ve el formulario y la vista móvil no desborda', async () => {
    const staff = await abrir({width:390,height:844},'staff');
    try {
        assert.equal(await staff.page.locator('#asignaciones-panel').isVisible(),false);
        assert.equal(await staff.page.locator('#nav-asignaciones').isHidden(),true);
        assert.deepEqual(staff.errores,[]);
    } finally { await staff.browser.close(); }
    const directiva = await abrir({width:390,height:844});
    try {
        await directiva.page.locator('#asignaciones-panel').waitFor({state:'visible'});
        const desborde = await directiva.page.locator('#asignaciones-panel').evaluate(panel =>
            panel.getBoundingClientRect().right > window.innerWidth + 2 || panel.scrollWidth > panel.clientWidth + 2);
        assert.equal(desborde,false);
        assert.deepEqual(directiva.errores,[]);
    } finally { await directiva.browser.close(); }
});
