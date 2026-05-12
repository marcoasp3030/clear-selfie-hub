CREATE TABLE IF NOT EXISTS public.message_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('sms','whatsapp')),
  provider TEXT,
  phone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed')),
  error TEXT,
  provider_message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_attempts_created_at ON public.message_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_attempts_phone ON public.message_attempts (phone);

ALTER TABLE public.message_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view message attempts"
  ON public.message_attempts FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete message attempts"
  ON public.message_attempts FOR DELETE
  TO authenticated
  USING (public.is_admin());