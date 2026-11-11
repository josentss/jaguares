# UX operativa — navegación, formularios y filtros

## Motivo

El propietario validó el PR #40 en Preview y documentó problemas de densidad en cuatro capturas:
banner innecesariamente grande al entrar a Organización Deportiva, tarjetas desiguales,
clasificación por edad ocupando una fila completa de inscripción y formularios demasiado anchos.
Pidió navegación agrupada y un filtro de categoría formativa para la tabla de atletas.

## Cambios de este PR

- El encabezado de Organización Deportiva se convierte en una línea de contexto y
  tres contadores pequeños (temporadas, categorías, equipos). Se elimina el banner/hero.
- Los formularios de temporada, categoría y equipo conservan sus validaciones y acciones
  de alta/edición/cancelación; sus tarjetas tienen alturas alineadas en escritorio y se
  apilan sin desbordarse en pantallas menores.
- La directiva tiene un menú accesible con dos grupos: **Club y atletas** (Solicitudes,
  Registrar atleta, Gestión de atletas, Organización deportiva) y **Administración**
  (Auditoría de pagos, Gestión web y eventos). Inicio y cierre de sesión permanecen directos.
  Los grupos se abren por botón con `aria-expanded`, admiten teclado y mantienen
  el cierre del menú al cambiar de sección en móvil.
- Formularios de inscripción de representante y directiva con tres columnas de
  dimensiones acotadas en escritorio, dos en tamaños intermedios y una en móvil.
  La categoría orientativa aparece como indicador discreto bajo la fecha.
- Gestión de Atletas (directiva): búsqueda, estado y nuevo filtro por **código de categoría
  por edad** funcionan en conjunto. Las categorías provienen del contrato compartido
  `JaguaresCategoriasFormativas.CATEGORIAS`, no de nombres de equipos editables.
  Incluye «Sin categoría publicada» para edades 16–18 y contador de filas visibles.
- Se actualizan las etiquetas de tarjetas móviles de atletas, desfasadas desde la
  adición de la columna Categoría del PR #40.
- No se alteran endpoints, SQL, cuotas, Cloudinary, cálculos de edad ni permisos.

## PR siguiente: planilla general de atletas por categoría

El PR de UX original no la implementó. Requisito funcional recibido del propietario:

1. En **Gestión de Atletas**, la directiva selecciona una categoría por edad.
   El resultado incluye solamente los atletas que coinciden con esa categoría;
   otros filtros (estado y búsqueda) deben tener un comportamiento explícito
   y coherente entre lo mostrado y lo exportado.
2. Una acción real **«Generar planilla general»** exportará un PDF compacto en A4
   con título como «Club Jaguares — Planilla general — U-9 Iniciación».
   Si se escoge «Todas las categorías», el título debe indicarlo. Evitar
   repetir la categoría en cada fila cuando el conjunto sea de una sola categoría.
3. Columnas mínimas por atleta: **Nombre completo, cédula y fecha de nacimiento**.
   Añadir categoría por fila solo si la exportación mezcla categorías,
   y evitar datos médicos, dirección, teléfonos, documentos o información financiera.
4. El servidor debe validar la sesión y el rol administrativo, volver a consultar
   los datos autorizados e interpretar los filtros; **nunca** confiar en el DOM
   para construir una exportación completa. No reutilizar la planilla individual
   del atleta ni descargar archivos privados para esta función.
5. Paginación PDF, cabecera legible, recuento de registros, fecha civil de Caracas,
   fuente legible en móvil/escritorio, estado vacío (no generar archivo sin atletas
   o mostrar PDF con «Sin resultados», a decidir). No enviar datos reales a
   servicios externos de conversión.
6. Pruebas de PDF: categoría seleccionada, todas, cero resultados, escapes de
   caracteres, coincidencia de registros con filtros, 401/403, ausencia de datos
   personales adicionales y límite de filas/páginas.

### Contrato acordado el 11 de noviembre de 2026

- Se usa la categoría por edad publicada en la portada y codificada en
  `categorias-formativas.js`: U-7, U-9, U-11, U-13 o U-15. «U8» fue un ejemplo,
  no una categoría nueva. «Todas» y «Sin categoría publicada» no habilitan exportación.
- Al seleccionar una categoría se muestra «Generar planilla general». La exportación
  consulta nuevamente el servidor e incluye **solo atletas activos** de esa categoría.
  Búsqueda y filtro de estado de la tabla no modifican el PDF.
- Encabezado con el logotipo actual del sitio y nombre de la categoría seleccionada.
  Columnas: nombre completo, cédula y fecha de nacimiento. Fecha civil de Caracas,
  total y páginas. Si no hay atletas activos, se avisa y no se descarga un PDF vacío.
- El endpoint requiere sesión de staff/directiva/admin, acepta solo códigos publicados,
  devuelve únicamente las cuatro columnas necesarias y rechaza planillas mayores
  de 1000 atletas con error explícito. No se consultan documentos ni datos médicos.
- La clasificación sigue siendo orientativa, especialmente U-15: el PDF no acredita
  elegibilidad competitiva ni asigna atleta a equipo o temporada.

**Diferencia importante:** `categorias_deportivas` creadas por directiva son
catálogos por temporada, no la categoría etaria orientativa calculada por fecha
de nacimiento. No equipararlas ni asignar atletas a un equipo automáticamente.

## Validación manual breve (solo Preview)

1. Directiva: menú «Club y atletas» → Organización Deportiva. Sin banner,
   tres contadores discretos, tarjetas alineadas en escritorio, apiladas en móvil.
   Crear/editar un nombre existente si se desea, sin duplicar datos de prueba.
2. Directiva: Gestión de Atletas → filtrar U-9 y comprobar que aparecen solo
   atletas clasificados U-9. Combinar con «Activo/Espera» y buscar por nombre.
   «Todas las categorías» restaura los resultados; «Sin categoría publicada»
   incluye edades sin grupo en la portada. No requiere registros nuevos.
3. Registro en ambos roles: categoría junto a fecha en un rótulo pequeño;
   nombres/apellidos no deben ocupar media pantalla. Probar una fecha sin enviar
   inscripción.
4. Comprobar navegación y filtros en una pantalla estrecha; etiquetas de la
   tabla por atleta deben ser «Fecha nac.», «Categoría», «Estado», «Acciones».
5. Regresión breve: planilla individual, comprobantes y calendario. Sin SQL.

El CI contiene pruebas de navegación en ambas dimensiones, filtros combinados,
estructura de catálogos, formulario compacto y regresiones anteriores.
