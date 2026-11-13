'use strict';

(function(root) {
    const el = id => document.getElementById(id);
    let habilitado = false, cargando = false, enviando = false;
    let catalogo = [];
    let cerrarEdicion = null;
    const PRECIO_VALIDO = /^(?:\d{1,3})(?:\.\d{1,2})?$/;
    const precioValido = v => PRECIO_VALIDO.test(String(v)) && Number(v) >= .01 && Number(v) <= 999.99;

    function hoyCaracas() {
        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'
        }).formatToParts(new Date());
        const p = tipo => partes.find(x => x.type === tipo)?.value;
        return `${p('year')}-${p('month')}-${p('day')}`;
    }

    function proximoMes(periodo) {
        const [a,m] = periodo.split('-').map(Number);
        return `${m === 12 ? a+1 : a}-${String(m === 12 ? 1 : m+1).padStart(2,'0')}`;
    }

    function estado(mensaje,error=false) {
        const salida=el('gestion-cobros-estado');
        salida.textContent=mensaje;
        salida.dataset.error=String(error);
    }

    function celda(fila, contenido) {
        const td = document.createElement('td');
        if (contenido instanceof Node) td.append(contenido);
        else td.textContent=contenido;
        fila.append(td);
        return td;
    }

    function numero(n) { return Number(n).toFixed(2); }

    // SVG del sistema: acciones discretas, nunca mostrar guardar/cancelar sin editar.
    function icono(nombre) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('viewBox','0 0 24 24');
        svg.setAttribute('width','18');svg.setAttribute('height','18');
        svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
        svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');
        svg.setAttribute('stroke-linejoin','round');
        svg.setAttribute('aria-hidden','true');
        const trazos = {
            editar: ['M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1',
                'M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97L9 12v3h3z','M16 5l3 3'],
            guardar: ['M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
                'M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7'],
            cancelar: ['M18 6 6 18','M6 6l12 12'],
            retirar: ['M3 6h18','M8 6V4h8v2','M6 6l1 15h10l1-15','M10 10v7','M14 10v7']
        };
        for(const d of trazos[nombre]) {
            const path=document.createElementNS('http://www.w3.org/2000/svg','path');
            path.setAttribute('d',d);svg.append(path);
        }
        return svg;
    }

    function botonAccion(tipo,etiqueta) {
        const boton=document.createElement('button');
        boton.type='button';
        boton.className='cobros-accion-icono cobros-accion-'+tipo;
        boton.title=etiqueta;
        boton.setAttribute('aria-label',etiqueta);
        boton.append(icono(tipo));
        return boton;
    }

    function editarFila(concepto) {
        const tr=document.createElement('tr');
        const nombreVista=document.createElement('span');
        nombreVista.textContent=concepto.nombre;
        const nombre=document.createElement('input');
        nombre.type='text';nombre.maxLength=60;nombre.minLength=2;
        nombre.value=concepto.nombre;nombre.required=true;
        nombre.setAttribute('aria-label','Nombre '+concepto.codigo);
        const celdaNombre=celda(tr,nombreVista);celdaNombre.append(nombre);nombre.hidden=true;

        const precioVista=document.createElement('span');
        precioVista.textContent='USD '+numero(concepto.monto_referencia_usd);
        const precio=document.createElement('input');
        precio.type='number';precio.min='0.01';precio.max='999.99';
        precio.step='0.01';precio.inputMode='decimal';
        precio.value=numero(concepto.monto_referencia_usd);
        precio.setAttribute('aria-label','Precio USD '+concepto.nombre);
        const celdaPrecio=celda(tr,precioVista);celdaPrecio.append(precio);precio.hidden=true;

        const activoVista=document.createElement('span');
        activoVista.className='cobros-estado-concepto';
        activoVista.textContent=concepto.activo?'Activo':'Inactivo';
        const activo=document.createElement('input');
        activo.type='checkbox';activo.checked=Boolean(concepto.activo);
        activo.setAttribute('aria-label','Activo '+concepto.nombre);
        const celdaActivo=celda(tr,activoVista);celdaActivo.append(activo);activo.hidden=true;

        const acciones=document.createElement('div');
        acciones.className='cobros-acciones-fila';
        const editar=botonAccion('editar','Editar '+concepto.nombre);
        const guardar=botonAccion('guardar','Guardar cambios de '+concepto.nombre);
        const cancelar=botonAccion('cancelar','Cancelar edición de '+concepto.nombre);
        const retirar=botonAccion('retirar','Retirar concepto '+concepto.nombre);
        guardar.hidden=true;cancelar.hidden=true;retirar.hidden=true;
        acciones.append(editar,guardar,cancelar,retirar);
        celda(tr,acciones).className='cobros-columna-acciones';

        function edicion(activa) {
            for(const input of [nombre,precio,activo])input.hidden=!activa;
            for(const vista of [nombreVista,precioVista,activoVista])vista.hidden=activa;
            editar.hidden=activa;guardar.hidden=!activa;cancelar.hidden=!activa;
            retirar.hidden=!activa;
            if(!activa) {
                nombre.value=concepto.nombre;
                precio.value=numero(concepto.monto_referencia_usd);
                activo.checked=Boolean(concepto.activo);
                if(cerrarEdicion===finalizar)cerrarEdicion=null;
            }
        }
        function finalizar() { edicion(false); }
        editar.addEventListener('click',()=>{
            if(enviando||cargando)return;
            if(cerrarEdicion)cerrarEdicion();
            edicion(true);cerrarEdicion=finalizar;nombre.focus();
        });
        cancelar.addEventListener('click',()=>{if(!enviando)finalizar();});
        retirar.addEventListener('click',async()=>{
            if(enviando)return;
            if(!root.confirm('¿Retirar «'+concepto.nombre+'» del catálogo? '+
                'Si tiene cargos anteriores se archivará y conservará su historial. '+
                'Los conceptos institucionales también se archivan.'))return;
            retirar.disabled=true;guardar.disabled=true;cancelar.disabled=true;
            const exito=await escribir('/api/directiva/cobros/catalogo/'+
                encodeURIComponent(concepto.codigo),{method:'DELETE'},'Concepto retirado');
            retirar.disabled=false;guardar.disabled=false;cancelar.disabled=false;
            if(exito){
                cerrarEdicion=null;
                await cargar();
                estado('Concepto retirado. Puedes mostrar los archivados para reactivarlos.');
            }
        });
        guardar.addEventListener('click',async()=>{
            if(enviando)return;
            const nuevoNombre=nombre.value.trim();
            if(nuevoNombre.length<2||nuevoNombre.length>60||/[<>\x00-\x1f]/.test(nuevoNombre)||
                !precioValido(precio.value)) {
                estado('Nombre no válido o precio fuera de USD 0,01–999,99 (máximo 2 decimales).',true);
                return;
            }
            if(nuevoNombre===concepto.nombre&&
                Number(precio.value)===Number(concepto.monto_referencia_usd)&&
                activo.checked===Boolean(concepto.activo)) {
                finalizar();return;
            }
            if(!root.confirm('¿Guardar cambios de '+concepto.nombre+'? Solo afectan cargos futuros.'))return;
            guardar.disabled=true;cancelar.disabled=true;
            const guardado=await escribir('/api/directiva/cobros/catalogo/'+encodeURIComponent(concepto.codigo),{
                method:'PATCH',body:JSON.stringify({
                    nombre:nuevoNombre,monto_usd:precio.value,activo:activo.checked
                })
            },'Tarifa actualizada');
            guardar.disabled=false;cancelar.disabled=false;
            if(guardado) {
                cerrarEdicion=null;
                await cargar();
                estado('Tarifa actualizada');
            }
        });
        return tr;
    }

    function pintar() {
        const tabla=el('gestion-cobros-conceptos');
        cerrarEdicion=null;
        tabla.replaceChildren();
        const visibles=catalogo.filter(x=>x.activo||
            el('gestion-conceptos-archivados')?.checked);
        for (const concepto of visibles) tabla.append(editarFila(concepto));
        if (!visibles.length) {
            const tr=document.createElement('tr');
            celda(tr,'Sin conceptos').colSpan=4;
            tabla.append(tr);
        }
        const sel=el('gestion-cargo-concepto');
        const previo=sel.value;
        sel.replaceChildren(new Option('Seleccionar',''));
        for (const o of catalogo.filter(x=>x.activo && x.modalidad!=='mensual')) {
            sel.add(new Option(`${o.nombre} · USD ${numero(o.monto_referencia_usd)}`,o.codigo));
        }
        if ([...sel.options].some(x=>x.value===previo))sel.value=previo;
        const nota=el('gestion-cobros-atleta');
        const atleta=el('cobros-atleta');
        nota.textContent=atleta.value ? 'Atleta: '+atleta.selectedOptions[0]?.textContent :
            'Selecciona primero un atleta en el historial superior.';
    }

    function pintarTasas(tasas) {
        const tbody=el('gestion-cobros-tasas');
        tbody.replaceChildren();
        for(const tasa of tasas) {
            const tr=document.createElement('tr');
            celda(tr,String(tasa.fecha_vigencia||''));
            celda(tr,tasa.moneda);
            celda(tr,String(tasa.tasa_por_usd));
            celda(tr,String(tasa.fuente));
            tbody.append(tr);
        }
        if (!tasas.length) {
            const tr=document.createElement('tr');
            celda(tr,'No hay tasas configuradas').colSpan=4;
            tbody.append(tr);
        }
    }

    let referencias = null, referenciasCargando = false;
    function mostrarReferencias(datos) {
        const formatear=v=>Number(v).toLocaleString('es-VE',{
            minimumFractionDigits:2,maximumFractionDigits:6
        });
        const principal=datos.principal||datos.mercado;
        el('gestion-mercado-usd').textContent=principal?
            formatear(principal.usd_ves)+' Bs':'—';
        el('gestion-mercado-eur').textContent=principal?
            formatear(principal.eur_ves)+' Bs':'—';
        el('gestion-mercado-vigencia').textContent=principal?
            'Fecha del proveedor: '+String(principal.fecha_referencia).slice(0,10):
            'Sin cotización vigente';
        el('gestion-referencia-registrar').disabled=!principal;
        el('gestion-referencias-cache').textContent=principal?
            (principal.desde_cache?'Desde caché del día':'Cotización guardada hoy'):'';
        const aviso=el('gestion-referencias-estado');
        aviso.textContent=datos.avisos?.principal||'';
        aviso.dataset.error=String(Boolean(datos.avisos?.principal));
    }

    async function consultarReferencias() {
        if(!habilitado||referenciasCargando)return;
        referenciasCargando=true;
        el('gestion-referencias-consultar').disabled=true;
        const aviso=el('gestion-referencias-estado');
        aviso.textContent='Consultando referencias…';aviso.dataset.error='false';
        try{
            const respuesta=await apiFetch('/api/directiva/cobros/tasas/referencias');
            const datos=await respuesta.json();
            if(!respuesta.ok||!datos.success)
                throw new Error(datos.message||'No se pudieron consultar referencias');
            referencias=datos;
            mostrarReferencias(datos);
        }catch(error){
            aviso.textContent=error.message||'No hay referencias disponibles.';
            aviso.dataset.error='true';
            el('gestion-referencia-registrar').disabled=true;
        }finally{
            referenciasCargando=false;
            el('gestion-referencias-consultar').disabled=false;
        }
    }

    async function cargar() {
        if(!habilitado||cargando||enviando)return;
        cargando=true;
        el('gestion-cobros-recargar').disabled=true;
        estado('Cargando conceptos…');
        try {
            const [r1,r2]=await Promise.all([
                apiFetch('/api/directiva/cobros/catalogo'),
                apiFetch('/api/directiva/cobros/tasas')
            ]);
            const [a,b]=await Promise.all([r1.json(),r2.json()]);
            if(!r1.ok||!r2.ok||!a.success||!b.success) {
                throw new Error(a.message||b.message||'No se pudo consultar');
            }
            catalogo=a.conceptos||[];
            pintar();
            pintarTasas(b.tasas||[]);
            estado('');
        }catch(error){estado(error.message||'No se pudo cargar.',true);}
        finally{cargando=false;el('gestion-cobros-recargar').disabled=false;}
    }

    async function escribir(url,opciones,mensaje) {
        if (enviando) return false;
        enviando=true;
        estado('Guardando…');
        try {
            const r=await apiFetch(url,opciones);
            const data=await r.json();
            if(!r.ok||!data.success)throw new Error(data.message||'No se pudo guardar');
            estado(mensaje);
            return true;
        }catch(e){estado(e.message||'No se pudo guardar',true);return false;}
        finally{enviando=false;}
    }

    async function terminar(url,body,mensaje) {
        const correcto=await escribir(url,{
            method:'POST',body:JSON.stringify(body)
        },mensaje);
        if (correcto) {
            await cargar();
            estado(mensaje);
            root.JaguaresConciliacion?.cargar();
        }
        return correcto;
    }

    function seleccionado() {
        const sel=el('cobros-atleta');
        if (!sel?.value) {estado('Selecciona primero un atleta.',true);return null;}
        return {id:Number(sel.value),nombre:sel.selectedOptions[0]?.textContent||''};
    }

    function inicializar(rol) {
        habilitado=['directiva','admin'].includes(rol);
        el('gestion-cobros').hidden=!habilitado;
        if (!habilitado) return;

        const hoy=hoyCaracas(),mes=hoy.slice(0,7);
        el('gestion-mes').value=mes;
        el('gestion-mes').min=mes;
        el('gestion-mes').max=proximoMes(mes);
        el('gestion-cargo-vence').value=hoy;
        el('gestion-cargo-vence').min=hoy;
        el('gestion-cargo-limite').value=hoy;
        el('gestion-cargo-limite').min=hoy;
        const rangoDesde=mes+'-01';
        const rangoHasta=String(Number(hoy.slice(0,4))+1)+'-12-31';
        el('gestion-tasa-fecha').value=hoy;
        el('gestion-tasa-fecha').min=rangoDesde;
        el('gestion-tasa-fecha').max=rangoHasta;
        el('cobros-atleta').addEventListener('change',pintar);
        el('gestion-cobros-recargar').addEventListener('click',cargar);
        el('gestion-conceptos-archivados').addEventListener('change',pintar);
        el('gestion-seccion-tasas').addEventListener('toggle',event=>{
            if(event.target.open&&!referencias)consultarReferencias();
        });
        el('gestion-referencias-consultar').addEventListener('click',consultarReferencias);
        el('gestion-referencia-registrar').addEventListener('click',async()=>{
            const referencia=referencias?.principal||referencias?.mercado;
            if(!referencia||enviando)return;
            const hoy=hoyCaracas();
            const precio=Number(referencia.usd_ves).toFixed(6);
            if(!root.confirm('¿Registrar '+precio+' Bs por USD para '+hoy+'?\n'+
                'Fuente: ExchangeRate-API, actualización '+
                String(referencia.fecha_referencia).slice(0,10)+
                '.\nLa tasa quedará registrada e inmutable.'))return;
            const listo=await terminar('/api/directiva/cobros/tasas/publicar-referencia',
                {confirmar:true},'Tasa ExchangeRate-API registrada');
            if(listo)el('gestion-referencia-registrar').disabled=true;
        });

        el('gestion-cobros-nuevo').addEventListener('submit',async(e)=>{
            e.preventDefault();
            const nombre=el('gestion-concepto-nombre').value.trim();
            const codigo=nombre.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                .toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
            const monto=el('gestion-concepto-precio').value;
            if (codigo.length<3 || ['inscripcion','mensualidad'].includes(codigo)) {
                estado('Usa un nombre de concepto diferente.',true);return;
            }
            if(!precioValido(monto)) {estado('Precio permitido: USD 0,01–999,99 (dos decimales).',true);return;}
            if(!root.confirm(`¿Agregar ${nombre} con tarifa USD ${monto}?`))return;
            if(await terminar('/api/directiva/cobros/catalogo',
                {codigo,nombre,monto_usd:monto},'Concepto agregado'))e.target.reset();
        });

        el('gestion-cobros-mensualidad').addEventListener('submit',async(e)=>{
            e.preventDefault();
            const atleta=seleccionado();if(!atleta)return;
            const mes=el('gestion-mes').value;
            if(!root.confirm(`¿Asignar mensualidad de ${mes} a ${atleta.nombre}?`))return;
            await terminar('/api/directiva/cobros/mensualidades',{
                id_atleta:atleta.id,periodo_mes:mes+'-01',confirmar:true
            },'Mensualidad asignada');
        });

        el('gestion-cobros-cargo').addEventListener('submit',async(e)=>{
            e.preventDefault();
            const atleta=seleccionado();if(!atleta)return;
            const concepto=el('gestion-cargo-concepto').value;
            const info=catalogo.find(x=>x.codigo===concepto);
            if(!info)return;
            if(concepto==='inscripcion'&&!el('gestion-cargo-revisado').checked) {
                estado('Confirma la revisión del historial de inscripción.',true);return;
            }
            if(!root.confirm(`¿Asignar ${info.nombre} (USD ${numero(info.monto_referencia_usd)}) a ${atleta.nombre}?`))return;
            await terminar('/api/directiva/cobros/cargos',{
                id_atleta:atleta.id,codigo_concepto:concepto,
                detalle:el('gestion-cargo-detalle').value.trim(),
                fecha_vencimiento:el('gestion-cargo-vence').value,
                fecha_limite:el('gestion-cargo-limite').value,
                historial_revisado:el('gestion-cargo-revisado').checked,confirmar:true
            },'Cargo asignado');
        });

        el('gestion-cobros-tasa').addEventListener('submit',async(e)=>{
            e.preventDefault();
            const body={
                moneda:el('gestion-tasa-moneda').value,
                fecha_vigencia:el('gestion-tasa-fecha').value,
                tasa_por_usd:el('gestion-tasa-valor').value,
                fuente:el('gestion-tasa-fuente').value.trim()
            };
            if(body.fecha_vigencia < rangoDesde || body.fecha_vigencia > rangoHasta) {
                estado('Fecha permitida: desde el mes actual hasta diciembre del próximo año.',true);
                return;
            }
            if(!root.confirm(`¿Registrar ${body.tasa_por_usd} ${body.moneda} por USD para ${body.fecha_vigencia}?\nFuente: ${body.fuente}`))return;
            if(await terminar('/api/directiva/cobros/tasas',body,'Tasa registrada')) {
                el('gestion-tasa-valor').value='';
                el('gestion-tasa-fuente').value='';
            }
        });
    }

    root.JaguaresGestionCobros={inicializar,cargar};
})(window);
