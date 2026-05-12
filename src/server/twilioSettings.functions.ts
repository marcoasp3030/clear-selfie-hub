import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import {
  getSettings,
  upsertSetting,
} from "./appSettingsRepo.server";
import { logMessageAttempt } from "./messageAttemptsRepo.server";
const TWILIO_SETTING_KEYS = {
  sid: "twilio.account_sid",
  token: "twilio.auth_token",
  from: "twilio.from_number",
} as const;

const accessTokenSchema = z.string().trim().min(1);

function maskToken(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length <= 6) return "••••";
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

export const getTwilioSettings = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const vals = await getSettings([
      TWILIO_SETTING_KEYS.sid,
      TWILIO_SETTING_KEYS.token,
      TWILIO_SETTING_KEYS.from,
    ]);
    const sid = vals[TWILIO_SETTING_KEYS.sid];
    const token = vals[TWILIO_SETTING_KEYS.token];
    const from = vals[TWILIO_SETTING_KEYS.from];

    const envFallback = {
      sid: !sid && Boolean(process.env.TWILIO_ACCOUNT_SID),
      token: !token && Boolean(process.env.TWILIO_AUTH_TOKEN),
      from: !from && Boolean(process.env.TWILIO_FROM_NUMBER),
    };

    return {
      accountSid: sid ?? null,
      authTokenMasked: maskToken(token),
      hasAuthToken: Boolean(token),
      fromNumber: from ?? null,
      envFallback,
    };
  });

export const updateTwilioSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accessToken: string;
      accountSid?: string | null;
      authToken?: string | null;
      fromNumber?: string | null;
    }) =>
      z
        .object({
          accessToken: accessTokenSchema,
          accountSid: z
            .string()
            .trim()
            .max(64)
            .regex(/^AC[a-zA-Z0-9]+$/, "Account SID deve começar com AC")
            .nullable()
            .optional(),
          authToken: z.string().trim().min(8).max(256).nullable().optional(),
          fromNumber: z
            .string()
            .trim()
            .max(32)
            .regex(/^\+?[\d\s().-]+$/, "Número inválido")
            .nullable()
            .optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await assertAdminAccess(data.accessToken);
    if (data.accountSid !== undefined) {
      await upsertSetting(
        TWILIO_SETTING_KEYS.sid,
        data.accountSid?.trim() || null,
        userId,
      );
    }
    if (data.authToken !== undefined) {
      await upsertSetting(
        TWILIO_SETTING_KEYS.token,
        data.authToken?.trim() || null,
        userId,
      );
    }
    if (data.fromNumber !== undefined) {
      await upsertSetting(
        TWILIO_SETTING_KEYS.from,
        data.fromNumber?.trim() || null,
        userId,
      );
    }
    return { success: true as const };
  });

function normalizeE164(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  return `+${trimmed.replace(/\D/g, "")}`;
}

export const sendTestSms = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; to: string; body?: string }) =>
      z
        .object({
          accessToken: accessTokenSchema,
          to: z
            .string()
            .trim()
            .min(5)
            .max(32)
            .regex(/^\+?[\d\s().-]+$/, "Número inválido"),
          body: z.string().trim().min(1).max(480).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const vals = await getSettings([
      TWILIO_SETTING_KEYS.sid,
      TWILIO_SETTING_KEYS.token,
      TWILIO_SETTING_KEYS.from,
    ]);
    const sid =
      vals[TWILIO_SETTING_KEYS.sid] || process.env.TWILIO_ACCOUNT_SID || "";
    const token =
      vals[TWILIO_SETTING_KEYS.token] || process.env.TWILIO_AUTH_TOKEN || "";
    const from =
      vals[TWILIO_SETTING_KEYS.from] || process.env.TWILIO_FROM_NUMBER || "";

    if (!sid || !token || !from) {
      return {
        success: false as const,
        status: 0,
        error:
          "Twilio não configurado. Preencha Account SID, Auth Token e número remetente.",
        sid: null as string | null,
        responseBody: null as string | null,
      };
    }

    const to = normalizeE164(data.to);
    const fromE164 = from.trim().startsWith("+")
      ? from.trim()
      : `+${from.trim().replace(/\D/g, "")}`;
    const body = data.body?.trim() || "Teste de envio Twilio (Admin).";

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid.trim()}/Messages.json`;
    const auth = btoa(`${sid.trim()}:${token.trim()}`);
    const params = new URLSearchParams({ To: to, From: fromE164, Body: body });

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      await logMessageAttempt({
        channel: "sms",
        provider: "twilio",
        phone: to,
        status: "failed",
        error: `network: ${msg}`,
        metadata: { test: true },
      });
      return {
        success: false as const,
        status: 0,
        error: `Falha de rede: ${msg}`,
        sid: null,
        responseBody: null,
      };
    }

    const text = await res.text();
    let parsed: { sid?: string; message?: string; code?: number; status?: string } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      const errMsg = parsed?.message
        ? `${parsed.message}${parsed.code ? ` (code ${parsed.code})` : ""}`
        : `HTTP ${res.status}`;
      await logMessageAttempt({
        channel: "sms",
        provider: "twilio",
        phone: to,
        status: "failed",
        error: errMsg,
        metadata: { test: true, http: res.status },
      });
      return {
        success: false as const,
        status: res.status,
        error: errMsg,
        sid: null,
        responseBody: text.slice(0, 2000),
      };
    }

    await logMessageAttempt({
      channel: "sms",
      provider: "twilio",
      phone: to,
      status: "sent",
      provider_message_id: parsed?.sid ?? null,
      metadata: { test: true, twilioStatus: parsed?.status ?? null },
    });

    return {
      success: true as const,
      status: res.status,
      error: null as string | null,
      sid: parsed?.sid ?? null,
      responseBody: text.slice(0, 2000),
    };
  });