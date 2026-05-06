import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabaseAdmin.server";
import type { Database } from "@/integrations/supabase/types";
import { getCookie } from "@tanstack/react-start/server";
import { AUTH_COOKIE_NAME, verifyAdminToken } from "./auth.server";
import {
  deleteRegistrationRow,
  getStats,
  listRegistrations,
} from "./registrationsRepo.server";
import { deletePhoto, getPhotoAccessUrl } from "./storage.server";

export const LOCAL_ACCESS_TOKEN_SENTINEL = "__local_jwt__";

function tryLocalAdminFromCookie(): string | null {
  const token = getCookie(AUTH_COOKIE_NAME);
  if (!token) return null;
  const user = verifyAdminToken(token);
  return user ? user.id : null;
}

function createAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Response("Internal error", { status: 500 });
  }

  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let authClient: ReturnType<typeof createAuthClient> | undefined;

async function getUserIdFromAccessToken(accessToken: string) {
  if (!authClient) authClient = createAuthClient();

  const { data, error } = await authClient.auth.getClaims(accessToken);

  if (error || !data?.claims?.sub) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return data.claims.sub;
}

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Role check failed:", error);
    throw new Response("Internal error", { status: 500 });
  }
  if (!data) {
    throw new Response("Forbidden: admin role required", { status: 403 });
  }
}

export async function assertAdminAccess(accessToken: string) {
  // Caminho novo: cookie httpOnly com JWT proprio (Etapa 2 da migracao VPS).
  if (accessToken === LOCAL_ACCESS_TOKEN_SENTINEL || !accessToken) {
    const localUserId = tryLocalAdminFromCookie();
    if (localUserId) return localUserId;
    if (accessToken === LOCAL_ACCESS_TOKEN_SENTINEL) {
      throw new Response("Unauthorized", { status: 401 });
    }
  }
  // Caminho legado (Supabase Auth) — mantido durante o cutover.
  const userId = await getUserIdFromAccessToken(accessToken);
  await assertAdmin(userId);
  return userId;
}

export async function checkIsAdminByAccessToken(accessToken: string) {
  if (accessToken === LOCAL_ACCESS_TOKEN_SENTINEL || !accessToken) {
    const localUserId = tryLocalAdminFromCookie();
    if (localUserId) return true;
    if (accessToken === LOCAL_ACCESS_TOKEN_SENTINEL) return false;
  }

  let userId: string;

  try {
    userId = await getUserIdFromAccessToken(accessToken);
  } catch {
    return false;
  }

  const { data: roleRow, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Admin check failed:", error);
    return false;
  }

  return Boolean(roleRow);
}

export async function listRegistrationRows(input: {
  accessToken: string;
  search: string;
  limit: number;
  offset: number;
}) {
  await assertAdminAccess(input.accessToken);
  try {
    return await listRegistrations({
      search: input.search,
      limit: input.limit,
      offset: input.offset,
    });
  } catch (err) {
    console.error("List failed:", err);
    throw new Response("Internal error", { status: 500 });
  }
}

export async function getRegistrationStatsData(accessToken: string) {
  await assertAdminAccess(accessToken);
  try {
    return await getStats();
  } catch (err) {
    console.error("Stats failed:", err);
    throw new Response("Internal error", { status: 500 });
  }
}

export async function getPhotoSignedUrlForPath(accessToken: string, path: string) {
  await assertAdminAccess(accessToken);
  try {
    const url = await getPhotoAccessUrl(path);
    return { url };
  } catch (err) {
    console.error("Signed URL failed:", err);
    throw new Response("Internal error", { status: 500 });
  }
}

export async function deleteRegistrationById(accessToken: string, id: string) {
  await assertAdminAccess(accessToken);
  try {
    const { photo_path } = await deleteRegistrationRow(id);
    if (photo_path) await deletePhoto(photo_path).catch(() => {});
    return { success: true as const };
  } catch (err) {
    console.error("Delete failed:", err);
    throw new Response("Internal error", { status: 500 });
  }
}