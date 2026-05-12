// Server-only Twilio SMS sender (Account SID + Auth Token).
// Used as an alternative channel to WhatsApp for phone verification.

function getTwilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new Response(
      "Twilio não configurado. Defina TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_FROM_NUMBER.",
      { status: 500 }
    );
  }
  return { sid, token, from };
}

/** Send an SMS via Twilio REST API. `to` must be E.164 (e.g. +5511912345678). */
export async function sendTwilioSms(to: string, body: string): Promise<void> {
  const { sid, token, from } = getTwilioConfig();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const params = new URLSearchParams({ To: to, From: from, Body: body });

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
    console.error("twilio network error:", err);
    throw new Response("Não foi possível conectar ao Twilio.", { status: 502 });
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`twilio sms failed [${res.status}]:`, text);
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string; code?: number };
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Response(`Twilio: ${msg}`, { status: 502 });
  }
}