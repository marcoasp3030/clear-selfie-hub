import { db } from "./db.server";
import { supabaseAdmin } from "./supabaseAdmin.server";
import { getDataBackend } from "./registrationsRepo.server";

export type PhoneVerificationRow = {
  id: string;
  phone: string;
  code_hash: string;
  verify_token: string | null;
  attempts: number;
  expires_at: string;
  verified_at: string | null;
  created_at: string;
};

export async function getLastUnverifiedByPhone(
  phone: string,
): Promise<{ id: string; created_at: string } | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ id: string; created_at: string }>(
      `SELECT id::text, created_at::text
         FROM phone_verifications
        WHERE phone = $1 AND verified_at IS NULL
        ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    return rows[0] ?? null;
  }
  const { data } = await supabaseAdmin
    .from("phone_verifications")
    .select("id, created_at")
    .eq("phone", phone)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: String(data.id), created_at: String(data.created_at) } : null;
}

export async function deleteUnverifiedByPhone(phone: string): Promise<void> {
  if (getDataBackend() === "pg") {
    await db.query(
      `DELETE FROM phone_verifications WHERE phone = $1 AND verified_at IS NULL`,
      [phone],
    );
    return;
  }
  await supabaseAdmin
    .from("phone_verifications")
    .delete()
    .eq("phone", phone)
    .is("verified_at", null);
}

export async function insertPhoneVerification(input: {
  phone: string;
  code_hash: string;
  expires_at: string;
  ip_address: string | null;
  verify_token: string;
}): Promise<{ ok: boolean }> {
  if (getDataBackend() === "pg") {
    try {
      await db.query(
        `INSERT INTO phone_verifications (phone, code_hash, expires_at, ip_address, verify_token)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.phone,
          input.code_hash,
          input.expires_at,
          input.ip_address,
          input.verify_token,
        ],
      );
      return { ok: true };
    } catch (err) {
      console.error("insertPhoneVerification pg failed:", err);
      return { ok: false };
    }
  }
  const { error } = await supabaseAdmin
    .from("phone_verifications")
    .insert(input);
  if (error) {
    console.error("phone_verifications insert failed:", error);
    return { ok: false };
  }
  return { ok: true };
}

export async function getActiveCodeForPhone(
  phone: string,
): Promise<Pick<
  PhoneVerificationRow,
  "id" | "code_hash" | "expires_at" | "attempts" | "verified_at"
> | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{
      id: string;
      code_hash: string;
      expires_at: string;
      attempts: number;
      verified_at: string | null;
    }>(
      `SELECT id::text, code_hash, expires_at::text, attempts, verified_at::text
         FROM phone_verifications
        WHERE phone = $1 AND verified_at IS NULL
        ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    return rows[0] ?? null;
  }
  const { data, error } = await supabaseAdmin
    .from("phone_verifications")
    .select("id, code_hash, expires_at, attempts, verified_at")
    .eq("phone", phone)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: String(data.id),
        code_hash: String(data.code_hash),
        expires_at: String(data.expires_at),
        attempts: Number(data.attempts),
        verified_at: data.verified_at ? String(data.verified_at) : null,
      }
    : null;
}

export async function bumpAttempts(id: string, current: number): Promise<void> {
  if (getDataBackend() === "pg") {
    await db.query(
      `UPDATE phone_verifications
          SET attempts = $2, updated_at = now()
        WHERE id = $1`,
      [id, current + 1],
    );
    return;
  }
  await supabaseAdmin
    .from("phone_verifications")
    .update({ attempts: current + 1, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function markVerifiedById(id: string): Promise<void> {
  if (getDataBackend() === "pg") {
    await db.query(
      `UPDATE phone_verifications
          SET verified_at = now(), updated_at = now()
        WHERE id = $1`,
      [id],
    );
    return;
  }
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("phone_verifications")
    .update({ verified_at: now, updated_at: now })
    .eq("id", id);
}

export async function getLastVerifiedAtByPhone(
  phone: string,
): Promise<string | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{ verified_at: string | null }>(
      `SELECT verified_at::text
         FROM phone_verifications
        WHERE phone = $1
        ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    return rows[0]?.verified_at ?? null;
  }
  const { data } = await supabaseAdmin
    .from("phone_verifications")
    .select("verified_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.verified_at as string | undefined) ?? null;
}

/**
 * Procura linhas nao verificadas (limite 20) cujo telefone "casa" com
 * o numero recebido (sufixo). Retorna a primeira que ainda esta dentro
 * do prazo de expiracao.
 */
export async function findUnverifiedByPhoneLooseMatch(
  fromPhone: string,
): Promise<{ id: string; phone: string; expires_at: string } | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{
      id: string;
      phone: string;
      expires_at: string;
    }>(
      `SELECT id::text, phone, expires_at::text
         FROM phone_verifications
        WHERE verified_at IS NULL
        ORDER BY created_at DESC LIMIT 20`,
    );
    return matchPhone(rows, fromPhone);
  }
  const { data } = await supabaseAdmin
    .from("phone_verifications")
    .select("id, phone, expires_at, verified_at")
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  return matchPhone(
    (data ?? []).map((r) => ({
      id: String(r.id),
      phone: String(r.phone),
      expires_at: String(r.expires_at),
    })),
    fromPhone,
  );
}

export async function findByVerifyToken(
  token: string,
): Promise<{ id: string; phone: string; expires_at: string; verified_at: string | null } | null> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<{
      id: string;
      phone: string;
      expires_at: string;
      verified_at: string | null;
    }>(
      `SELECT id::text, phone, expires_at::text, verified_at::text
         FROM phone_verifications
        WHERE verify_token = $1 LIMIT 1`,
      [token],
    );
    return rows[0] ?? null;
  }
  const { data } = await supabaseAdmin
    .from("phone_verifications")
    .select("id, phone, expires_at, verified_at")
    .eq("verify_token", token)
    .maybeSingle();
  return data
    ? {
        id: String(data.id),
        phone: String(data.phone),
        expires_at: String(data.expires_at),
        verified_at: (data.verified_at as string | null) ?? null,
      }
    : null;
}

function matchPhone<T extends { phone: string; expires_at: string }>(
  rows: T[],
  fromPhone: string,
): T | null {
  const b = fromPhone.replace(/\D/g, "");
  for (const r of rows) {
    const a = r.phone.replace(/\D/g, "");
    if ((a.endsWith(b) || b.endsWith(a)) && new Date(r.expires_at).getTime() >= Date.now()) {
      return r;
    }
  }
  return null;
}