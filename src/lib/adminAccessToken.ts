import { supabase } from "@/integrations/supabase/client";

/**
 * Sentinel usado quando o admin esta autenticado via JWT proprio (cookie
 * httpOnly). O servidor reconhece e valida pelo cookie, sem precisar do
 * access token do Supabase.
 */
export const LOCAL_ACCESS_TOKEN_SENTINEL = "__local_jwt__";

/**
 * Retorna um access token utilizavel pelas server functions admin.
 * Prefere a sessao Supabase (legado) e cai para o sentinel JWT local.
 */
export async function requireAdminAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  // Sem sessao Supabase -> assume JWT local em cookie. O servidor valida.
  return LOCAL_ACCESS_TOKEN_SENTINEL;
}
