'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const raiz=path.resolve(__dirname,'../public');
let server,base,modo='cargos',envios=[],cotizaciones=0;
const fechaHoy=()=>{
    const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Caracas',
        day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date());
    const v=t=>p.find(x=>x.type===t).value;
    return `${v('year')}-${v('month')}-${v('day')}`;
};
function json(res,data,status=200){
    res.writeHead(status,{'Content-Type':'application/json;charset=utf-8'});
    res.end(JSON.stringify(data));
}

test.before(async()=>{
    server=http.createServer(async(req,res)=>{
        const url=new URL(req.url,'http://localhost'),p=url.pathname;
        if(p==='/api/auth/me'){
            const now=Date.now();
            return json(res,{success:true,usuario:{
                id_usuario:5,rol:'representante',nombres:'Prueba',apellidos:'Representante'
            },sesion:{id:'sesion-cargos',servidor:now,vence:now+900000,limite:now+43200000}});
        }
        if(p==='/api/usuarios/perfil/5')return json(res,{success:true,perfil:{
            nombres:'Prueba',apellidos:'Representante',cedula:'V-12345678',
            telefono1:'04141234567',correo:'prueba@local.invalid'
        }});
        if(p==='/api/atletas/representante/5')return json(res,{success:true,
            atletas:[{id_atleta:31,nombres:'Atleta',apellidos:'Sintético',estado:'activo'}]});
        if(p==='/api/pagos/obligaciones/31'){
            const cargos=[
                {id_obligacion:1,codigo_concepto:'mensualidad',nombre_concepto:'Mensualidad',
                    periodo_mes:'2026-11-01',monto_usd:'15.00',fecha_emision:'2026-11-01',estado:'pendiente'},
                {id_obligacion:2,codigo_concepto:'mensualidad',nombre_concepto:'Mensualidad',
                    periodo_mes:'2027-01-01',monto_usd:'15.00',fecha_emision:'2026-11-01',estado:'pendiente'},
                {id_obligacion:3,codigo_concepto:'torneo',nombre_concepto:'Torneo especial',
                    detalle:'Encuentro',monto_usd:'40.00',fecha_emision:'2026-11-01',estado:'pendiente'},
                {id_obligacion:4,codigo_concepto:'mensualidad',nombre_concepto:'Mensualidad',
                    periodo_mes:'2026-10-01',monto_usd:'15.00',fecha_emision:'2026-11-01',estado:'en_revision'}
            ];
            return json(res,{success:true,id_atleta:31,
                ancla:modo==='sin-cargos'?null:{fecha_inicio:'2026-11-01',dia_ancla:15},
                obligaciones:modo==='sin-cargos'?[]:modo==='bloqueado'?[cargos[3]]:cargos});
        }
        if(p.startsWith('/api/pagos/cotizacion/')){
            cotizaciones++;
            const moneda=url.searchParams.get('moneda'),fecha=url.searchParams.get('fecha');
            const id=Number(p.split('/').pop());
            if(modo==='sin-tasa'&&moneda==='Bs')return json(res,{
                success:false,message:'Directiva debe configurar una tasa para esta moneda y fecha'
            },409);
            const nominal=id===3?'40.00':'15.00';
            return json(res,{
                success:true,id_obligacion:id,moneda,precio_usd:nominal,
                monto:moneda==='USD'?nominal:moneda==='Bs'?
                    (Number(nominal)*40).toFixed(2):(Number(nominal)*4000).toFixed(2),
                tasa_por_usd:moneda==='USD'?'1.000000':moneda==='Bs'?'40.000000':'4000.000000',
                fecha_tasa:fecha,fuente:moneda==='USD'?'Importe nominal USD':'Tasa sintética del día'
            });
        }
        if(p==='/api/pagos/reportar'&&req.method==='POST'){
            const partes=[];for await(const parte of req)partes.push(parte);
            envios.push(Buffer.concat(partes).toString('utf8'));
            return json(res,{success:true,message:'Pago enviado para revisión'});
        }
        if(p==='/api/pagos/historial/5')return json(res,{success:true,datos:[]});
        if(p==='/api/notificaciones/5')return json(res,{success:true,notificaciones:[]});
        if(p==='/api/cms/public/eventos')return json(res,{success:true,eventos:[]});
        if(p.startsWith('/api/'))return json(res,{success:true,datos:[]});
        const file=path.resolve(raiz,'.'+decodeURI(p==='/'?'/index.html':p));
        if(!file.startsWith(raiz+path.sep)){res.writeHead(403);return res.end();}
        try{
            const bytes=await fs.readFile(file);
            res.writeHead(200,{'Content-Type':{
                '.html':'text/html','.css':'text/css','.js':'application/javascript',
                '.png':'image/png'}[path.extname(file)]||'application/octet-stream'});
            res.end(bytes);
        }catch{res.writeHead(404);res.end('No encontrado');}
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    base='http://127.0.0.1:'+server.address().port;
});
test.after(async()=>{if(server)await new Promise(r=>server.close(r));});

async function abrir(viewport){
    const browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport});
    const errores=[];
    page.on('pageerror',e=>errores.push(e.message));
    await page.route('https://**/*',r=>r.abort());
    await page.goto(base+'/admin/panel-representante.html');
    await page.waitForFunction(()=>document.body.dataset.sessionState==='ready');
    await page.locator('li[data-target="sec-pagos"]').evaluate(el=>el.click());
    await page.locator('#pay-atleta option[value="31"]').waitFor({state:'attached'});
    await page.locator('#pay-atleta').selectOption('31');
    return {browser,page,errores};
}

test('solo conceptos emitidos: precio fijo USD y envío de ID de obligación',async()=>{
    modo='cargos';envios=[];cotizaciones=0;
    const {browser,page,errores}=await abrir({width:1400,height:900});
    try{
        await page.locator('#pay-obligacion option[value="1"]').waitFor({state:'attached'});
        assert.equal(await page.locator('#pay-concepto option').count(),3);
        assert.equal(await page.locator('#pay-obligacion option[value="2"]').count(),0);
        assert.equal(await page.locator('#pay-obligacion option[value="4"]').count(),0);
        assert.equal(await page.locator('#pay-mes').count(),0);
        await page.locator('#pay-metodo').selectOption('Efectivo');
        await page.waitForFunction(()=>document.querySelector('#pay-monto-efec').value==='15.00');
        assert.equal(await page.locator('#pay-monto-efec').isEditable(),false);
        assert.equal(await page.locator('#form-report-pago button[type=submit]').isDisabled(),false);
        await page.locator('#form-report-pago button[type=submit]').click();
        await page.getByText('Pago reportado con éxito').waitFor();
        assert.equal(envios.length,1);
        assert.match(envios[0],/name="id_obligacion"/);
        assert.match(envios[0],/\r\n1\r\n/);
        assert.doesNotMatch(envios[0],/name="mes"/);
        assert.ok(cotizaciones>=1);
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
});

test('sin cargos no ofrece meses libres ni permite enviar pago',async()=>{
    modo='sin-cargos';envios=[];
    const {browser,page,errores}=await abrir({width:1400,height:900});
    try{
        await page.getByText('No hay cargos pendientes asignados.').waitFor();
        assert.equal(await page.locator('#pay-concepto').isDisabled(),true);
        assert.equal(await page.locator('#pay-mes').count(),0);
        assert.equal(await page.locator('#form-report-pago button[type=submit]').isDisabled(),true);
        assert.equal(envios.length,0);
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
});

test('monto Bs fijo requiere tasa del día; móvil sin desbordamiento',async()=>{
    modo='sin-tasa';envios=[];
    const {browser,page,errores}=await abrir({width:390,height:844});
    try{
        await page.locator('#pay-obligacion option[value="1"]').waitFor({state:'attached'});
        await page.locator('#pay-metodo').selectOption('Transferencia Bancaria');
        await page.getByText('Directiva debe configurar una tasa para esta moneda y fecha').waitFor();
        assert.equal(await page.locator('#pay-monto-trans').isEditable(),false);
        assert.equal(await page.locator('#form-report-pago button[type=submit]').isDisabled(),true);
        assert.equal(envios.length,0);
        const widths=await page.evaluate(()=>({
            document:document.documentElement.scrollWidth,window:innerWidth,
            form:document.querySelector('#form-report-pago').getBoundingClientRect().width
        }));
        assert.ok(widths.document<=widths.window+1,JSON.stringify(widths));
        assert.ok(widths.form<=390);
        assert.deepEqual(errores,[]);
    }finally{await browser.close();}
});
