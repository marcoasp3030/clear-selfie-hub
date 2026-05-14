import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import { getSetting, upsertSetting } from "./appSettingsRepo.server";
import { callSintegrawsCpf } from "@/lib/sintegrawsCpf.server";
import {
  SINTEGRAWS_TOKEN_KEY,
  getSintegrawsToken,
} from "./sintegrawsSettings.server";

const accessTokenSchema = z.string().trim().min(1);

function maskToken(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length <= 6) return "••••";
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

export const getSintegrawsSettings = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const dbToken = await getSetting(SINTEGRAWS_TOKEN_KEY);
    const hasEnv = Boolean(process.env.SINTEGRAWS_TOKEN);
    return {
      tokenMasked: maskToken(dbToken),
      hasToken: Boolean(dbToken),
      envFallback: !dbToken && hasEnv,
    };
  });

export const updateSintegrawsSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; token?: string | null }) =>
      z
        .object({
          accessToken: accessTokenSchema,
          token: z.string().trim().min(8).max(512).nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await assertAdminAccess(data.accessToken);
    if (data.token !== undefined) {
      await upsertSetting(
        SINTEGRAWS_TOKEN_KEY,
        data.token?.trim() || null,
        userId,
      );
    }
    return { success: true as const };
  });

export const testSintegrawsToken = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; cpf: string; birthDate: string }) =>
      z
        .object({
          accessToken: accessTokenSchema,
          cpf: z.string().trim().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
          birthDate: z
            .string()
            .trim()
            .regex(/^\d{8}$/, "Data deve estar em ddmmaaaa"),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const token = await getSintegrawsToken();
    if (!token) {
      return {
        success: false as const,
        status: 0,
        message: "Token SintegraWS não configurado.",
        body: null as string | null,
      };
    }
    const result = await callSintegrawsCpf(token, data.cpf, data.birthDate);
    if (!result.ok) {
      return {
        success: false as const,
        status: result.status,
        message: result.message,
        body: result.raw,
        blocked: result.kind === "blocked",
      };
    }

    return {
      success: result.status >= 200 && result.status < 300,
      status: result.status,
      message: result.status >= 200 && result.status < 300
        ? "Resposta recebida do SintegraWS."
        : `HTTP ${result.status} retornado pelo SintegraWS.`,
      body: result.raw.slice(0, 1000),
      blocked: false,
    };
  });