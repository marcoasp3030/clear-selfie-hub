import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const accessTokenSchema = z.string().trim().min(1);

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

// Helper: throws Response 403 if the user isn't an admin.
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

export const listRegistrations = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; search?: string; limit?: number; offset?: number }) => {
      const parsed = z
        .object({
          accessToken: accessTokenSchema,
          search: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .parse(input);

      return {
        accessToken: parsed.accessToken,
        search: parsed.search?.trim() || "",
        limit: Math.min(Math.max(parsed.limit ?? 50, 1), 200),
        offset: Math.max(parsed.offset ?? 0, 0),
      };
    }
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);

    let query = supabaseAdmin
      .from("registrations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term}`
      );
    }

    const { data: rows, error, count } = await query;
    if (error) {
      console.error("List failed:", error);
      throw new Response("Internal error", { status: 500 });
    }

    return { rows: rows ?? [], total: count ?? 0 };
  });

export const getRegistrationStats = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const [totalRes, todayRes, weekRes] = await Promise.all([
      supabaseAdmin
        .from("registrations")
        .select("id", { count: "exact", head: true }),
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
  });

export const getPhotoSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; path: string }) =>
    z
      .object({
        accessToken: accessTokenSchema,
        path: z.string().trim().min(1).max(512),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);

    const { data: signed, error } = await supabaseAdmin.storage
      .from("registration-photos")
      .createSignedUrl(data.path, 60 * 60); // 1 hour

    if (error || !signed) {
      console.error("Signed URL failed:", error);
      throw new Response("Internal error", { status: 500 });
    }

    return { url: signed.signedUrl };
  });

export const deleteRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: string }) =>
    z
      .object({
        accessToken: accessTokenSchema,
        id: z.string().uuid(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);

    // Fetch photo path first so we can clean up storage
    const { data: row, error: fetchError } = await supabaseAdmin
      .from("registrations")
      .select("photo_path")
      .eq("id", data.id)
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
      .eq("id", data.id);

    if (deleteError) {
      console.error("Delete failed:", deleteError);
      throw new Response("Internal error", { status: 500 });
    }

    if (row.photo_path) {
      await supabaseAdmin.storage
        .from("registration-photos")
        .remove([row.photo_path]);
    }

    return { success: true as const };
  });

export const checkAdminAccess = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data: payload }) => {
    let userId: string;

    try {
      userId = await getUserIdFromAccessToken(payload.accessToken);
    } catch {
      return { isAdmin: false };
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
      return { isAdmin: false };
    }
    return { isAdmin: !!roleRow };
  });
