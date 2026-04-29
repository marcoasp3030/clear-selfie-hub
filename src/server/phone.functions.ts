import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHash, randomInt, randomBytes, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { uazFetch } from "./uazapi.server";

const RESEND_COOLDOWN_SECONDS = 30;
const CODE_TTL_SECONDS = 5 * 60; // 5 minutes
const MAX_ATTEMPTS = 5;

function normalizePhone(raw: string): string {
  // Brazilian mobile -> E.164 digits, e.g. "(11) 91234-5678" -> "5511912345678"
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

function hashCode(code: string, phone: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function clientIp(): string | null {
  const h =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  if (h) return h;
  try {
    return getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    return null;
  }
}

async function getActiveInstanceToken(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("uazapi_instances")
    .select("instance_token, status")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getActiveInstanceToken db error:", error);
    throw new Response("Erro ao localizar instância WhatsApp.", { status: 500 });
  }
  if (!data?.instance_token) {
    throw new Response(
      "Nenhuma instância WhatsApp configurada. Peça a um administrador para conectar a integração.",
      { status: 503 }
    );
  }
  return data.instance_token;
}

/** Short URL-safe token used as the interactive button id (verify:<token>). */
function makeVerifyToken(): string {
  // 12 bytes -> 16 chars base64url (no padding) — short, unique, hard to guess
  return randomBytes(12).toString("base64url");
}

// ------------------------------------------------------------------
// sendPhoneVerification
// ------------------------------------------------------------------
export const sendPhoneVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z
      .object({
        phone: z.string().trim().min(10).max(20),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (phone.length < 12) {
      throw new Response("Número de celular inválido.", { status: 400 });
    }

    // Cooldown: prevent spamming the same number
    const { data: last } = await supabaseAdmin
      .from("phone_verifications")
      .select("id, created_at")
      .eq("phone", phone)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last) {
      const ageSec =
        (Date.now() - new Date(last.created_at).getTime()) / 1000;
      if (ageSec < RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - ageSec);
        throw new Response(
          `Aguarde ${wait}s para solicitar um novo código.`,
          { status: 429 }
        );
      }
    }

    // Generate a 6-digit numeric code
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);
    const verifyToken = makeVerifyToken();

    // Invalidate previous unverified codes for this phone
    await supabaseAdmin
      .from("phone_verifications")
      .delete()
      .eq("phone", phone)
      .is("verified_at", null);

    const { error: insertError } = await supabaseAdmin
      .from("phone_verifications")
      .insert({
        phone,
        code_hash: hashCode(code, phone),
        expires_at: expiresAt.toISOString(),
        ip_address: clientIp(),
        verify_token: verifyToken,
      });
    if (insertError) {
      console.error("phone_verifications insert failed:", insertError);
      throw new Response("Não foi possível gerar o código.", { status: 500 });
    }

    // Send WhatsApp message via uazapi.
    // We try the interactive menu (button) endpoint first — it gives the user
    // a "Copiar código" button and a "Já verifiquei" reply button that the
    // server will detect via webhook. If the server / WhatsApp client doesn't
    // accept it, we gracefully fall back to a plain text message.
    const token = await getActiveInstanceToken();
    const headline =
      `🔐 *Confirme seu cadastro*\n\n` +
      `Seu código de verificação é: *${code}*\n\n` +
      `_Toque em *Copiar código* para colar no formulário, ou em *✅ Já verifiquei* para confirmar automaticamente._\n\n` +
      `O código expira em 5 minutos. Nunca compartilhe com terceiros.`;

    let sent = false;
    try {
      await uazFetch("/send/menu", {
        method: "POST",
        instanceToken: token,
        body: {
          number: phone,
          type: "button",
          text: headline,
          choices: [
            `📋 Copiar código|copy:${code}`,
            `✅ Já verifiquei|verify:${verifyToken}`,
          ],
          footerText: "Verificação de cadastro",
        },
      });
      sent = true;
    } catch (err) {
      console.warn(
        "uazapi /send/menu failed, falling back to /send/text:",
        err
      );
    }

    if (!sent) {
      try {
        await uazFetch("/send/text", {
          method: "POST",
          instanceToken: token,
          body: {
            number: phone,
            text:
              `🔐 *Confirme seu cadastro*\n\n` +
              `Seu código de verificação é: *${code}*\n\n` +
              `Ele expira em 5 minutos. Não compartilhe com ninguém.`,
            linkPreview: false,
          },
        });
        sent = true;
      } catch (err) {
        console.error("uazapi send/text failed:", err);
      }
    }

    if (!sent) {
      // Best-effort cleanup so the user can retry quickly
      await supabaseAdmin
        .from("phone_verifications")
        .delete()
        .eq("phone", phone)
        .is("verified_at", null);
      throw new Response(
        "Não foi possível enviar a mensagem no WhatsApp. Verifique o número e tente novamente.",
        { status: 502 }
      );
    }

    return {
      success: true as const,
      expiresAt: expiresAt.toISOString(),
      cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    };
  });

// ------------------------------------------------------------------
// verifyPhoneCode
// ------------------------------------------------------------------
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
    const phone = normalizePhone(data.phone);

    const { data: row, error } = await supabaseAdmin
      .from("phone_verifications")
      .select("id, code_hash, expires_at, attempts, verified_at")
      .eq("phone", phone)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("verifyPhoneCode db error:", error);
      throw new Response("Erro ao validar código.", { status: 500 });
    }
    if (!row) {
      return {
        success: false as const,
        error: "no_code" as const,
        message: "Nenhum código ativo. Solicite um novo.",
      };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return {
        success: false as const,
        error: "expired" as const,
        message: "Código expirado. Solicite um novo.",
      };
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return {
        success: false as const,
        error: "too_many_attempts" as const,
        message: "Muitas tentativas. Solicite um novo código.",
      };
    }

    const provided = hashCode(data.code, phone);
    const ok =
      provided.length === row.code_hash.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(row.code_hash));

    if (!ok) {
      await supabaseAdmin
        .from("phone_verifications")
        .update({
          attempts: row.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return {
        success: false as const,
        error: "invalid_code" as const,
        message: "Código incorreto.",
        remainingAttempts: Math.max(0, MAX_ATTEMPTS - (row.attempts + 1)),
      };
    }

    await supabaseAdmin
      .from("phone_verifications")
      .update({
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return { success: true as const };
  });

// ------------------------------------------------------------------
// pollPhoneVerification — used by the client to detect when the user
// clicked the "✅ Já verifiquei" button on WhatsApp (verified via webhook).
// ------------------------------------------------------------------
export const pollPhoneVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z.object({ phone: z.string().trim().min(10).max(20) }).parse(input)
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const { data: row, error } = await supabaseAdmin
      .from("phone_verifications")
      .select("verified_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("pollPhoneVerification db error:", error);
      return { verified: false as const };
    }
    return { verified: Boolean(row?.verified_at) };
  });

/** Server-side check used by createRegistration to ensure the phone is verified. */
export async function assertPhoneVerified(phoneRaw: string): Promise<void> {
  const phone = normalizePhone(phoneRaw);
  const { data, error } = await supabaseAdmin
    .from("phone_verifications")
    .select("verified_at")
    .eq("phone", phone)
    .not("verified_at", "is", null)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("assertPhoneVerified db error:", error);
    throw new Response("Erro ao validar telefone.", { status: 500 });
  }
  if (!data?.verified_at) {
    throw new Response(
      "Você precisa validar o número de WhatsApp antes de finalizar o cadastro.",
      { status: 403 }
    );
  }
  // Optional: invalidate so the same code cannot be reused indefinitely
  // (we leave it valid here; createRegistration only runs once per attempt)
}