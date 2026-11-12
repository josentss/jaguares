'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const raiz = path.resolve(__dirname, '../public');
let servidor, base;
let inicio = null;
let envios = [];
let generacionInvocada = false;
const nombreMalicioso = '<img src=x onerror=alert(1)>';

function json(res, body, status=200) {
    res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify(body));
}

const registro = () => ({
    id_atleta:31,nombres:nombreMalicioso,apellidos:'Atleta',
    estado:'activo',estado_representante:'aprobado',rol_representante:'representante',
    fecha_inicio:inicio?.fecha_inicio || null,dia_ancla:inicio?.dia_ancla || null
});

test.before(async () => {
    servidor = http.createServer(async (req,res) => {
        const url = new URL(req.url,'http://localhost');
        if (url.pathname === '/api/auth/me') {
            const rol = url.searchParams.get('rol') ||
                ((req.headers.referer || '').includes('rol=staff') ? 'staff' : 'directiva');
            const ahora = Date.now();
            return json(res,{success:true,
                usuario:{id_usuario:9,rol,nombres:'Prueba',apellidos:'Directiva'},
                sesion:{id:'sesion-conciliacion',servidor:ahora,vence:ahora+900000,
                    limite:ahora+43200000}});
        }
        if (url.pathname === '/api/directiva/cobros/conciliacion/atletas' &&
            req.method === 'GET') {
            return json(res,{success:true,atletas:[{
                ...registro(),total_pagos:2,pendientes:1,aprobados:1,rechazados:0
            }]});
        }
        if (url.pathname === '/api/directiva/cobros/conciliacion/atletas/31') {
            return json(res,{
                success:true,atleta:registro(),
                pagos:[
                    {id_pago:1,mes_pagado:'Noviembre',fecha_pago:'2026-11-08',
                        monto:'15.00',moneda:'USD',estado_pago:'aprobado',id_obligacion:null},
                    {id_pago:2,mes_pagado:'Octubre',fecha_pago:'2026-10-08',
                        monto:'15.00',moneda:'USD',estado_pago:'pendiente',id_obligacion:null}
                ],
                obligaciones:[],historial_sin_periodo_anual:true
            });
        }
        if (url.pathname === '/api/directiva/cobros/anclas/31' && req.method === 'POST') {
            let contenido='';
            for await (const parte of req) contenido+=parte;
            inicio=JSON.parse(contenido);
            envios.push(inicio);
            return json(res,{success:true,ancla:inicio},201);
        }
        if (url.pathname.includes('/cobros/mensualidades')) {
            generacionInvocada=true;
            return json(res,{success:false},405);
        }
        if (url.pathname === '/api/directiva/auditoria') return json(res,{
            metricas:{activos:1,espera:0,pagos_pendientes:0},
            atletas:[],pagos:[],tasa_bcv:36.5
        });
        if (url.pathname.startsWith('/api/')) return json(res,{success:true,datos:[]});
        const archivo=path.resolve(raiz,'.'+decodeURI(url.pathname==='/'?'/index.html':url.pathname));
        if (!archivo.startsWith(raiz+path.sep)) {res.writeHead(403);return res.end();}
        try {
            const datos=await fs.readFile(archivo);
            const tipo={'.html':'text/html','.js':'application/javascript',
                '.css':'text/css','.png':'image/png'}[path.extname(archivo)]||'application/octet-stream';
            res.writeHead(200,{'Content-Type':tipo});res.end(datos);
        } catch {res.writeHead(404);res.end('No encontrado');}
    });
    await new Promise(resolve=>servidor.listen(0,'127.0.0.1',resolve));
    base='http://127.0.0.1:'+servidor.address().port;
});

test.after(async () => {
    if(servidor) await new Promise(resolve=>servidor.close(resolve));
});

async function abrir(viewport,rol='directiva') {
    const browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport});
    const errores=[];
    page.on('pageerror',e=>errores.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    await page.goto(base+'/admin/panel-directiva.html?rol='+rol);
    await page.waitForFunction(()=>document.body.dataset.sessionState==='ready');
    return {browser,page,errores};
}

test('Directiva consulta histórico, confirma explícitamente y activa SIN deuda',async()=>{
    inicio=null; envios=[]; generacionInvocada=false;
    const {browser,page,errores}=await abrir({width:1360,height:800});
    page.on('dialog',dialog=>dialog.accept());
    try {
        await page.locator('#nav-conciliacion-cobros').evaluate(el=>el.click());
        await page.locator('#cobros-atleta option[value="31"]').waitFor({state:'attached'});
        await page.locator('#cobros-atleta').selectOption('31');
        await page.locator('#cobros-pagos tr').first().waitFor();
        assert.equal(await page.locator('#cobros-pagos tr').count(),2);
        const contenido=await page.locator('#cobros-nombre').textContent();
        assert.match(contenido,/<img src=x/);
        assert.equal(await page.locator('#cobros-nombre img').count(),0);
        assert.match(await page.locator('#cobros-resumen-actual').textContent(),/aprobado/);
        assert.equal(await page.locator('#cobros-guardar').isDisabled(),false);
        const inicioMes=await page.locator('#cobros-fecha-inicio').getAttribute('min');
        await page.locator('#cobros-fecha-inicio').fill(inicioMes);
        await page.locator('#cobros-dia-ancla').fill('15');
        await page.locator('#cobros-historial-revisado').check();
        await page.locator('#cobros-guardar').click();
        await page.getByText('Inicio registrado correctamente. No se han creado obligaciones.').waitFor();
        assert.equal(envios.length,1);
        assert.deepEqual(envios[0],{
            fecha_inicio:inicioMes,dia_ancla:15,historial_revisado:true
        });
        assert.equal(await page.locator('#cobros-guardar').isDisabled(),true);
        assert.equal(generacionInvocada,false);
        assert.deepEqual(errores,[]);
    } finally {await browser.close();}
});

test('staff no puede acceder a la conciliación administrativa',async()=>{
    const {browser,page,errores}=await abrir({width:1360,height:800},'staff');
    try {
        assert.equal(await page.locator('#nav-conciliacion-cobros').isVisible(),false);
        assert.equal(await page.locator('#cobros-panel').isVisible(),false);
        assert.deepEqual(errores,[]);
    } finally {await browser.close();}
});

test('móvil: formulario y tabla no desbordan el ancho del panel',async()=>{
    inicio=null;
    const {browser,page,errores}=await abrir({width:390,height:844});
    try {
        await page.locator('#nav-conciliacion-cobros').evaluate(el=>el.click());
        await page.locator('#cobros-atleta option[value="31"]').waitFor({state:'attached'});
        await page.locator('#cobros-atleta').selectOption('31');
        await page.locator('#cobros-pagos tr').first().waitFor();
        const anchos=await page.evaluate(()=>({
            documento:document.documentElement.scrollWidth,
            ventana:window.innerWidth,
            formulario:document.querySelector('#cobros-form').getBoundingClientRect().width
        }));
        assert.ok(anchos.documento<=anchos.ventana+1,
            `desbordamiento móvil: ${JSON.stringify(anchos)}`);
        assert.ok(anchos.formulario<=390);
        assert.deepEqual(errores,[]);
    } finally {await browser.close();}
});
