# Ajustes de paneles y planilla individual

El propietario confirmó visualmente la planilla general del PR #44 y pidió
estos ajustes de presentación en directiva y representante.

## Alcance de este PR

- En Auditoría de pagos, las acciones de cada fila conservan una sola línea,
  incluso si aparecen comprobante, aprobar, rechazar y eliminar. La tabla puede
  desplazarse horizontalmente cuando el espacio es estrecho.
- Ambos formularios de atleta mantienen tres campos en cada una de las dos
  primeras filas. El indicador de categoría ocupa la primera columna de la
  tercera fila y alergias/condiciones médicas las otras dos. Los documentos
  permanecen agrupados como estaban.
- En Solicitudes se muestra el rol de la cuenta en lugar del estado redundante
  «Pendiente». Aprobar y rechazar usan los SVG ya empleados en pagos y atletas.
  El rol es informativo; este PR no permite cambiarlo.
- La planilla individual omite las aclaraciones «heredada» y «orientativa, sin
  equipo asignado». Conserva el valor de cédula y el nombre de categoría.
- Sin cambios de SQL, rutas, autorización, importes o reglas deportivas.

## Decisiones posteriores

- **Asignación de roles:** el registro público actual crea representantes y
  el backend solo aprueba o rechaza solicitudes de ese rol. La creación o
  promoción de directivos requiere un flujo separado con quién puede otorgar
  privilegios, confirmación, auditoría y revocación. El propietario acordó
  separarlo de este PR.
- **Asignación a equipos:** la categoría etaria calculada es informativa. Los
  equipos de Organización Deportiva son catálogos bajo una categoría y temporada,
  sin relación actual con atletas. Una futura asignación manual necesitará una
  tabla aditiva con atleta, equipo, vigencia e historial; primero se deben acordar
  reglas de multiequipo, cambios de temporada y quién puede asignar.
- **Reporte de pagos de representante:** abordar después del ajuste de ambos
  paneles. Las reglas de cuota, deuda, tasa y pagos parciales siguen pendientes.

## Validación

`tests/interfaz.test.js` comprueba acciones de pagos en una fila, iconos y rol
en Solicitudes, distribución de los dos formularios y flujos existentes en
escritorio/móvil. `tests/planilla-pdf.test.js` comprueba texto de planilla
individual y exportación A4. El ensayo manual de Preview debe revisar las
cuatro vistas con datos sintéticos y la planilla individual descargada.
