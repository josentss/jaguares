'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const raiz = path.resolve(__dirname,'../public');
let servidor, base, modo='guiado', envios=[];

function json(res, contenido, status=200) {
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify(contenido));
}

function obligacion(id, mes, estado, valor='15.00') {
    return {id_obligacion:id,codigo_concepto:'mensualidad',
        periodo_mes:mes,monto_usd:valor,fecha_emision:'2026-11-01',
        fecha_vencimiento:'2026-11-15',fecha_limite:'2026-11-30',estado};
}

test.before(async()=>{
    servidor=http.createServer(async(req,res)=>{
        const pathname=new URL(req.url,'http://localhost').pathname;
        if(pathname==='/api/auth/me') {
            const now=Date.now();
            return json(res,{success:true,
                usuario:{id_usuario:5,rol:'representante',nombres:'Prueba',apellidos:'Representante'},
                sesion:{id:'sesion-pagos-guiados',servidor:now,vence:now+900000,
                    limite:now+43200000}});
        }
        if(pathname==='/api/usuarios/perfil/5') return json(res,{success:true,perfil:{
            nombres:'Prueba',apellidos:'Representante',cedula:'V-12345678',
            telefono1:'04141234567',correo:'prueba@local.invalid'
        }});
        if(pathname==='/api/atletas/representante/5') return json(res,{
            success:true,atletas:[{id_atleta:31,nombres:'Atleta',apellidos:'Sintético',
                estado:'activo',cedula:'V-12345678'}]
        });
        if(pathname==='/api/pagos/obligaciones/31') return json(res,modo==='legacy'?
            {success:true,id_atleta:31,ancla:null,obligaciones:[]}:
            {success:true,id_atleta:31,
                ancla:{fecha_inicio:'2026-11-01',dia_ancla:15},
                obligaciones:modo==='bloqueado'?
                    [obligacion(1,'2026-11-01','en_revision')]:
                    [obligacion(1,'2026-11-01','pendiente'),
                     obligacion(2,'2026-12-01','en_plazo'),
                     obligacion(3,'2027-01-01','pendiente'),
                     obligacion(4,'2026-10-01','pagada')]}
        );
        if(pathname==='/api/pagos/reportar' && req.method==='POST') {
            const partes=[];for await(const parte of req)partes.push(parte);
            const texto=Buffer.concat(partes).toString('utf8');
            envios.push(texto);
            return json(res,{success:true,message:'Pago enviado para revisión'},200);
        }
        if(pathname==='/api/pagos/historial/5') return json(res,{success:true,datos:[]});
        if(pathname==='/api/notificaciones/5') return json(res,{success:true,notificaciones:[]});
        if(pathname==='/api/cms/public/eventos') return json(res,{success:true,eventos:[]});
        if(pathname.startsWith('/api/')) return json(res,{success:true,datos:[]});
        const archivo=path.resolve(raiz,'.'+decodeURI(pathname==='/'?'/index.html':pathname));
        if(!archivo.startsWith(raiz+path.sep)){res.writeHead(403);return res.end();}
        try{
            const datos=await fs.readFile(archivo);
            const ext=path.extname(archivo);
            res.writeHead(200,{'Content-Type':
                ({'.html':'text/html','.css':'text/css','.js':'application/javascript',
                    '.png':'image/png'}[ext]||'application/octet-stream')});
            res.end(datos);
        }catch{res.writeHead(404);res.end('No encontrado');}
    });
    await new Promise(resolve=>servidor.listen(0,'127.0.0.1',resolve));
    base='http://127.0.0.1:'+servidor.address().port;
});

test.after(async()=>{if(servidor)await new Promise(resolve=>servidor.close(resolve));});

async function abrir(viewport) {
    const browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport});
    const errores=[];
    page.on('pageerror',e=>errores.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    await page.goto(base+'/admin/panel-representante.html');
    await page.waitForFunction(()=>document.body.dataset.sessionState==='ready');
    await page.locator('li[data-target="sec-pagos"]').evaluate(el=>el.click());
    await page.locator('#pay-atleta option[value="31"]').waitFor({state:'attached'});
    await page.locator('#pay-atleta').selectOption('31');
    return {browser,page,errores};
}

test('representante elige obligación, precio USD fijo y envía ID, no mes ambiguo',async()=>{
    modo='guiado';envios=[];
    const {browser,page,errores}=await abrir({width:1400,height:900});
    try{
        await page.locator('#pay-obligacion option[value="1"]').waitFor({state:'attached'});
        assert.equal(await page.locator('#pay-obligacion').isVisible(),true);
        assert.equal(await page.locator('#pay-mes').isVisible(),false);
        assert.equal(await page.locator('#pay-obligacion option[value="3"]').count(),0);
        assert.equal(await page.locator('#pay-obligacion option[value="4"]').count(),0);
        await page.locator('#pay-metodo').selectOption('Efectivo');
        assert.equal(await page.locator('#pay-monto-efec').inputValue(),'15.00');
        assert.equal(await page.locator('#pay-monto-efec').getAttribute('readonly'),'');
        await page.locator('#form-report-pago button[type="submit"]').click();
        await page.getByText('Pago reportado con éxito').waitFor();
        assert.equal(envios.length,1);
        assert.match(envios[0],/name="id_obligacion"/);
        assert.match(envios[0],/\r\n1\r\n/);
        assert.doesNotMatch(envios[0],/name="mes"/);
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
});

test('sin ancla conserva reporte legado con selector de mes',async()=>{
    modo='legacy';envios=[];
    const {browser,page,errores}=await abrir({width:1400,height:900});
    try{
        await page.waitForFunction(()=>!document.querySelector('#pay-mes').disabled);
        assert.equal(await page.locator('#pay-mes').isVisible(),true);
        assert.equal(await page.locator('#pay-obligacion').isVisible(),false);
        await page.locator('#pay-metodo').selectOption('Efectivo');
        await page.locator('#pay-monto-efec').fill('12');
        await page.locator('#form-report-pago button[type="submit"]').click();
        await page.getByText('Pago reportado con éxito').waitFor();
        assert.equal(envios.length,1);
        assert.match(envios[0],/name="mes"/);
        assert.doesNotMatch(envios[0],/name="id_obligacion"/);
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
});

test('sin cargos pendientes impide nuevo reporte; móvil no desborda',async()=>{
    modo='bloqueado';envios=[];
    const {browser,page,errores}=await abrir({width:390,height:844});
    try{
        await page.getByText('No hay cargos disponibles para reportar.').waitFor();
        assert.equal(await page.locator('#form-report-pago button[type="submit"]').isDisabled(),true);
        assert.equal(await page.locator('#pay-mes').isVisible(),false);
        assert.equal(envios.length,0);
        const medidas=await page.evaluate(()=>({
            pagina:document.documentElement.scrollWidth,ventana:window.innerWidth,
            formulario:document.getElementById('form-report-pago').getBoundingClientRect().width
        }));
        assert.ok(medidas.pagina<=medidas.ventana+1,JSON.stringify(medidas));
        assert.ok(medidas.formulario<=390);
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
});
