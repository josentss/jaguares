/* Un solo comportamiento de sidebar para ambos paneles. */
(function(root) {
    'use strict';
    function inicializar(id) {
        const boton=document.getElementById(id), sidebar=document.getElementById('sidebar'),
            fondo=document.getElementById('sidebar-backdrop');
        const escritorio=matchMedia('(min-width: 993px)');
        let reducido=false, movilAbierto=false;
        function pintar() {
            const abierto=escritorio.matches?!reducido:movilAbierto;
            document.body.classList.toggle('sidebar-colapsado',escritorio.matches&&reducido);
            sidebar.classList.toggle('open',!escritorio.matches&&movilAbierto);
            fondo.classList.toggle('show',!escritorio.matches&&movilAbierto);
            sidebar.inert=!abierto;
            const principal=document.querySelector('.main-content');
            if(principal)principal.inert=!escritorio.matches&&movilAbierto;
            boton.setAttribute('aria-expanded',String(abierto));
            boton.setAttribute('aria-label',abierto?'Ocultar menú':'Mostrar menú');
            boton.title=abierto?'Ocultar menú':'Mostrar menú';
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
