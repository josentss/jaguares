'use strict';

(function(root) {
    const el = id => document.getElementById(id);
    let habilitado = false, cargando = false, enviando = false;
    let catalogo = [];

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

    function editarFila(concepto) {
        const tr=document.createElement('tr');
        const nombre=document.createElement('input');
        nombre.type='text';nombre.maxLength=60;nombre.value=concepto.nombre;
        nombre.setAttribute('aria-label','Nombre '+concepto.codigo);
        celda(tr,nombre);
        const precio=document.createElement('input');
        precio.type='number';precio.min='0.01';precio.max='9999999';
        precio.step='0.01';precio.value=numero(concepto.monto_referencia_usd);
        precio.setAttribute('aria-label','Precio USD '+concepto.nombre);
        celda(tr,precio);
        const activo=document.createElement('input');
        activo.type='checkbox';activo.checked=Boolean(concepto.activo);
        activo.setAttribute('aria-label','Activo '+concepto.nombre);
        celda(tr,activo);
        const guardar=document.createElement('button');
        guardar.type='button';guardar.className='cobros-btn-secundario';
        guardar.textContent='Guardar';
        guardar.addEventListener('click',async()=>{
            if (enviando) return;
            if (!root.confirm(`¿Guardar la tarifa de ${concepto.nombre}? Solo afectará cargos futuros.`)) return;
            const guardado=await escribir('/api/directiva/cobros/catalogo/'+encodeURIComponent(concepto.codigo),{
                method:'PATCH',body:JSON.stringify({
                    nombre:nombre.value.trim(),monto_usd:precio.value,activo:activo.checked
                })
            },'Tarifa actualizada');
            if (guardado) {
                // Usar siempre el precio guardado en servidor, no la copia previa del catálogo.
                await cargar();
                estado('Tarifa actualizada');
            }
        });
        celda(tr,guardar);
        return tr;
    }

    function pintar() {
        const tabla=el('gestion-cobros-conceptos');
        tabla.replaceChildren();
        for (const concepto of catalogo) tabla.append(editarFila(concepto));
        if (!catalogo.length) {
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
        el('gestion-tasa-fecha').value=hoy;
        el('gestion-tasa-fecha').max=hoy;
        el('cobros-atleta').addEventListener('change',pintar);
        el('gestion-cobros-recargar').addEventListener('click',cargar);

        el('gestion-cobros-nuevo').addEventListener('submit',async(e)=>{
            e.preventDefault();
            const nombre=el('gestion-concepto-nombre').value.trim();
            const codigo=nombre.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                .toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
            const monto=el('gestion-concepto-precio').value;
            if (codigo.length<3 || ['inscripcion','mensualidad'].includes(codigo)) {
                estado('Usa un nombre de concepto diferente.',true);return;
            }
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
            if(!root.confirm(`¿Registrar ${body.tasa_por_usd} ${body.moneda} por USD para ${body.fecha_vigencia}?\nFuente: ${body.fuente}`))return;
            if(await terminar('/api/directiva/cobros/tasas',body,'Tasa registrada')) {
                el('gestion-tasa-valor').value='';
                el('gestion-tasa-fuente').value='';
            }
        });
    }

    root.JaguaresGestionCobros={inicializar,cargar};
})(window);
