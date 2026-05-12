import { db } from "./db.server";
import { supabaseAdmin } from "./supabaseAdmin.server";

/**
 * Repository das tabelas `registrations` / `phone_verifications`.
 *
 * Backend escolhido por env:
 *  - DATABASE_URL definido -> Postgres direto (Etapa 3 da migracao VPS)
 *  - caso contrario        -> supabaseAdmin (modo atual)
 *
 * O shape de retorno e identico nos dois modos pra facilitar o cutover.
 */

export type Backend = "pg" | "supabase";
export function getDataBackend(): Backend {
  const url = process.env.DATABASE_URL?.trim();
  // Só usa Postgres direto se DATABASE_URL parecer uma URL postgres válida.
  // Evita cair em "pg" quando a env tem lixo (ex.: "base"), o que gerava
  // ENOTFOUND no preview do Lovable Cloud.
  return url && /^postgres(ql)?:\/\//i.test(url) ? "pg" : "supabase";
}

export type RegistrationRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  cpf: string | null;
  photo_path: string;
  device_fingerprint: string | null;
  device_id: string | null;
  device_os: string | null;
  device_browser: string | null;
  device_model: string | null;
  device_platform: string | null;
  device_language: string | null;
  device_timezone: string | null;
  screen_resolution: string | null;
  user_agent: string | null;
  ip_address: string | null;
  geo_city: string | null;
  geo_region: string | null;
  geo_country: string | null;
  created_at: string;
};

export type DuplicateMatch = {
  id: string;
  first_name: string;
  last_name: string;
  cpf: string | null;
  phone: string;
  device_fingerprint: string | null;
  created_at: string;
};

export async function findDuplicateRegistration(opts: {
  cpf?: string;
  phone?: string;
  deviceFingerprint?: string;
  deviceId: string | null;
}): Promise<DuplicateMatch | null> {
  if (!opts.cpf && !opts.phone && !opts.deviceFingerprint) return null;

  if (getDataBackend() === "pg") {
    const filters: string[] = [];
    const params: unknown[] = [];
    const push = (sql: string, value: unknown) => {
      params.push(value);
      filters.push(sql.replace("$$", `$${params.length}`));
    };
    if (opts.cpf) push("cpf = $$", opts.cpf);
    if (opts.phone) push("phone = $$", opts.phone);
    if (opts.deviceFingerprint) push("device_fingerprint = $$", opts.deviceFingerprint);

    const deviceClause =
      opts.deviceId !== null
        ? `device_id = $${params.length + 1}`
        : `device_id IS NULL`;
    if (opts.deviceId !== null) params.push(opts.deviceId);

    const { rows } = await db.query<DuplicateMatch>(
      `SELECT id::text, first_name, last_name, cpf, phone,
              device_fingerprint, created_at::text AS created_at
         FROM registrations
        WHERE (${filters.join(" OR ")})
          AND ${deviceClause}
        ORDER BY created_at DESC
        LIMIT 1`,
      params,
    );
    return rows[0] ?? null;
  }

  // Supabase
  const orFilters: string[] = [];
  if (opts.cpf) orFilters.push(`cpf.eq.${opts.cpf}`);
  if (opts.phone) orFilters.push(`phone.eq.${opts.phone}`);
  if (opts.deviceFingerprint)
    orFilters.push(`device_fingerprint.eq.${opts.deviceFingerprint}`);

  let q = supabaseAdmin
    .from("registrations")
    .select(
      "id, first_name, last_name, cpf, phone, device_fingerprint, created_at",
    )
    .or(orFilters.join(","));
  q = opts.deviceId ? q.eq("device_id", opts.deviceId) : q.is("device_id", null);

  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as DuplicateMatch | null) ?? null;
}

export async function findFingerprintInDevice(
  deviceFingerprint: string,
  deviceId: string | null,
): Promise<{ id: string } | null> {
  if (getDataBackend() === "pg") {
    const params: unknown[] = [deviceFingerprint];
    const deviceClause =
      deviceId !== null
        ? (params.push(deviceId), `device_id = $${params.length}`)
        : `device_id IS NULL`;
    const { rows } = await db.query<{ id: string }>(
      `SELECT id::text FROM registrations
        WHERE device_fingerprint = $1 AND ${deviceClause}
        LIMIT 1`,
      params,
    );
    return rows[0] ?? null;
  }

  let q = supabaseAdmin
    .from("registrations")
    .select("id")
    .eq("device_fingerprint", deviceFingerprint);
  q = deviceId ? q.eq("device_id", deviceId) : q.is("device_id", null);
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw error;
  return data ? { id: String(data.id) } : null;
}

export type InsertRegistrationInput = {
  first_name: string;
  last_name: string;
  phone: string;
  cpf: string | null;
  photo_path: string;
  device_fingerprint: string;
  device_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_model: string | null;
  device_os: string | null;
  device_browser: string | null;
  screen_resolution: string | null;
  device_language: string | null;
  device_timezone: string | null;
  device_platform: string | null;
  geo_city: string | null;
  geo_region: string | null;
  geo_country: string | null;
};

export async function insertRegistration(
  payload: InsertRegistrationInput,
): Promise<{ id: string }> {
  if (getDataBackend() === "pg") {
    const cols = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO registrations (${cols.join(", ")})
       VALUES (${placeholders})
       RETURNING id::text`,
      values,
    );
    return rows[0];
  }

  const { data, error } = await supabaseAdmin
    .from("registrations")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert falhou");
  return { id: String(data.id) };
}

/**
 * Verifica se ha verificacao de telefone confirmada (verified_at IS NOT NULL)
 * pra um determinado numero E.164.
 */
export async function hasVerifiedPhone(phoneE164: string): Promise<boolean> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM phone_verifications
          WHERE phone = $1 AND verified_at IS NOT NULL
       ) AS ok`,
      [phoneE164],
    );
    return Boolean(rows[0]?.ok);
  }
  const { data, error } = await supabaseAdmin
    .from("phone_verifications")
    .select("verified_at")
    .eq("phone", phoneE164)
    .not("verified_at", "is", null)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.verified_at);
}

export type ListFilters = { search: string; limit: number; offset: number };
export type ListResult = { rows: RegistrationRow[]; total: number };

export async function listRegistrations(filters: ListFilters): Promise<ListResult> {
  if (getDataBackend() === "pg") {
    const params: unknown[] = [];
    let where = "";
    if (filters.search) {
      params.push(`%${filters.search}%`);
      where = `WHERE first_name ILIKE $${params.length}
                  OR last_name  ILIKE $${params.length}
                  OR phone      ILIKE $${params.length}`;
    }
    const totalRes = await db.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM registrations ${where}`,
      params,
    );
    params.push(filters.limit, filters.offset);
    const rowsRes = await db.query<RegistrationRow>(
      `SELECT id::text, first_name, last_name, phone, cpf, photo_path,
              device_fingerprint, device_id::text, device_os, device_browser,
              device_model, device_platform, device_language, device_timezone,
              screen_resolution, user_agent, ip_address,
              geo_city, geo_region, geo_country,
              created_at::text AS created_at
         FROM registrations
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { rows: rowsRes.rows, total: Number(totalRes.rows[0].c) };
  }

  let q = supabaseAdmin
    .from("registrations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  if (filters.search) {
    const t = `%${filters.search}%`;
    q = q.or(`first_name.ilike.${t},last_name.ilike.${t},phone.ilike.${t}`);
  }
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data as unknown as RegistrationRow[]) ?? [], total: count ?? 0 };
}

export async function deleteRegistrationRow(id: string): Promise<{ photo_path: string | null }> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ photo_path: string | null }>(
      `DELETE FROM registrations WHERE id = $1 RETURNING photo_path`,
      [id],
    );
    return rows[0] ?? { photo_path: null };
  }
  const { data: row } = await supabaseAdmin
    .from("registrations")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  await supabaseAdmin.from("registrations").delete().eq("id", id);
  return { photo_path: (row?.photo_path as string | undefined) ?? null };
}

export async function getStats(): Promise<{ total: number; today: number; week: number }> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ total: string; today: string; week: string }>(
      `SELECT
         (SELECT count(*) FROM registrations)::text AS total,
         (SELECT count(*) FROM registrations
            WHERE created_at >= date_trunc('day', now()))::text AS today,
         (SELECT count(*) FROM registrations
            WHERE created_at >= now() - interval '7 days')::text AS week`,
    );
    const r = rows[0];
    return { total: Number(r.total), today: Number(r.today), week: Number(r.week) };
  }
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const [a, b, c] = await Promise.all([
    supabaseAdmin.from("registrations").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("registrations").select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString()),
    supabaseAdmin.from("registrations").select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
  ]);
  return { total: a.count ?? 0, today: b.count ?? 0, week: c.count ?? 0 };
}

export type RegistrationForSync = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  cpf: string | null;
  photo_path: string;
  device_id: string | null;
};

export async function getRegistrationForSync(
  id: string,
): Promise<RegistrationForSync | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<RegistrationForSync>(
      `SELECT id::text, first_name, last_name, phone, cpf, photo_path,
              device_id::text
         FROM registrations WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }
  const { data } = await supabaseAdmin
    .from("registrations")
    .select("id,first_name,last_name,phone,cpf,photo_path,device_id")
    .eq("id", id)
    .maybeSingle();
  return data
    ? {
        id: String(data.id),
        first_name: String(data.first_name),
        last_name: String(data.last_name),
        phone: String(data.phone),
        cpf: (data.cpf as string | null) ?? null,
        photo_path: String(data.photo_path),
        device_id: (data.device_id as string | null) ?? null,
      }
    : null;
}

export type DeviceSyncPatch = {
  device_sync_status: "pending" | "success" | "error";
  device_sync_user_id?: number | null;
  device_sync_error?: string | null;
  device_sync_attempted_at?: string | null;
};

export async function updateRegistrationSync(
  id: string,
  patch: DeviceSyncPatch,
): Promise<void> {
  if (getDataBackend() === "pg") {
    const cols = Object.keys(patch);
    const values = Object.values(patch);
    const sets = cols.map((k, i) => `${k} = $${i + 2}`).join(", ");
    await db.query(`UPDATE registrations SET ${sets} WHERE id = $1`, [
      id,
      ...values,
    ]);
    return;
  }
  await supabaseAdmin.from("registrations").update(patch).eq("id", id);
}
