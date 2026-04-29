ALTER TABLE public.devices
  ADD COLUMN api_login text,
  ADD COLUMN api_password text;

ALTER TABLE public.registrations
  ADD COLUMN device_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN device_sync_user_id integer,
  ADD COLUMN device_sync_error text,
  ADD COLUMN device_sync_attempted_at timestamptz;

-- Allow admins to update registrations (for retry sync status)
CREATE POLICY "Admins can update registrations"
ON public.registrations
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());