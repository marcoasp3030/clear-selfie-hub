import { db } from "./db.server";
import { supabaseAdmin } from "./supabaseAdmin.server";
import { getDataBackend } from "./registrationsRepo.server";

let ensuredAppSettingsTable = false;
async function ensureAppSettingsTable(): Promise<void> {
  if (ensuredAppSettingsTable) return;
  if (getDataBackend() !== "pg") {
    ensuredAppSettingsTable = true;
    return;
  }
  try {
    await db.query(
      `CREATE TABLE IF NOT EXISTS app_settings (
         key        TEXT PRIMARY KEY,
         value      TEXT,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_by UUID
       )`,
    );
    ensuredAppSettingsTable = true;
  } catch (err) {
    console.error("ensureAppSettingsTable failed:", err);
  }
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    if (getDataBackend() === "pg") {
      await ensureAppSettingsTable();
      const { rows } = await db.query<{ value: string | null }>(
        `SELECT value FROM app_settings WHERE key = $1 LIMIT 1`,
        [key],
      );
      return rows[0]?.value ?? null;
    }
    const { data, error } = await supabaseAdmin
      .from("app_settings" as never)
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      console.error("getSetting error:", error);
      return null;
    }
    return ((data as { value?: string | null } | null)?.value ?? null) || null;
  } catch (err) {
    console.error("getSetting failed:", err);
    return null;
  }
}

export async function getSettings(
  keys: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const k of keys) out[k] = null;
  try {
    if (getDataBackend() === "pg") {
      await ensureAppSettingsTable();
      const { rows } = await db.query<{ key: string; value: string | null }>(
        `SELECT key, value FROM app_settings WHERE key = ANY($1::text[])`,
        [keys],
      );
      for (const r of rows) out[r.key] = r.value ?? null;
      return out;
    }
    const { data, error } = await supabaseAdmin
      .from("app_settings" as never)
      .select("key,value")
      .in("key", keys);
    if (error) {
      console.error("getSettings error:", error);
      return out;
    }
    for (const r of (data ?? []) as { key: string; value: string | null }[]) {
      out[r.key] = r.value ?? null;
    }
    return out;
  } catch (err) {
    console.error("getSettings failed:", err);
    return out;
  }
}

export async function upsertSetting(
  key: string,
  value: string | null,
  updatedBy: string | null,
): Promise<void> {
  if (getDataBackend() === "pg") {
    await ensureAppSettingsTable();
    await db.query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
         VALUES ($1, $2, now(), $3)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value,
                       updated_at = now(),
                       updated_by = EXCLUDED.updated_by`,
      [key, value, updatedBy],
    );
    return;
  }
  const { error } = await supabaseAdmin
    .from("app_settings" as never)
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      } as never,
      { onConflict: "key" } as never,
    );
  if (error) {
    console.error("upsertSetting error:", error);
    throw new Error(error.message);
  }
}