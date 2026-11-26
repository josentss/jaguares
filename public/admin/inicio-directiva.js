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
    function atletas(lista, espera) {
        const ids=['stat-atletas-total','stat-inactivos','stat-espera-gestion'];
        const distribucion=el('inicio-distribucion');
        if (!Array.isArray(lista)) {
            ids.forEach(id=>el(id).textContent='—'); distribucion.hidden=true; return;
        }
        const total=lista.length;
        const conteos=['activo','espera','inactivo'].map(estado=>lista.filter(a=>a.estado===estado).length);
        el(ids[0]).textContent=total;
        el(ids[1]).textContent=conteos[2];
        el(ids[2]).textContent=entero(Number(espera))?Number(espera):'—';
        distribucion.hidden=!total || conteos.reduce((a,b)=>a+b,0)!==total;
        if (!distribucion.hidden) {
            ['activos','espera','inactivos'].forEach((key,i)=>el('inicio-barra-'+key).style.width=(conteos[i]/total*100)+'%');
            el('inicio-distribucion-texto').textContent=conteos[0]+' activos · '+conteos[1]+' en espera · '+conteos[2]+' inactivos';
        }
    }
    async function cargarResumen() {
        if (!permitido || !fetchApi) return;
        const actual=++revision;
        const estado=el('inicio-resumen-estado');
        Object.values(metricas).forEach(id=>el(id).textContent='—');
        estado.textContent='Consultando resumen…';
        try {
            const res=await fetchApi('/api/directiva/resumen');
            const data=await res.json();
            if(actual!==revision)return;
            if(!res.ok||!data.success||!data.resumen||!Object.keys(metricas).every(k=>entero(data.resumen[k])))throw Error('Resumen inválido');
            Object.entries(metricas).forEach(([key,id])=>el(id).textContent=data.resumen[key]);
            estado.textContent='';
        } catch {
            if(actual===revision)estado.textContent='Resumen complementario no disponible. Vuelve a Inicio para reintentar.';
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
        for(const id of ['inicio-deportes','inicio-solicitudes','inicio-sin-equipo','inicio-acceso-asignar','inicio-acceso-cobros'])el(id).hidden=!permitido;
        if(!iniciado){
            iniciado=true;
            el('sec-dashboard').addEventListener('click',e=>{
                const boton=e.target.closest('button[data-dashboard-destino]');
                if(boton)navegar(boton);
            });
        }
        cargarResumen();
    }
    root.JaguaresInicio={inicializar,cargarResumen,atletas};
})(window);
