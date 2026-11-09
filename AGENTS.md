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

**Siguiente bloque sugerido:** revisar PR #32 (prueba Cloudinary `authenticated` con recursos sintéticos y opt-in `--ejecutar`). PR #31 está fusionado y el inventario real encontró 34 referencias públicas documentales (30 atletas, 4 pagos), ninguna `authenticated`, sin incidencias de formato. El propietario restableció `DATABASE_URL` de Vercel y probó sesión/lecturas. No activar cargas privadas en Production ni migrar históricos por esta prueba aislada; tras prueba de proveedor con foto/PDF/recibo sintéticos, probar flujo web en Preview y planear migración deduplicada/reversible autorizada. Mantener calendario y pagos funcionando y documentar cualquier riesgo residual.
