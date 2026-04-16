import { supabase } from "@/integrations/supabase/client";

export async function requireAdminAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Admin session not found");
  }

  return data.session.access_token;
}