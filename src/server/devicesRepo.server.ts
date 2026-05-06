import { db } from "./db.server";
import { supabaseAdmin } from "./supabaseAdmin.server";
import { getDataBackend } from "./registrationsRepo.server";

export type DeviceRow = {
  id: string;
  name: string;
  slug: string;
  api_base_url: string;
  api_login: string | null;
  created_at: string;
};

export type DeviceFull = DeviceRow & { api_password: string | null };

const DEVICE_COLS =
  "id, name, slug, api_base_url, api_login, created_at";

export async function listDevices(): Promise<DeviceRow[]> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DeviceRow>(
      `SELECT id::text, name, slug, api_base_url, api_login,
              created_at::text AS created_at
         FROM devices
        ORDER BY created_at DESC`,
    );
    return rows;
  }
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select(DEVICE_COLS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DeviceRow[];
}

export async function findDeviceBySlug(
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ id: string; name: string; slug: string }>(
      `SELECT id::text, name, slug FROM devices WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    return rows[0] ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string; name: string; slug: string } | null) ?? null;
}

export async function findDeviceCredentialsBySlug(
  slug: string,
): Promise<DeviceFull | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DeviceFull>(
      `SELECT id::text, name, slug, api_base_url, api_login, api_password,
              created_at::text AS created_at
         FROM devices WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    return rows[0] ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, name, slug, api_base_url, api_login, api_password, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DeviceFull | null) ?? null;
}

export async function findDeviceById(id: string): Promise<DeviceFull | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DeviceFull>(
      `SELECT id::text, name, slug, api_base_url, api_login, api_password,
              created_at::text AS created_at
         FROM devices WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, name, slug, api_base_url, api_login, api_password, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DeviceFull | null) ?? null;
}

export async function slugExists(slug: string): Promise<boolean> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM devices WHERE slug = $1) AS ok`,
      [slug],
    );
    return Boolean(rows[0]?.ok);
  }
  const { data } = await supabaseAdmin
    .from("devices")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return Boolean(data);
}

export type InsertDeviceInput = {
  name: string;
  slug: string;
  api_base_url: string;
  api_login: string;
  api_password: string;
  created_by: string | null;
};

export async function insertDevice(
  input: InsertDeviceInput,
): Promise<DeviceRow | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DeviceRow>(
      `INSERT INTO devices (name, slug, api_base_url, api_login, api_password, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id::text, name, slug, api_base_url, api_login,
                 created_at::text AS created_at`,
      [
        input.name,
        input.slug,
        input.api_base_url,
        input.api_login,
        input.api_password,
        input.created_by,
      ],
    );
    return rows[0] ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("devices")
    .insert(input)
    .select(DEVICE_COLS)
    .single();
  if (error || !data) return null;
  return data as DeviceRow;
}

export async function deleteDevice(id: string): Promise<{ error?: string }> {
  if (getDataBackend() === "pg") {
    await db.query(`DELETE FROM devices WHERE id = $1`, [id]);
    return {};
  }
  const { error } = await supabaseAdmin.from("devices").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}