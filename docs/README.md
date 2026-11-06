# Documentación de Jaguares

La documentación activa se mantiene deliberadamente corta:

- [CONTEXTO_MAESTRO_CODEX.md](CONTEXTO_MAESTRO_CODEX.md): estado, inventario del esquema SQL comunicado, diferencias con el código, riesgos y hoja de ruta.
- [PRUEBAS_MANUALES_WEB.md](PRUEBAS_MANUALES_WEB.md): regresión manual por recorridos.
- [SESIONES_Y_ACCESO.md](SESIONES_Y_ACCESO.md): contrato de autenticación e inactividad.
- [README_DEPLOY.md](../README_DEPLOY.md): publicación en Vercel con PostgreSQL/Supabase.

## Criterio de mantenimiento

- El código y el esquema efectivo son la fuente de verdad.
- El contexto maestro conserva decisiones actuales, no diarios completos de cada PR.
- La guía manual describe recorridos vigentes, no resultados históricos.
- La evidencia inmutable debe enlazarse al PR o al CI, sin copiarla en varios archivos.
- Un documento histórico eliminado del árbol sigue disponible en Git.
- Nunca incluir secretos, cookies, recibos, cédulas, datos médicos ni capturas sin anonimizar.

Al terminar un bloque, actualizar el contexto solo con: comportamiento vigente, decisión tomada, prueba realmente ejecutada, riesgo residual y siguiente paso.
