ALTER TABLE public.phone_verifications
  ADD COLUMN IF NOT EXISTS verify_token text;

CREATE UNIQUE INDEX IF NOT EXISTS phone_verifications_verify_token_key
  ON public.phone_verifications (verify_token)
  WHERE verify_token IS NOT NULL;