// Server-only helpers to talk to the uazapi (uazapiGO) WhatsApp API.
// Docs: https://docs.uazapi.com/
//
// Two auth modes are used:
//  - `admintoken` header: instance lifecycle (create / list / delete instances)
//  - `token` header: per-instance operations (connect, status, qrcode, disconnect)

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (opts.admin) {
    headers["admintoken"] = getAdminToken();
  } else {
    if (!opts.instanceToken) {
      throw new Response("Token da instância ausente", { status: 500 });
    }
    headers["token"] = opts.instanceToken;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    console.error("uazapi network error:", err);
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
    throw new Response(`uazapi: ${message}`, { status: res.status });
  }

  return data as T;
}
