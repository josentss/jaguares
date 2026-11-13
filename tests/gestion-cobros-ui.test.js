'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const raiz=path.resolve(__dirname,'../public');
let servidor,base,escrituras=[],consultasReferencias=0;
const conceptos=[
    {codigo:'inscripcion',nombre:'Inscripción',modalidad:'unica',monto_referencia_usd:'15.00',activo:true},
    {codigo:'mensualidad',nombre:'Mensualidad',modalidad:'mensual',monto_referencia_usd:'15.00',activo:true},
    {codigo:'torneo',nombre:'Torneo',modalidad:'manual',monto_referencia_usd:'40.00',activo:true}
];
function json(res,v,status=200){
    res.writeHead(status,{'Content-Type':'application/json;charset=utf-8'});
    res.end(JSON.stringify(v));
}
test.before(async()=>{
    servidor=http.createServer(async(req,res)=>{
        const url=new URL(req.url,'http://localhost'),p=url.pathname;
        if(p==='/api/auth/me'){
            const now=Date.now(),rol=url.searchParams.get('rol')||
                ((req.headers.referer||'').includes('rol=staff')?'staff':'directiva');
            return json(res,{success:true,usuario:{id_usuario:9,rol,nombres:'Prueba',apellidos:'Directiva'},
                sesion:{id:'session-gestion',servidor:now,vence:now+900000,limite:now+43200000}});
        }
        if(p==='/api/directiva/cobros/catalogo' && req.method==='GET')
            return json(res,{success:true,conceptos});
        if(p==='/api/directiva/cobros/tasas'&&req.method==='GET')
            return json(res,{success:true,tasas:[]});
        if(p==='/api/directiva/cobros/tasas/referencias'&&req.method==='GET'){
            consultasReferencias++;
            return json(res,{success:true,fecha_consulta:'2026-11-13',
                principal:{usd_ves:'970.000000',eur_ves:'1141.176471',
                    fecha_referencia:'2026-11-13',desde_cache:true},
                avisos:{principal:null}});
        }
        if(p==='/api/directiva/cobros/conciliacion/atletas'&&req.method==='GET')
            return json(res,{success:true,atletas:[{
                id_atleta:31,nombres:'Atleta',apellidos:'Sintético',
                estado:'activo',estado_representante:'aprobado',
                fecha_inicio:'2026-11-01',dia_ancla:15,
                total_pagos:0,pendientes:0,aprobados:0,rechazados:0
            }]});
        if(p==='/api/directiva/cobros/conciliacion/atletas/31'&&req.method==='GET')
            return json(res,{success:true,atleta:{
                id_atleta:31,nombres:'Atleta',apellidos:'Sintético',
                estado:'activo',estado_representante:'aprobado',
                rol_representante:'representante',fecha_inicio:'2026-11-01',dia_ancla:15
            },pagos:[],obligaciones:[],historial_sin_periodo_anual:false});
        if(req.method!=='GET'&&p.startsWith('/api/directiva/cobros/')){
            let body='';for await(const s of req)body+=s;
            const parsed=body?JSON.parse(body):{};
            escrituras.push({p,method:req.method,body:parsed});
            if(p.includes('/catalogo/')) {
                const codigo=decodeURIComponent(p.split('/').pop());
                const idx=conceptos.findIndex(x=>x.codigo===codigo);
                if (idx<0) return json(res,{success:false,message:'No encontrado'},404);
                const concepto=conceptos[idx];
                if(req.method==='DELETE'){
                    concepto.activo=false;
                    return json(res,{success:true,accion:'archivado',
                        message:'Concepto archivado'});
                }
                concepto.nombre=parsed.nombre;
                concepto.monto_referencia_usd=parsed.monto_usd;
                concepto.activo=parsed.activo;
                return json(res,{success:true,concepto});
            }
            if(p.endsWith('/publicar-referencia'))return json(res,{
                success:true,tasa:{id_tasa:40,moneda:'Bs',tasa_por_usd:'970.000000'}
            },201);
            if(p.endsWith('/mensualidades'))return json(res,{success:true,creada:true,obligacion:{id_obligacion:1}});
            if(p.endsWith('/cargos'))return json(res,{success:true,obligacion:{id_obligacion:2}},201);
            if(p.endsWith('/tasas'))return json(res,{success:true,tasa:{id_tasa:1}},201);
            if(p.endsWith('/catalogo'))return json(res,{success:true,concepto:parsed},201);
        }
        if(p==='/api/directiva/auditoria')return json(res,{success:true,
            metricas:{activos:0,espera:0,pagos_pendientes:0},atletas:[],pagos:[],tasa_bcv:36.5
        });
        if(p.startsWith('/api/'))return json(res,{success:true,datos:[]});
        const file=path.resolve(raiz,'.'+decodeURI(p==='/'?'/index.html':p));
        if(!file.startsWith(raiz+path.sep)){res.writeHead(403);return res.end();}
        try{
            const data=await fs.readFile(file);
            const tipo={'.html':'text/html','.js':'application/javascript',
                '.css':'text/css','.png':'image/png'}[path.extname(file)];
            res.writeHead(200,{'Content-Type':tipo||'application/octet-stream'});res.end(data);
        }catch{res.writeHead(404);res.end('No encontrado');}
    });
    await new Promise(r=>servidor.listen(0,'127.0.0.1',r));
    base='http://127.0.0.1:'+servidor.address().port;
});
test.after(async()=>{if(servidor)await new Promise(r=>servidor.close(r));});
async function abrir(viewport,rol='directiva'){
    const browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport});
    const errores=[];page.on('pageerror',e=>errores.push(e.message));
    page.on('dialog',d=>d.accept());
    await page.route('https://**/*',r=>r.abort());
    await page.goto(base+'/admin/panel-directiva.html?rol='+rol);
    await page.waitForFunction(()=>document.body.dataset.sessionState==='ready');
    return {browser,page,errores};
}

test('directiva edita tarifa y registra cargos sin crear deuda al cargar la pantalla',async()=>{
    escrituras=[];
    const {browser,page,errores}=await abrir({width:1360,height:900});
    try{
        await page.locator('#nav-conciliacion-cobros').evaluate(e=>e.click());
        await page.locator('#gestion-cobros-conceptos tr').first().waitFor();
        assert.equal(escrituras.length,0);
        assert.equal(await page.locator('#gestion-cobros-conceptos tr').count(),3);
        const mensual=page.locator('#gestion-cobros-conceptos tr').nth(1);
        assert.equal(await mensual.locator('input[type=number]').isVisible(),false);
        assert.equal(await mensual.getByRole('button',{name:'Guardar cambios de Mensualidad'}).isVisible(),false);
        await mensual.getByRole('button',{name:'Editar Mensualidad'}).click();
        assert.equal(await mensual.locator('input[type=number]').isVisible(),true);
        assert.equal(await mensual.getByRole('button',{name:'Editar Mensualidad'}).isVisible(),false);
        await mensual.locator('input[type=number]').fill('1000');
        await mensual.getByRole('button',{name:'Guardar cambios de Mensualidad'}).click();
        await page.waitForFunction(()=>document.querySelector('#gestion-cobros-estado')
            ?.textContent.includes('fuera de USD'));
        assert.equal(escrituras.length,0);
        await mensual.locator('input[type=number]').fill('18.00');
        await mensual.getByRole('button',{name:'Guardar cambios de Mensualidad'}).click();
        await page.waitForFunction(()=>document.querySelector('#gestion-cobros-estado')
            ?.textContent.includes('Tarifa actualizada'));
        assert.equal(escrituras[0].p,'/api/directiva/cobros/catalogo/mensualidad');
        assert.equal(escrituras[0].body.monto_usd,'18.00');
        await page.waitForFunction(() => document.querySelectorAll(
            '#gestion-cobros-conceptos tr')[1]?.textContent.includes('USD 18.00'));
        const mensualActual=page.locator('#gestion-cobros-conceptos tr').nth(1);
        assert.equal(await mensualActual.locator('input[type=number]').isVisible(),false);
        await mensualActual.getByRole('button',{name:'Editar Mensualidad'}).click();
        await mensualActual.locator('input[type=number]').fill('55');
        await mensualActual.getByRole('button',{name:'Cancelar edición de Mensualidad'}).click();
        assert.equal(await mensualActual.locator('input[type=number]').isVisible(),false);
        assert.equal(escrituras.length,1);
        assert.match(await mensualActual.innerText(),/USD 18.00/);
        await page.locator('#cobros-atleta option[value="31"]').waitFor({state:'attached'});
        await page.locator('#cobros-atleta').selectOption('31');
        await page.locator('#gestion-cobros-mensualidad button[type=submit]').click();
        await page.waitForFunction(()=>document.querySelector('#gestion-cobros-estado').textContent.includes('Mensualidad asignada'));
        assert.ok(escrituras.some(x=>x.p.endsWith('/mensualidades')&&x.body.id_atleta===31));
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
});

test('tasas ExchangeRate-API y publicación requieren interacción explícita',async()=>{
    escrituras=[];consultasReferencias=0;
    const {browser,page,errores}=await abrir({width:1360,height:900});
    try{
        await page.locator('#nav-conciliacion-cobros').evaluate(e=>e.click());
        await page.locator('#gestion-cobros-conceptos tr').first().waitFor();
        assert.equal(consultasReferencias,0);
        assert.equal(escrituras.length,0);
        await page.locator('#gestion-seccion-tasas summary').first().click();
        await page.waitForFunction(()=>document.querySelector('#gestion-mercado-usd')
            ?.textContent.includes('970'));
        assert.match(await page.locator('#gestion-mercado-vigencia').textContent(),/2026-11-13/);
        assert.match(await page.locator('#gestion-mercado-eur').textContent(),/1\.141/);
        assert.equal(consultasReferencias,1);
        assert.equal(escrituras.length,0);
        await page.locator('#gestion-referencia-registrar').click();
        await page.waitForFunction(()=>document.querySelector('#gestion-cobros-estado')
            ?.textContent.includes('Tasa ExchangeRate-API registrada'));
        assert.equal(escrituras.length,1);
        assert.equal(escrituras[0].p,'/api/directiva/cobros/tasas/publicar-referencia');
        assert.deepEqual(escrituras[0].body,{confirmar:true});
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
});


test('calendario manual restringe el mes actual y el año siguiente',async()=>{
    escrituras=[];
    const {browser,page,errores}=await abrir({width:1360,height:900});
    try{
        await page.locator('#nav-conciliacion-cobros').evaluate(e=>e.click());
        await page.locator('#gestion-cobros-conceptos tr').first().waitFor();
        await page.locator('#gestion-seccion-tasas summary').first().click();
        await page.locator('.cobros-tasa-manual summary').click();
        const limites=await page.locator('#gestion-tasa-fecha').evaluate(el=>({
            desde:el.min,hasta:el.max,valor:el.value
        }));
        assert.equal(limites.desde,limites.valor.slice(0,7)+'-01');
        assert.equal(limites.hasta,
            String(Number(limites.valor.slice(0,4))+1)+'-12-31');
        await page.locator('#gestion-tasa-moneda').selectOption('COP');
        await page.locator('#gestion-tasa-valor').fill('3800');
        await page.locator('#gestion-tasa-fuente').fill('Directiva prueba');
        await page.evaluate(()=>{
            const fecha=document.getElementById('gestion-tasa-fecha');
            fecha.value='1890-01-01';
            fecha.closest('form').dispatchEvent(new Event('submit',{
                cancelable:true,bubbles:true
            }));
        });
        await page.waitForFunction(()=>document.querySelector('#gestion-cobros-estado')
            ?.textContent.includes('Fecha permitida'));
        assert.equal(escrituras.length,0);
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
});

test('móvil: catálogo y tasas no desbordan y staff no puede gestionar',async()=>{
    escrituras=[];
    const {browser,page,errores}=await abrir({width:390,height:844});
    try{
        await page.locator('#nav-conciliacion-cobros').evaluate(e=>e.click());
        await page.locator('#gestion-cobros-conceptos tr').first().waitFor();
        const medidas=await page.evaluate(()=>({
            doc:document.documentElement.scrollWidth,window:innerWidth,
            gestion:document.querySelector('#gestion-cobros').getBoundingClientRect().width
        }));
        assert.ok(medidas.doc<=medidas.window+1,JSON.stringify(medidas));
        assert.ok(medidas.gestion<=390);
        assert.equal(escrituras.length,0);
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
    const staff=await abrir({width:390,height:844},'staff');
    try{
        assert.equal(await staff.page.locator('#gestion-cobros').isVisible(),false);
        assert.equal(await staff.page.locator('#nav-conciliacion-cobros').isVisible(),false);
        assert.deepEqual(staff.errores,[]);
    }finally{await staff.browser.close();}
});

test('papelera contextual archiva concepto y permite mostrarlo para reactivar',async()=>{
    escrituras=[];
    const {browser,page,errores}=await abrir({width:1360,height:900});
    try {
        await page.locator('#nav-conciliacion-cobros').evaluate(e=>e.click());
        const fila=page.locator('#gestion-cobros-conceptos tr')
            .filter({hasText:'Torneo'});
        await fila.waitFor();
        assert.equal(await fila.getByRole('button',{name:'Retirar concepto Torneo'}).isVisible(),false);
        await fila.getByRole('button',{name:'Editar Torneo'}).click();
        assert.equal(await fila.getByRole('button',{name:'Retirar concepto Torneo'}).isVisible(),true);
        await fila.getByRole('button',{name:'Retirar concepto Torneo'}).click();
        await page.waitForFunction(()=>document.querySelector('#gestion-cobros-estado')
            ?.textContent.includes('Concepto retirado'));
        assert.ok(escrituras.some(x=>x.method==='DELETE'&&
            x.p==='/api/directiva/cobros/catalogo/torneo'));
        assert.equal(await page.locator('#gestion-cobros-conceptos tr')
            .filter({hasText:'Torneo'}).count(),0);
        await page.locator('#gestion-conceptos-archivados').check();
        const archivado=page.locator('#gestion-cobros-conceptos tr')
            .filter({hasText:'Torneo'});
        assert.equal(await archivado.count(),1);
        await archivado.getByRole('button',{name:'Editar Torneo'}).click();
        await archivado.getByRole('checkbox',{name:'Activo Torneo'}).check();
        await archivado.getByRole('button',{name:'Guardar cambios de Torneo'}).click();
        await page.waitForFunction(()=>document.querySelector('#gestion-cobros-estado')
            ?.textContent.includes('Tarifa actualizada'));
        assert.equal(await page.locator('#gestion-cobros-conceptos tr')
            .filter({hasText:'Torneo'}).count(),1);
        assert.deepEqual(errores,[]);
    } finally {await browser.close();}
});
