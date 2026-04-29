import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  pollPhoneVerificationData,
  sendPhoneVerificationData,
  verifyPhoneCodeData,
} from "./phone.server";

export const sendPhoneVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z
      .object({
        phone: z.string().trim().min(10).max(20),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    return sendPhoneVerificationData(data);
  });

export const verifyPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; code: string }) =>
    z
      .object({
        phone: z.string().trim().min(10).max(20),
        code: z.string().trim().regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    return verifyPhoneCodeData(data);
  });

export const pollPhoneVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z.object({ phone: z.string().trim().min(10).max(20) }).parse(input)
  )
  .handler(async ({ data }) => {
    return pollPhoneVerificationData(data);
  });