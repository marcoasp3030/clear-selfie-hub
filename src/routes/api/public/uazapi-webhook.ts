import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * uazapi webhook receiver.
 *
 * Configure in the uazapi dashboard / API to POST message events to:
 *   https://<your-domain>/api/public/uazapi-webhook
 *
 * Strategy (in order):
 *   1) If any string in the payload contains "verify:<token>", look the row
 *      up by token and mark it verified.
 *   2) Otherwise, if we can extract the sender phone AND a recent reply text
 *      that matches our verify button label ("já verifiquei", "verifiquei",
 *      "verificar", etc.), look up the latest unverified row for that phone
 *      and mark it verified.
 *
 * The route is intentionally tolerant of multiple payload shapes because
 * uazapi delivers different envelopes for different event types.
 */

type AnyRecord = Record<string, unknown>;

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asObject(v: unknown): AnyRecord | null {
  return v && typeof v === "object" ? (v as AnyRecord) : null;
}

/** Walk the payload and collect every string value that looks like
 *  a button id / selected reply (selectedButtonId, buttonId, id, body, text...). */
function collectCandidateStrings(node: unknown, out: string[], depth = 0): void {
  if (depth > 8 || node == null) return;
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectCandidateStrings(item, out, depth + 1);
    return;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node as AnyRecord)) {
      collectCandidateStrings(v, out, depth + 1);
    }
  }
}

function extractVerifyToken(payload: unknown): string | null {
  const strings: string[] = [];
  collectCandidateStrings(payload, strings);
  for (const s of strings) {
    // Accept "verify:TOKEN" anywhere in any string value
    const m = s.match(/verify:([A-Za-z0-9_\-]{8,64})/);
    if (m) return m[1];
  }
  return null;
}

/** True if any string in the payload looks like a "Já verifiquei" reply. */
function looksLikeVerifyClick(payload: unknown): boolean {
  const strings: string[] = [];
  collectCandidateStrings(payload, strings);
  const re = /(j[áa]\s*verifiquei|^verifiquei$|verificar|✅\s*j[áa]\s*verifiquei)/i;
  for (const s of strings) {
    if (s.length > 200) continue; // skip giant blobs
    if (re.test(s.trim())) return true;
  }
  return false;
}

/** Best-effort sender phone extraction (E.164 digits). */
function extractFromNumber(payload: unknown): string | null {
  const obj = asObject(payload);
  if (!obj) return null;

  const candidates: unknown[] = [
    obj.from,
    obj.sender,
    obj.chatid,
    obj.chatId,
    obj.phone,
    obj.number,
    asObject(obj.message)?.from,
    asObject(obj.message)?.sender,
    asObject(obj.message)?.chatid,
    asObject(obj.message)?.sender_lid,
    asObject(obj.data)?.from,
    asObject(obj.data)?.sender,
    asObject(obj.data)?.chatid,
    asObject(obj.data)?.phone,
    asObject(obj.data)?.number,
    asObject(asObject(obj.data)?.key)?.remoteJid,
    asObject(asObject(obj.message)?.key)?.remoteJid,
    asObject(obj.key)?.remoteJid,
  ];
  for (const c of candidates) {
    const s = asString(c);
    if (!s) continue;
    const digits = s.replace(/\D/g, "");
    if (digits.length >= 10) return digits;
  }
  // Last-resort: scan any string in the payload for a JID-shaped token
  const strings: string[] = [];
  collectCandidateStrings(payload, strings);
  for (const s of strings) {
    const m = s.match(/(\d{10,15})@s\.whatsapp\.net/);
    if (m) return m[1];
  }
  return null;
}

async function markVerifiedById(rowId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("phone_verifications")
    .update({
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId);
  if (error) console.error("[uazapi-webhook] update error:", error);
}

async function handleWebhook(request: Request): Promise<Response> {
  let payload: unknown = null;
  let raw = "";
  try {
    raw = await request.text();
    if (raw) payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }
  console.log(
    "[uazapi-webhook] received:",
    typeof payload === "object"
      ? JSON.stringify(payload).slice(0, 2000)
      : String(payload).slice(0, 2000)
  );

  const token = extractVerifyToken(payload);
  const fromPhone = extractFromNumber(payload);
  console.log("[uazapi-webhook] parsed:", { token, fromPhone });

  // Path 1: explicit verify:TOKEN id from interactive button
  if (token) {
    const { data: row } = await supabaseAdmin
      .from("phone_verifications")
      .select("id, phone, expires_at, verified_at")
      .eq("verify_token", token)
      .maybeSingle();
    if (row && !row.verified_at && new Date(row.expires_at).getTime() >= Date.now()) {
      await markVerifiedById(row.id);
      console.log("[uazapi-webhook] verified by token");
      return new Response("ok", { status: 200 });
    }
    console.warn("[uazapi-webhook] token row not usable", { token, row });
  }

  // Path 2: matched by sender phone + recognizable reply text
  if (fromPhone && looksLikeVerifyClick(payload)) {
    const { data: rows } = await supabaseAdmin
      .from("phone_verifications")
      .select("id, phone, expires_at, verified_at")
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    const match = (rows ?? []).find((r) => {
      const a = r.phone.replace(/\D/g, "");
      const b = fromPhone.replace(/\D/g, "");
      return a.endsWith(b) || b.endsWith(a);
    });
    if (match && new Date(match.expires_at).getTime() >= Date.now()) {
      await markVerifiedById(match.id);
      console.log("[uazapi-webhook] verified by phone+text");
      return new Response("ok", { status: 200 });
    }
    console.warn("[uazapi-webhook] no matching unverified row for phone", fromPhone);
  }

  return new Response("ok", { status: 200 });
}

export const Route = createFileRoute("/api/public/uazapi-webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleWebhook(request),
      // Allow GET for connectivity checks from the uazapi dashboard
      GET: () => new Response("uazapi-webhook ok", { status: 200 }),
    },
  },
});