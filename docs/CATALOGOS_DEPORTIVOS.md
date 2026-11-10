# Catálogos deportivos — PR funcional

El módulo **Organización Deportiva** permite al personal de directiva, staff o administración:
crear y renombrar **temporadas**, **categorías dentro de una temporada** y **equipos dentro de una categoría**.

No existen asignaciones automáticas por edad, sexo, nivel ni rendimiento; tampoco plantillas de atletas,
transferencias, bajas de equipos, categorías predefinidas o fechas de temporada. No inferir esas reglas.
La siguiente etapa será la asignación **manual** de atletas a equipos con reglas aprobadas por el club.

## Migración (REQUERIDA para usar el módulo)

Archivo versionado: `migrations/2026-11-10_catalogos_deportivos.sql`.

- No la aplica Vercel ni el código de Node.js automáticamente.
- Crea únicamente tres tablas nuevas con FK `ON DELETE RESTRICT`, índices únicos que ignoran mayúsculas
  para nombres dentro de su jerarquía, y metadatos de creación. No altera `usuarios`, `atletas`,
  `pagos` ni columnas existentes. Es repetible (`IF NOT EXISTS`) **solo respecto a objetos del mismo diseño**;
  no debe considerarse una herramienta para reconciliar esquemas divergentes.
- Primero revisar y respaldar la base destino. Preferir una base Preview aislada. **Si el Preview reutiliza
  Supabase de Production, aplicar la migración también modifica el esquema de esa base compartida.**
  Exige aceptación expresa, respaldo recuperable y comprobación de la rama Vercel correcta antes de ejecutar SQL.
- En Supabase SQL Editor, confirmar `SELECT current_schema();` devuelve `public` y ejecutar el archivo
  completo, sin modificarlo ni unirlo a migraciones de otras funcionalidades. No ejecutar `DROP`, `DELETE`
  ni `TRUNCATE`.
- Validación de solo lectura después de aplicar:

```sql
SELECT
    to_regclass('public.temporadas_deportivas') IS NOT NULL AS temporadas,
    to_regclass('public.categorias_deportivas') IS NOT NULL AS categorias,
    to_regclass('public.equipos_deportivos') IS NOT NULL AS equipos;
```

## Endpoints privados

`GET /api/directiva/deportes/catalogo`: tres arrays sin datos de menores.
`POST /api/directiva/deportes/temporadas` → `{nombre}`.
`POST /api/directiva/deportes/categorias` → `{nombre, id_temporada}`.
`POST /api/directiva/deportes/equipos` → `{nombre, id_categoria}`.
`PUT /api/directiva/deportes/:tipo/:id` → `{nombre}`, donde `:tipo` es `temporadas`, `categorias` o `equipos`.

Los tipos son una lista cerrada, las entradas se validan en backend, se utilizan consultas SQL
parametrizadas y el prefijo `/api/directiva` comprueba sesión y rol. No existe endpoint de borrado.

## Ensayo manual de Preview (sin manipular atletas existentes)

1. Confirmar que el Preview usa el commit del PR y las variables de sesión y BD de la rama,
   no el dominio Production. Aplicar la migración **solo si el destino está respaldado y autorizado**.
2. Directiva → **Organización Deportiva**: crear una temporada ficticia, luego una categoría
   en esa temporada y un equipo en esa categoría. Confirmar los tres en las listas.
3. Cambiar el nombre del equipo usando «Editar», guardar y recargar la página: el nombre persiste
   y su categoría no cambia.
4. Intentar registrar de nuevo la misma temporada con diferentes mayúsculas: debe mostrarse
   error de duplicado (HTTP 409). Introducir un nombre inválido (p. ej. etiqueta HTML) debe dar HTTP 400
   incluso si se envía directamente al API.
5. En sesión de representante, `GET /api/directiva/deportes/catalogo` debe responder HTTP 403.
   Sin sesión, HTTP 401. Las secciones de atletas, pagos, eventos y planilla PDF deben continuar funcionando.
6. Abrir el panel en móvil para verificar formularios/listas, sin salirse de pantalla.

Si falla cualquiera de los pasos, no fusionar. Compartir solo códigos HTTP, mensajes y
nombres ficticios; nunca credenciales, cookies, documentos o URL firmadas.

## Verificación automática

- `tests/catalogos-deportivos-pg.test.js`: migración repetible, permisos 401/403,
  creación, jerarquía, validaciones, duplicados y renombrado con PostgreSQL desechable.
- `tests/catalogos-deportivos-ui.test.js`: formularios y navegación en Chromium escritorio/móvil
  con servidor fixture, sin datos reales.
- La CI ejecuta todas las regresiones existentes de Jaguares, incluidos Cloudinary y pagos.

**No ejecutar tests PostgreSQL apuntando a Supabase**. El helper exige
`DATABASE_URL` local a `jaguares_test`; GitHub Actions provee PostgreSQL desechable.

## Estado y siguientes pasos

Hasta validación real del Preview, el módulo es implementación propuesta y pruebas automatizadas,
no una función probada en Production. Siguiente PR: asignación manual de atletas a equipos,
con control de concurrencia y un historial mínimo por temporada, previo acuerdo de reglas
de multiequipo y movimientos. Nunca borrar históricos para corregir nombres o asignaciones.
