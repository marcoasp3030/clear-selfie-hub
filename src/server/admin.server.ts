import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabaseAdmin.server";
import type { Database } from "@/integrations/supabase/types";

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
  const userId = await getUserIdFromAccessToken(accessToken);
  await assertAdmin(userId);
  return userId;
}

export async function checkIsAdminByAccessToken(accessToken: string) {
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

  let query = supabaseAdmin
    .from("registrations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (input.search) {
    const term = `%${input.search}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term}`,
    );
  }

  const { data: rows, error, count } = await query;
  if (error) {
    console.error("List failed:", error);
    throw new Response("Internal error", { status: 500 });
  }

  return { rows: rows ?? [], total: count ?? 0 };
}

export async function getRegistrationStatsData(accessToken: string) {
  await assertAdminAccess(accessToken);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [totalRes, todayRes, weekRes] = await Promise.all([
    supabaseAdmin.from("registrations").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString()),
    supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
  ]);

  return {
    total: totalRes.count ?? 0,
    today: todayRes.count ?? 0,
    week: weekRes.count ?? 0,
  };
}

export async function getPhotoSignedUrlForPath(accessToken: string, path: string) {
  await assertAdminAccess(accessToken);

  const { data: signed, error } = await supabaseAdmin.storage
    .from("registration-photos")
    .createSignedUrl(path, 60 * 60);

  if (error || !signed) {
    console.error("Signed URL failed:", error);
    throw new Response("Internal error", { status: 500 });
  }

  return { url: signed.signedUrl };
}

export async function deleteRegistrationById(accessToken: string, id: string) {
  await assertAdminAccess(accessToken);

  const { data: row, error: fetchError } = await supabaseAdmin
    .from("registrations")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("Fetch before delete failed:", fetchError);
    throw new Response("Internal error", { status: 500 });
  }
  if (!row) {
    return { success: true as const };
  }

  const { error: deleteError } = await supabaseAdmin
    .from("registrations")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Delete failed:", deleteError);
    throw new Response("Internal error", { status: 500 });
  }

  if (row.photo_path) {
    await supabaseAdmin.storage.from("registration-photos").remove([row.photo_path]);
  }

  return { success: true as const };
}