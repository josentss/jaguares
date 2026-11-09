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

**Siguiente bloque sugerido:** revisar PR #34. Tras fusionar PR #33, el preflight real de Cloudinary devolvió `CARPETA_URL_DIFERENTE`, `formato_cloudinary=png` y limpieza correcta (1 recurso eliminado, 0 pendientes). La URL nativa no encaja con la carpeta esperada pese a confirmar `public_id`, recurso y tipo. PR #34 construye URL canónica desde identidad/version/formato verificados con Admin API, y comprueba acceso sin firma, firmado y vencido con 3 archivos sintéticos. Si la prueba se aprueba pero `requiere_ajuste_de_url_web=true`, NO activar privacidad en Vercel: corregir luego almacenamiento de URL en backend y verificarlo en Preview. Históricos públicos (34 referencias) sin migrar.
