import { db } from "./db.server";
import { supabaseAdmin } from "./supabaseAdmin.server";
import { getDataBackend } from "./registrationsRepo.server";

export type UazapiInstanceRow = {
  id: string;
  name: string;
  instance_id: string | null;
  instance_token: string | null;
  status: string;
  phone_connected: string | null;
  profile_name: string | null;
  owner_jid: string | null;
  last_qr_at: string | null;
  last_status_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, name, instance_id, instance_token, status, phone_connected, profile_name, owner_jid, last_qr_at, last_status_at, created_by, created_at, updated_at";

export async function getLatestInstance(): Promise<UazapiInstanceRow | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<UazapiInstanceRow>(
      `SELECT id::text, name, instance_id, instance_token, status, phone_connected,
              profile_name, owner_jid,
              last_qr_at::text, last_status_at::text, created_by::text,
              created_at::text, updated_at::text
         FROM uazapi_instances
        ORDER BY created_at DESC
        LIMIT 1`,
    );
    return rows[0] ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("uazapi_instances")
    .select(COLS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UazapiInstanceRow | null) ?? null;
}

export async function getActiveInstanceTokenOrNull(): Promise<string | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ instance_token: string | null }>(
      `SELECT instance_token FROM uazapi_instances
        ORDER BY created_at DESC LIMIT 1`,
    );
    return rows[0]?.instance_token ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("uazapi_instances")
    .select("instance_token")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.instance_token as string | undefined) ?? null;
}

export async function deleteInstanceById(id: string): Promise<void> {
  if (getDataBackend() === "pg") {
    await db.query(`DELETE FROM uazapi_instances WHERE id = $1`, [id]);
    return;
  }
  const { error } = await supabaseAdmin
    .from("uazapi_instances")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertInstance(input: {
  name: string;
  instance_token: string;
  instance_id: string | null;
  status: string;
  created_by: string | null;
}): Promise<UazapiInstanceRow> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<UazapiInstanceRow>(
      `INSERT INTO uazapi_instances (name, instance_token, instance_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id::text, name, instance_id, instance_token, status, phone_connected,
                 profile_name, owner_jid,
                 last_qr_at::text, last_status_at::text, created_by::text,
                 created_at::text, updated_at::text`,
      [
        input.name,
        input.instance_token,
        input.instance_id,
        input.status,
        input.created_by,
      ],
    );
    return rows[0];
  }
  const { data, error } = await supabaseAdmin
    .from("uazapi_instances")
    .insert(input)
    .select(COLS)
    .single();
  if (error || !data) throw error ?? new Error("insert falhou");
  return data as UazapiInstanceRow;
}

export type UazapiUpdate = Partial<{
  status: string;
  last_status_at: string;
  last_qr_at: string;
  updated_at: string;
  owner_jid: string | null;
  phone_connected: string | null;
  profile_name: string;
  instance_id: string;
  instance_token: string;
}>;

export async function updateInstance(
  id: string,
  patch: UazapiUpdate,
): Promise<void> {
  const keys = Object.keys(patch);
  if (!keys.length) return;

  if (getDataBackend() === "pg") {
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const values = keys.map((k) => (patch as Record<string, unknown>)[k]);
    await db.query(
      `UPDATE uazapi_instances SET ${sets} WHERE id = $1`,
      [id, ...values],
    );
    return;
  }
  const { error } = await supabaseAdmin
    .from("uazapi_instances")
    .update(patch)
    .eq("id", id);
  if (error) console.error("updateInstance error:", error);
}