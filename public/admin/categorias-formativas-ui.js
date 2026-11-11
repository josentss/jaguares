'use strict';

(function () {
    const reglas = window.JaguaresCategoriasFormativas;
    if (!reglas) return;

    function conectar(idFecha, idTarjeta, idNombre, idDetalle) {
        const campo = document.getElementById(idFecha);
        const tarjeta = document.getElementById(idTarjeta);
        const nombre = document.getElementById(idNombre);
        const detalle = document.getElementById(idDetalle);
        if (!campo || !tarjeta || !nombre || !detalle) return;
        function actualizar() {
            if (!campo.value) {
                tarjeta.dataset.estado = 'vacio';
                nombre.textContent = 'Por calcular';
                detalle.textContent = 'Selecciona la fecha de nacimiento para ver la categoría por edad.';
                return;
            }
            const clasificacion = reglas.clasificar(campo.value);
            tarjeta.dataset.estado = clasificacion.estado;
            nombre.textContent = clasificacion.categoria
                ? clasificacion.categoria.nombre
                : (clasificacion.estado === 'sin_categoria_publicada'
                    ? 'Pendiente de clasificación' : 'Fecha por revisar');
            const edad = Number.isInteger(clasificacion.edad)
                ? clasificacion.edad + (clasificacion.edad === 1 ? ' año' : ' años') + ' · '
                : '';
            detalle.textContent = edad + clasificacion.mensaje;
        }
        campo.addEventListener('input', actualizar);
        campo.addEventListener('change', actualizar);
        campo.closest('form')?.addEventListener('reset', () => queueMicrotask(actualizar));
        actualizar();
    }

    conectar('atl-fecha-nac','atl-categoria-automatica','atl-categoria-nombre','atl-categoria-detalle');
    conectar('dir-fecha-nac','dir-categoria-automatica','dir-categoria-nombre','dir-categoria-detalle');
})();
