# Jaguares — contexto maestro

Documento vivo para continuar el sistema sin reconstruir ni duplicar funcionalidades. El código actual es la fuente de verdad.

## 1. Estado comprobado

- Repositorio: <https://github.com/josentss/jaguares>
- Rama de producción: `main`.
- Base verificada el 5 de noviembre de 2026: `4f2dfa8663cf30c851a646f3896b58008b3dd50a`.
- PR #1 al #16 fusionados; no había PR abiertos al comenzar el cambio de hora de eventos.
- PR #15 limita eventos nuevos desde el día actual en Caracas hasta el 31 de diciembre del año siguiente.
- El último despliegue Production, asociado al PR #16, figura como `success`.
- El propietario confirmó manualmente en Production el comportamiento del PR #15.
- CI usa Node.js 22. El entorno local habitual usa Node.js 24; no cambiar versiones sin necesidad.

Este estado debe contrastarse con GitHub y Vercel al comenzar cada bloque.

## 2. Reglas de trabajo

1. Leer este documento y revisar el código antes de proponer cambios.
2. Trabajar en una rama; no editar `main`, fusionar ni desplegar sin autorización.
3. Mantener Express, PostgreSQL/Supabase, Cloudinary y Vercel salvo decisión explícita.
4. El backend valida datos, roles, propiedad, relaciones y estados.
5. Usar consultas parametrizadas y cambios de base compatibles y no destructivos.
6. No escribir en Supabase de producción durante desarrollo o pruebas.
7. Proteger especialmente datos personales, documentos y datos médicos de menores.
8. No inventar tarifas, categorías, sanciones, eliminación ni comunicaciones.
9. Conservar históricos; archivado y eliminación requieren política institucional.
10. No declarar probada una función si no se ejecutó la prueba correspondiente.

## 3. Arquitectura vigente

- Backend: Node.js, Express y controladores CommonJS.
- Base: PostgreSQL en Supabase mediante `pg` y `DATABASE_URL`.
- Autenticación: JWT en cookie `HttpOnly`, con guardas de rol y estado.
- Archivos: Cloudinary y almacenamiento privado temporal para comprobantes.
- Frontend: HTML, CSS y JavaScript sin framework en `public/`.
- Despliegue: Vercel mediante `vercel.json`; `index.js` es la entrada.
- Pruebas: `node:test`, PostgreSQL temporal y Playwright.

Las rutas, controladores y esquema reales prevalecen sobre descripciones históricas.

## 4. Capacidades implementadas

### Cuentas, permisos y sesiones

- Registro de representantes; aprobación e inactivación por directiva.
- Acceso por rol y propiedad: cada representante opera solo sobre su familia.
- Sesión compartida entre pestañas, cierre sincronizado y recuperación tras recarga.
- Inactividad de 15 minutos con aviso previo; duración absoluta de 12 horas.
- La comprobación inicial evita exponer brevemente datos del panel.

Contrato y límites: [SESIONES_Y_ACCESO.md](SESIONES_Y_ACCESO.md).

### Atletas e inscripciones

- Altas desde representante y directiva con validación equivalente en backend.
- Edad de alta: 5 a 18 años cumplidos según la fecha civil de Caracas. Esto valida inscripción, no asigna categoría.
- Cédula propia venezolana `V`/`E` con 7 a 9 dígitos o heredada generada por el servidor.
- Hermanos pueden heredar la cédula del representante con sufijos únicos; los históricos no se renumeran.
- Se rechaza dentro de una familia el mismo nombre completo normalizado y fecha de nacimiento.
- Altas relacionadas usan transacciones y bloqueos cooperativos para reducir carreras.
- Los estados controlan disponibilidad en pagos y paneles.
- Planilla exportable a PDF con paginación y espera de recursos.

### Pagos

- Reporte en efectivo o transferencia, comprobante cuando corresponde y revisión por directiva.
- Solo se admiten pagos ordinarios de atletas activos con representante aprobado.
- Las fechas civiles se mantienen sin desplazamientos de zona horaria.
- Los montos actuales son libres; todavía no representan la mensualidad oficial.

### Calendario y notificaciones

- Directiva crea, completa y cancela eventos; representantes ven los vigentes.
- Eventos nuevos: desde hoy en Caracas hasta el 31 de diciembre del año siguiente.
- Los históricos fuera del rango se conservan.
- La rama `feat/hora-eventos` añade `hora_evento TIME WITHOUT TIME ZONE` nullable: los históricos quedan sin hora y Express exige `HH:mm` para nuevas altas. La hora es civil de Venezuela, sin conversión a UTC.
- El calendario público y los paneles de directiva y representantes muestran la hora cuando existe. Los históricos se presentan solo con fecha.
- **Condición de publicación:** revisar y aplicar primero `migrations/2026-11-05_eventos_hora.sql` en producción mediante el proceso autorizado, antes de desplegar el código que lee la columna. Esta rama no aplica cambios en Supabase.
- Las notificaciones son informativas y de mejor esfuerzo; no hay lectura persistente.

## 5. Riesgos y deuda vigentes

### Críticos ante evidencia concreta

- Evitar publicación o registro de documentos, recibos y datos médicos reales.
- Revisar archivos privados presentes en la historia Git y acordar remediación antes de reescribirla.
- Confirmar en PostgreSQL real restricciones, claves foráneas y duplicados antes de migrar.
- Mantener autorización backend en toda ruta nueva; la interfaz no es una barrera.

### Seguridad y operación

- Falta validar firmas o bytes mágicos de cargas, no solo tipo/extensión.
- Debe auditarse la privacidad efectiva de URL de Cloudinary.
- Cloudinary y SQL no forman una transacción única; pueden quedar archivos huérfanos.
- El limitador en memoria no es global entre instancias serverless.
- Falta revisión periódica de dependencias, CORS, `TRUST_PROXY`, CSRF y XSS.
- El logout elimina cookies, pero no revoca centralmente un JWT copiado.
- No hay esquema/migración canónico versionado que demuestre todas las restricciones de producción.
- El bloqueo asesor de altas es cooperativo; escritores futuros deben respetarlo.

### Producto y conservación

- No hay historial general de cambios, archivado ni eliminación definitiva controlada.
- No hay auditoría persistente de acciones administrativas.
- Categorías, tarifas, sanciones, retención y comunicaciones requieren decisiones.

## 6. Hoja de ruta por impacto en UX

Cada punto debe ir en un PR separado y conservar compatibilidad.

1. **Hora de eventos.** Implementada en la rama `feat/hora-eventos`; pendiente de revisión, migración autorizada y despliegue.
2. **Pagos guiados por deuda.** Solo conceptos pendientes, monto oficial y conversión. Bloqueado hasta definir tarifa, moneda base, tasa, redondeo, vencimientos y pagos parciales.
3. **Categorías, equipos y temporadas.** Asignación por edad, temporada y rendimiento; requiere reglas deportivas.
4. **Traspasos y plantillas.** Historial de movimientos y plantillas por categoría, después del modelo anterior.
5. **Historial, archivado y auditoría.** Conservación y trazabilidad; eliminación solo con política aprobada.
6. **Historial y condiciones deportivas.** Torneos, títulos, lesiones, sanciones, `Lesionado` y `Sancionado`.
7. **Calendario ampliado.** Reuniones, recordatorios y lectura persistente.
8. **Integraciones.** WhatsApp y cumpleaños solo con consentimiento y política.

Los hallazgos reales de seguridad o integridad tienen prioridad sobre esta lista.

## 7. Decisiones institucionales pendientes

No implementar por inferencia:

- mensualidad, monedas, fuente de tasa, redondeo, mora y pagos parciales;
- categorías, temporadas, equipos, ascensos y excepciones;
- faltas, tarjetas, sanciones y cobros asociados;
- retención, archivado y eliminación definitiva;
- mensajes, destinatarios, consentimiento y horarios de comunicación.

## 8. Validación y entrega

- Sintaxis y pruebas existentes.
- PostgreSQL temporal para transacciones o esquema.
- Playwright escritorio/móvil si cambia una interfaz.
- Regresión proporcional de cuentas, inscripción, pagos y permisos.
- Sin secretos ni datos reales en código, pruebas, logs o documentos.
- Contexto actualizado con evidencia real y riesgo residual.
- Rama y PR preparados; no fusionar ni desplegar sin aprobación.

## 9. Documentación activa

- [README de documentación](README.md): índice y mantenimiento.
- [PRUEBAS_MANUALES_WEB.md](PRUEBAS_MANUALES_WEB.md): checklist manual vigente.
- [SESIONES_Y_ACCESO.md](SESIONES_Y_ACCESO.md): sesiones e inactividad.
- [README_DEPLOY.md](../README_DEPLOY.md): Vercel y Supabase.

Los informes de PR anteriores se retiraron porque duplicaban este estado. Siguen recuperables en Git y GitHub.

## 10. Próximo bloque recomendado

Revisar el PR de hora de eventos y coordinar la migración aditiva antes de su publicación. No se ha probado en producción.

Evidencia local del 5 de noviembre de 2026: `node --check` en 46 archivos JavaScript; 58 pruebas backend con mocks; 52 pruebas de integración con PostgreSQL 18 temporal y Playwright; 62 pruebas de interfaz, PDF y sesiones en escritorio y móvil; caso de calendario repetido tras ampliar aserciones de hora (1 aprobado). El CI del nuevo PR queda pendiente. Riesgo residual: el esquema efectivo de Supabase no se inspeccionó ni modificó; el despliegue de código antes de la migración produciría errores en eventos.
