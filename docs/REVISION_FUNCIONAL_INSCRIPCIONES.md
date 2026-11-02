# Corrección funcional de inscripciones y revisión de flujos

Fecha: 2026-11-02. Base de código: main `8d5855f`. Rama: `fix/inscripcion-flujo-completo`.

## Incidencia y diagnóstico

El propietario comunicó que el botón de inscripción no respondía en ambos paneles, tanto con cédula propia como heredada, mientras los pagos de atletas activos sí funcionaban. La prioridad de este bloque es recuperar y probar los flujos existentes; no se añadieron módulos deportivos o administrativos.

| Estado | Hallazgo y evidencia | Corrección |
| --- | --- | --- |
| Confirmado, reproducido antes del cambio | Una cédula o teléfono inválidos generan `setCustomValidity`. Al cambiar a heredados, el campo oculto conserva el error. El navegador realiza la validación antes de `submit`: no llega ninguna petición y el control inválido no se puede enfocar | Deshabilitar controles que no aplican, limpiar su error y recalcular validez en el envío. Mensaje visible con `role=alert`; validación de servidor conservada |
| Confirmado en prueba con recurso bloqueado | Ambos paneles llaman `ValidacionJaguares` antes del `try` de la petición. Si no se carga ese archivo, se produce `ReferenceError` y no hay POST ni respuesta visible. La prueba añadida falló así antes de corregir | Cliente compartido usa el validador cuando está disponible y validación HTML como respaldo si falta. El backend sigue rechazando datos incorrectos. Versionar las URLs de los recursos cambiados fuerza su actualización |
| Confirmado | Los errores personalizados no se limpiaban con `form.reset()` y podían sobrevivir a cambios programáticos/autocompletado. Las pruebas anteriores no pulsaban el botón tras esos cambios | Limpiar errores al resetear y revalidar antes de comprobar constraints nativos; prueba con cambio de valor sin evento `input` |
| Confirmado con HTTP real | POST de inscripción sin cuerpo lanzaba una excepción y devolvía 500. JSON inválido también se trataba como error interno | Validar estructura antes de acceder al body; responder 400 a formato inválido y 413 a exceso del límite existente de 1 MB |
| Confirmado en revisión de coherencia | Los paneles de métodos de pago ocultos seguían habilitados; una fecha inválida de un método abandonado podía impedir el otro. El formulario no reflejaba en sus campos todos los límites de importe ya vigentes en backend. La etiqueta de foto anunciaba 8 MB aunque Multer limita 5 MB | Deshabilitar el método inactivo y sincronizarlo al resetear; representar min/max/required existentes; etiqueta de 5 MB. No se cambian tarifas ni métodos permitidos |
| Confirmado, carencia de cobertura | El CI del PR #7 pasó 74 pruebas, pero los casos de inscripción de navegador comprobaban campos aislados con APIs simuladas; no acreditaban el recorrido botón → API → SQL | Añadir pruebas con login/cookies, Express, Multer, controladores, autorización y PostgreSQL reales, además de las regresiones de interfaz |

Se comprobaron mediante GET los archivos públicos de ambos paneles, `api-client.js` y `validacion-formularios.js`: HTTP 200 y contenido idéntico al main previo. Por ello, la ausencia del validador es una reproducción de un riesgo de carga, **no una ausencia demostrada en el despliegue consultado**. No se usaron credenciales ni datos productivos para reproducir el caso del propietario; no se afirma que se haya identificado el estado exacto de su navegador.

## Revisión por recorrido funcional

| Área | Evidencia de ejecución local |
| --- | --- |
| Acceso, aprobación y sesión | Registro público por UI, login pendiente denegado, aprobación por UI de directiva y login posterior real; cuenta revocada deja de acceder con su cookie anterior |
| Perfil | Completar onboarding por formulario, guardar mediante PUT real y continuar inscribiendo; validaciones y duplicados de perfil cubiertos también por las suites anteriores de backend/PG |
| Inscripción por representante | Escritorio/móvil con clics reales: error visible, corrección, herencia tras datos inválidos, cédula propia, segunda inscripción tras reset y persistencia tras recargar; atleta en espera con propietario correcto |
| Inscripción por directiva | Escritorio/móvil: representante existente y nuevo, atleta activo, cuenta aprobada y login posterior de esa familia. Fallo SQL tras crear usuario revierte todo y permite reintentar con el mismo formulario |
| Documentos | Multer y la asociación SQL son reales. Se simula exclusivamente el proveedor Cloudinary: error de carga no crea atleta; reintento guarda foto/partida con URLs distintas y correctas |
| Pagos | Activación → efectivo → historial → aprobación; intento desde formulario desactualizado tras inactivar devuelve 409 sin otro pago. Transferencia con archivo a través de Multer; cambio de método no arrastra errores del anterior |
| Propiedad y notificaciones | Otra familia recibe 403 al consultar perfil, planilla, historial y notificaciones. El representante recibe las notificaciones de cambios reales de su pago |
| Calendario | Directiva crea y cancela un evento por UI; la consulta pública real lo incluye y luego lo excluye |
| Resiliencia del cliente | Recurso de validación bloqueado intencionalmente: ambos paneles envían; el backend rechaza nombre incorrecto y permite corregir y guardar |

Las pruebas usan datos y documentos sintéticos. No se prueba mediante clics cada estado histórico o todos los escenarios posibles del proyecto. Las pruebas existentes de concurrencia, duplicados, rollback y permisos continúan ejecutándose.

## Pruebas y límites

- Node 24.15.0 y Node 22.23.4: **64/64 backend + 25/25 navegador** en cada versión, sin fallos. Son **89 escenarios**, no 178 escenarios diferentes.
- Navegador: 14 pruebas de interfaz con APIs simuladas y 11 flujos con aplicación/PG reales. Escritorio 1440×900 y móvil 390×844; Chromium 141.0.7390.37 / Playwright 1.56.1.
- PostgreSQL 18 temporal local con esquemas aleatorios, PK/UNIQUE/FK y destino protegido por el guard de pruebas. CI conserva PostgreSQL 16 y Node 22; CI remoto del cambio pendiente al preparar la entrega.
- Sintaxis de 38 archivos JavaScript comprobada en Node 22/24; `git diff --check` correcto. No se modificaron `package.json` ni el lockfile. CI instalará Playwright fuera de las dependencias de la aplicación para conservar las versiones del lockfile durante los flujos de navegador.
- La tasa externa y Cloudinary son fronteras simuladas. No se probaron cargas reales en Cloudinary, credenciales/variables de Vercel ni constraints/datos reales de Supabase. Se conservan los pendientes de privacidad, contenido real de archivos, archivos huérfanos, dependencias y seguridad señalados en el contexto maestro.
- Capturas sintéticas de altas persistidas: `test-artifacts/inscripcion-real-escritorio.png` y `test-artifacts/inscripcion-real-movil.png`. El log de depuración generado por Chromium se excluye del control de versiones.

Para ejecutar, con PostgreSQL desechable local y dependencias del lockfile:

```powershell
$env:DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5432/jaguares_test?sslmode=disable'
node --test tests/seguridad.test.js tests/estados-y-sesiones.test.js tests/formularios.test.js tests/postgres-config.test.js tests/pagos-pg.test.js tests/integridad-pg.test.js

npm.cmd install --prefix node_modules/.cache/jaguares-herramientas --no-save --package-lock=false playwright@1.56.1
$env:NODE_PATH = (Resolve-Path node_modules/.cache/jaguares-herramientas/node_modules).Path
node node_modules/.cache/jaguares-herramientas/node_modules/playwright/cli.js install chromium
node --test tests/interfaz.test.js tests/flujos-web-pg.test.js
```

## Validación posterior por el propietario

Tras revisión, CI y despliegue autorizado, recargar la web para usar los recursos versionados y comprobar primero:

1. Cédula propia válida → alta; luego otro atleta para verificar el reset.
2. Cédula/teléfono inválidos → seleccionar herencia → alta, en ambos paneles.
3. Datos inválidos → mensaje visible → corregir → alta.
4. Directiva con representante existente y nuevo; confirmar el propietario y estado.
5. Atleta en espera → aprobar → pagar; después inactivar → intentar pago con pestaña antigua, que debe rechazarse.

No retomar módulos nuevos antes de confirmar este recorrido funcional. Las cuentas de representante pendientes no están autorizadas a inscribir directamente; el recorrido para probarlas es registro público → aprobación → completar perfil → inscripción de atleta en espera.
