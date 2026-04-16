import { UAParser } from "ua-parser-js";

export interface ParsedUserAgent {
  device_model: string | null;
  device_os: string | null;
  device_browser: string | null;
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) {
    return { device_model: null, device_os: null, device_browser: null };
  }
  try {
    const parser = new UAParser(ua);
    const result = parser.getResult();

    const deviceVendor = result.device.vendor || "";
    const deviceModel = result.device.model || "";
    const deviceType = result.device.type || "desktop";

    const modelStr = [deviceVendor, deviceModel].filter(Boolean).join(" ").trim();
    const finalModel = modelStr ? `${modelStr} (${deviceType})` : deviceType;

    const osStr = [result.os.name, result.os.version].filter(Boolean).join(" ").trim();
    const browserStr = [result.browser.name, result.browser.version]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      device_model: finalModel || null,
      device_os: osStr || null,
      device_browser: browserStr || null,
    };
  } catch {
    return { device_model: null, device_os: null, device_browser: null };
  }
}

export interface GeoInfo {
  geo_city: string | null;
  geo_region: string | null;
  geo_country: string | null;
}

// Uses ip-api.com free tier (no key required, ~45 req/min per IP).
// Returns null fields when IP is private or lookup fails.
export async function lookupGeoFromIp(ip: string | null): Promise<GeoInfo> {
  if (!ip || isPrivateIp(ip)) {
    return { geo_city: null, geo_region: null, geo_country: null };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error("geo lookup failed");
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
    };
    if (data.status !== "success") {
      return { geo_city: null, geo_region: null, geo_country: null };
    }
    return {
      geo_city: data.city || null,
      geo_region: data.regionName || null,
      geo_country: data.country || null,
    };
  } catch {
    return { geo_city: null, geo_region: null, geo_country: null };
  }
}

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  return false;
}
