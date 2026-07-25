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

mobileMenuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    const icon = mobileMenuBtn.querySelector('i');
    if(navLinks.classList.contains('active')){
        icon.classList.replace('fa-bars', 'fa-times');
    } else {
        icon.classList.replace('fa-times', 'fa-bars');
    }
});

// Cerrar menú móvil al hacer clic en un enlace
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        mobileMenuBtn.querySelector('i').classList.replace('fa-times', 'fa-bars');
    });
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
        img1: "img/cat-1.jpg",
        img2: "img/cat-2.jpg"
    },
    u9: {
        titulo: "U-9 Iniciación",
        edades: "Niños(as) de 8 y 9 años",
        atletas: "28 atletas inscritos",
        torneos: "Liga Menor de Barinas",
        img1: "img/u9-card.jpg",
        img2: "img/cat-1.jpg"
    },
    u11: {
        titulo: "U-11 Formación",
        edades: "Niños(as) de 10 y 11 años",
        atletas: "35 atletas inscritos",
        torneos: "Campeonatos Estatales e Invitacionales",
        img1: "img/u11-card.jpg",
        img2: "img/cat-2.jpg"
    },
    u13: {
        titulo: "U-13 Mini Voleibol",
        edades: "Jóvenes de 12 y 13 años",
        atletas: "40 atletas inscritos",
        torneos: "Liga Nacional de Mini Voleibol",
        img1: "img/u13-card.jpg",
        img2: "img/cat-1.jpg"
    },
    u15: {
        titulo: "U-15 Infantil (M)",
        edades: "Masculino de 14 y 15 años",
        atletas: "30 atletas inscritos",
        torneos: "Campeonato Zonal Andino, Invitacionales Nacionales",
        img1: "img/u15-card.jpg",
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
cards.forEach(card => {
    card.addEventListener('click', () => {
        const catId = card.getAttribute('data-cat');
        const info = dataCategorias[catId];

        if(info) {
            mTitulo.textContent = info.titulo;
            mEdades.textContent = info.edades;
            mAtletas.textContent = info.atletas;
            mTorneos.textContent = info.torneos;
            mImg1.src = info.img1;
            mImg2.src = info.img2;

            modal.classList.add('active');
        }
    });
});

// Cerrar Modal
closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));

// Cerrar al hacer clic fuera del contenido del modal
modal.addEventListener('click', (e) => {
    if(e.target === modal) {
        modal.classList.remove('active');
    }
});


/* =====================================
   5. CALENDARIO UI (VISUAL/FRONTEND)
======================================== */
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
let date = new Date();
let currentMonth = date.getMonth();
let currentYear = date.getFullYear();

const monthYearText = document.getElementById('month-year');
const calendarDays = document.getElementById('calendar-days');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');

function renderCalendar() {
    calendarDays.innerHTML = "";

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    monthYearText.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // Espacios vacíos del mes anterior
    for (let i = 0; i < firstDay; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('cal-day', 'empty');
        calendarDays.appendChild(emptyDiv);
    }

    // Días del mes actual
    const todayDate = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('cal-day');
        dayDiv.textContent = i;

        // Marcar el día de hoy
        if(i === todayDate.getDate() && currentMonth === todayDate.getMonth() && currentYear === todayDate.getFullYear()) {
            dayDiv.classList.add('today');
        }

        calendarDays.appendChild(dayDiv);
    }
}

prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
});

nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
});

// Inicializar el calendario
renderCalendar();
