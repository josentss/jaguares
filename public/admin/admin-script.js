// --- Feedback visual (reemplaza alert) ---
function showAuthFeedback(message, type = 'error') {
    const el = document.getElementById('auth-feedback');
    if (!el) {
        alert(message);
        return;
    }
    el.textContent = message;
    el.className = 'auth-feedback show ' + type;
}

function clearAuthFeedback() {
    const el = document.getElementById('auth-feedback');
    if (el) {
        el.textContent = '';
        el.className = 'auth-feedback';
    }
}

const tabLogin    = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin   = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const formDescription = document.getElementById('form-description');

tabLogin.addEventListener('click', () => {
    formLogin.classList.add('active');
    formRegister.classList.remove('active');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    clearAuthFeedback();
    if (formDescription) {
        formDescription.textContent = 'Ingresa tus datos para acceder al sistema.';
    }
});

tabRegister.addEventListener('click', () => {
    formRegister.classList.add('active');
    formLogin.classList.remove('active');
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    clearAuthFeedback();
    if (formDescription) {
        formDescription.textContent = 'Crea tu cuenta. La directiva debe aprobarla antes de entrar.';
    }
});

// --- Registro ---
formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthFeedback();
    const btn = formRegister.querySelector('button[type="submit"]');
    const btnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Creando cuenta...';

    const datos = {
        nombres:   document.getElementById('reg-names').value.trim(),
        apellidos: document.getElementById('reg-lastnames').value.trim(),
        email:     document.getElementById('reg-email').value.trim(),
        password:  document.getElementById('reg-password').value
    };

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const result = await res.json();

        if (result.success) {
            showAuthFeedback(
                result.message || 'Cuenta creada. Espera la aprobación de la directiva para iniciar sesión.',
                'success'
            );
            formRegister.reset();
            setTimeout(() => tabLogin.click(), 1200);
        } else {
            showAuthFeedback(result.message || 'No se pudo crear la cuenta.', 'error');
        }
    } catch (err) {
        showAuthFeedback('No hay conexión con el servidor. Intenta de nuevo.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = btnText;
    }
});

// --- Login ---
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthFeedback();
    const btn = formLogin.querySelector('button[type="submit"]');
    const btnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Ingresando...';

    const datos = {
        email:    document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value
    };

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const result = await res.json();

        if (result.success) {
            localStorage.setItem('usuario', JSON.stringify(result.usuario));
            const rol = result.usuario.rol;

            if (['admin', 'staff', 'directiva'].includes(rol)) {
                window.location.href = 'panel-directiva.html';
            } else if (rol === 'representante') {
                window.location.href = 'panel-representante.html';
            } else {
                showAuthFeedback('Tu cuenta no tiene un rol válido. Contacta a la directiva.', 'error');
            }
        } else {
            const msg = (result.message || '').toLowerCase();
            let tipo = 'error';
            if (msg.includes('pendiente') || msg.includes('aprobación') || msg.includes('espera')) {
                tipo = 'info';
            }
            showAuthFeedback(result.message || 'Correo o contraseña incorrectos.', tipo);
        }
    } catch (err) {
        console.error('Error en login:', err);
        showAuthFeedback('No hay conexión con el servidor. Intenta de nuevo.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = btnText;
    }
});
