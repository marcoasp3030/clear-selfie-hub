
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  api_base_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX devices_slug_idx ON public.devices (slug);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view devices by slug"
ON public.devices
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can insert devices"
ON public.devices
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admins can update devices"
ON public.devices
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete devices"
ON public.devices
FOR DELETE
TO authenticated
USING (is_admin());

ALTER TABLE public.registrations
  ADD COLUMN device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL;

CREATE INDEX registrations_device_id_idx ON public.registrations (device_id);
