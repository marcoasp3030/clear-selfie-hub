import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import { getLatestInstance, getActiveInstanceTokenOrNull } from "./uazapiRepo.server";
import { getDataBackend } from "./registrationsRepo.server";
import { logMessageAttempt } from "./messageAttemptsRepo.server";
import { getUazapiLogEvents, logUazapiEvent } from "./uazapiDebug.server";

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
  const request = (authMode: "header" | "query") => {
    const target = new URL(url);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (authMode === "header") headers.admintoken = adminToken;
    else target.searchParams.set("admintoken", adminToken);
    return fetch(target.toString(), { method: "GET", headers });
  };
  try {
    let authMode: "header" | "query" = "header";
    let res = await request("header");
    if (res.status === 401 || res.status === 403) {
      const preview = await res
        .clone()
        .text()
        .catch(() => "");
      if (/missing token|invalid token|unauthorized|forbidden|admintoken|token/i.test(preview)) {
        authMode = "query";
        res = await request("query");
      }
    }
    const ms = Date.now() - start;
    const text = await res.text();
    logUazapiEvent({
      level: res.ok ? "info" : "error",
      action: "diagnostic-probe",
      method: "GET",
      path: "/instance/all",
      status: res.status,
      ms,
      ok: res.ok,
      requestBody: { authMode },
      responsePreview: text,
      error: res.ok ? undefined : text.slice(0, 300) || `HTTP ${res.status}`,
    });
    return {
      ok: res.ok,
      status: res.status,
      ms,
      url: authMode === "query" ? `${url}?admintoken=***` : url,
      bodyPreview: text.slice(0, 300),
    };
  } catch (err) {
    logUazapiEvent({
      level: "error",
      action: "diagnostic-probe",
      method: "GET",
      path: "/instance/all",
      ms: Date.now() - start,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
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
      logs: getUazapiLogEvents(),
      checkedAt: new Date().toISOString(),
    };
  });

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

/**
 * Faz um GET autenticado em /instance/all para validar conectividade
 * e credenciais (admintoken). Retorna debug completo para a UI.
 */
export const pingUazapi = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const baseUrl = process.env.UAZAPI_BASE_URL;
    const adminToken = process.env.UAZAPI_ADMIN_TOKEN;
    if (!baseUrl) {
      return {
        ok: false,
        error: "UAZAPI_BASE_URL não configurado",
        url: null,
        status: 0,
        ms: 0,
        bodyPreview: null,
      };
    }
    if (!adminToken) {
      return {
        ok: false,
        error: "UAZAPI_ADMIN_TOKEN não configurado",
        url: null,
        status: 0,
        ms: 0,
        bodyPreview: null,
      };
    }
    const probe = await probeUazapi(baseUrl, adminToken);
    return probe;
  });

/**
 * Envia uma mensagem de teste pelo WhatsApp via uazapi (/send/text)
 * usando o token da instância salva. Retorna status e corpo bruto da
 * resposta para debug. Loga em message_attempts.
 */
export const sendTestWhatsApp = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; to: string; text: string }) =>
    z
      .object({
        accessToken: accessTokenSchema,
        to: z.string().trim().min(8).max(20),
        text: z.string().trim().min(1).max(1000),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean;
      status: number;
      ms: number;
      url: string | null;
      requestBody: { number: string; text: string; linkPreview: boolean } | null;
      responseBody: string | null;
      error: string | null;
    }> => {
      await assertAdminAccess(data.accessToken);

      const baseUrl = process.env.UAZAPI_BASE_URL;
      if (!baseUrl) {
        return {
          success: false,
          status: 0,
          ms: 0,
          url: null,
          requestBody: null,
          responseBody: null,
          error: "UAZAPI_BASE_URL não configurado",
        };
      }

      let token: string | null = null;
      try {
        token = await getActiveInstanceTokenOrNull();
      } catch (err) {
        return {
          success: false,
          status: 0,
          ms: 0,
          url: null,
          requestBody: null,
          responseBody: null,
          error:
            "Falha ao ler instância salva: " + (err instanceof Error ? err.message : String(err)),
        };
      }
      if (!token) {
        return {
          success: false,
          status: 0,
          ms: 0,
          url: null,
          requestBody: null,
          responseBody: null,
          error: "Nenhuma instância uazapi salva. Crie e conecte uma instância em /admin/whatsapp.",
        };
      }

      const phone = normalizePhone(data.to);
      const url = `${baseUrl.replace(/\/+$/, "")}/send/text`;
      const body = { number: phone, text: data.text, linkPreview: false };

      const start = Date.now();
      let status = 0;
      let responseBody: string | null = null;
      let error: string | null = null;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            token,
          },
          body: JSON.stringify(body),
        });
        status = res.status;
        responseBody = (await res.text()).slice(0, 2000);
        if (!res.ok) {
          error = `HTTP ${res.status}`;
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      const ms = Date.now() - start;
      const success = !error && status >= 200 && status < 300;
      logUazapiEvent({
        level: success ? "info" : "error",
        action: "send-test-whatsapp",
        method: "POST",
        path: "/send/text",
        status,
        ms,
        ok: success,
        requestBody: body,
        responsePreview: responseBody,
        error: error ?? undefined,
      });

      try {
        await logMessageAttempt({
          channel: "whatsapp",
          provider: "uazapi",
          phone,
          status: success ? "sent" : "failed",
          error,
          metadata: { test: true, status, ms, responseBody: responseBody?.slice(0, 500) ?? null },
        });
      } catch {
        /* noop */
      }

      return { success, status, ms, url, requestBody: body, responseBody, error };
    },
  );
