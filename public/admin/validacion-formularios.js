/* Reglas de formulario de Jaguares: el backend sigue siendo la autoridad. */
(function () {
    'use strict';

    const NOMBRE = /^[\p{L}\p{M}]+(?:[ '\u2019.\-][\p{L}\p{M}]+)*$/u;
    const CEDULA = /^[VE]-[0-9]{7,9}$/;
    const TELEFONO = /^(?:0[0-9]{10}|(?:\+?58)[1-9][0-9]{9}|\+[1-9][0-9]{7,14})$/;
    const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

    const CAMPOS = {
        'reg-names': ['nombre', 80], 'reg-lastnames': ['nombre', 80],
        'reg-email': ['correo', 120], 'reg-password': ['clave', 128],
        'atl-nombres': ['nombre', 80], 'atl-apellidos': ['nombre', 80],
        'atl-cedula': ['cedula-numero', 9], 'atl-direccion': ['texto', 255],
        'atl-fecha-nac': ['fecha-atleta', 10],
        'atl-telefono': ['telefono', 30], 'atl-alergias': ['medico', 500],
        'perfil-nombres': ['nombre', 80], 'perfil-apellidos': ['nombre', 80],
        'perfil-cedula': ['cedula', 11], 'perfil-tel1': ['telefono', 30],
        'perfil-tel2': ['telefono', 30], 'perfil-password': ['clave', 128],
        'ob-cedula': ['cedula', 11], 'ob-tel1': ['telefono', 30],
        'ob-tel2': ['telefono', 30],
        'dir-rep-nombres': ['nombre', 80], 'dir-rep-apellidos': ['nombre', 80],
        'dir-rep-cedula': ['cedula-numero', 9],
        'dir-rep-telefono': ['telefono', 30],
        'dir-rep-correo': ['correo', 120], 'dir-rep-pass': ['clave', 128],
        'dir-nombres': ['nombre', 80], 'dir-apellidos': ['nombre', 80],
        'dir-cedula': ['cedula-numero', 9], 'dir-direccion': ['texto', 255],
        'dir-fecha-nac': ['fecha-atleta', 10],
        'dir-telefono': ['telefono', 30], 'dir-alergias': ['medico', 500]
    };

    function fechaVenezuela() {
        if (window.FechasJaguares) return window.FechasJaguares.hoyVenezuela();
        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const parte = tipo => partes.find(p => p.type === tipo)?.value;
        return [parte('year'), parte('month'), parte('day')].join('-');
    }

    function esEdadValida(fecha, hoy = fechaVenezuela()) {
        if (window.FechasJaguares) return window.FechasJaguares.esEdadValida(fecha, hoy);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
        const fechaReal = new Date(fecha + 'T12:00:00Z');
        if (Number.isNaN(fechaReal.getTime()) || fechaReal.toISOString().slice(0,10) !== fecha) return false;
        const [an,mn,dn] = fecha.split('-').map(Number);
        const [ah,mh,dh] = hoy.split('-').map(Number);
        const edad = ah - an - (mh < mn || (mh === mn && dh < dn) ? 1 : 0);
        return fecha <= hoy && edad >= 5 && edad <= 18;
    }

    function actualizarLimitesNacimiento(campo) {
        const hoy = fechaVenezuela();
        let limites = window.FechasJaguares?.limitesNacimientoAtleta(hoy);
        if (!limites) {
            // Respaldo si no cargó el recurso de fechas: no bloquear el formulario.
            const [year, mes, dia] = hoy.split('-').map(Number);
            const aniversario = edad => new Date(Date.UTC(year - edad, mes - 1,
                Math.min(dia, new Date(Date.UTC(year - edad, mes, 0)).getUTCDate())));
            const minimo = aniversario(19);
            minimo.setUTCDate(minimo.getUTCDate() + 1);
            limites = { min: minimo.toISOString().slice(0, 10), max: aniversario(5).toISOString().slice(0, 10) };
        }
        campo.min = limites.min;
        campo.max = limites.max;
    }

    function errorCampo(tipo, valor, requerido) {
        const v = valor.trim();
        if (!v) return requerido ? 'Este campo es obligatorio.' : '';
        switch (tipo) {
            case 'nombre':
                return v.length < 2 || v.length > 80 || !NOMBRE.test(v)
                    ? 'Escribe un nombre de 2 a 80 caracteres: letras, espacios, apóstrofes o guiones.'
                    : '';
            case 'cedula-numero':
                return /^[0-9]{7,9}$/.test(v) ? '' : 'Cédula incompleta: ingresa entre 7 y 9 dígitos.';
            case 'cedula':
                return CEDULA.test(v.toUpperCase()) ? '' : 'Cédula incompleta o incorrecta: V-/E- y de 7 a 9 dígitos.';
            case 'telefono': {
                const limpio = v.replace(/[() .-]/g, '');
                return /^[+0-9() .-]{8,30}$/.test(v) && TELEFONO.test(limpio)
                    ? '' : 'Usa 11 dígitos nacionales o teléfono internacional con + y código de país.';
            }
            case 'texto': {
                if (CONTROL.test(valor) || /[<>]/.test(valor)) return 'La dirección contiene caracteres no permitidos.';
                const letras = v.match(/\p{L}/gu) || [];
                return v.length >= 7 && v.length <= 255 && letras.length >= 3 && !/\d{15,}/.test(v)
                    ? '' : 'Indica una dirección real: calle, barrio o referencia. No basta con números.';
            }
            case 'medico':
                if (CONTROL.test(valor) || /[<>]/.test(valor) || v.length > 500)
                    return 'Las condiciones médicas contienen caracteres no permitidos.';
                return (!/\p{L}/u.test(v) || /\p{L}\d{3,}\p{L}/u.test(v))
                    ? 'Describe la condición con palabras; se admiten números médicos, como tipo 1 o 500 mg.'
                    : '';
            case 'fecha-atleta':
                return esEdadValida(v) ? ''
                    : 'El atleta debe tener entre 5 y 18 años cumplidos. Revisa la fecha de nacimiento.';
            case 'correo':
                return v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
                    ? '' : 'Introduce un correo válido (máximo 120 caracteres).';
            case 'clave':
                return valor.length >= 8 && valor.length <= 128 && valor.trim().length > 0
                    ? '' : 'La contraseña debe tener entre 8 y 128 caracteres.';
            default: return '';
        }
    }

    function tipoCampo(campo) { return CAMPOS[campo.id]?.[0]; }

    function esCampoOculto(campo) {
        if (campo.matches(':disabled')) return true;
        // offsetParent también es null para elementos fijos/otros layouts visibles.
        for (let elemento = campo; elemento && elemento.nodeType === 1; elemento = elemento.parentElement) {
            const estilo = getComputedStyle(elemento);
            if (estilo.display === 'none' || estilo.visibility === 'hidden') return true;
        }
        return false;
    }

    function validarCampo(campo) {
        const tipo = tipoCampo(campo);
        if (!tipo) return true;
        if (esCampoOculto(campo)) {
            campo.setCustomValidity('');
            campo.removeAttribute('aria-invalid');
            return true;
        }
        if (tipo === 'cedula' && campo.value) {
            campo.value = campo.value.toUpperCase();
        }
        if (tipo === 'fecha-atleta') actualizarLimitesNacimiento(campo);
        const mensaje = errorCampo(tipo, campo.value, campo.required);
        campo.setCustomValidity(mensaje);
        if (mensaje) campo.setAttribute('aria-invalid', 'true');
        else campo.removeAttribute('aria-invalid');
        return !mensaje;
    }

    function limpiarMensaje(formulario) {
        formulario.querySelector('.form-validation-message')?.remove();
    }

    function validarFormulario(formulario) {
        const campos = formulario.querySelectorAll('input, select, textarea');
        for (const campo of campos) validarCampo(campo);
        limpiarMensaje(formulario);
        const invalido = [...campos].find(campo => campo.willValidate && !campo.validity.valid);
        if (!invalido) return true;
        const mensaje = document.createElement('p');
        mensaje.className = 'form-validation-message';
        mensaje.setAttribute('role', 'alert');
        const etiqueta = invalido.labels?.[0]?.textContent.trim() ||
            invalido.closest('.form-group-panel')?.querySelector('label')?.textContent.trim();
        mensaje.textContent = `${etiqueta ? etiqueta + ': ' : ''}${invalido.validationMessage}`;
        const boton = formulario.querySelector('button[type="submit"]');
        if (boton?.parentElement === formulario) formulario.insertBefore(mensaje, boton);
        else formulario.prepend(mensaje);
        invalido.setAttribute('aria-invalid', 'true');
        formulario.reportValidity();
        return false;
    }

    document.addEventListener('DOMContentLoaded', () => {
        for (const [id, [tipo, longitud]] of Object.entries(CAMPOS)) {
            const campo = document.getElementById(id);
            if (!campo) continue;
            campo.maxLength = longitud;
            campo.dataset.validacion = tipo;
            if (tipo === 'cedula-numero') campo.inputMode = 'numeric';
            if (tipo === 'telefono') campo.inputMode = 'tel';
            if (tipo === 'cedula') campo.placeholder = 'V-12345678';
            if (tipo === 'fecha-atleta') {
                actualizarLimitesNacimiento(campo);
                campo.addEventListener('focus', () => actualizarLimitesNacimiento(campo));
            }
            campo.addEventListener('beforeinput', (evento) => {
                if (!evento.data || evento.isComposing) return;
                const permitido = {
                    nombre: /^[\p{L}\p{M} '\u2019.\-]+$/u,
                    'cedula-numero': /^[0-9]+$/,
                    cedula: /^[VEve0-9-]+$/,
                    telefono: /^[+0-9() .-]+$/,
                    texto: /^[^\u0000-\u001f<>]+$/u,
                    medico: /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f<>]+$/u
                }[tipo];
                if (permitido && !permitido.test(evento.data)) evento.preventDefault();
            });
            campo.addEventListener('input', () => {
                if (tipo === 'cedula-numero' && /\D/.test(campo.value)) {
                    campo.value = campo.value.replace(/\D/g, '');
                }
                validarCampo(campo);
            });
            campo.addEventListener('blur', () => validarCampo(campo));
        }
        for (const form of document.querySelectorAll('form')) {
            // El navegador valida antes de emitir submit. Los errores custom
            // antiguos deben recalcularse antes, también tras autofill/cambiar modo.
            form.noValidate = true;
            form.addEventListener('submit', event => {
                if (!validarFormulario(form)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);
            form.addEventListener('input', () => limpiarMensaje(form));
            form.addEventListener('change', () => limpiarMensaje(form));
            form.addEventListener('reset', () => {
                limpiarMensaje(form);
                for (const campo of form.querySelectorAll('input, select, textarea')) {
                    campo.setCustomValidity('');
                    campo.removeAttribute('aria-invalid');
                }
            });
        }
    });
    window.ValidacionJaguares = { validarFormulario, validarCampo, errorCampo, esEdadValida };
})();
