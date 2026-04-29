CREATE TABLE public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX phone_verifications_phone_idx ON public.phone_verifications (phone, created_at DESC);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- No client (anon/authenticated) can read or write directly.
-- All access goes through server functions using the service role.
CREATE POLICY "No direct access to phone_verifications"
  ON public.phone_verifications
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);