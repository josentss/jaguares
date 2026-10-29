/* =====================================
   1. MODO OSCURO (DARK MODE)
======================================== */
const toggleBtns = document.querySelectorAll('#theme-toggle, #theme-toggle-desktop');

const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'dark') {
        toggleBtns.forEach(btn => btn.querySelector('i').classList.replace('fa-moon', 'fa-sun'));
    }
}

toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = theme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        toggleBtns.forEach(b => {
            const icon = b.querySelector('i');
            if(newTheme === 'dark') {
                icon.classList.replace('fa-moon', 'fa-sun');
            } else {
                icon.classList.replace('fa-sun', 'fa-moon');
            }
        });
    });
});

/* =====================================
   2. MENÚ MÓVIL (HAMBURGUESA)
======================================== */
const mobileMenuBtn = document.getElementById('mobile-menu');
const navLinks = document.getElementById('nav-links');
const navBackdrop = document.getElementById('nav-backdrop');

function cerrarMenuMovil() {
    if (!navLinks) return;
    navLinks.classList.remove('active');
    if (navBackdrop) {
        navBackdrop.classList.remove('show');
        navBackdrop.hidden = true;
    }
    document.body.classList.remove('nav-open');
    if (mobileMenuBtn) {
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    }
}

function abrirMenuMovil() {
    if (!navLinks || !mobileMenuBtn) return;
    navLinks.classList.add('active');
    if (navBackdrop) {
        navBackdrop.hidden = false;
        navBackdrop.classList.add('show');
    }
    document.body.classList.add('nav-open');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    const icon = mobileMenuBtn.querySelector('i');
    if (icon) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    }
}

if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (navLinks.classList.contains('active')) cerrarMenuMovil();
        else abrirMenuMovil();
    });
}
if (navBackdrop) {
    navBackdrop.addEventListener('click', cerrarMenuMovil);
}
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', cerrarMenuMovil);
});

// Si se agranda la ventana (rotar el móvil, redimensionar en PC), se cierra el menú móvil
window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) cerrarMenuMovil();
});

/* =====================================
   3. ANIMACIONES DE SCROLL (REVEAL)
======================================== */
function reveal() {
    const reveals = document.querySelectorAll(".reveal, .reveal-left, .reveal-right");
    for (let i = 0; i < reveals.length; i++) {
        const windowHeight = window.innerHeight;
        const elementTop = reveals[i].getBoundingClientRect().top;
        const elementVisible = 120;

        if (elementTop < windowHeight - elementVisible && !reveals[i].classList.contains("active")) {
            const el = reveals[i];
            el.classList.add("active");
            // Al terminar la entrada se quita el retraso escalonado en línea, para que el hover responda con suavidad
            if (el.style.transitionDelay) {
                setTimeout(() => { el.style.transitionDelay = ''; }, 1600);
            }
        }
    }
}
window.addEventListener("scroll", reveal);
window.addEventListener("load", reveal);


/* =====================================
   4. MODAL DE CATEGORÍAS
======================================== */
// Base de datos de información por categoría
const dataCategorias = {
    u7: {
        titulo: "U-7 Semillitas",
        edades: "Niños(as) de 5 a 7 años",
        atletas: "32 atletas inscritos",
        torneos: "Eventos internos y amistosos locales",
        img1: "img/u7-card.jpeg",
        img2: "img/cat-1.jpg"
    },
    u9: {
        titulo: "U-9 Iniciación",
        edades: "Niños(as) de 8 y 9 años",
        atletas: "28 atletas inscritos",
        torneos: "Liga Menor de Barinas",
        img1: "img/u9-card.jpeg",
        img2: "img/cat-1.jpg"
    },
    u11: {
        titulo: "U-11 Formación",
        edades: "Niños(as) de 10 y 11 años",
        atletas: "35 atletas inscritos",
        torneos: "Campeonatos Estatales e Invitacionales",
        img1: "img/u11-card.jpeg",
        img2: "img/cat-2.jpg"
    },
    u13: {
        titulo: "U-13 Mini Voleibol",
        edades: "Jóvenes de 12 y 13 años",
        atletas: "40 atletas inscritos",
        torneos: "Liga Nacional de Mini Voleibol",
        img1: "img/u13-card.jpeg",
        img2: "img/cat-1.jpg"
    },
    u15: {
        titulo: "U-15 Infantil (M)",
        edades: "Masculino de 14 y 15 años",
        atletas: "30 atletas inscritos",
        torneos: "Campeonato Zonal Andino, Invitacionales Nacionales",
        img1: "img/u15-card.jpeg",
        img2: "img/foto-entrenadores.jpg"
    }
};

const cards = document.querySelectorAll('.cat-trigger');
const modal = document.getElementById('modal-categoria');
const closeModalBtn = document.querySelector('.close-modal');

// Elementos del DOM a actualizar
const mTitulo = document.getElementById('modal-titulo');
const mEdades = document.getElementById('modal-edades');
const mAtletas = document.getElementById('modal-atletas');
const mTorneos = document.getElementById('modal-torneos');
const mImg1 = document.getElementById('modal-img-1');
const mImg2 = document.getElementById('modal-img-2');

// Abrir Modal (guarda el foco para devolverlo al cerrar)
let ultimoFoco = null;
function abrirModalCategoria() {
    if (!modal) return;
    ultimoFoco = document.activeElement;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    if (closeModalBtn) closeModalBtn.focus({ preventScroll: true });
}
function cerrarModalCategoria() {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    if (ultimoFoco && typeof ultimoFoco.focus === 'function') {
        ultimoFoco.focus({ preventScroll: true });
    }
    ultimoFoco = null;
}

cards.forEach(card => {
    card.addEventListener('click', () => {
        const catId = card.getAttribute('data-cat');
        const info = dataCategorias[catId];
        if (!info) return;
        mTitulo.textContent = info.titulo;
        mEdades.textContent = info.edades;
        mAtletas.textContent = info.atletas;
        mTorneos.textContent = info.torneos;
        mImg1.src = info.img1;
        mImg2.src = info.img2;
        abrirModalCategoria();
    });
});

// Abrir con Enter o Espacio cuando la tarjeta tiene el foco
cards.forEach(card => {
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
        }
    });
});

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', cerrarModalCategoria);
}
if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModalCategoria();
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modal && modal.classList.contains('active')) cerrarModalCategoria();
    if (navLinks && navLinks.classList.contains('active')) cerrarMenuMovil();
});


/* =====================================
   5. CALENDARIO + EVENTOS (API CMS)
======================================== */
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
let date = new Date();
let currentMonth = date.getMonth();
let currentYear = date.getFullYear();

/** @type {Array<{id_evento:number,titulo:string,fecha_evento:string,lugar:string,estado:string}>} */
let eventosPublicos = [];

const monthYearText = document.getElementById('month-year');
const calendarDays = document.getElementById('calendar-days');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const listaEventosEl = document.getElementById('lista-eventos-publicos');
const calendarHint = document.getElementById('calendar-hint');

// Evita que texto del CMS se interprete como HTML (seguridad)
function escapeHTML(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function fechaLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseFechaEvento(fecha) {
    if (!fecha) return null;
    // Postgres / ISO: '2026-11-05' o '2026-11-05T00:00:00.000Z'
    const s = String(fecha).slice(0, 10);
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return { y, m: m - 1, d, key: s };
}

function eventosDelMes(year, month) {
    return eventosPublicos.filter(ev => {
        const p = parseFechaEvento(ev.fecha_evento);
        return p && p.y === year && p.m === month;
    });
}

function renderListaEventos(filtroKey /* YYYY-MM-DD o null = todos del mes */) {
    if (!listaEventosEl) return;

    let lista = eventosDelMes(currentYear, currentMonth);
    if (filtroKey) {
        lista = lista.filter(ev => {
            const p = parseFechaEvento(ev.fecha_evento);
            return p && p.key === filtroKey;
        });
    }

    if (lista.length === 0) {
        listaEventosEl.innerHTML = `<li class="empty-ev">${
            filtroKey
                ? 'No hay eventos en este día.'
                : 'No hay eventos próximos en este mes.'
        }</li>`;
        return;
    }

    listaEventosEl.innerHTML = lista.map(ev => {
        const p = parseFechaEvento(ev.fecha_evento);
        const fechaTxt = p
            ? new Date(p.y, p.m, p.d).toLocaleDateString('es-VE', {
                weekday: 'short', day: 'numeric', month: 'short'
              })
            : '';
        return `<li>
            <strong>${escapeHTML(ev.titulo || 'Evento')}</strong>
            <span>${fechaTxt}${ev.lugar ? ' · ' + escapeHTML(ev.lugar) : ''}</span>
        </li>`;
    }).join('');
}

function renderCalendar() {
    if (!calendarDays || !monthYearText) return;
    calendarDays.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    monthYearText.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    const keysConEvento = new Set(
        eventosDelMes(currentYear, currentMonth).map(ev => {
            const p = parseFechaEvento(ev.fecha_evento);
            return p ? p.key : null;
        }).filter(Boolean)
    );

    for (let i = 0; i < firstDay; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('cal-day', 'empty');
        calendarDays.appendChild(emptyDiv);
    }

    const todayDate = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('cal-day');
        dayDiv.textContent = i;

        const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        if (i === todayDate.getDate() && currentMonth === todayDate.getMonth() && currentYear === todayDate.getFullYear()) {
            dayDiv.classList.add('today');
        }

        if (keysConEvento.has(key)) {
            dayDiv.classList.add('has-event');
            dayDiv.title = 'Hay evento(s)';
            dayDiv.tabIndex = 0;
            dayDiv.setAttribute('role', 'button');
            dayDiv.setAttribute('aria-label', `${i} de ${monthNames[currentMonth]}: ver eventos`);
            dayDiv.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dayDiv.click();
                }
            });
            dayDiv.addEventListener('click', () => {
                renderListaEventos(key);
                if (calendarHint) {
                    calendarHint.innerHTML = `<i class="fas fa-calendar-day"></i> Eventos del ${i} de ${monthNames[currentMonth]}.`;
                }
            });
        }

        calendarDays.appendChild(dayDiv);
    }

    renderListaEventos(null);
    if (calendarHint) {
        calendarHint.innerHTML = '<i class="fas fa-info-circle"></i> Toca un día marcado para filtrar; la lista muestra los del mes.';
    }
}

/* ---- Próximo evento destacado ---- */
const proximoEl = document.getElementById('proximo-evento');

function diasHasta(key) {
    const [y, m, d] = key.split('-').map(Number);
    const hoy = new Date();
    const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const b = Date.UTC(y, m - 1, d);
    return Math.round((b - a) / 86400000);
}

function renderProximoEvento() {
    if (!proximoEl) return;

    const futuros = eventosPublicos
        .map(ev => ({ ev, p: parseFechaEvento(ev.fecha_evento) }))
        .filter(x => x.p && diasHasta(x.p.key) >= 0)
        .sort((a, b) => (a.p.key < b.p.key ? -1 : a.p.key > b.p.key ? 1 : 0));

    if (futuros.length === 0) {
        proximoEl.hidden = true;
        proximoEl.innerHTML = '';
        return;
    }

    const { ev, p } = futuros[0];
    const n = diasHasta(p.key);
    const cuando = n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`;
    const fechaTxt = new Date(p.y, p.m, p.d).toLocaleDateString('es-VE', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    const detalle = fechaTxt + (ev.lugar ? ' · ' + ev.lugar : '');
    proximoEl.innerHTML = `<span class="pe-dot" aria-hidden="true"></span><span class="pe-txt"><strong>Próximo:</strong> ${escapeHTML(ev.titulo || 'Evento')}</span><span class="pe-cuando">· ${cuando}</span>`;
    proximoEl.title = detalle;
    proximoEl.setAttribute('aria-label', `Próximo evento: ${ev.titulo || 'Evento'}, ${cuando}. ${detalle}. Ver en el calendario`);
    proximoEl.hidden = false;

    // Al tocarlo, el calendario salta a ese mes y muestra el evento
    proximoEl.onclick = () => {
        currentMonth = p.m;
        currentYear = p.y;
        renderCalendar();
        renderListaEventos(p.key);
        if (calendarHint) {
            calendarHint.innerHTML = `<i class="fas fa-calendar-day"></i> Eventos del ${p.d} de ${monthNames[p.m]}.`;
        }
    };
}

async function cargarEventosPublicos() {
    try {
        const res = await fetch('/api/cms/public/eventos');
        const data = await res.json();
        if (res.ok && data.success) {
            eventosPublicos = data.eventos || [];
        } else {
            eventosPublicos = [];
        }
    } catch (err) {
        console.error('No se pudieron cargar eventos públicos:', err);
        eventosPublicos = [];
    }
    renderCalendar();
    renderProximoEvento();
}

if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });
}

if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });
}

cargarEventosPublicos();


/* =====================================
   6. BARRA SUPERIOR COMPACTA + VOLVER ARRIBA
======================================== */
const navbarEl = document.querySelector('.navbar');
const backTopBtn = document.getElementById('back-to-top');

function actualizarUIScroll() {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (navbarEl) navbarEl.classList.toggle('scrolled', y > 40);
    if (backTopBtn) backTopBtn.classList.toggle('show', y > 700);
}
window.addEventListener('scroll', actualizarUIScroll, { passive: true });
actualizarUIScroll();

if (backTopBtn) {
    backTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* =====================================
   7. SECCIÓN ACTIVA EN EL MENÚ
======================================== */
const enlacesSeccion = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
const mapaSecciones = new Map(enlacesSeccion.map(a => [a.getAttribute('href').slice(1), a]));

if ('IntersectionObserver' in window && mapaSecciones.size) {
    const observadorSecciones = new IntersectionObserver((entradas) => {
        entradas.forEach(entrada => {
            if (!entrada.isIntersecting) return;
            enlacesSeccion.forEach(a => {
                a.classList.remove('is-current');
                a.removeAttribute('aria-current');
            });
            const activo = mapaSecciones.get(entrada.target.id);
            if (activo) {
                activo.classList.add('is-current');
                activo.setAttribute('aria-current', 'true');
            }
        });
    }, { rootMargin: '-45% 0px -50% 0px' });

    mapaSecciones.forEach((_, id) => {
        const seccion = document.getElementById(id);
        if (seccion) observadorSecciones.observe(seccion);
    });
}

/* =====================================
   8. CONTADORES SUTILES (franja de cifras)
======================================== */
const prefiereMenosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animarContador(el) {
    const fin = Number(el.dataset.count);
    if (!fin || prefiereMenosMovimiento) { el.textContent = fin || el.textContent; return; }
    const duracion = 1100;
    const inicio = performance.now();
    function paso(ahora) {
        const k = Math.min((ahora - inicio) / duracion, 1);
        const suave = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(fin * suave);
        if (k < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
}

const contadores = document.querySelectorAll('[data-count]');
if ('IntersectionObserver' in window && contadores.length) {
    const observadorContadores = new IntersectionObserver((entradas, obs) => {
        entradas.forEach(entrada => {
            if (!entrada.isIntersecting) return;
            animarContador(entrada.target);
            obs.unobserve(entrada.target);
        });
    }, { threshold: 0.6 });
    contadores.forEach(c => observadorContadores.observe(c));
}

/* =====================================
   9. CARRUSEL DE CATEGORÍAS (móvil): puntos indicadores
======================================== */
const gridCategorias = document.querySelector('.services-grid');
const puntosEl = document.getElementById('cat-dots');

if (gridCategorias && puntosEl) {
    const tarjetas = Array.from(gridCategorias.querySelectorAll('.category-card'));
    puntosEl.innerHTML = tarjetas
        .map((_, i) => `<button type="button" aria-label="Ir a la categoría ${i + 1} de ${tarjetas.length}"></button>`)
        .join('');
    const puntos = Array.from(puntosEl.children);

    function actualizarPuntos() {
        const centro = gridCategorias.scrollLeft + gridCategorias.clientWidth / 2;
        let mejor = 0, distMin = Infinity;
        tarjetas.forEach((t, i) => {
            const d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - centro);
            if (d < distMin) { distMin = d; mejor = i; }
        });
        puntos.forEach((p, i) => p.classList.toggle('on', i === mejor));
    }

    gridCategorias.addEventListener('scroll', actualizarPuntos, { passive: true });
    window.addEventListener('resize', actualizarPuntos);
    puntos.forEach((punto, i) => {
        punto.addEventListener('click', () => {
            const t = tarjetas[i];
            gridCategorias.scrollTo({
                left: t.offsetLeft - (gridCategorias.clientWidth - t.offsetWidth) / 2,
                behavior: 'smooth'
            });
        });
    });
    actualizarPuntos();
}
