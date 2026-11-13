-- PR #56 — caché persistente de referencias por día, compartida entre
-- todas las instancias de Vercel. Solo datos de proveedores externos.
-- IMPORTANTE: ejecutar manualmente tras respaldo y comprobaciones de esquema.
-- No modifica pagos, obligaciones, conceptos ni tasas_cobro existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS referencias_cambio_diarias (
    fecha_consulta DATE NOT NULL,
    proveedor VARCHAR(32) NOT NULL
        CHECK (proveedor IN ('bcv_republicacion', 'exchangerate_api')),
    fecha_referencia DATE NOT NULL,
    usd_ves NUMERIC(18,6) NOT NULL
        CHECK (usd_ves > 0 AND usd_ves <= 999999999),
    eur_ves NUMERIC(18,6) NOT NULL
        CHECK (eur_ves > 0 AND eur_ves <= 999999999),
    capturado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (fecha_consulta, proveedor)
);

COMMENT ON TABLE referencias_cambio_diarias IS
'Referencias externas cacheadas, NO tasas de cobro. BCV republicado por bcv.today; ExchangeRate-API es referencia comercial. La Directiva publica la tasa de cobro tras confirmarla.';

COMMIT;
