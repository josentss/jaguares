# Instrucciones para Codex — Jaguares

Antes de comenzar cualquier tarea, lee **[docs/CONTEXTO_MAESTRO_CODEX.md](docs/CONTEXTO_MAESTRO_CODEX.md)**. Es el documento vivo con arquitectura, estado de PR, reglas validadas, riesgos, backlog, criterios de aceptación y próxima tarea.

## Normas esenciales

- Confirma el estado de `main`, de los PR y del despliegue; el documento puede quedar atrasado.
- No reescribas el proyecto, no cambies el stack innecesariamente y no rompas los flujos existentes.
- No edites `main`, no fusiones PR y no despliegues sin autorización expresa. Trabaja en ramas.
- No alteres datos de Supabase de producción ni ejecutes migraciones destructivas sin autorización.
- No inventes reglas de tarifas, categorías, sanciones, eliminación de datos personales o comunicaciones. La eliminación puntual de eventos ha sido solicitada explícitamente; nunca es automática.
- Backend como autoridad: valida entradas, roles, propiedad del recurso, estados y relaciones; pruebas unitarias, PostgreSQL temporal y Playwright.
- Protege datos de menores, documentación personal y datos médicos. Nunca coloques secretos ni datos reales en tests, logs o documentos.
- En cada PR relevante, actualiza también el contexto maestro: cambios, decisiones, evidencia de pruebas, riesgo residual, estado de tareas y nuevos enlaces.
- No marques una funcionalidad como «implementada» si solo se propuso; no marques «probada en producción» si solo usaste mocks o CI.

**Siguiente bloque sugerido:** revisar PR #30, que reemplaza CORS permisivo para todo `*.vercel.app`/`*.onrender.com` por orígenes exactos o mismo host del despliegue y rechaza escrituras API de origen externo. PR #29 está fusionado y probado por el propietario en Production: SVG, visor de comprobantes, estados y eliminación de pago rechazado funcionan. Validar CI, Preview, Production y configuración real de `CORS_ORIGIN` antes de fusionar. Después ejecutar el inventario local de Cloudinary (solo conteos) y verificar `authenticated` con archivos sintéticos; nunca migrar/eliminar recursos históricos sin autorización.
