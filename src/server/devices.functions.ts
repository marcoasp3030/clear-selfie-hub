import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).optional(),
  apiBaseUrl: z
    .string()
    .trim()
    .min(8)
    .max(255)
    .url("URL inválida")
    .refine((u) => /^https?:\/\//i.test(u), "URL deve começar com http:// ou https://"),
});

export type DeviceRow = {
  id: string;
  name: string;
  slug: string;
  api_base_url: string;
  created_at: string;
};

async function ensureAdmin(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) {
    throw new Error("forbidden");
  }
}

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("devices")
      .select("id,name,slug,api_base_url,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { devices: (data ?? []) as DeviceRow[] };
  });

export const createDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

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
        created_by: context.userId,
      })
      .select("id,name,slug,api_base_url,created_at")
      .single();
    if (error || !inserted) {
      return { success: false as const, error: "insert_failed" as const };
    }
    return { success: true as const, device: inserted as DeviceRow };
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
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