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
- [ ] **Evento válido:** crear desde hoy hasta el 31 de diciembre del año siguiente; aparece en ambos paneles.
- [ ] **Evento inválido:** fecha pasada o posterior al límite se rechaza en interfaz y backend.
- [ ] **Histórico:** eventos antiguos siguen visibles donde corresponde; no se reescriben.
- [ ] **Completar/cancelar:** deja de mostrarse como vigente, pero permanece en el historial administrativo.

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
