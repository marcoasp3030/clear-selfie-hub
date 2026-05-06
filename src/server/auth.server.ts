import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db.server";

/**
 * Sistema de autenticação local (JWT + bcrypt).
 * Pensado pra coexistir com o Supabase Auth durante a Etapa 2 da migração:
 *  - Se DATABASE_URL nao estiver configurado ou a tabela `users` nao existir,
 *    `tryLocalLogin` retorna `null` e o front cai automaticamente no Supabase.
 *  - Quando o admin existir no Postgres, o JWT vira o caminho primario.
 */

export const AUTH_COOKIE_NAME = "nutricar_admin_token";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export type LocalAdminUser = {
  id: string;
  email: string;
  isAdmin: boolean;
};

export type LocalAuthResult =
  | { kind: "ok"; user: LocalAdminUser; token: string }
  | { kind: "invalid" }
  | { kind: "unavailable"; reason: string };

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET ausente ou muito curto (>= 16 chars).");
  }
  return secret;
}

export function signAdminToken(user: LocalAdminUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, is_admin: user.isAdmin },
    getJwtSecret(),
    { expiresIn: AUTH_COOKIE_MAX_AGE, issuer: "nutricar-admin" },
  );
}

export function verifyAdminToken(token: string): LocalAdminUser | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { issuer: "nutricar-admin" }) as {
      sub: string;
      email: string;
      is_admin: boolean;
    };
    if (!payload.is_admin) return null;
    return { id: payload.sub, email: payload.email, isAdmin: true };
  } catch {
    return null;
  }
}

/**
 * Tenta autenticar via Postgres local. Retorna `unavailable` se a infra
 * (DATABASE_URL/JWT_SECRET/tabela users) ainda nao foi provisionada — o
 * caller deve, nesse caso, tentar o Supabase como fallback.
 */
export async function tryLocalLogin(
  emailRaw: string,
  password: string,
): Promise<LocalAuthResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !password) return { kind: "invalid" };

  if (!process.env.DATABASE_URL) {
    return { kind: "unavailable", reason: "DATABASE_URL nao configurado" };
  }
  if (!process.env.JWT_SECRET) {
    return { kind: "unavailable", reason: "JWT_SECRET nao configurado" };
  }

  let row: { id: string; email: string; password_hash: string; is_admin: boolean } | undefined;
  try {
    const result = await db.query<{
      id: string;
      email: string;
      password_hash: string;
      is_admin: boolean;
    }>(
      `SELECT id::text, email, password_hash, is_admin
         FROM users
        WHERE lower(email) = $1
        LIMIT 1`,
      [email],
    );
    row = result.rows[0];
  } catch (err) {
    // Tabela nao existe ainda, ou banco inacessivel: deixa o Supabase assumir.
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist/i.test(msg) || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
      return { kind: "unavailable", reason: msg };
    }
    throw err;
  }

  if (!row || !row.is_admin) return { kind: "invalid" };

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return { kind: "invalid" };

  const user: LocalAdminUser = { id: row.id, email: row.email, isAdmin: true };
  return { kind: "ok", user, token: signAdminToken(user) };
}

/** Cria/atualiza o admin inicial no Postgres a partir de uma senha plain. */
export async function upsertLocalAdmin(emailRaw: string, password: string): Promise<LocalAdminUser> {
  const email = emailRaw.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query<{ id: string; email: string }>(
    `INSERT INTO users (email, password_hash, is_admin)
     VALUES ($1, $2, true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           is_admin      = true,
           updated_at    = now()
     RETURNING id::text, email`,
    [email, hash],
  );
  return { id: rows[0].id, email: rows[0].email, isAdmin: true };
}
