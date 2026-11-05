-- Aplicar y revisar por separado antes de desplegar el código que usa hora_evento.
-- Los eventos históricos conservan NULL; los nuevos se validan en Express.
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS hora_evento TIME WITHOUT TIME ZONE;
