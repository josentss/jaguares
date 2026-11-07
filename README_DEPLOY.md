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

## Entrega privada de documentos en Cloudinary (fase gradual)

- La variable opcional `CLOUDINARY_AUTHENTICATED_UPLOADS` **no se activa automáticamente**. Sin valor o con `0`, se conserva el tipo de carga anterior (`upload`).
- Solo tras comprobar en Cloudinary que se pueden entregar imágenes y PDF con tipo `authenticated`, activar `CLOUDINARY_AUTHENTICATED_UPLOADS=1` en el entorno autorizado de Vercel. Esto afecta **solo nuevas cargas de documentos de atletas y comprobantes**; noticias públicas no cambian.
- La API consulta propiedad o rol (`representante` propietario, `staff`, `directiva`, `admin`) antes de generar enlaces firmados que vencen aproximadamente en dos minutos. No guardar ni compartir estos enlaces: mientras no caduquen se pueden reutilizar.
- Los documentos de las fichas se exponen en rutas de Jaguares, no como URL directa en el JSON: `/api/atletas/:id/documentos/foto|cedula_archivo|partida_nacimiento`. Los comprobantes conservan `/api/pagos/captura/:id_pago`, que da un URL temporal tras validar acceso.
- **Los archivos históricos de tipo `upload` siguen siendo públicamente accesibles por sus URL antiguas** aunque la aplicación ya no las muestre en el JSON. Migrarlos exige inventario, respaldo, verificación de tipo/recurso, estrategia de `rename`/copiado, invalidación y aprobación; este PR no los migra.
- Antes de activarlo, verificar el plan Cloudinary y la opción de entrega de PDF (en cuentas Free puede estar deshabilitada), y probar con archivos **sintéticos** en un entorno aislado. Validar acceso propio/ajeno, staff y descarga/visualización de PDF y foto en planilla.
- Al detectar problemas, revertir la variable para **futuras** cargas; esto no convierte automáticamente en públicos los archivos `authenticated` ya subidos. No ejecutar migraciones ni cambios sobre activos antiguos para deshacer una prueba.

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
