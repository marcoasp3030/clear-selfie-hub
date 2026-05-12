import { db } from "./db.server";
import { supabaseAdmin } from "./supabaseAdmin.server";
import { getDataBackend } from "./registrationsRepo.server";
import { deletePhoto } from "./storage.server";

export type RegisteredDeviceGroup = {
  device_fingerprint: string | null;
  device_id: string | null;
  registrations_count: number;
  last_created_at: string;
  last_first_name: string | null;
  last_last_name: string | null;
  last_phone: string | null;
  device_os: string | null;
  device_browser: string | null;
  device_model: string | null;
};

export async function listRegisteredDeviceGroups(): Promise<RegisteredDeviceGroup[]> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<RegisteredDeviceGroup>(
      `SELECT
         device_fingerprint,
         device_id::text AS device_id,
         COUNT(*)::int AS registrations_count,
         MAX(created_at)::text AS last_created_at,
         (ARRAY_AGG(first_name ORDER BY created_at DESC))[1] AS last_first_name,
         (ARRAY_AGG(last_name  ORDER BY created_at DESC))[1] AS last_last_name,
         (ARRAY_AGG(phone      ORDER BY created_at DESC))[1] AS last_phone,
         (ARRAY_AGG(device_os      ORDER BY created_at DESC))[1] AS device_os,
         (ARRAY_AGG(device_browser ORDER BY created_at DESC))[1] AS device_browser,
         (ARRAY_AGG(device_model   ORDER BY created_at DESC))[1] AS device_model
       FROM registrations
       WHERE device_fingerprint IS NOT NULL
       GROUP BY device_fingerprint, device_id
       ORDER BY MAX(created_at) DESC
       LIMIT 500`,
    );
    return rows;
  }

  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select(
      "id,first_name,last_name,phone,device_fingerprint,device_id,device_os,device_browser,device_model,created_at",
    )
    .not("device_fingerprint", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;

  const map = new Map<string, RegisteredDeviceGroup & { _firstSeen: boolean }>();
  for (const r of (data ?? []) as Array<{
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    device_fingerprint: string | null;
    device_id: string | null;
    device_os: string | null;
    device_browser: string | null;
    device_model: string | null;
    created_at: string;
  }>) {
    const key = `${r.device_fingerprint ?? ""}|${r.device_id ?? ""}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        device_fingerprint: r.device_fingerprint,
        device_id: r.device_id ?? null,
        registrations_count: 1,
        last_created_at: r.created_at,
        last_first_name: r.first_name ?? null,
        last_last_name: r.last_name ?? null,
        last_phone: r.phone ?? null,
        device_os: r.device_os ?? null,
        device_browser: r.device_browser ?? null,
        device_model: r.device_model ?? null,
        _firstSeen: true,
      });
    } else {
      existing.registrations_count += 1;
    }
  }
  return Array.from(map.values()).map(({ _firstSeen, ...rest }) => rest);
}

export async function deleteRegistrationsForDevice(
  deviceFingerprint: string,
  deviceId: string | null,
): Promise<{ deleted: number }> {
  if (getDataBackend() === "pg") {
    const params: unknown[] = [deviceFingerprint];
    const deviceClause =
      deviceId !== null
        ? (params.push(deviceId), `device_id = $${params.length}`)
        : `device_id IS NULL`;
    const { rows } = await db.query<{ photo_path: string | null }>(
      `DELETE FROM registrations
        WHERE device_fingerprint = $1 AND ${deviceClause}
        RETURNING photo_path`,
      params,
    );
    await Promise.all(
      rows
        .map((r) => r.photo_path)
        .filter((p): p is string => Boolean(p))
        .map((p) => deletePhoto(p).catch(() => {})),
    );
    return { deleted: rows.length };
  }

  let q = supabaseAdmin
    .from("registrations")
    .select("id,photo_path")
    .eq("device_fingerprint", deviceFingerprint);
  q = deviceId ? q.eq("device_id", deviceId) : q.is("device_id", null);
  const { data: matches, error: selErr } = await q;
  if (selErr) throw selErr;

  const ids = (matches ?? []).map((m) => m.id);
  if (ids.length === 0) return { deleted: 0 };

  const { error: delErr } = await supabaseAdmin
    .from("registrations")
    .delete()
    .in("id", ids);
  if (delErr) throw delErr;

  await Promise.all(
    (matches ?? [])
      .map((m) => m.photo_path)
      .filter((p): p is string => Boolean(p))
      .map((p) => deletePhoto(p).catch(() => {})),
  );

  return { deleted: ids.length };
}
