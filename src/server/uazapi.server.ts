// Server-only helpers to talk to the uazapi (uazapiGO) WhatsApp API.
// Docs: https://docs.uazapi.com/
//
// Two auth modes are used:
//  - `admintoken` header: instance lifecycle (create / list / delete instances)
//  - `token` header: per-instance operations (connect, status, qrcode, disconnect)

import { logUazapiEvent } from "./uazapiDebug.server";
import { getSettings } from "./appSettingsRepo.server";

type UazFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Use admintoken auth instead of per-instance token. */
  admin?: boolean;
  /** Per-instance token (required when admin=false). */
  instanceToken?: string;
};

export async function resolveUazapiConfig(): Promise<{
  baseUrl: string | null;
  adminToken: string | null;
  baseUrlSource: "db" | "env" | null;
  adminTokenSource: "db" | "env" | null;
}> {
  let dbBase: string | null = null;
  let dbToken: string | null = null;
  try {
    const s = await getSettings(["uazapi_base_url", "uazapi_admin_token"]);
    dbBase = (s["uazapi_base_url"] || "").trim() || null;
    dbToken = (s["uazapi_admin_token"] || "").trim() || null;
  } catch {
    /* ignore — fallback to env */
  }
  const envBase = (process.env.UAZAPI_BASE_URL || "").trim() || null;
  const envToken = (process.env.UAZAPI_ADMIN_TOKEN || "").trim() || null;
  const baseUrl = dbBase ?? envBase;
  const adminToken = dbToken ?? envToken;
  return {
    baseUrl: baseUrl ? baseUrl.replace(/\/+$/, "") : null,
    adminToken,
    baseUrlSource: dbBase ? "db" : envBase ? "env" : null,
    adminTokenSource: dbToken ? "db" : envToken ? "env" : null,
  };
}

async function getBaseUrl(): Promise<string> {
  const cfg = await resolveUazapiConfig();
  if (!cfg.baseUrl) {
    throw new Response("UAZAPI_BASE_URL não configurado (configure em /admin/whatsapp)", { status: 500 });
  }
  return cfg.baseUrl;
}

async function getAdminToken(): Promise<string> {
  const cfg = await resolveUazapiConfig();
  if (!cfg.adminToken) {
    throw new Response("UAZAPI_ADMIN_TOKEN não configurado (configure em /admin/whatsapp)", { status: 500 });
  }
  return cfg.adminToken;
}

export async function uazFetch<T = unknown>(path: string, opts: UazFetchOptions = {}): Promise<T> {
  const base = await getBaseUrl();
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const adminToken = opts.admin ? await getAdminToken() : null;
  const instanceToken = opts.admin ? null : opts.instanceToken;

  if (!opts.admin && !instanceToken) {
    throw new Response("Token da instância ausente", { status: 500 });
  }

  const makeRequest = (authMode: "header" | "query") => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    let requestUrl = url;

    if (authMode === "header") {
      if (opts.admin && adminToken) headers["admintoken"] = adminToken;
      if (!opts.admin && instanceToken) headers["token"] = instanceToken;
    } else {
      const u = new URL(url);
      if (opts.admin && adminToken) u.searchParams.set("admintoken", adminToken);
      if (!opts.admin && instanceToken) u.searchParams.set("token", instanceToken);
      requestUrl = u.toString();
    }

    return fetch(requestUrl, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

  let res: Response;
  const start = Date.now();
  let authMode: "header" | "query" = "header";
  let finalUrl = url;
  try {
    res = await makeRequest("header");
    if (res.status === 401 || res.status === 403) {
      const preview = await res
        .clone()
        .text()
        .catch(() => "");
      if (/missing token|invalid token|unauthorized|forbidden|admintoken|token/i.test(preview)) {
        authMode = "query";
        finalUrl = `${url}${url.includes("?") ? "&" : "?"}${opts.admin ? "admintoken" : "token"}=***`;
        logUazapiEvent({
          level: "warn",
          action: "request-auth-fallback",
          method: opts.method ?? "GET",
          path,
          url: finalUrl,
          status: res.status,
          ms: Date.now() - start,
          ok: false,
          error: "Retrying with query-string auth required by some uazapi deployments.",
        });
        res = await makeRequest("query");
      }
    }
  } catch (err) {
    console.error("uazapi network error:", err);
    logUazapiEvent({
      level: "error",
      action: "request",
      method: opts.method ?? "GET",
      path,
      url: finalUrl,
      ms: Date.now() - start,
      ok: false,
      requestBody: opts.body,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Response("Não foi possível conectar ao servidor uazapi.", {
      status: 502,
    });
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ||
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ||
      (typeof data === "string" ? data : null) ||
      `HTTP ${res.status}`;
    console.error(`uazapi ${path} -> ${res.status}: ${message}`);
    logUazapiEvent({
      level: "error",
      action: "request",
      method: opts.method ?? "GET",
      path,
      url: finalUrl,
      status: res.status,
      ms: Date.now() - start,
      ok: false,
      requestBody: { authMode, body: opts.body ?? null },
      responsePreview: data,
      error: message,
    });
    throw new Response(`uazapi: ${message}`, { status: res.status });
  }

  logUazapiEvent({
    level: "info",
    action: "request",
    method: opts.method ?? "GET",
    path,
    url: finalUrl,
    status: res.status,
    ms: Date.now() - start,
    ok: true,
    requestBody: { authMode, body: opts.body ?? null },
    responsePreview: data,
  });

  return data as T;
}
