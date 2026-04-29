CREATE TABLE public.uazapi_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  instance_token text,
  instance_id text,
  status text NOT NULL DEFAULT 'disconnected',
  phone_connected text,
  owner_jid text,
  profile_name text,
  last_qr_at timestamptz,
  last_status_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.uazapi_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view uazapi instances"
  ON public.uazapi_instances FOR SELECT
  TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can insert uazapi instances"
  ON public.uazapi_instances FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update uazapi instances"
  ON public.uazapi_instances FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete uazapi instances"
  ON public.uazapi_instances FOR DELETE
  TO authenticated USING (public.is_admin());