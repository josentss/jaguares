'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const raiz = path.resolve(__dirname, '../public');
let servidor, base;
let vacio = false, escrituras = 0, consultas = 0;
const nombreXss = '<img src=x onerror=alert(1)>';

function responder(res, body, status = 200) {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify(body));
}

test.before(async () => {
    servidor = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (req.method !== 'GET') escrituras += 1;
        if (url.pathname === '/api/auth/me') {
            const ahora = Date.now();
            return responder(res, { success:true,
                usuario:{ id_usuario:5, rol:'representante', nombres:'Cuenta', apellidos:'Prueba' },
                sesion:{ id:'cuenta-representante', servidor:ahora, vence:ahora+900000,
                    limite:ahora+43200000 }
            });
        }
        if (url.pathname === '/api/usuarios/perfil/5') return responder(res, {
            success:true, perfil:{ nombres:'Cuenta', apellidos:'Prueba', cedula:'V-12345678',
                telefono1:'04141234567', telefono2:'', correo:'ejemplo@local.invalid' }
        });
        if (url.pathname === '/api/atletas/representante/5') return responder(res, {
            success:true, atletas:[{id_atleta:31, nombres:nombreXss, apellidos:'Sintético',
                cedula:'V-12345678', estado:'activo'}]
        });
        if (url.pathname === '/api/pagos/obligaciones/31') {
            consultas += 1;
            return responder(res, vacio ? {
                success:true, id_atleta:31, ancla:null, obligaciones:[]
            } : {
                success:true, id_atleta:31,
                ancla:{ fecha_inicio:'2026-11-01',dia_ancla:15 },
                obligaciones:[
                    { id_obligacion:1, codigo_concepto:'mensualidad',
                        periodo_mes:'2026-11-01',monto_usd:'15.00',
                        fecha_vencimiento:'2026-11-15',fecha_limite:'2026-11-30',
                        estado:'pendiente' },
                    { id_obligacion:2,codigo_concepto:'mensualidad',
                        periodo_mes:'2026-12-01',monto_usd:'15.00',
                        fecha_vencimiento:'2026-12-15',fecha_limite:'2026-12-31',
                        estado:'en_revision' },
                    { id_obligacion:3,codigo_concepto:'inscripcion',
                        detalle:'Inscripción',monto_usd:'15.00',
                        fecha_vencimiento:'2026-11-01',fecha_limite:'2026-11-30',
                        estado:'pagada' }
                ]
            });
        }
        if (url.pathname === '/api/pagos/historial/5') return responder(res,{success:true,datos:[]});
        if (url.pathname === '/api/notificaciones/5') return responder(res,{success:true,notificaciones:[]});
        if (url.pathname === '/api/cms/public/eventos') return responder(res,{success:true,eventos:[]});
        if (url.pathname.startsWith('/api/')) return responder(res,{success:true,datos:[]});
        const archivo = path.resolve(raiz, '.' + decodeURI(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!archivo.startsWith(raiz + path.sep)) {res.writeHead(403);return res.end();}
        try {
            const datos = await fs.readFile(archivo);
            const ext = path.extname(archivo);
            const tipo = {'.html':'text/html','.js':'application/javascript',
                '.css':'text/css','.png':'image/png'}[ext] || 'application/octet-stream';
            res.writeHead(200,{'Content-Type':tipo});res.end(datos);
        } catch {res.writeHead(404);res.end('No encontrado');}
    });
    await new Promise(resolve => servidor.listen(0,'127.0.0.1',resolve));
    base = 'http://127.0.0.1:' + servidor.address().port;
});

test.after(async () => {
    if (servidor) await new Promise(resolve => servidor.close(resolve));
});

async function abrir(viewport) {
    const navegador = await chromium.launch({headless:true});
    const page = await navegador.newPage({viewport});
    const errores = [];
    page.on('pageerror',e=>errores.push(e.message));
    await page.route('https://**/*', route=>route.abort());
    await page.goto(base+'/admin/panel-representante.html');
    await page.waitForFunction(()=>document.body.dataset.sessionState==='ready');
    await page.locator('li[data-target="sec-estado-cuenta"]').evaluate(el=>el.click());
    await page.locator('#cuenta-atleta option[value="31"]').waitFor({state:'attached'});
    return {navegador,page,errores};
}

test('representante consulta estados y montos USD sin ejecutar POST ni interpretar históricos',async()=>{
    vacio=false; escrituras=0; consultas=0;
    const {navegador,page,errores}=await abrir({width:1440,height:900});
    try {
        await page.locator('#cuenta-obligaciones tr').first().waitFor();
        assert.equal(await page.locator('#cuenta-obligaciones tr').count(),3);
        assert.match(await page.locator('#cuenta-resumen').innerText(),/1 por atender · 1 en revisión · 1 pagadas/);
        assert.match(await page.locator('#cuenta-obligaciones').innerText(),/USD 15.00/);
        assert.match(await page.locator('#cuenta-obligaciones').innerText(),/15\/11\/2026/);
        assert.match(await page.locator('#cuenta-obligaciones').innerText(),/Límite 30\/11\/2026/);
        assert.match(await page.locator('#cuenta-obligaciones').innerText(),/En revisión/);
        assert.match(await page.locator('#cuenta-nota').innerText(),/aún no se vinculan/);
        assert.equal(await page.locator('#cuenta-atleta img').count(),0);
        assert.ok(consultas>=1);
        assert.equal(escrituras,0);
        assert.deepEqual(errores,[]);
    } finally {await navegador.close();}
});

test('sin ancla ni obligaciones no muestra al día ni deuda inventada',async()=>{
    vacio=true; escrituras=0;
    const {navegador,page,errores}=await abrir({width:1440,height:900});
    try {
        await page.getByText('Inicio de cobro pendiente de configurar.').waitFor();
        assert.equal(await page.locator('#cuenta-obligaciones tr').count(),1);
        assert.match(await page.locator('#cuenta-obligaciones').innerText(),/Sin obligaciones registradas/);
        assert.equal(await page.getByText(/al día/i).count(),0);
        assert.equal(escrituras,0);
        assert.deepEqual(errores,[]);
    } finally {await navegador.close();}
});

test('móvil mantiene panel y tabla dentro del ancho y permite actualizar',async()=>{
    vacio=false; escrituras=0;
    const {navegador,page,errores}=await abrir({width:390,height:844});
    try {
        await page.locator('#cuenta-obligaciones tr').first().waitFor();
        const anchos = await page.evaluate(()=>({
            documento:document.documentElement.scrollWidth, ventana:window.innerWidth,
            tabla:document.querySelector('.cuenta-tabla-scroll').getBoundingClientRect().width
        }));
        assert.ok(anchos.documento<=anchos.ventana+1,JSON.stringify(anchos));
        assert.ok(anchos.tabla<=390);
        await page.locator('#cuenta-actualizar').click();
        await page.locator('#cuenta-obligaciones tr').first().waitFor();
        assert.equal(escrituras,0);
        assert.deepEqual(errores,[]);
    } finally {await navegador.close();}
});
