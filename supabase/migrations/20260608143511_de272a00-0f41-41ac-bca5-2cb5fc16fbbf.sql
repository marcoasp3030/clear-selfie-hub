-- Fix security issues for handle_new_user_profile
ALTER FUNCTION public.handle_new_user_profile() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon;

-- Add RLS policies for user_roles to allow admins to manage them
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all user roles" ON public.user_roles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Also allow users to see their own role
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
