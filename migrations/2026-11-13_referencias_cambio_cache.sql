-- PR #56 — caché persistente de referencias por día, compartida entre
-- todas las instancias de Vercel. Solo datos de proveedores externos.
-- IMPORTANTE: ejecutar manualmente tras respaldo y comprobaciones de esquema.
-- No modifica pagos, obligaciones, conceptos ni tasas_cobro existentes.
BEGIN;

-- Reforzar en DB el límite aplicado en backend/UI a nuevas tarifas.
-- Preflight: todos los montos actuales deben estar entre 0.01 y 999.99 USD.
DO $
BEGIN
    IF EXISTS (SELECT 1 FROM conceptos_cobro
        WHERE monto_referencia_usd < 0.01 OR monto_referencia_usd > 999.99)
    THEN
        RAISE EXCEPTION 'Existen tarifas fuera del rango USD 0.01 a 999.99; revisar antes de migrar';
    END IF;
END $;
ALTER TABLE conceptos_cobro
    DROP CONSTRAINT IF EXISTS conceptos_cobro_precio_max_999;
ALTER TABLE conceptos_cobro
    ADD CONSTRAINT conceptos_cobro_precio_max_999
    CHECK (monto_referencia_usd >= 0.01 AND monto_referencia_usd <= 999.99);

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
