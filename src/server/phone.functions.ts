import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  pollPhoneVerificationData,
  sendPhoneVerificationData,
  verifyPhoneCodeData,
} from "./phone.server";

async function extractErrorMessage(err: unknown): Promise<string> {
  if (err instanceof Response) {
    const message = await err
      .clone()
      .text()
      .catch(() => "");
    return message || `Erro HTTP ${err.status}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
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
      // Return a structured failure so the client can toast a friendly message
      // without triggering the dev overlay / RUNTIME_ERROR blank screen.
      const message = await extractErrorMessage(err);
      console.error("[sendPhoneVerification] failed:", message);
      return {
        success: false as const,
        error: "send_failed" as const,
        message,
      };
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
      const message = await extractErrorMessage(err);
      console.error("[verifyPhoneCode] failed:", message);
      return {
        success: false as const,
        error: "verify_failed" as const,
        message,
      };
    }
  });

export const pollPhoneVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z.object({ phone: z.string().trim().min(10).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    return pollPhoneVerificationData(data);
  });
