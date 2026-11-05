# Despliegue de Jaguares

La producción actual usa Vercel para la aplicación y PostgreSQL/Supabase para datos. Esta guía no autoriza escrituras directas, migraciones ni despliegues.

## Flujo normal

1. Crear una rama desde `main` actualizado.
2. Implementar y ejecutar las pruebas proporcionales al cambio.
3. Publicar la rama y abrir un Pull Request.
4. Esperar el CI con Node.js 22 y PostgreSQL temporal cuando corresponda.
5. Revisar el diff y fusionar solo con autorización del propietario.
6. Confirmar en Vercel que el SHA fusionado terminó en Production.
7. Ejecutar un recorrido manual corto, sin datos personales reales.

`vercel.json` dirige las solicitudes a `index.js`. No cambiar runtime, versión de Node o arquitectura solo para resolver una diferencia local.

## Variables de entorno

Configurar en el proveedor apropiado, nunca en Git:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `EXCHANGERATE_API_KEY` si la función que la usa está habilitada
- `TRUST_PROXY`, `PGOPTIONS`, `PURGE_RETENTION_DAYS` y `PURGE_BATCH_SIZE` solo según la configuración operativa acordada

`NODE_ENV`, `PORT` y `VERCEL` suelen ser administradas por la plataforma. No copiar valores productivos a documentación, pruebas o logs.

## Base de datos

- Supabase de producción no se usa para pruebas.
- Toda migración debe estar versionada, revisada, ser compatible con históricos y tener estrategia de reversión.
- Validar primero contra PostgreSQL temporal.
- Antes de añadir unicidad o claves foráneas, auditar datos existentes.
- No ejecutar cambios destructivos sin autorización y respaldo confirmado.

## Comprobación posterior

- SHA correcto y despliegue `success`.
- Inicio, recarga y cierre de sesión.
- Un flujo crítico afectado por el PR.
- Rutas protegidas sin exposición anónima.
- Logs sin secretos ni datos personales.

Usar [docs/PRUEBAS_MANUALES_WEB.md](docs/PRUEBAS_MANUALES_WEB.md) para una regresión más amplia.
