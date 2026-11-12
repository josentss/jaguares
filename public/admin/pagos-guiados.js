'use strict';

// Solo se pueden reportar obligaciones emitidas por el club.
// El monto lo calcula y verifica el servidor; nunca lo determina el navegador.
(function(root) {
    const byId = id => document.getElementById(id);
    const CONCEPTOS = Object.freeze({
        inscripcion:'Inscripción', mensualidad:'Mensualidad', torneo:'Torneo',
        arbitraje:'Arbitraje', sancion:'Sanción'
    });
    const DISPONIBLES = new Set(['pendiente','en_plazo','morosa']);
    let iniciado=false,estado='sin-atleta',secuencia=0,secuenciaCotizacion=0;
    let obligaciones=[],cotizacion=null;

    function hoyCaracas() {
        const partes = new Intl.DateTimeFormat('en-US',{
            timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'
        }).formatToParts(new Date());
        const valor = tipo => partes.find(p=>p.type===tipo)?.value;
        return `${valor('year')}-${valor('month')}-${valor('day')}`;
    }
    function siguienteMes(periodo) {
        const [anio,mes]=periodo.slice(0,7).split('-').map(Number);
        return `${mes===12?anio+1:anio}-${String(mes===12?1:mes+1).padStart(2,'0')}-01`;
    }
    function nombre(o) { return o.nombre_concepto || CONCEPTOS[o.codigo_concepto] || 'Cargo'; }
    function rotulo(o) {
        const periodo = o.codigo_concepto==='mensualidad' && o.periodo_mes ?
            ' · '+o.periodo_mes.slice(0,7) : '';
        return `${nombre(o)}${periodo}${o.detalle?' · '+o.detalle:''} · USD ${Number(o.monto_usd).toFixed(2)}`;
    }
    function aviso(texto,error=false) {
        const el=byId('pay-guia-estado');
        el.textContent=texto;el.dataset.error=String(error);
    }
    function limpiarImportes() {
        byId('pay-monto-efec').value='';
        byId('pay-monto-trans').value='';
        byId('pay-guia-monto').textContent='';
    }
    function disponible() {
        const id=byId('pay-obligacion').value;
        return estado==='cargos' && obligaciones.some(o=>String(o.id_obligacion)===id);
    }
    function habilitarBoton() {
        const boton=byId('form-report-pago').querySelector('button[type=submit]');
        boton.disabled=!disponible()||!cotizacion||!byId('pay-atleta').value;
    }
    function seleccionarTipo() {
        const tipo=byId('pay-concepto').value;
        const select=byId('pay-obligacion');
        select.replaceChildren(new Option('Seleccionar cargo',''));
        for (const o of obligaciones.filter(o=>o.codigo_concepto===tipo)) {
            select.add(new Option(rotulo(o),String(o.id_obligacion)));
        }
        if(select.options.length===2)select.selectedIndex=1;
        select.disabled=select.options.length===1;
        consultarMonto();
    }
    function pintar() {
        byId('pay-obligacion-wrap').hidden = !obligaciones.length;
        const sel=byId('pay-concepto');
        const primero=obligaciones[0];
        const nombres=new Map(obligaciones.map(o=>[o.codigo_concepto,nombre(o)]));
        sel.replaceChildren(new Option('Seleccionar concepto',''));
        for(const [codigo,etiqueta] of nombres)sel.add(new Option(etiqueta,codigo));
        sel.disabled=!obligaciones.length;
        if (primero) sel.value=primero.codigo_concepto;
        seleccionarTipo();
    }
    function metodoYFecha() {
        const metodo=byId('pay-metodo').value;
        if(metodo==='Transferencia Bancaria') return {
            metodo,moneda:'Bs',fecha:byId('pay-fecha-trans').value,
            input:byId('pay-monto-trans')
        };
        if(metodo==='Efectivo') return {
            metodo,moneda:byId('pay-moneda-efec').value,
            fecha:byId('pay-fecha-efec').value,input:byId('pay-monto-efec')
        };
        return null;
    }
    async function consultarMonto() {
        const revision=++secuenciaCotizacion;
        cotizacion=null;
        limpiarImportes();
        habilitarBoton();
        const seleccionado=byId('pay-obligacion').value;
        const o=obligaciones.find(o=>String(o.id_obligacion)===seleccionado);
        if(!o||!disponible())return;
        byId('pay-guia-monto').textContent=`Cargo USD ${Number(o.monto_usd).toFixed(2)}`;
        const pago=metodoYFecha();
        if(!pago||!pago.fecha)return;
        aviso('Calculando importe…');
        try {
            const qs=new URLSearchParams({moneda:pago.moneda,fecha:pago.fecha});
            const r=await apiFetch('/api/pagos/cotizacion/'+encodeURIComponent(seleccionado)+'?'+qs);
            const data=await r.json();
            if(revision!==secuenciaCotizacion || !disponible() ||
                seleccionado!==byId('pay-obligacion').value)return;
            if(!r.ok||!data.success)throw new Error(data.message||'Cotización no disponible');
            if(data.moneda!==pago.moneda||String(data.id_obligacion)!==seleccionado)
                throw new Error('La cotización cambió; actualiza');
            pago.input.value=data.monto;
            cotizacion={
                id:seleccionado,moneda:pago.moneda,fecha:pago.fecha,
                metodo:pago.metodo,monto:data.monto
            };
            const base=`Cargo USD ${Number(data.precio_usd).toFixed(2)}`;
            byId('pay-guia-monto').textContent=pago.moneda==='USD'?base:
                `${base} · 1 USD = ${data.tasa_por_usd} ${pago.moneda} · ${data.fuente} (${data.fecha_tasa})`;
            aviso('');
            habilitarBoton();
        }catch(e){
            if(revision!==secuenciaCotizacion)return;
            aviso(e.message||'Importe no disponible. Consulta a Directiva.',true);
            habilitarBoton();
        }
    }
    function seleccion() {
        if(!disponible()||!cotizacion)return {modo:'bloqueado'};
        const p=metodoYFecha();
        if(!p||cotizacion.id!==byId('pay-obligacion').value ||
            p.moneda!==cotizacion.moneda||p.fecha!==cotizacion.fecha||
            p.metodo!==cotizacion.metodo||p.input.value!==cotizacion.monto) {
            return {modo:'bloqueado'};
        }
        return {modo:'vinculado',id_obligacion:cotizacion.id,cotizacion};
    }
    async function refrescar() {
        const id=byId('pay-atleta').value,revision=++secuencia;
        ++secuenciaCotizacion;
        obligaciones=[];cotizacion=null;
        limpiarImportes();
        estado='cargando';
        byId('pay-concepto').disabled=true;
        byId('pay-obligacion').disabled=true;
        byId('pay-obligacion-wrap').hidden=true;
        habilitarBoton();
        if(!id){estado='sin-atleta';aviso('Selecciona un atleta.');return;}
        aviso('Consultando cargos…');
        try{
            const r=await apiFetch('/api/pagos/obligaciones/'+encodeURIComponent(id));
            const data=await r.json();
            if(revision!==secuencia||id!==byId('pay-atleta').value)return;
            if(!r.ok||!data.success)throw new Error(data.message||'No se pudo consultar');
            const hoy=hoyCaracas(),max=siguienteMes(hoy.slice(0,7)+'-01');
            const todos=Array.isArray(data.obligaciones)?data.obligaciones:[];
            obligaciones=todos.filter(o=>DISPONIBLES.has(o.estado)&&
                (!o.fecha_emision||o.fecha_emision<=hoy)&&
                (o.codigo_concepto!=='mensualidad'||(o.periodo_mes&&o.periodo_mes<=max)));
            if(!obligaciones.length) {
                estado='sin-cargos';
                byId('pay-concepto').replaceChildren(new Option('Sin cargos disponibles',''));
                byId('pay-obligacion').replaceChildren(new Option('Sin cargos disponibles',''));
                aviso('No hay cargos pendientes asignados.');
                habilitarBoton();
                return;
            }
            estado='cargos';
            aviso('');
            pintar();
        }catch(e) {
            if(revision!==secuencia)return;
            estado='error';aviso(e.message||'No se pudieron cargar los cargos.',true);
            habilitarBoton();
        }
    }
    function iniciar() {
        if(iniciado)return;
        iniciado=true;
        byId('pay-intro').textContent='Selecciona el cargo que vas a pagar.';
        byId('pay-concepto').addEventListener('change',seleccionarTipo);
        byId('pay-obligacion').addEventListener('change',consultarMonto);
        byId('pay-atleta').addEventListener('change',refrescar);
        for(const id of ['pay-metodo','pay-moneda-efec',
            'pay-fecha-trans','pay-fecha-efec']) {
            byId(id).addEventListener('change',consultarMonto);
        }
        byId('pay-fecha-trans').value=hoyCaracas();
        byId('pay-fecha-efec').value=hoyCaracas();
        byId('pay-monto-efec').readOnly=true;
        byId('pay-monto-trans').readOnly=true;
        aviso('Selecciona un atleta.');
        habilitarBoton();
    }
    root.JaguaresPagosGuiados={iniciar,refrescar,seleccion};
})(window);
