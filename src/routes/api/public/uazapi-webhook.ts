import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * uazapi webhook receiver.
 *
 * Configure in the uazapi dashboard / API to POST message events to:
 *   https://<your-domain>/api/public/uazapi-webhook
 *
 * We look for inbound button replies whose selected button id starts with
 * "verify:<token>" and mark the matching phone_verifications row as verified.
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
  if (depth > 6 || node == null) return;
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

/** Best-effort sender phone extraction (E.164 digits). */
function extractFromNumber(payload: unknown): string | null {
  const obj = asObject(payload);
  if (!obj) return null;

  const candidates: unknown[] = [
    obj.from,
    obj.sender,
    obj.chatid,
    obj.chatId,
    asObject(obj.message)?.from,
    asObject(obj.message)?.sender,
    asObject(obj.data)?.from,
    asObject(obj.data)?.sender,
    asObject(obj.data)?.chatid,
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
  return null;
}

async function handleWebhook(request: Request): Promise<Response> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // uazapi may also send form-encoded — accept and ignore
    return new Response("ok", { status: 200 });
  }

  const token = extractVerifyToken(payload);
  if (!token) {
    // Not a verification reply — acknowledge and exit quietly.
    return new Response("ok", { status: 200 });
  }

  const fromPhone = extractFromNumber(payload);
  console.log("[uazapi-webhook] verify button click", {
    token,
    fromPhone,
  });

  // Look up the verification row by token (and optionally cross-check phone).
  const { data: row, error } = await supabaseAdmin
    .from("phone_verifications")
    .select("id, phone, expires_at, verified_at")
    .eq("verify_token", token)
    .maybeSingle();

  if (error) {
    console.error("[uazapi-webhook] lookup error:", error);
    return new Response("ok", { status: 200 });
  }
  if (!row) {
    console.warn("[uazapi-webhook] unknown verify token:", token);
    return new Response("ok", { status: 200 });
  }
  if (row.verified_at) {
    return new Response("ok", { status: 200 });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    console.warn("[uazapi-webhook] verify token expired");
    return new Response("ok", { status: 200 });
  }

  // Cross-check sender phone if we could parse one — must match the row.
  if (fromPhone && !row.phone.endsWith(fromPhone) && !fromPhone.endsWith(row.phone)) {
    console.warn("[uazapi-webhook] sender phone mismatch", {
      expected: row.phone,
      got: fromPhone,
    });
    return new Response("ok", { status: 200 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("phone_verifications")
    .update({
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (updateError) {
    console.error("[uazapi-webhook] update error:", updateError);
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