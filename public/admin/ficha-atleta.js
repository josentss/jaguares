/* Lectura y edición de ficha compartidas. El servidor autoriza y valida. */
(function(root) {
    'use strict';
    const el=id=>document.getElementById(id);
    function inicializar({apiFetch,showToast,actualizar}) {
        const dialog=el('ficha-atleta-dialog'), form=el('ficha-form'),
            estado=el('ficha-estado'),
            guardar=form.querySelector('button[type=submit]');
        let atleta=null, id=null, ocupado=false, secuencia=0, origen=null;
        const campos={nombres:'ficha-nombres',apellidos:'ficha-apellidos',
            fecha_nacimiento:'ficha-fecha',direccion:'ficha-direccion',
            telefono:'ficha-telefono',alergias_medicas:'ficha-medico'};
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
            form.hidden=false;estado.textContent='';
            for(const [k,campo] of Object.entries(campos)){
                el(campo).value=atleta[k]||'';
                el(campo).setCustomValidity('');
            }
            el('ficha-heredada').checked=!!atleta.cedula_heredada;
            cargarCedulaJaguares('ficha',atleta.cedula_heredada?'':atleta.cedula);
            alternarCedula();el('ficha-nombres').focus();
        }
        async function abrir(nuevoId,boton){
            if(ocupado||dialog.open||!Number.isSafeInteger(nuevoId)||nuevoId<=0)return;
            id=nuevoId;atleta=null;origen=boton;const revision=++secuencia;
            form.hidden=true;estado.textContent='Cargando ficha…';
            dialog.showModal();
            try{
                const res=await apiFetch('/api/atletas/'+id),data=await res.json();
                if(revision!==secuencia||!dialog.open)return;
                if(!res.ok||!data.success||!data.atleta)throw Error('Ficha no disponible');
                atleta=data.atleta;estado.textContent='';
                if(atleta.version_ficha)editar();else estado.textContent='No se puede editar esta ficha. Vuelve a consultarla.';
            }catch{if(revision===secuencia&&dialog.open)estado.textContent='No se pudo consultar la ficha. Cierra e inténtalo de nuevo.';}
        }
        document.addEventListener('click',e=>{
            const boton=e.target.closest('button[data-ficha-editar]');
            if(boton)abrir(Number(boton.dataset.fichaEditar),boton);
        });
        el('ficha-cancelar').addEventListener('click',()=>{if(!ocupado)dialog.close();});
        el('ficha-heredada').addEventListener('change',alternarCedula);
        el('ficha-cerrar').addEventListener('click',()=>{if(!ocupado)dialog.close();});
        dialog.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();});
        dialog.addEventListener('close',()=>{++secuencia;atleta=null;form.reset();form.hidden=true;estado.textContent='';origen?.focus();});
        form.addEventListener('submit',async e=>{
            e.preventDefault();
            if(ocupado||!atleta||!validarFormularioJaguares(form))return;
            const heredada=el('ficha-heredada').checked;
            const body={version:atleta.version_ficha,nombres:el('ficha-nombres').value,
                apellidos:el('ficha-apellidos').value,hereda_cedula:heredada,
                cedula:heredada?null:leerCedulaJaguares('ficha'),fecha_nac:el('ficha-fecha').value,
                direccion:el('ficha-direccion').value,telefono:el('ficha-telefono').value,
                alergias_medicas:el('ficha-medico').value};
            if(body.fecha_nac!==atleta.fecha_nacimiento && root.ValidacionJaguares && !root.ValidacionJaguares.esEdadValida(body.fecha_nac)){
                estado.textContent='La fecha corregida debe corresponder a un atleta de 5 a 18 años.';
                el('ficha-fecha').focus();return;
            }
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
