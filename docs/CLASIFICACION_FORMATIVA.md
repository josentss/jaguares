# Clasificación formativa por edad y UX deportiva

## Alcance del PR

El panel de representante y el de directiva calculan automáticamente una **categoría orientativa** al
introducir `fecha_nac` durante el registro del atleta. No existe selector editable de categoría:
la clasificación real en la respuesta del API se vuelve a calcular en el **backend** desde la fecha,
sin aceptar un código de categoría enviado por el navegador.

La categoría orientativa también se muestra en los listados y en la planilla del atleta. **No se añade
una columna a Supabase**, ni se inserta una pertenencia a una `categorias_deportivas` o
`equipos_deportivos`. La edad y el resultado se calculan al consultar, así que cambian con el cumpleaños.
Las reglas son de información deportiva general, no de elegibilidad federativa, y no modifican el
estado `activo/espera/inactivo`.

### Rangos publicados en `public/index.html`

| Código | Categoría | Edad cumplida |
| --- | --- | --- |
| u7 | U-7 Semillitas | 5–7 |
| u9 | U-9 Iniciación | 8–9 |
| u11 | U-11 Formación | 10–11 |
| u13 | U-13 Mini Voleibol | 12–13 |
| u15 | U-15 Infantil (M) | 14–15 — **solo modalidad masculina según la portada** |

- El cálculo usa **edad cumplida en la fecha civil actual de Venezuela (America/Caracas)**,
  no únicamente la diferencia de años de nacimiento. Ejemplo: si cumple ocho años mañana,
  hoy pertenece todavía al rango 5–7. No existen reglas de corte por año de temporada todavía.
- U-15 se muestra con `requiere_validacion` y NO confirma elegibilidad porque el registro de atletas
  no contiene un atributo de modalidad/género verificado.
- La inscripción admite hasta 18 años pero la portada solo define categorías hasta 15.
  De 16–18 se muestra `sin_categoria_publicada`, nunca se crea una categoría ficticia.
- El módulo compartido `public/admin/categorias-formativas.js` contiene la única tabla de rangos.
  Tests la comparan con el texto de las tarjetas públicas para evitar desalineación.

### UX

- Ambos formularios incluyen tarjeta de resultado con mensajes claros y anuncio accesible,
  sin depender de selección manual ni escritura de `categoria` en FormData.
- En los listados aparece la categoría orientativa; en directiva también figura en la planilla PDF.
- Organización Deportiva (PR #39) recibe cabecera de sección, contadores reales,
  numeración de pasos, mejora de jerarquía, campos accesibles y estilos adaptables a móvil.
- CSS y JavaScript nuevos son módulos separados: no se reescribe el HTML monolítico ni se afecta
  la autorización, pagos, Cloudinary ni eventos.

## Cómo probar en Preview (sin SQL ni registros nuevos)

1. Abrir el Preview del PR, con la rama correcta, como representante y directiva.
2. En sus formularios de inscripción, introducir una fecha con edad cumplida de 10 años:
   debe aparecer «U-11 Formación». Cambiar por una fecha de 8 años: «U-9 Iniciación».
3. Con fecha de 14/15 años, aparece U-15 (M) **con advertencia de elegibilidad**; con 17 años
   «Pendiente de clasificación», ya que la portada no publica un grupo para esa edad.
4. Comprobar que no hay selector de categoría y que los campos existentes de inscripción funcionan.
   No es necesario enviar una inscripción nueva para verificar el cálculo.
5. Verificar en listados y planilla que las categorías se muestran sin exponer datos ajenos.
6. Abrir Organización Deportiva en computadora y móvil, comprobar los contadores y que los catálogos
   del PR #39 siguen permitiendo crear y renombrar.
7. Una verificación breve de calendario, pagos y documentos existentes completa la regresión.

## Qué no se incluye

- Asignación a temporada activa o a equipo: requiere una decisión explícita sobre año/corte
  de edad deportivo y sobre elegibilidad de U-15 masculina, además de las edades superiores a 15.
- Cambios masivos de atletas históricos, backfill, nuevas tablas, migración SQL o cambios de estado.
- Modificaciones de `public/index.html`: sus tarjetas son el contrato visible comparado por tests.

## Verificación automatizada

- `tests/categorias-formativas.test.js`: límites exactos en cumpleaños, coherencia con portada,
  U-15 condicionada, 16–18 sin categoría y fechas inválidas.
- `tests/catalogos-deportivos-ui.test.js`: previsualización de edades y nuevo aspecto del panel
  en Chromium, manteniendo pruebas previas de CRUD de catálogo.
- Se ejecuta la batería de regresión de GitHub Actions.

**No confundir categoría por edad mostrada con membresía en un equipo**: la segunda debe ser
una funcionalidad independiente con decisiones deportivas acordadas.
