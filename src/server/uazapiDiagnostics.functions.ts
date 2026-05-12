import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import { getLatestInstance } from "./uazapiRepo.server";
import { getDataBackend } from "./registrationsRepo.server";

const accessTokenSchema = z.string().trim().min(1);

function mask(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}…${value.slice(-4)} (len=${value.length})`;
}

function maskUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.replace(/(:\/\/[^:/]+:)[^@]+(@)/, "$1***$2");
}

async function probeUazapi(baseUrl: string, adminToken: string) {
  const url = `${baseUrl.replace(/\/+$/, "")}/instance/all`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { admintoken: adminToken, Accept: "application/json" },
    });
    const ms = Date.now() - start;
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      ms,
      url,
      bodyPreview: text.slice(0, 300),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - start,
      url,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const getUazapiDiagnostics = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);

    const env = {
      UAZAPI_BASE_URL: process.env.UAZAPI_BASE_URL ?? null,
      UAZAPI_ADMIN_TOKEN_present: Boolean(process.env.UAZAPI_ADMIN_TOKEN),
      UAZAPI_ADMIN_TOKEN_masked: mask(process.env.UAZAPI_ADMIN_TOKEN),
      DATABASE_URL_present: Boolean(process.env.DATABASE_URL),
      DATABASE_URL_masked: maskUrl(process.env.DATABASE_URL),
      TWILIO_ACCOUNT_SID_present: Boolean(process.env.TWILIO_ACCOUNT_SID),
      TWILIO_ACCOUNT_SID_masked: mask(process.env.TWILIO_ACCOUNT_SID),
      TWILIO_AUTH_TOKEN_present: Boolean(process.env.TWILIO_AUTH_TOKEN),
      TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? null,
      JWT_SECRET_present: Boolean(process.env.JWT_SECRET),
      UPLOADS_DIR: process.env.UPLOADS_DIR ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
      data_backend: getDataBackend(),
    };

    let instance: Awaited<ReturnType<typeof getLatestInstance>> | null = null;
    let instanceError: string | null = null;
    try {
      instance = await getLatestInstance();
    } catch (err) {
      instanceError = err instanceof Error ? err.message : String(err);
    }

    let probe: Awaited<ReturnType<typeof probeUazapi>> | null = null;
    if (env.UAZAPI_BASE_URL && process.env.UAZAPI_ADMIN_TOKEN) {
      probe = await probeUazapi(env.UAZAPI_BASE_URL, process.env.UAZAPI_ADMIN_TOKEN);
    }

    return {
      env,
      instance: instance
        ? {
            id: instance.id,
            name: instance.name,
            status: instance.status,
            instance_id: instance.instance_id,
            instance_token_masked: mask(instance.instance_token),
            phone_connected: instance.phone_connected,
            profile_name: instance.profile_name,
            owner_jid: instance.owner_jid,
            last_qr_at: instance.last_qr_at,
            last_status_at: instance.last_status_at,
            created_at: instance.created_at,
            updated_at: instance.updated_at,
          }
        : null,
      instanceError,
      probe,
      checkedAt: new Date().toISOString(),
    };
  });