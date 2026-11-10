# Ensayo de cargas privadas en Preview

> **Resultado funcional (10-11-2026):** las cargas privadas y la autorización de documentos/comprobantes fueron comprobadas en Preview con datos sintéticos; se verificaron visores, exportación PDF, caducidad de firma y compatibilidad histórica (PR #37). **Desviación relevante:** se reutilizó la base Supabase conectada también a Production, por lo que NO se verificó aislamiento. Los IDs sintéticos identificados son atletas 30/31 y pagos 20/21; no son necesariamente todos los assets creados. Nada se ha borrado en Cloudinary/Supabase. El procedimiento aislado siguiente sigue siendo el estándar recomendado, y NO debe darse por completado solo con el ensayo compartido.

### Compensación propuesta en rama separada (PR de noviembre 2026)

La nueva lógica rastrea las cargas de documentos y comprobantes realizadas por una solicitud. Al ocurrir un fallo seguro del formulario o un rollback PostgreSQL confirmado, comprueba que ninguna referencia de esas cargas figure en `atletas` ni `pagos` y solicita la eliminación puntual a Cloudinary con tipo de entrega correcto (`upload` o `authenticated`). Una escritura SQL ambigua o fallo de Cloudinary deja un caso pendiente para revisión manual: nunca se debe borrarlo a ciegas. No hay migraciones SQL ni limpieza retroactiva.

**Pruebas seguras:** ejecutar `node --test tests/compensacion-cloudinary.test.js` (sin SQL real) y el flujo `tests/flujos-web-pg.test.js` únicamente con la base PostgreSQL local desechable `jaguares_test` y Cloudinary simulado. En Preview compartido con Production, limitarse a un alta sintética normal y comprobar que permanece accesible tras el COMMIT; **no inducir fallos SQL ni subidas fallidas para medir borrados reales**. Usar entorno *realmente aislado* para una prueba destructiva de compensación y verificar las identidades concretas en Cloudinary. No compartir JWT, URL firmadas ni `public_id` en capturas.


Objetivo: verificar una inscripción y una transferencia **totalmente sintéticas** contra la aplicación web y Cloudinary reales, sin escribir en Supabase de Production ni alterar los 34 enlaces históricos. Este ensayo sigue pendiente hasta que se configure y ejecute un entorno aislado.

## Preparar el entorno

1. Crear una base PostgreSQL/Supabase **nueva y vacía**, con identificador de proyecto diferente al de Production. Reproducir solo el esquema necesario de `usuarios`, `atletas`, `pagos`, `notificaciones`, `audit_uploads` y demás tablas que carga la aplicación. El esquema temporal de `tests/` simplifica algunas restricciones: no usarlo como copia certificada de Production. Si se obtiene un volcado, debe ser **solo de estructura**, revisado antes de aplicarlo; no copiar filas, documentos, claves ni auditorías reales. [Supabase documenta el volcado de esquema sin datos](https://supabase.com/docs/reference/cli/supabase-db-dump).
2. Preparar una rama de prueba con un Preview de Vercel. En **Settings → Environment Variables**, asignar a esa rama `DATABASE_URL` de la base nueva, un `JWT_SECRET` exclusivo y `CLOUDINARY_AUTHENTICATED_UPLOADS=1`. Configurar las credenciales Cloudinary en Vercel sin copiarlas al repositorio, capturas o chat. Vercel permite [variables Preview específicas por rama](https://vercel.com/docs/environment-variables); su cambio requiere un despliegue nuevo. Confirmar que Production conserva su configuración y que la rama no hereda una `DATABASE_URL` de Production. Si no es posible demostrar esta separación, detener el ensayo antes de registrar una cuenta.
3. Inicializar **solo en la base de prueba** una cuenta `directiva` aprobada y, si se probará ese permiso, una cuenta `staff` aprobada. Usar nombres, documentos, contraseñas y correos de prueba. El alta de representantes desde la web puede completar las otras dos identidades. No reutilizar cuentas ni datos productivos.
4. Confirmar que el SHA esperado terminó en Preview y que el origen de la web y API coincide. No interpretar un Preview verde como prueba de aislamiento de base de datos ni de entrega privada.

## Recorrido y criterios de aceptación

Registrar en un registro privado de pruebas el SHA, URL de Preview, fecha, navegador y resultados **sin** contraseñas, cookies, URL firmadas, `public_id`, documentos ni datos médicos. Usar una foto PNG, una partida PDF y un comprobante PNG generados para esta prueba.

1. Registrar y aprobar al representante A; registrar otro representante B aprobado. A inscribe a un atleta con foto y PDF sintéticos. Comprobar que la base de prueba guarda URL de `image/authenticated` bajo `jaguares/atletas`, no la carpeta discrepante de la URL nativa. Confirmar que no hay filas nuevas en Production.
2. A y directiva abren foto y PDF mediante `/api/atletas/:id/documentos/:tipo`. Si se preparó staff, repetir con staff. B recibe HTTP 403 y una sesión ausente HTTP 401. La URL sin firma debe fallar; una URL temporal debe entregar el archivo correcto y dejar de funcionar al vencer. No compartir ni registrar esas URL.
3. Abrir la planilla del atleta como A y directiva, comprobar la foto y exportar el PDF en escritorio y móvil. Si falta la imagen, falla la descarga o la exportación, el ensayo no se aprueba.
4. Activar al atleta en la base de prueba. A reporta una transferencia con comprobante PNG sintético. Verificar `ruta_captura` bajo `jaguares_comprobantes` con tipo `authenticated`. A y directiva (y staff, si aplica) pueden abrirlo; B recibe HTTP 403 y la sesión ausente HTTP 401. Confirmar que el historial no devuelve la URL original de Cloudinary.
5. Confirmar que las imágenes públicas del CMS siguen usando `upload`. Probar una solicitud con archivo de firma falsa: debe fallar antes de Cloudinary y no crear filas.

## Cierre del ensayo

- Desactivar `CLOUDINARY_AUTHENTICATED_UPLOADS` **solo en el entorno de prueba** y generar un nuevo despliegue si ese Preview seguirá disponible. Desactivar el flag afecta futuras cargas; los archivos `authenticated` ya creados conservan su tipo.
- Inventariar los recursos sintéticos creados por este ensayo y eliminarlos **por identidad comprobada**, uno a uno, en Cloudinary. Confirmar cero pendientes. Limpiar solo los registros sintéticos de la base aislada; conservar evidencia anónima de resultados. Si una identidad no se puede confirmar, no ejecutar borrados por carpeta o lote.
- Si un paso falla, registrar la etapa y el resultado anónimo, dejar Production sin cambios y abrir un PR de corrección específico. No migrar históricos ni activar cargas privadas en Production por un éxito parcial.

La compensación de archivos huérfanos tras fallos de formulario o SQL sigue siendo una tarea separada. Las pruebas de CI usan Cloudinary simulado y no sustituyen este ensayo.
