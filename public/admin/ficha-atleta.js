/* Lectura y edición de ficha compartidas. El servidor autoriza y valida. */
(function(root) {
    'use strict';
    const el=id=>document.getElementById(id);
    function inicializar({apiFetch,showToast,actualizar}) {
        const dialog=el('ficha-atleta-dialog'), form=el('ficha-form'),
            lectura=el('ficha-lectura'), estado=el('ficha-estado'),
            guardar=form.querySelector('button[type=submit]');
        let atleta=null, id=null, ocupado=false, secuencia=0, origen=null;
        const campos={nombres:'ficha-nombres',apellidos:'ficha-apellidos',
            fecha_nacimiento:'ficha-fecha',direccion:'ficha-direccion',
            telefono:'ficha-telefono',alergias_medicas:'ficha-medico'};
        function mostrarDatos() {
            form.hidden=true;lectura.hidden=false;
            const datos=el('ficha-datos');datos.replaceChildren();
            for(const [titulo,valor] of [
                ['Nombre',atleta.nombres+' '+atleta.apellidos],['Cédula',atleta.cedula],
                ['Fecha de nacimiento',root.FechasJaguares?.formatearFechaCivil(atleta.fecha_nacimiento)||atleta.fecha_nacimiento],
                ['Categoría por edad',atleta.clasificacion?.categoria?.nombre],
                ['Estado',atleta.estado],['Teléfono',atleta.telefono],
                ['Dirección',atleta.direccion],['Condiciones médicas',atleta.alergias_medicas]
            ]){
                const bloque=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
                dt.textContent=titulo;dd.textContent=valor||'—';bloque.append(dt,dd);datos.append(bloque);
            }
            const docs=el('ficha-documentos');docs.replaceChildren();
            for(const [campo,tipo,etiqueta] of [['foto_url','foto','Foto'],['cedula_archivo_url','cedula_archivo','Cédula'],['partida_nacimiento_url','partida_nacimiento','Partida de nacimiento']]){
                const ruta='/api/atletas/'+id+'/documentos/'+tipo;
                if(atleta.documentos?.[campo]!==ruta)continue;
                const enlace=document.createElement('a');enlace.href=ruta;enlace.target='_blank';enlace.rel='noopener noreferrer';enlace.textContent=etiqueta;docs.append(enlace);
            }
            el('ficha-editar').disabled=!atleta.version_ficha;
        }
        function alternarCedula(){
            const heredada=el('ficha-heredada').checked;
            el('ficha-cedula-grupo').hidden=heredada;
            el('ficha-nac').disabled=heredada;el('ficha-cedula').disabled=heredada;
            el('ficha-cedula').setCustomValidity('');
            const nota=el('ficha-cedula-nota');nota.hidden=!heredada;
            nota.textContent=atleta?.cedula_heredada?'Se conserva '+atleta.cedula:'Se asignará desde la cédula del representante al guardar.';
        }
        function editar(){
            if(!atleta?.version_ficha)return;
            lectura.hidden=true;form.hidden=false;estado.textContent='';
            for(const [k,campo] of Object.entries(campos)){
                el(campo).value=atleta[k]||'';
                el(campo).setCustomValidity('');
            }
            el('ficha-heredada').checked=!!atleta.cedula_heredada;
            cargarCedulaJaguares('ficha',atleta.cedula_heredada?'':atleta.cedula);
            alternarCedula();el('ficha-nombres').focus();
        }
        async function abrir(nuevoId,edicion,boton){
            if(ocupado||dialog.open||!Number.isSafeInteger(nuevoId)||nuevoId<=0)return;
            id=nuevoId;atleta=null;origen=boton;const revision=++secuencia;
            lectura.hidden=true;form.hidden=true;estado.textContent='Cargando ficha…';
            dialog.showModal();
            try{
                const res=await apiFetch('/api/atletas/'+id),data=await res.json();
                if(revision!==secuencia||!dialog.open)return;
                if(!res.ok||!data.success||!data.atleta)throw Error('Ficha no disponible');
                atleta=data.atleta;estado.textContent='';
                if(edicion&&atleta.version_ficha)editar();else mostrarDatos();
            }catch{if(revision===secuencia&&dialog.open)estado.textContent='No se pudo consultar la ficha. Cierra e inténtalo de nuevo.';}
        }
        document.addEventListener('click',e=>{
            const boton=e.target.closest('button[data-ficha-editar],button[data-ficha-ver]');
            if(boton)abrir(Number(boton.dataset.fichaEditar||boton.dataset.fichaVer),boton.hasAttribute('data-ficha-editar'),boton);
        });
        el('ficha-editar').addEventListener('click',editar);
        el('ficha-cancelar').addEventListener('click',()=>{if(!ocupado){estado.textContent='';mostrarDatos();}});
        el('ficha-heredada').addEventListener('change',alternarCedula);
        el('ficha-cerrar').addEventListener('click',()=>{if(!ocupado)dialog.close();});
        dialog.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();});
        dialog.addEventListener('close',()=>{++secuencia;atleta=null;form.reset();lectura.hidden=true;form.hidden=true;el('ficha-datos').replaceChildren();el('ficha-documentos').replaceChildren();estado.textContent='';origen?.focus();});
        form.addEventListener('submit',async e=>{
            e.preventDefault();
            if(ocupado||!atleta||!validarFormularioJaguares(form))return;
            const heredada=el('ficha-heredada').checked;
            const body={version:atleta.version_ficha,nombres:el('ficha-nombres').value,
                apellidos:el('ficha-apellidos').value,hereda_cedula:heredada,
                cedula:heredada?null:leerCedulaJaguares('ficha'),fecha_nac:el('ficha-fecha').value,
                direccion:el('ficha-direccion').value,telefono:el('ficha-telefono').value,
                alergias_medicas:el('ficha-medico').value};
            ocupado=true;guardar.disabled=true;el('ficha-cerrar').disabled=true;el('ficha-cancelar').disabled=true;
            estado.textContent='Guardando…';
            try{
                const res=await apiFetch('/api/atletas/'+id+'/ficha',{method:'PUT',body:JSON.stringify(body)}),data=await res.json();
                if(!res.ok||!data.success){estado.textContent=data.message||'No se pudo guardar la ficha.';return;}
                estado.textContent='';dialog.close();showToast('Ficha actualizada','success');
                await actualizar();
            }catch{estado.textContent='No se pudo confirmar el guardado. Vuelve a abrir la ficha antes de reintentar.';}
            finally{ocupado=false;guardar.disabled=false;el('ficha-cerrar').disabled=false;el('ficha-cancelar').disabled=false;}
        });
    }
    root.JaguaresFicha={inicializar};
})(window);
