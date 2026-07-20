// --- Lógica de pestañas ---
const tabLogin    = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin   = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');

tabLogin.addEventListener('click', () => {
    formLogin.classList.add('active');
    formRegister.classList.remove('active');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
});

tabRegister.addEventListener('click', () => {
    formRegister.classList.add('active');
    formLogin.classList.remove('active');
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
});

// --- Registro ---
formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
        nombres:   document.getElementById('reg-names').value,
        apellidos: document.getElementById('reg-lastnames').value,
        email:     document.getElementById('reg-email').value,
        password:  document.getElementById('reg-password').value
    };

    try {
        const res    = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const result = await res.json();
        alert(result.message);
        if (result.success) {
            // Cambiar a pestaña de login tras registro exitoso
            tabLogin.click();
        }
    } catch (err) {
        alert('Error de conexión con el servidor.');
    }
});

// --- Login ---
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
        email:    document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
    };

    try {
        const res    = await fetch('/api/auth/login', {
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
                alert('Tu cuenta no tiene un rol asignado válido. Contacta al Staff.');
            }
        } else {
            alert(result.message);
        }
    } catch (err) {
        console.error('Error en login:', err);
        alert('Hubo un problema de conexión con el servidor.');
    }
});
