type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type UazapiLogEvent = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  action: string;
  method?: string;
  path?: string;
  status?: number;
  ms?: number;
  ok?: boolean;
  requestBody?: JsonValue;
  responsePreview?: JsonValue;
  error?: string;
};

const MAX_EVENTS = 80;
const events: UazapiLogEvent[] = [];

type UazapiLogInput = Omit<UazapiLogEvent, "id" | "at" | "requestBody" | "responsePreview"> & {
  requestBody?: unknown;
  responsePreview?: unknown;
};

function safePreview(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.startsWith("data:image") || value.length > 400) {
      return `${value.slice(0, 120)}… (len=${value.length})`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 5).map(safePreview);
  if (typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const k = key.toLowerCase();
      if (k.includes("token") || k.includes("secret") || k.includes("password")) {
        out[key] = val ? "***" : null;
      } else if (k.includes("qrcode")) {
        out[key] = typeof val === "string" ? `${val.slice(0, 80)}… (len=${val.length})` : safePreview(val);
      } else {
        out[key] = safePreview(val);
      }
    }
    return out;
  }
  return String(value);
}

export function logUazapiEvent(event: UazapiLogInput) {
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