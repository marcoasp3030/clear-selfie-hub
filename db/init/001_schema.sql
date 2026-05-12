-- =========================================================================
-- Schema Postgres da Nutricar (substitui o Supabase no cutover da VPS)
-- Postgres 14+ (gen_random_uuid esta disponivel via pgcrypto)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----- Usuarios admin (substitui auth.users do Supabase) ----------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                 -- bcrypt
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- Cadastros faciais ------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name               TEXT NOT NULL,
  last_name                TEXT NOT NULL,
  phone                    TEXT NOT NULL,
  cpf                      TEXT,
  photo_path               TEXT NOT NULL,
  ip_address               TEXT,
  user_agent               TEXT,
  device_os                TEXT,
  device_browser           TEXT,
  device_model             TEXT,
  device_platform          TEXT,
  device_language          TEXT,
  device_timezone          TEXT,
  screen_resolution        TEXT,
  device_fingerprint       TEXT,
  device_id                UUID,
  device_sync_status       TEXT NOT NULL DEFAULT 'pending',
  device_sync_user_id      INTEGER,
  device_sync_error        TEXT,
  device_sync_attempted_at TIMESTAMPTZ,
  geo_city                 TEXT,
  geo_region               TEXT,
  geo_country              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_phone      ON registrations (phone);

-- ----- Verificacoes WhatsApp/SMS ----------------------------------------
CREATE TABLE IF NOT EXISTS phone_verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        TEXT NOT NULL,
  code_hash    TEXT NOT NULL,
  verify_token TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  ip_address   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications (phone);

-- ----- Equipamentos ControlID -------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  api_base_url TEXT NOT NULL,
  api_login    TEXT,
  api_password TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- Diagnosticos de camera -------------------------------------------
CREATE TABLE IF NOT EXISTS camera_diagnostics_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_agent        TEXT,
  platform          TEXT,
  browser           TEXT,
  in_app_browser    BOOLEAN NOT NULL DEFAULT false,
  in_iframe         BOOLEAN NOT NULL DEFAULT false,
  is_secure_context BOOLEAN NOT NULL DEFAULT true,
  device_id         UUID,
  results           JSONB NOT NULL,
  likely_cause      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- Instancias uazapi ------------------------------------------------
CREATE TABLE IF NOT EXISTS uazapi_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  instance_id     TEXT,
  instance_token  TEXT,
  status          TEXT NOT NULL DEFAULT 'disconnected',
  phone_connected TEXT,
  profile_name    TEXT,
  owner_jid       TEXT,
  last_qr_at      TIMESTAMPTZ,
  last_status_at  TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- Tentativas de envio (SMS / WhatsApp) -----------------------------
CREATE TABLE IF NOT EXISTS message_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel             TEXT NOT NULL CHECK (channel IN ('sms','whatsapp')),
  provider            TEXT,
  phone               TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('sent','failed')),
  error               TEXT,
  provider_message_id TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_attempts_created_at
  ON message_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_attempts_phone
  ON message_attempts (phone);
