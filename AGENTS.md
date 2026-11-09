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

**Siguiente bloque sugerido:** revisar PR #33. PR #32 fusionado: primera prueba real subió una foto PNG `authenticated` y la eliminó (1/1, 0 pendientes), pero se detuvo en `subida_foto` / `URL_INCOMPATIBLE`, sin comprobar acceso firmado. PR #33 clasifica esa diferencia sin imprimir URLs o debilitar el parser de producción. No activar cargas privadas ni migrar históricos (34 referencias públicas) hasta validar entrega real con firma, PDF y comprobantes.
