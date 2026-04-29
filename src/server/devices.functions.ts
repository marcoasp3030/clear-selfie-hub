import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const accessTokenSchema = z.string().trim().min(1);

const createSchema = z.object({
  accessToken: accessTokenSchema,
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).optional(),
  apiBaseUrl: z
    .string()
    .trim()
    .min(8)
    .max(255)
    .url("URL inválida")
    .refine((u) => /^https?:\/\//i.test(u), "URL deve começar com http:// ou https://"),
  apiLogin: z.string().trim().min(1).max(120),
  apiPassword: z.string().trim().min(1).max(255),
});

export type DeviceRow = {
  id: string;
  name: string;
  slug: string;
  api_base_url: string;
  api_login: string | null;
  created_at: string;
};

let authClient: ReturnType<typeof createClient<Database>> | undefined;
function getAuthClient() {
  if (!authClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Response("Internal error", { status: 500 });
    authClient = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
  }
  return authClient;
}

async function assertAdmin(accessToken: string): Promise<string> {
  const { data, error } = await getAuthClient().auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) throw new Response("Unauthorized", { status: 401 });
  const userId = data.claims.sub;
  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleErr || !roleRow) throw new Response("Forbidden", { status: 403 });
  return userId;
}

export const listDevices = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: accessTokenSchema }).parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { data: rows, error } = await supabaseAdmin
      .from("devices")
      .select("id,name,slug,api_base_url,api_login,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { devices: (rows ?? []) as DeviceRow[] };
  });

export const createDevice = createServerFn({ method: "POST" })
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const userId = await assertAdmin(data.accessToken);

    let slug = (data.slug && data.slug.length > 0 ? data.slug : slugify(data.name)).toLowerCase();
    slug = slug.replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
    if (!slugRegex.test(slug)) {
      return { success: false as const, error: "invalid_slug" as const };
    }

    const { data: existing } = await supabaseAdmin
      .from("devices")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      return { success: false as const, error: "duplicate_slug" as const };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("devices")
      .insert({
        name: data.name,
        slug,
        api_base_url: data.apiBaseUrl.replace(/\/+$/, ""),
        api_login: data.apiLogin,
        api_password: data.apiPassword,
        created_by: userId,
      })
      .select("id,name,slug,api_base_url,api_login,created_at")
      .single();
    if (error || !inserted) {
      return { success: false as const, error: "insert_failed" as const };
    }
    return { success: true as const, device: inserted as DeviceRow };
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: accessTokenSchema, id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { error } = await supabaseAdmin.from("devices").delete().eq("id", data.id);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });

// Public lookup by slug — used by the public registration page.
export const getDeviceBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ slug: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: device, error } = await supabaseAdmin
      .from("devices")
      .select("id,name,slug")
      .eq("slug", data.slug.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { device: device as { id: string; name: string; slug: string } | null };
  });