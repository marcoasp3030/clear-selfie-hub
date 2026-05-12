// Server-only Twilio SMS sender (Account SID + Auth Token).
// Used as an alternative channel to WhatsApp for phone verification.

function getTwilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.error("[twilio] missing config", {
      hasSid: Boolean(sid),
      hasToken: Boolean(token),
      hasFrom: Boolean(from),
    });
    throw new Response(
      "Twilio não configurado. Defina TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_FROM_NUMBER.",
      { status: 500 }
    );
  }
  // Twilio expects E.164 (e.g. +15551234567). Normalize the FROM to ensure
  // the leading "+" is present even if the user pasted "15551234567".
  const normalizedFrom = from.trim().startsWith("+")
    ? from.trim()
    : `+${from.trim().replace(/\D/g, "")}`;
  return { sid: sid.trim(), token: token.trim(), from: normalizedFrom };
}

/** Send an SMS via Twilio REST API. `to` must be E.164 (e.g. +5511912345678). */
export async function sendTwilioSms(to: string, body: string): Promise<void> {
  const { sid, token, from } = getTwilioConfig();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  // Use btoa for portability across Node + Cloudflare Worker runtimes.
  const auth = btoa(`${sid}:${token}`);

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  console.log(`[twilio] sending SMS to=${to} from=${from} sid=${sid.slice(0, 6)}...`);

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
    const cause =
      err instanceof Error && "cause" in err ? String((err as { cause?: unknown }).cause) : "";
    console.error(`[twilio] fetch threw -> ${msg} | cause=${cause}`);
    throw new Response(`Falha de rede ao conectar ao Twilio: ${msg}`, { status: 502 });
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`[twilio] HTTP ${res.status}: ${text}`);
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string; code?: number };
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Response(`Twilio: ${msg}`, { status: 502 });
  }
  console.log(`[twilio] SMS accepted by API (HTTP ${res.status})`);
}