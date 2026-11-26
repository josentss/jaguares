/* Dashboard de Directiva. Solo presenta datos; las operaciones siguen en sus secciones. */
(function(root) {
    'use strict';
    const el = id => document.getElementById(id);
    const entero = n => Number.isSafeInteger(n) && n >= 0;
    const metricas = {
        temporadas:'stat-temporadas', categorias:'stat-categorias', equipos:'stat-equipos',
        eventos_proximos:'stat-eventos', activos_con_equipo:'stat-con-equipo',
        activos_sin_equipo:'stat-sin-equipo', representantes_aprobados:'stat-representantes',
        representantes_pendientes:'stat-solicitudes'
    };
    let permitido=false, fetchApi, revision=0, iniciado=false;
    let auditoria=null, resumen=null, exportando=false;
    function actualizarBoton() {
        const boton=el('inicio-exportar');
        boton.disabled=!permitido||!auditoria||!resumen||exportando;
        boton.title=boton.disabled&&!exportando?'El informe requiere que ambos resúmenes estén disponibles.':'Descargar informe estadístico A4';
    }
    function contar(lista, campo, estados) {
        const c=Object.fromEntries(estados.map(e=>[e,0]));
        c.otros=0;
        for(const fila of lista){
            const e=String(fila[campo]||'').toLowerCase();
            c[Object.hasOwn(c,e)?e:'otros']++;
        }
        return c;
    }
    function comenzarAuditoria() {
        auditoria=null;
        actualizarBoton();
    }
    function falloAuditoria() {
        comenzarAuditoria();
        for(const id of ['stat-atletas-total','stat-inactivos','stat-espera-gestion'])el(id).textContent='—';
        el('inicio-distribucion').hidden=true;
        el('inicio-grafico-pagos').hidden=true;
    }
    function registrarAuditoria(atletas,pagos,finanzas) {
        const a=contar(atletas,'estado',['activo','espera','inactivo']);
        const p=contar(pagos,'estado_pago',['aprobado','pendiente','rechazado']);
        const total=atletas.length;
        el('stat-atletas-total').textContent=total;
        el('stat-activos').textContent=a.activo;
        el('stat-espera').textContent=a.espera;
        el('stat-inactivos').textContent=a.inactivo;
        el('stat-espera-gestion').textContent=a.espera;
        el('stat-pendientes').textContent=p.pendiente;
        el('inicio-distribucion').hidden=!total||a.otros>0;
        if(!el('inicio-distribucion').hidden){
            for(const [id,n] of [['activos',a.activo],['espera',a.espera],['inactivos',a.inactivo]])
                el('inicio-barra-'+id).style.width=(n/total*100)+'%';
            el('inicio-distribucion-texto').textContent=Math.round(a.activo/total*100)+'% activos · '+Math.round(a.espera/total*100)+'% en espera · '+Math.round(a.inactivo/total*100)+'% inactivos';
        }
        el('inicio-grafico-pagos').hidden=false;
        el('inicio-pagos-otros-fila').hidden=p.otros===0;
        for(const [key,n] of Object.entries(p)){
            el('inicio-pagos-'+key).textContent=n;
            el('inicio-pagos-barra-'+key).style.width=(pagos.length?n/pagos.length*100:0)+'%';
        }
        // La exportación solo conserva agregados, nunca listas con datos personales.
        auditoria={atletas:{...a,total},pagos:{...p,total:pagos.length},finanzas:{...finanzas},consultado:new Date().toISOString()};
        actualizarBoton();
    }
    async function cargarResumen() {
        if (!permitido || !fetchApi) return;
        const actual=++revision;
        const estado=el('inicio-resumen-estado');
        resumen=null;
        actualizarBoton();
        el('inicio-grafico-equipos').hidden=true;
        Object.values(metricas).forEach(id=>el(id).textContent='—');
        estado.textContent='Consultando resumen…';
        try {
            const res=await fetchApi('/api/directiva/resumen');
            const data=await res.json();
            if(actual!==revision)return;
            if(!res.ok||!data.success||!data.resumen||!Object.keys(metricas).every(k=>entero(data.resumen[k])))throw Error('Resumen inválido');
            const valores=Object.fromEntries(Object.keys(metricas).map(k=>[k,data.resumen[k]]));
            Object.entries(metricas).forEach(([key,id])=>el(id).textContent=valores[key]);
            const total=valores.activos_con_equipo+valores.activos_sin_equipo;
            const porcentaje=total?valores.activos_con_equipo/total*100:0;
            el('inicio-equipo-con').style.width=porcentaje+'%';
            el('inicio-equipo-sin').style.width=(total?100-porcentaje:0)+'%';
            el('inicio-equipo-cobertura').textContent=total?Math.round(porcentaje)+'% de cobertura':'Sin atletas activos';
            el('inicio-grafico-equipos').hidden=false;
            resumen={...valores,consultado:new Date().toISOString()};
            estado.textContent='';
            actualizarBoton();
        } catch {
            if(actual===revision)estado.textContent='Resumen complementario no disponible. Vuelve a Inicio para reintentar.';
        }
    }
    async function exportar() {
        if(!permitido||!auditoria||!resumen||exportando)return;
        const estado=el('inicio-exportar-estado');
        const boton=el('inicio-exportar');
        const datos={auditoria,resumen};
        exportando=true;
        actualizarBoton();
        boton.setAttribute('aria-busy','true');
        estado.textContent='Generando informe…';
        try{
            await root.JaguaresInforme.descargar(datos);
            estado.textContent='Informe descargado.';
        }catch{
            estado.textContent='No se pudo generar el informe. Inténtalo de nuevo.';
        }finally{
            exportando=false;
            boton.removeAttribute('aria-busy');
            actualizarBoton();
        }
    }
    function navegar(boton) {
        const destino=boton.dataset.dashboardDestino;
        const nav=[...document.querySelectorAll('.sidebar-menu li[data-target]')].find(n=>n.dataset.target===destino);
        if(!nav||nav.hidden||boton.hidden)return;
        const filtro=boton.dataset.dashboardFiltro;
        if(destino==='sec-atletas'&&filtro){
            el('search-atletas').value='';
            el('filter-categoria-atletas').value='todos';
            el('filter-estado-atletas').value=filtro;
            el('filter-estado-atletas').dispatchEvent(new Event('change'));
        }else if(destino==='sec-pagos'&&filtro){
            el('search-pagos').value='';
            el('filter-estado-pagos').value=filtro;
            el('filter-estado-pagos').dispatchEvent(new Event('change'));
        }
        nav.click();
        const titulo=el('panel-title');
        titulo.setAttribute('tabindex','-1');
        titulo.focus({preventScroll:true});
        window.scrollTo({top:0,behavior:'instant'});
    }
    function inicializar(rol, api) {
        permitido=['directiva','admin'].includes(rol);
        fetchApi=api;
        for(const id of ['inicio-deportes','inicio-solicitudes','inicio-sin-equipo','inicio-acceso-asignar','inicio-acceso-cobros','inicio-exportacion'])el(id).hidden=!permitido;
        actualizarBoton();
        if(!iniciado){
            iniciado=true;
            el('inicio-exportar').addEventListener('click',exportar);
            el('sec-dashboard').addEventListener('click',e=>{
                const boton=e.target.closest('button[data-dashboard-destino]');
                if(boton)navegar(boton);
            });
        }
        cargarResumen();
    }
    root.JaguaresInicio={inicializar,cargarResumen,comenzarAuditoria,falloAuditoria,registrarAuditoria};
})(window);
