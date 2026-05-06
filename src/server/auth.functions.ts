import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
  setResponseStatus,
} from "@tanstack/react-start/server";
import { z } from "zod";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  tryLocalLogin,
  upsertLocalAdmin,
  verifyAdminToken,
  type LocalAdminUser,
} from "./auth.server";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(6).max(200),
});

function setAuthCookie(token: string) {
  setCookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
}

/**
 * Login local (Postgres + JWT). Retorna `unavailable` quando a infra ainda
 * nao esta provisionada — o cliente entao tenta o Supabase como fallback.
 */
export const localLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentialsSchema.parse(input))
  .handler(async ({ data }) => {
    const result = await tryLocalLogin(data.email, data.password);

    if (result.kind === "ok") {
      setAuthCookie(result.token);
      return { ok: true as const, user: result.user };
    }
    if (result.kind === "unavailable") {
      return { ok: false as const, unavailable: true as const, reason: result.reason };
    }
    setResponseStatus(401);
    return { ok: false as const, unavailable: false as const, reason: "Credenciais invalidas" };
  });

export const localLogout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(AUTH_COOKIE_NAME, { path: "/" });
  return { ok: true as const };
});

export const getLocalSession = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(AUTH_COOKIE_NAME);
  if (!token) return { user: null as LocalAdminUser | null };
  return { user: verifyAdminToken(token) };
});

/**
 * Bootstrap do primeiro admin. Funciona enquanto NAO existir nenhum admin
 * na tabela `users` — depois disso retorna `forbidden`. Util pra subir o
 * sistema na VPS sem precisar abrir psql.
 */
export const bootstrapLocalAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentialsSchema.parse(input))
  .handler(async ({ data }) => {
    if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
      setResponseStatus(503);
      return { ok: false as const, reason: "DATABASE_URL ou JWT_SECRET ausentes" };
    }
    const { db } = await import("./db.server");
    const { rows } = await db.query<{ c: string }>(
      "SELECT count(*)::text AS c FROM users WHERE is_admin = true",
    );
    if (Number(rows[0].c) > 0) {
      setResponseStatus(403);
      return { ok: false as const, reason: "Ja existe admin cadastrado" };
    }
    const user = await upsertLocalAdmin(data.email, data.password);
    return { ok: true as const, user };
  });
