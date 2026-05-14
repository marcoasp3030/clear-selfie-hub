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
  cpf_validation_required: boolean;
};

export type DeviceFull = DeviceRow & { api_password: string | null };

const DEVICE_COLS =
  "id, name, slug, api_base_url, api_login, created_at, cpf_validation_required";

export async function listDevices(): Promise<DeviceRow[]> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DeviceRow>(
      `SELECT id::text, name, slug, api_base_url, api_login,
              created_at::text AS created_at, cpf_validation_required
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
): Promise<{ id: string; name: string; slug: string; cpf_validation_required: boolean } | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ id: string; name: string; slug: string; cpf_validation_required: boolean }>(
      `SELECT id::text, name, slug, cpf_validation_required FROM devices WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    return rows[0] ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, name, slug, cpf_validation_required")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string; name: string; slug: string; cpf_validation_required: boolean } | null) ?? null;
}

export async function findDeviceCredentialsBySlug(
  slug: string,
): Promise<DeviceFull | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DeviceFull>(
      `SELECT id::text, name, slug, api_base_url, api_login, api_password,
              created_at::text AS created_at, cpf_validation_required
         FROM devices WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    return rows[0] ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, name, slug, api_base_url, api_login, api_password, created_at, cpf_validation_required")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DeviceFull | null) ?? null;
}

export async function findDeviceById(id: string): Promise<DeviceFull | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DeviceFull>(
      `SELECT id::text, name, slug, api_base_url, api_login, api_password,
              created_at::text AS created_at, cpf_validation_required
         FROM devices WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, name, slug, api_base_url, api_login, api_password, created_at, cpf_validation_required")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DeviceFull | null) ?? null;
}

export async function listDevicesByName(name: string): Promise<DeviceFull[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DeviceFull>(
      `SELECT id::text, name, slug, api_base_url, api_login, api_password,
              created_at::text AS created_at, cpf_validation_required
         FROM devices
        WHERE LOWER(TRIM(name)) = LOWER($1)
        ORDER BY created_at ASC`,
      [trimmed],
    );
    return rows;
  }
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, name, slug, api_base_url, api_login, api_password, created_at, cpf_validation_required")
    .ilike("name", trimmed);
  if (error) throw new Error(error.message);
  return ((data ?? []) as DeviceFull[]).filter(
    (d) => d.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
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
  cpf_validation_required: boolean;
};

export async function insertDevice(
  input: InsertDeviceInput,
): Promise<DeviceRow | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DeviceRow>(
      `INSERT INTO devices (name, slug, api_base_url, api_login, api_password, created_by, cpf_validation_required)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text, name, slug, api_base_url, api_login,
                 created_at::text AS created_at, cpf_validation_required`,
      [
        input.name,
        input.slug,
        input.api_base_url,
        input.api_login,
        input.api_password,
        input.created_by,
        input.cpf_validation_required,
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

export type UpdateDeviceInput = {
  id: string;
  name: string;
  slug: string;
  api_base_url: string;
  api_login: string;
  // null = keep current password unchanged
  api_password: string | null;
  cpf_validation_required: boolean;
};

export async function updateDevice(
  input: UpdateDeviceInput,
): Promise<DeviceRow | null> {
  if (getDataBackend() === "pg") {
    if (input.api_password === null) {
      const { rows } = await db.query<DeviceRow>(
        `UPDATE devices
            SET name = $2, slug = $3, api_base_url = $4, api_login = $5,
                cpf_validation_required = $6
          WHERE id = $1
          RETURNING id::text, name, slug, api_base_url, api_login,
                    created_at::text AS created_at, cpf_validation_required`,
        [
          input.id,
          input.name,
          input.slug,
          input.api_base_url,
          input.api_login,
          input.cpf_validation_required,
        ],
      );
      return rows[0] ?? null;
    }
    const { rows } = await db.query<DeviceRow>(
      `UPDATE devices
          SET name = $2, slug = $3, api_base_url = $4, api_login = $5,
              api_password = $6, cpf_validation_required = $7
        WHERE id = $1
        RETURNING id::text, name, slug, api_base_url, api_login,
                  created_at::text AS created_at, cpf_validation_required`,
      [
        input.id,
        input.name,
        input.slug,
        input.api_base_url,
        input.api_login,
        input.api_password,
        input.cpf_validation_required,
      ],
    );
    return rows[0] ?? null;
  }
  const patch: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
    api_base_url: input.api_base_url,
    api_login: input.api_login,
    cpf_validation_required: input.cpf_validation_required,
  };
  if (input.api_password !== null) patch.api_password = input.api_password;
  const { data, error } = await supabaseAdmin
    .from("devices")
    .update(patch)
    .eq("id", input.id)
    .select(DEVICE_COLS)
    .single();
  if (error || !data) return null;
  return data as DeviceRow;
}

export async function slugExistsExcept(
  slug: string,
  excludeId: string,
): Promise<boolean> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM devices WHERE slug = $1 AND id <> $2) AS ok`,
      [slug, excludeId],
    );
    return Boolean(rows[0]?.ok);
  }
  const { data } = await supabaseAdmin
    .from("devices")
    .select("id")
    .eq("slug", slug)
    .neq("id", excludeId)
    .maybeSingle();
  return Boolean(data);
}