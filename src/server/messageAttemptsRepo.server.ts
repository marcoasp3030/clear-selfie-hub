import { db } from "./db.server";
import { supabaseAdmin } from "./supabaseAdmin.server";
import { getDataBackend } from "./registrationsRepo.server";

export type MessageAttemptRow = {
  id: string;
  channel: "sms" | "whatsapp";
  provider: string | null;
  phone: string;
  status: "sent" | "failed";
  error: string | null;
  provider_message_id: string | null;
  metadata: unknown;
  created_at: string;
};

export async function logMessageAttempt(input: {
  channel: "sms" | "whatsapp";
  provider?: string | null;
  phone: string;
  status: "sent" | "failed";
  error?: string | null;
  provider_message_id?: string | null;
  metadata?: unknown;
}): Promise<void> {
  try {
    if (getDataBackend() === "pg") {
      await db.query(
        `INSERT INTO message_attempts
           (channel, provider, phone, status, error, provider_message_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          input.channel,
          input.provider ?? null,
          input.phone,
          input.status,
          input.error ?? null,
          input.provider_message_id ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null,
        ],
      );
      return;
    }
    await supabaseAdmin.from("message_attempts" as never).insert({
      channel: input.channel,
      provider: input.provider ?? null,
      phone: input.phone,
      status: input.status,
      error: input.error ?? null,
      provider_message_id: input.provider_message_id ?? null,
      metadata: input.metadata ?? null,
    } as never);
  } catch (err) {
    console.error("logMessageAttempt failed:", err);
  }
}

export async function listMessageAttemptsRows(input: {
  channel?: "sms" | "whatsapp" | "all";
  status?: "sent" | "failed" | "all";
  search?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: MessageAttemptRow[]; total: number }> {
  const channel = input.channel && input.channel !== "all" ? input.channel : null;
  const status = input.status && input.status !== "all" ? input.status : null;
  const search = input.search?.trim() || null;

  if (getDataBackend() === "pg") {
    const where: string[] = [];
    const params: unknown[] = [];
    if (channel) {
      params.push(channel);
      where.push(`channel = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(phone ILIKE $${params.length} OR error ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const totalRes = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM message_attempts ${whereSql}`,
      params,
    );
    params.push(input.limit);
    params.push(input.offset);
    const rowsRes = await db.query<MessageAttemptRow>(
      `SELECT id::text, channel, provider, phone, status, error,
              provider_message_id, metadata, created_at::text
         FROM message_attempts
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { rows: rowsRes.rows, total: Number(totalRes.rows[0]?.count ?? 0) };
  }

  let q = supabaseAdmin
    .from("message_attempts" as never)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);
  if (channel) q = q.eq("channel", channel);
  if (status) q = q.eq("status", status);
  if (search) q = q.or(`phone.ilike.%${search}%,error.ilike.%${search}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return {
    rows: (data ?? []) as unknown as MessageAttemptRow[],
    total: count ?? 0,
  };
}