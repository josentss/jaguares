/* Un solo comportamiento de sidebar para ambos paneles. */
(function(root) {
    'use strict';
    function inicializar(id) {
        const boton=document.getElementById(id), sidebar=document.getElementById('sidebar'),
            fondo=document.getElementById('sidebar-backdrop');
        const escritorio=matchMedia('(min-width: 993px)');
        const logo=sidebar.querySelector('.sidebar-logo');
        const titulo=document.querySelector('.panel-title-group');
        const principal=document.querySelector('.main-content');
        // El mismo botón conserva ID, eventos y estado accesible al cambiar
        // de ubicación. En móvil debe quedar fuera del contenido inerte.
        function ubicarBoton(abierto) {
            const destino=escritorio.matches?(abierto?logo:titulo):fondo.parentElement;
            if(boton.parentElement===destino)return;
            const teniaFoco=document.activeElement===boton;
            if(!escritorio.matches)fondo.before(boton);
            else if(abierto)logo.append(boton);
            else titulo.prepend(boton);
            return teniaFoco;
        }
        let reducido=false, movilAbierto=false;
        function pintar() {
            const abierto=escritorio.matches?!reducido:movilAbierto;
            document.body.classList.toggle('sidebar-colapsado',escritorio.matches&&reducido);
            sidebar.classList.toggle('open',!escritorio.matches&&movilAbierto);
            fondo.classList.toggle('show',!escritorio.matches&&movilAbierto);
            // Mover antes de activar inert; recuperar foco cuando se oculta
            // el menú o se cruza el breakpoint.
            const recuperarFoco=ubicarBoton(abierto);
            sidebar.inert=!abierto;
            if(principal)principal.inert=!escritorio.matches&&movilAbierto;
            boton.setAttribute('aria-expanded',String(abierto));
            boton.setAttribute('aria-label',abierto?'Ocultar menú':'Mostrar menú');
            boton.title=abierto?'Ocultar menú':'Mostrar menú';
            if(recuperarFoco)boton.focus({preventScroll:true});
        }
        function cerrarMovil() {
            if(!escritorio.matches){
                const focoEnMenu=sidebar.contains(document.activeElement);
                movilAbierto=false;pintar();if(focoEnMenu)boton.focus();
            }
        }
        boton.addEventListener('click',()=>{
            if(escritorio.matches)reducido=!reducido;
            else movilAbierto=!movilAbierto;
            pintar();
        });
        fondo.addEventListener('click',()=>{cerrarMovil();boton.focus();});
        escritorio.addEventListener('change',()=>{movilAbierto=false;pintar();});
        document.addEventListener('keydown',e=>{
            if(e.key==='Escape'&&!escritorio.matches&&movilAbierto){
                cerrarMovil();boton.focus();
            }
        });
        pintar();
        return {cerrarMovil};
    }
    root.JaguaresSidebar={inicializar};
})(window);
