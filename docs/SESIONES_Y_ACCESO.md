# Sesiones y acceso

Contrato vigente desde los PR #12 y #13, comprobado manualmente en Production.

## Comportamiento acordado

- Se permiten varias pestañas, ventanas y navegadores.
- Cada perfil de navegador mantiene sus propias cookies; normal e incógnito son sesiones independientes.
- No se usa la IP como identidad ni se bloquea una segunda ventana.
- La inactividad vence a los 15 minutos y muestra un aviso durante el último minuto.
- «Continuar sesión» renueva la actividad sin superar el máximo absoluto de 12 horas.
- Actividad en una pestaña mantiene la sesión del mismo perfil; cerrar una pestaña no ejecuta logout.
- Cerrar sesión expresamente coordina la salida de las demás pestañas del mismo perfil.

## Autoridad del servidor

Express verifica sesión, estado y rol antes de entregar los paneles protegidos. Las API conservan sus propias guardas. El HTML autorizado incluye solo metadatos básicos y vencimientos escapados; no incluye credenciales.

El servidor exige:

- JWT principal de 12 horas;
- credencial de actividad de 15 minutos vinculada al login;
- cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción;
- renovación explícita mediante `/api/auth/actividad`, con sesión vigente y comprobación de origen cuando existe.

El navegador agrupa renovaciones, coordina vencimientos entre pestañas y revalida al recuperar foco o caché. Consultas automáticas no cuentan como actividad del usuario. Si el servidor rechaza la sesión, el panel se oculta y redirige.

## Límites conocidos

- El logout elimina cookies, pero no revoca centralmente una copia robada de las credenciales.
- Un navegador suspendido puede retrasar el aviso; el servidor sigue aplicando el vencimiento.
- Sin conexión no se presume autorización: se oculta el panel y se permite reintentar.
- No existe una lista central de sesiones ni una función para cerrar dispositivos de forma remota.

## Regresión mínima

La sección de sesión de [PRUEBAS_MANUALES_WEB.md](PRUEBAS_MANUALES_WEB.md) cubre entrada, recarga, pestañas, logout, aviso, vencimiento, incógnito y acceso directo. Los cambios de autenticación requieren además pruebas backend y Playwright.
