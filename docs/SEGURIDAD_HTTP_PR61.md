# Seguridad HTTP y rutas — etapa 61

## Alcance

Rama basada en main `87857bd` (PR #60). No incluye cambios de esquema, reglas de cobro, sesiones persistentes, Cloudinary ni datos de Production.

## Contrato HTTP

- Las páginas públicas permitidas son `/`, `/index.html`, `/galeria.html` y `/admin/login.html`. Se sirven únicamente archivos existentes de los grupos de recursos CSS, JS e imágenes previstos, además de robots y sitemap. Un nuevo HTML no queda expuesto automáticamente.
- Los dos paneles privados se entregan exclusivamente por `panelMiddleware`; sus alias normalizados conservan el control de sesión y rol. No se sirven mediante express.static.
- Las rutas API válidas las determina el registro de routers de Express, no un listado duplicado de endpoints. Rutas no reconocidas: HTTP 404 con JSON en API, página institucional 404 en navegación GET/HEAD. El prefijo administrativo protegido puede responder 401/403 antes de revelar si una ruta existe. CORS preflight conserva su comportamiento.
- Rutas ambiguas, codificaciones no canónicas fuera de paneles, directorios no permitidos y ficheros privados no se sirven. El 404 no refleja el texto solicitado y lleva no-store.
- Los errores 401/403 y las respuestas de los controladores existentes se conservan. Se desactiva X-Powered-By y se evitan logs del URL completo en el manejador de errores HTTP.

## Cabeceras y origen

Se añaden nosniff, DENY, Referrer-Policy y Permissions-Policy (sin cámara, micrófono ni geolocalización). CSP inicial: frame-ancestors 'none', object-src 'none', base-uri 'none'. No se afirma que esta CSP bloquee todos los XSS: aún hay scripts y eventos inline, fuentes CDN y generación PDF. Una política estricta de scripts requiere inventario y pruebas de navegador durante la modularización. No forzar HSTS adicional sin comprobar la terminación HTTPS de cada entorno.

La protección de escrituras por Origin coincide con la semántica de mayúsculas/minúsculas de Express. CORS no sustituye autorización. Se mantiene la compatibilidad de clientes y los controles existentes; el refuerzo de sesiones y autenticación corresponde a la etapa 62.

## SQL y XSS

- Se conserva el uso de parámetros PostgreSQL para valores. El nombre de columna de documento se limita a propiedades propias del catálogo cerrado (foto, cédula y partida), no propiedades heredadas. Identificadores inválidos no llegan a SQL.
- Se escapa el estado del atleta interpolado en el atributo data-estado de la tabla Directiva. Se prueba un valor inesperado en el navegador con datos ficticios.
- Las pruebas existentes de roles, propiedad, sesiones, subida privada, SQL parametrizado y validaciones permanecen. Las pruebas no constituyen una auditoría exhaustiva ni certifican inexistencia de vulnerabilidades.

## Verificación y despliegue

1. GitHub Actions: ejecutar las suites existentes, incluyendo las nuevas pruebas en cabeceras-privacidad, seguridad e interfaz. No usar Supabase real.
2. Preview: comprobar GET /, /galeria.html y /admin/login.html. Abrir una ruta inexistente y confirmar HTTP 404 (no 200). Confirmar JSON 404 para /api/no-existe. Comprobar 401 en /api/auth/me sin sesión y la redirección del panel privado.
3. Con cada rol, comprobar navegación normal, visualización de comprobantes y PDF; en móvil confirmar que el 404 cabe y permite regresar. No enviar datos ni cambiar pagos en Preview compartido.
4. Confirmar que no hay nuevas solicitudes fallidas por CSS/JS, imágenes, fuentes o PDF. En DevTools comprobar cabeceras y no-store en API/panel.
5. Fusionar solamente con CI verde, Preview comprobado y autorización del propietario. No se necesita migración SQL.

Siguiente etapa: autenticación y sesiones. Los controles de Supabase y la limpieza de datos versionados quedan para la etapa 63; no se modifican en esta rama.
