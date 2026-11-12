# Consulta de plantillas y asignación de equipos

Alcance acordado el 12 de noviembre de 2026 para la rama
`feat/plantillas-equipos-secciones-20261112`.

## Separación funcional

- **Gestión de atletas:** búsqueda, categoría por edad, estado y acciones
  individuales. Conserva la planilla individual; no genera plantillas colectivas.
- **Organización deportiva:** grupo de navegación propio. **Catálogos
  deportivos** administra temporadas, categorías y equipos sin asignar atletas.
- **Asignación de equipos:** solo directiva/admin. Permite asignar o cambiar un
  atleta activo y consultar su historial. La categoría por edad es orientativa.
- **Consulta de plantillas:** staff/directiva/admin. Presenta la lista exacta que
  podrá exportarse por categoría etaria o por equipo deportivo.

Esta separación evita equiparar la categoría calculada por edad con la categoría
deportiva configurable. Ninguna selección asigna automáticamente un atleta.

## Contrato de consulta

`GET /api/directiva/atletas/planilla-general` acepta exactamente uno de estos
parámetros:

- `categoria=<codigo>`: U-7, U-9, U-11, U-13 o U-15 según el catálogo público.
- `equipo=<id>`: equipo existente dentro de su categoría y temporada.

En ambos casos el servidor vuelve a consultar PostgreSQL, devuelve solo atletas
`activo` y expone únicamente nombre, apellido, cédula y fecha de nacimiento. La
consulta por equipo exige una asignación vigente (`fin_en IS NULL`); una
asignación histórica cerrada no integra la plantilla. El límite sigue siendo
1000 atletas y la respuesta usa `Cache-Control: no-store`.

La respuesta identifica el alcance y su contexto. Para equipos incluye nombre,
categoría deportiva y temporada derivados de FK; el cliente no los inventa ni
los toma del DOM.

## PDF y vista previa

La vista previa y el PDF usan la misma respuesta. El documento incluye logotipo,
alcance, temporada/categoría cuando corresponda, fecha civil de Caracas, total,
nombre completo, cédula y nacimiento. No contiene representantes, contacto,
documentos, información médica ni pagos.

La búsqueda y los filtros de Gestión de atletas no alteran estas plantillas. Una
plantilla vacía se muestra como tal y no habilita la descarga.

## Base de datos y permisos

No requiere migración nueva. Reutiliza `temporadas_deportivas`,
`categorias_deportivas`, `equipos_deportivos` y `asignaciones_equipos` ya
aplicadas. Consultar/exportar mantiene los roles previos
staff/directiva/admin; asignar o cambiar permanece restringido a
directiva/admin.

## Validación manual de Preview

1. Confirmar que Gestión de atletas ya no contiene el botón de planilla colectiva.
2. Confirmar que Organización deportiva contiene únicamente los tres catálogos.
3. Abrir Asignación de equipos: dos filas alineadas, resumen compacto, botón al
   final e historial del atleta; staff no debe ver esa entrada del menú.
4. En Consulta de plantillas elegir U-9, consultar y generar el PDF.
5. Cambiar a Equipo deportivo, elegir un equipo bajo su temporada, comprobar la
   vista previa y generar el PDF. Debe incluir solo miembros activos vigentes.
6. Comprobar alcance vacío, escritorio y móvil. No mover atletas reales solo
   para probar.

El propietario fusionó el PR #48 y validó visualmente en Production las tres
secciones, la navegación, la asignación, la consulta y los catálogos.

## Cierre de UX

La rama `fix/ux-final-organizacion-deportiva-20261112` no cambia reglas, API ni
base de datos. En asignación distingue de forma explícita «Equipo actual»,
«Asignar equipo» y «Cambiar equipo», y muestra el progreso al actualizar o
guardar. Consulta de plantillas muestra progreso al consultar/generar; en móvil
presenta cada atleta como ficha y en escritorio mantiene encabezado visible en
listados largos.

Los listados de catálogos tienen altura acotada. Al seleccionar una temporada,
la tarjeta de categorías muestra solo sus categorías; al seleccionar una
categoría, la tarjeta de equipos muestra solo sus equipos. Sin selección se
mantiene la vista completa y los contadores globales no cambian. Es un filtro
visual: no elimina, archiva ni modifica registros.

## Evidencia local

El 12 de noviembre de 2026 pasaron 7/7 pruebas con PostgreSQL 18 desechable en
el PR #48, 16/16 pruebas específicas de asignaciones, catálogos, consulta y PDF
en Chromium para el cierre de UX, y 64/64 regresiones generales de interfaz y
sesiones. Se probaron escritorio y móvil. El PR #48 sí fue validado en
Production por el propietario; el cierre de UX aún requiere revisión de su
propio Preview.
