# Regresión manual web — Jaguares

Guía vigente desde el 5 de noviembre de 2026. Las casillas son instrucciones; no significan que el caso ya fue ejecutado. Usar cuentas y datos de prueba, nunca documentos personales reales.

## Antes de probar

- Confirmar el SHA desplegado y que Vercel terminó correctamente.
- Hacer recarga completa y usar perfiles separados para directiva y representante.
- Registrar navegador, dispositivo, hora y paso exacto si aparece un fallo.
- Anonimizar capturas; no compartir contraseñas, cookies, tokens ni comprobantes.

## Recorrido esencial

- [ ] **Cuenta pendiente:** registrar representante; el acceso queda bloqueado hasta aprobación.
- [ ] **Aprobación:** aprobarlo desde directiva; puede iniciar sesión y completar su perfil.
- [ ] **Inscripción propia:** registrar atleta de 5 a 18 años con cédula válida; queda una sola ficha en espera.
- [ ] **Errores:** fechas fuera del rango, cédula/teléfono inválidos y campos obligatorios muestran un mensaje útil y no crean registros.
- [ ] **Cédula heredada:** registrar dos hijos; reciben identificadores distintos y mantienen el representante correcto.
- [ ] **Duplicado familiar:** repetir nombre completo normalizado y fecha de nacimiento dentro de la misma familia; se rechaza sin alterar fechas.
- [ ] **Coincidencia entre familias:** el mismo nombre y fecha en otra familia no se bloquea solo por coincidencia.
- [ ] **Alta por directiva:** probar representante existente y cuenta nueva; relaciones, estado e identidad quedan correctos.
- [ ] **Planilla/PDF:** abrir una ficha nueva y otra histórica; foto, textos, fechas y secciones aparecen completos, sin cortes.
- [ ] **Estados:** aprobar atleta y luego inactivarlo; aparece y desaparece de los flujos correspondientes.
- [ ] **Pago en efectivo:** atleta activo y representante aprobado pueden reportarlo; queda pendiente para directiva.
- [ ] **Transferencia:** exige comprobante; directiva puede visualizarlo y aprobar o rechazar el reporte.
- [ ] **Fecha del pago:** la fecha elegida coincide en ambos paneles y en el historial, sin restar un día.
- [ ] **Pago inválido:** atleta inactivo o representante no aprobado se rechaza desde el backend aunque la pestaña sea antigua.
- [ ] **Propiedad:** una familia no puede consultar ni editar atletas, pagos o documentos de otra mediante URL o API.
- [ ] **Evento válido:** crear desde hoy hasta el 31 de diciembre del año siguiente con hora de Venezuela; fecha y hora aparecen en directiva, representantes y calendario público.
- [ ] **Hora válida:** en directiva, el popover compacto muestra un selector de hora (5–11 a. m. o 12–10 p. m.), botones a. m./p. m. y 12 opciones rápidas de minutos (00 a 55, de cinco en cinco), sin resumen duplicado dentro. El valor legible aparece solo en el formulario (ej. «2:30 p. m.»); la API recibe `14:30`. Las 10 p. m. se confirman como `22:00` sin minutos posteriores. Verificar 05:00, 14:30 y 22:00.
- [ ] **Reloj responsive/accesible:** abrir en escritorio/móvil y comprobar que el menú permanece corto, junto al campo y dentro del viewport. Se cierra con Escape, clic fuera o X; volver a abrir restaura hora, período y minuto. Cambiar controles sin confirmar y cerrar no cambia el valor guardado; seleccionar minutos guarda y cierra. El select de hora y los botones permiten teclado/foco. El reset limpia la selección.
- [ ] **Limpieza visual del PR #23:** el formulario no muestra texto explicativo debajo de «Hora» y el popover solo muestra «Minutos», sin «de 5 en 5». La descripción del horario continúa accesible para lectores de pantalla. Los botones de minutos conservan una zona táctil cómoda en móvil. Bajo «Eventos del calendario» no aparece el párrafo permanente de estados, pero los filtros, badges y el aviso contextual al existir completados siguen presentes.
- [ ] **Hora inválida:** omitirla o enviar por API 02:00, 04:55, 14:02, 22:05, 23:00 o un valor distinto de `HH:mm`; el backend rechaza sin insertar.
- [ ] **Evento inválido:** fecha pasada o posterior al límite se rechaza en interfaz y backend.
- [ ] **Histórico:** los eventos antiguos conservan el día que ya mostraba el sistema, sin desplazarse al día anterior en Caracas, sin hora inventada ni reescritura.
- [ ] **Estado derivado:** un evento de hoy sigue programado y visible durante su día; al día civil siguiente aparece como «Completado» en el historial de directiva y desaparece de la web pública sin proceso programado.
- [ ] **Historial:** las pestañas Programados/Historial alternan correctamente; la directiva ve una sugerencia de revisión cuando existen completados.
- [ ] **Papelera:** el botón SVG solicita confirmación; cancelar no elimina. Confirmar elimina solo el evento elegido y lo retira del panel y la web, sin alterar otros registros.
- [ ] **Permisos:** representantes y staff no pueden invocar el borrado mediante API ni desde la interfaz; solo directiva/admin.
- [ ] **Diseño:** formulario con título/lugar y fecha/hora alineados en escritorio, apilado en móvil; ningún selector se desborda.
- [ ] **Calendario público concurrido:** se muestran tres tarjetas inicialmente y «Ver todos» amplía la lista; tocar un día filtra y «Ver mes completo» restaura el mes.

## Archivos y privacidad (PR #24)

- [ ] **Firma válida:** usar PNG, JPEG, WebP, PDF de cédula/partida y GIF para noticias, solo con muestras sintéticas; deben funcionar como antes.
- [ ] **Firma falsa:** renombrar un TXT/HTML a PNG/PDF y declarar un MIME permitido; la API responde HTTP 400 sin enviarlo a Cloudinary ni guardar registros.
- [ ] **Contradicción:** imagen con extensión/MIME de PDF, o viceversa, y archivos mayores a 5 MiB se rechazan.
- [ ] **Autorización futura:** solo representante propietario y personal autorizado del panel directiva ven los documentos; nunca otro representante.
- [ ] **Privacidad pendiente:** no asumir que URL de Cloudinary histórica es privada solo porque Express exija autenticación para devolverla. Habrá un PR adicional para acceso temporal y migración no destructiva.

## Acceso privado y Cloudinary (PR #25)

- [ ] **Propiedad y panel:** el representante puede usar el botón «Documentos» en «Mis atletas» para abrir foto, cédula o partida disponibles en un diálogo compacto, también en móvil. Al seguir la ruta `/api/atletas/:id/documentos/:tipo`, el propietario puede acceder, el ajeno recibe HTTP 403 y la sesión ausente HTTP 401.
- [ ] **Directiva:** roles `staff`, `directiva` y `admin` pueden consultar la documentación según la política aprobada, sin revelar URL originales en la planilla JSON.
- [ ] **Comprobante:** solo propietario o directiva autorizada obtiene enlace al comprobante; el historial y la auditoría no devuelven el URL original.
- [ ] **Nueva carga privada:** *únicamente tras confirmar configuración de Cloudinary*, activar `CLOUDINARY_AUTHENTICATED_UPLOADS=1` en entorno de prueba. Confirmar que archivos de atletas y comprobantes se guardan como `authenticated`, mientras las imágenes de noticias permanecen públicas.
- [ ] **Firma con caducidad:** en archivos nuevos, una URL sin firma no debe abrir y la firmada deja de servir tras vencer; una URL temporal compartida funciona durante su vigencia (limitación explícita).
- [ ] **PDF y planilla:** comprobar vista de cédula/partida PDF, foto, descarga e impresión/exportación de planilla en móvil y escritorio con archivos sintéticos.
- [ ] **Históricos:** los activos existentes de tipo `upload` siguen accesibles por URL antiguas si se conoce; inventariar y migrar después sin reescribir Supabase ni cambiar URLs sin autorización.
- [ ] **Rollback:** `CLOUDINARY_AUTHENTICATED_UPLOADS=0` solo controla las cargas futuras; no desprotege los recursos ya guardados como `authenticated`.

## Inventario Cloudinary y rutas de documentos (PR #26)

- [ ] **Origen permitido:** desde la ficha de un atleta propio y la planilla directiva, un JPG/PNG/PDF histórico con URL de la cuenta y carpeta de Jaguares sigue abriéndose.
- [ ] **Destino incorrecto:** una URL de otro dominio, nube, carpeta o formato no permite redirigir fuera de Cloudinary; la API informa documento no disponible, sin exponer enlaces.
- [ ] **Metadatos históricos:** verificar en Media Library que ejemplos de ambas carpetas sean Públicos; no asumir que el recurso completo fue inventariado solo con dos muestras.
- [ ] **Inventario anónimo:** ejecutar `node scripts/auditar-cloudinary.js` solo con acceso autorizado y confirmar que la salida contiene conteos por categoría, sin URL ni datos personales; no se realizan actualizaciones SQL.
- [ ] **Antes de activar authenticated:** comprobar entrega firmada/no firmada de foto, comprobante y PDF sintéticos en Preview. El checkbox de entrega PDF/ZIP habilitado no prueba por sí solo que ya funcione el flujo completo con `authenticated`.
- [ ] **Históricos:** no modificar activos reales ni ejecutar `rename`, reemplazos SQL o invalidación de CDN sin revisión del inventario y autorización explícita.

## Sesión

- [ ] Entrar y recargar: vuelve al panel sin tarjeta blanca de verificación.
- [ ] Abrir dos pestañas: ambas funcionan; cerrar una no cierra la otra.
- [ ] Cerrar sesión expresamente: las pestañas del mismo perfil vuelven al login.
- [ ] Dejar 14 minutos sin interacción: aparece el aviso; «Continuar sesión» conserva datos y acceso.
- [ ] Repetir sin continuar: al llegar a 15 minutos el servidor exige iniciar sesión.
- [ ] Navegador normal e incógnito mantienen sesiones independientes; no se usa la IP como identidad.
- [ ] Pegar una URL protegida sin sesión no expone el panel antes de redirigir.

Detalles del contrato: [SESIONES_Y_ACCESO.md](SESIONES_Y_ACCESO.md).

## Móvil

- [ ] Repetir registro, errores, pago, calendario y sesión en un ancho móvil.
- [ ] Menú, teclado, calendarios, modales y botones no se superponen ni requieren desplazamiento horizontal.
- [ ] El aviso de inactividad no tapa controles imprescindibles y permite continuar.
- [ ] El PDF se genera completo; su visor puede variar según el dispositivo.

## Criterio ante fallos

Detener el recorrido afectado y conservar solo evidencia anonimizada. Indicar resultado esperado, observado, pasos, rol, navegador y hora. No intentar corregir datos de producción manualmente ni repetir envíos dudosos.
