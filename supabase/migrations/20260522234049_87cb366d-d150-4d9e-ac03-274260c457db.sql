ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS cpf_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_duplicate_phone boolean NOT NULL DEFAULT false;