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

## Orígenes autorizados y protección de escrituras (PR #30)

- La web usa peticiones **mismo origen**; funciona en Vercel Production y en Preview sin dar acceso CORS a terceros. En Vercel, el origen propio usa el esquema HTTPS y el host exacto de la petición.
- `CORS_ORIGIN` configura **solo** orígenes adicionales que necesiten llamar a la API desde otro dominio. Si no se necesita integración entre dominios, puede dejarse sin valor; en local se conserva `http://localhost:PORT`.
- Si hay integración legítima, enumerar orígenes completos separados por comas, por ejemplo `https://panel.autorizado.example,https://otro.autorizado.example`. Nunca usar `*` ni permitir todos los proyectos `vercel.app`/`onrender.com`; no añadir ruta final ni slash.
- Las escrituras de API (`POST`, `PUT`, `PATCH`, `DELETE`) con cabecera `Origin` fuera de esa lista y del mismo host se rechazan con HTTP 403; también cuando el navegador indica `Sec-Fetch-Site: cross-site` sin `Origin`.
- Esto **no** reemplaza autenticación, propiedad y roles ni la futura revisión CSRF integral. Antes del merge, comprobar login, registros y pagos desde el dominio de Vercel y cualquier integración declarada.

## Entrega privada de documentos en Cloudinary (fase gradual)

- La variable opcional `CLOUDINARY_AUTHENTICATED_UPLOADS` **no se activa automáticamente**. Sin valor o con `0`, se conserva el tipo de carga anterior (`upload`).
- Solo tras comprobar en Cloudinary que se pueden entregar imágenes y PDF con tipo `authenticated`, activar `CLOUDINARY_AUTHENTICATED_UPLOADS=1` en el entorno autorizado de Vercel. Esto afecta **solo nuevas cargas de documentos de atletas y comprobantes**; noticias públicas no cambian.
- La API consulta propiedad o rol (`representante` propietario, `staff`, `directiva`, `admin`) antes de generar enlaces firmados que vencen aproximadamente en dos minutos. No guardar ni compartir estos enlaces: mientras no caduquen se pueden reutilizar.
- Los documentos de las fichas se exponen en rutas de Jaguares, no como URL directa en el JSON: `/api/atletas/:id/documentos/foto|cedula_archivo|partida_nacimiento`. Los comprobantes conservan `/api/pagos/captura/:id_pago`, que da un URL temporal tras validar acceso.
- **Los archivos históricos de tipo `upload` siguen siendo públicamente accesibles por sus URL antiguas** aunque la aplicación ya no las muestre en el JSON. Migrarlos exige inventario, respaldo, verificación de tipo/recurso, estrategia de `rename`/copiado, invalidación y aprobación; este PR no los migra.
- Antes de activarlo, verificar el plan Cloudinary y la opción de entrega de PDF (en cuentas Free puede estar deshabilitada), y probar con archivos **sintéticos** en un entorno aislado. Validar acceso propio/ajeno, staff y descarga/visualización de PDF y foto en planilla.
- Al detectar problemas, revertir la variable para **futuras** cargas; esto no convierte automáticamente en públicos los archivos `authenticated` ya subidos. No ejecutar migraciones ni cambios sobre activos antiguos para deshacer una prueba.

### Auditoría de enlaces históricos (PR #26; solo lectura)

Las capturas del propietario muestran entrega PDF/ZIP **habilitada** y ejemplos de fotos/comprobantes con control de acceso **Público**. La API autorizada no revoca las URL antiguas. **No activar la variable en Production basándose únicamente en esas capturas**: un PDF real `authenticated` y su URL firmada deben probarse con un archivo sintético y el SHA de Preview.

Con un entorno autorizado que tenga `DATABASE_URL` y `CLOUDINARY_CLOUD_NAME` configurados, ejecutar localmente:

Antes de abrir una conexión, comprueba únicamente la **presencia** de variables y el **tipo de conexión** con:

```bash
node scripts/auditar-cloudinary.js --diagnostico
```

Este modo no se conecta a Supabase ni a Cloudinary y no muestra URL, host, usuario ni contraseña. La categoría `directa_ipv6_habitual` indica que la URL tiene formato de conexión directa; si la red local no ofrece IPv6, considera obtener desde **Supabase → Connect → Session pooler (puerto 5432)** una cadena nueva para uso **solo local**, sin cambiar la conexión de Vercel que ya funciona. El Session pooler es compatible con IPv4. No inventes la dirección de pooler ni copies credenciales al chat.

Después ejecuta el inventario de solo lectura:

```bash
node scripts/auditar-cloudinary.js
```

Si falla, el programa muestra `etapa` y `categoria` (sin mensajes crudos ni secretos). Categorías como `RED_NO_ALCANZABLE`, `DNS` o `TIEMPO_AGOTADO` sugieren problema de conexión; `AUTENTICACION` sugiere revisar credenciales, y `TABLA_FALTANTE` / `COLUMNA_FALTANTE` / `PERMISOS` orientan a una revisión del esquema o usuario SQL. Puedes compartir **solo** esos dos códigos, el tipo de conexión anónimo y, si termina correctamente, `colecciones`. No compartas `.env`, `DATABASE_URL`, trazas, logs completos o documentos.


El script carga el `.env` local mediante `dotenv` (PR #27), abre una **transacción PostgreSQL READ ONLY**, clasifica las referencias en fotos, cédulas, partidas y comprobantes y muestra únicamente recuentos agregados. No imprime URL, nombre de persona, `public_id` ni identificadores. No realiza llamadas de escritura a Cloudinary/Supabase; sí requiere lectura de las referencias históricas. No copiar credenciales al chat ni adjuntar resultados con datos personales.

- `publico`: URL identificada como `image|raw/upload` de las carpetas propias; la firma de un nuevo enlace no la vuelve privada.
- `autenticado`: URL identificada como `image|raw/authenticated`; comprobar que un enlace sin firma realmente falla.
- `referencia_legacy_sin_url`: un identificador antiguo de comprobante, sin URL completa, que necesita resolver su formato.
- `revisar_manual`: URL fuera de la cuenta/carpeta o patrón no reconocido; no se debe migrar automáticamente ni enviar al navegador sin validarla.

**Este resultado describe las cadenas SQL, no la metadata real de Cloudinary.** Contrastar `Asset type` y `Delivery type` en Media Library (vista de lista) o Admin API. Preparar respaldo/inventario y pruebas con recursos sintéticos; una migración de `upload` a `authenticated` requerirá cambios de referencia y posible invalidación de CDN, con autorización separada. Cloudinary documenta `rename(to_type)` para cambiar el tipo y advierte que la caché puede mantener temporalmente enlaces antiguos (ver [control de acceso](https://cloudinary.com/documentation/control_access_to_media) y [rename](https://cloudinary.com/documentation/image_upload_api_reference)).

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
