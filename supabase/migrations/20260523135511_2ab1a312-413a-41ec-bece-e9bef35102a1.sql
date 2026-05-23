
-- 1. Devices: restrict public SELECT to admins
DROP POLICY IF EXISTS "Public can view devices by slug" ON public.devices;
CREATE POLICY "Admins can view devices"
  ON public.devices FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 2. Registrations: remove permissive public INSERT (server uses service role)
DROP POLICY IF EXISTS "Public can insert registrations" ON public.registrations;

-- 3. Storage: remove public upload policy on registration-photos
DROP POLICY IF EXISTS "Public can upload registration photos" ON storage.objects;

-- 4. Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
