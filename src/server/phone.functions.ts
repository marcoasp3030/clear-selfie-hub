import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  pollPhoneVerificationData,
  sendPhoneVerificationData,
  verifyPhoneCodeData,
} from "./phone.server";

async function normalizeServerFnError(err: unknown): Promise<Error> {
  if (err instanceof Response) {
    const message = await err
      .clone()
      .text()
      .catch(() => "Erro no servidor.");
    return new Error(message || `Erro HTTP ${err.status}`);
  }
  if (err instanceof Error) return err;
  return new Error(String(err));
}

export const sendPhoneVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; channel?: "whatsapp" | "sms" }) =>
    z
      .object({
        phone: z.string().trim().min(10).max(20),
        channel: z.enum(["whatsapp", "sms"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      return await sendPhoneVerificationData(data);
    } catch (err) {
      throw await normalizeServerFnError(err);
    }
  });

export const verifyPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; code: string }) =>
    z
      .object({
        phone: z.string().trim().min(10).max(20),
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      return await verifyPhoneCodeData(data);
    } catch (err) {
      throw await normalizeServerFnError(err);
    }
  });

export const pollPhoneVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z.object({ phone: z.string().trim().min(10).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    return pollPhoneVerificationData(data);
  });
