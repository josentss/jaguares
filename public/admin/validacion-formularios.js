/* Reglas de formulario de Jaguares: el backend sigue siendo la autoridad. */
(function () {
    'use strict';

    const NOMBRE = /^[\p{L}\p{M}]+(?:[ '\u2019.\-][\p{L}\p{M}]+)*$/u;
    const CEDULA = /^[VE]-[0-9]{5,9}$/;
    const TELEFONO = /^(?:0[0-9]{10}|(?:\+?58)[1-9][0-9]{9}|\+[1-9][0-9]{7,14})$/;
    const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

    const CAMPOS = {
        'reg-names': ['nombre', 80], 'reg-lastnames': ['nombre', 80],
        'reg-email': ['correo', 120], 'reg-password': ['clave', 128],
        'atl-nombres': ['nombre', 80], 'atl-apellidos': ['nombre', 80],
        'atl-cedula': ['cedula-numero', 9], 'atl-direccion': ['texto', 255],
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
        'dir-telefono': ['telefono', 30], 'dir-alergias': ['medico', 500]
    };

    function errorCampo(tipo, valor, requerido) {
        const v = valor.trim();
        if (!v) return requerido ? 'Este campo es obligatorio.' : '';
        switch (tipo) {
            case 'nombre':
                return v.length < 2 || v.length > 80 || !NOMBRE.test(v)
                    ? 'Escribe un nombre de 2 a 80 caracteres: letras, espacios, apóstrofes o guiones.'
                    : '';
            case 'cedula-numero':
                return /^[0-9]{5,9}$/.test(v) ? '' : 'La cédula requiere de 5 a 9 dígitos.';
            case 'cedula':
                return CEDULA.test(v.toUpperCase()) ? '' : 'Formato: V-12345678 o E-12345678.';
            case 'telefono': {
                const limpio = v.replace(/[() .-]/g, '');
                return /^[+0-9() .-]{8,30}$/.test(v) && TELEFONO.test(limpio)
                    ? '' : 'Usa 11 dígitos nacionales o teléfono internacional con + y código de país.';
            }
            case 'texto':
            case 'medico':
                return CONTROL.test(valor) || /[<>]/.test(valor)
                    ? 'El texto contiene caracteres no admitidos.' : '';
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
        return campo.disabled || campo.offsetParent === null;
    }

    function validarCampo(campo) {
        const tipo = tipoCampo(campo);
        if (!tipo) return true;
        if (esCampoOculto(campo)) {
            campo.setCustomValidity('');
            return true;
        }
        if (tipo === 'cedula' && campo.value) {
            campo.value = campo.value.toUpperCase();
        }
        const mensaje = errorCampo(tipo, campo.value, campo.required);
        campo.setCustomValidity(mensaje);
        return !mensaje;
    }

    function validarFormulario(formulario) {
        const campos = formulario.querySelectorAll('input, textarea');
        for (const campo of campos) validarCampo(campo);
        if (formulario.checkValidity()) return true;
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
            form.addEventListener('submit', event => {
                if (!validarFormulario(form)) event.preventDefault();
            }, true);
        }
    });
    window.ValidacionJaguares = { validarFormulario, validarCampo, errorCampo };
})();
