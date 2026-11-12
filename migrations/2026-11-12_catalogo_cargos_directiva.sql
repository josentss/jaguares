-- PR #55: permitir conceptos manuales nuevos sin tocar pagos ni obligaciones.
-- Migración MANUAL después de backup/preflight; no ejecutar desde Node/Vercel.
-- Los cinco conceptos de sistema permanecen reconocibles e inalterados.
BEGIN;

ALTER TABLE public.conceptos_cobro
    DROP CONSTRAINT IF EXISTS conceptos_cobro_codigo_check;
ALTER TABLE public.conceptos_cobro
    ADD CONSTRAINT conceptos_cobro_codigo_check
    CHECK (
        codigo IN ('inscripcion', 'mensualidad', 'torneo', 'arbitraje', 'sancion')
        OR codigo ~ '^personalizado_[a-f0-9]{16}$'
    );

ALTER TABLE public.conceptos_cobro
    DROP CONSTRAINT IF EXISTS conceptos_cobro_modalidad;
ALTER TABLE public.conceptos_cobro
    ADD CONSTRAINT conceptos_cobro_modalidad
    CHECK (
        (codigo = 'inscripcion' AND modalidad = 'unica')
        OR (codigo = 'mensualidad' AND modalidad = 'mensual')
        OR (codigo IN ('torneo', 'arbitraje', 'sancion') AND modalidad = 'manual')
        OR (codigo ~ '^personalizado_[a-f0-9]{16}$' AND modalidad = 'manual')
    );

CREATE UNIQUE INDEX IF NOT EXISTS conceptos_cobro_nombre_unico
    ON public.conceptos_cobro (lower(btrim(nombre)));

COMMIT;
