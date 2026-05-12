import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import {
  getSettings,
  upsertSetting,
} from "./appSettingsRepo.server";
import { TWILIO_SETTING_KEYS } from "./twilio.server";

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