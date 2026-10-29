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

/* =====================================
   3. ANIMACIONES DE SCROLL (REVEAL)
======================================== */
function reveal() {
    const reveals = document.querySelectorAll(".reveal, .reveal-left, .reveal-right");
    for (let i = 0; i < reveals.length; i++) {
        const windowHeight = window.innerHeight;
        const elementTop = reveals[i].getBoundingClientRect().top;
        const elementVisible = 120;

        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
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

// Abrir Modal
function abrirModalCategoria() {
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
}
function cerrarModalCategoria() {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
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
            <strong>${ev.titulo || 'Evento'}</strong>
            <span>${fechaTxt}${ev.lugar ? ' · ' + ev.lugar : ''}</span>
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
