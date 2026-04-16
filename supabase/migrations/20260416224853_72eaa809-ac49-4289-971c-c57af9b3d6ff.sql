ALTER TABLE public.registrations ADD COLUMN device_fingerprint TEXT;
CREATE INDEX IF NOT EXISTS registrations_device_fingerprint_idx ON public.registrations(device_fingerprint);