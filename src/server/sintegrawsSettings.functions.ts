import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import { getSetting, upsertSetting } from "./appSettingsRepo.server";
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
    const url = new URL("https://www.sintegraws.com.br/api/v1/execute-api.php");
    url.searchParams.set("token", token);
    url.searchParams.set("cpf", data.cpf);
    url.searchParams.set("data-nascimento", data.birthDate);
    url.searchParams.set("plugin", "CPF");
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; NutricarFacial/1.0; +https://facial.nutricarbrasil.com.br)",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false as const,
        status: 0,
        message: `Falha de rede: ${msg}`,
        body: null,
      };
    }
    const text = await res.text();
    return {
      success: res.ok,
      status: res.status,
      message: res.ok
        ? "Resposta recebida do SintegraWS."
        : `HTTP ${res.status} retornado pelo SintegraWS.`,
      body: text.slice(0, 1000),
    };
  });