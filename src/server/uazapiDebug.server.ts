type UazapiLogEvent = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  action: string;
  method?: string;
  path?: string;
  status?: number;
  ms?: number;
  ok?: boolean;
  requestBody?: unknown;
  responsePreview?: unknown;
  error?: string;
};

const MAX_EVENTS = 80;
const events: UazapiLogEvent[] = [];

function safePreview(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.startsWith("data:image") || value.length > 400) {
      return `${value.slice(0, 120)}… (len=${value.length})`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 5).map(safePreview);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const k = key.toLowerCase();
      if (k.includes("token") || k.includes("secret") || k.includes("password")) {
        out[key] = val ? "***" : val;
      } else if (k.includes("qrcode")) {
        out[key] = typeof val === "string" ? `${val.slice(0, 80)}… (len=${val.length})` : safePreview(val);
      } else {
        out[key] = safePreview(val);
      }
    }
    return out;
  }
  return value;
}

export function logUazapiEvent(event: Omit<UazapiLogEvent, "id" | "at">) {
  const item: UazapiLogEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...event,
    requestBody: safePreview(event.requestBody),
    responsePreview: safePreview(event.responsePreview),
  };
  events.unshift(item);
  events.splice(MAX_EVENTS);
}

export function getUazapiLogEvents() {
  return [...events];
}