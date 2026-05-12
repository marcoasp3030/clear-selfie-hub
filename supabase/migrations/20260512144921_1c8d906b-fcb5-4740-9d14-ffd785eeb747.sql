CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view app_settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert app_settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update app_settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete app_settings"
  ON public.app_settings FOR DELETE TO authenticated
  USING (public.is_admin());