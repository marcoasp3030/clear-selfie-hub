// Server-only helpers to talk to the uazapi (uazapiGO) WhatsApp API.
// Docs: https://docs.uazapi.com/
//
// Two auth modes are used:
//  - `admintoken` header: instance lifecycle (create / list / delete instances)
//  - `token` header: per-instance operations (connect, status, qrcode, disconnect)

import { logUazapiEvent } from "./uazapiDebug.server";

type UazFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Use admintoken auth instead of per-instance token. */
  admin?: boolean;
  /** Per-instance token (required when admin=false). */
  instanceToken?: string;
};

function getBaseUrl() {
  const raw = process.env.UAZAPI_BASE_URL;
  if (!raw) {
    throw new Response("UAZAPI_BASE_URL não configurado", { status: 500 });
  }
  return raw.replace(/\/+$/, "");
}

function getAdminToken() {
  const t = process.env.UAZAPI_ADMIN_TOKEN;
  if (!t) {
    throw new Response("UAZAPI_ADMIN_TOKEN não configurado", { status: 500 });
  }
  return t;
}

export async function uazFetch<T = unknown>(
  path: string,
  opts: UazFetchOptions = {}
): Promise<T> {
  const base = getBaseUrl();
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const adminToken = opts.admin ? getAdminToken() : null;
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
  try {
    res = await makeRequest("header");
    if (res.status === 401 || res.status === 403) {
      const preview = await res.clone().text().catch(() => "");
      if (/missing token|invalid token|unauthorized|forbidden|admintoken|token/i.test(preview)) {
        authMode = "query";
        logUazapiEvent({
          level: "warn",
          action: "request-auth-fallback",
          method: opts.method ?? "GET",
          path,
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
    status: res.status,
    ms: Date.now() - start,
    ok: true,
    requestBody: { authMode, body: opts.body ?? null },
    responsePreview: data,
  });

  return data as T;
}
