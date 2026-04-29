import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseUserAgent, lookupGeoFromIp } from "./deviceParser";

const registrationSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(20),
  photoPath: z.string().trim().min(1).max(255),
  deviceFingerprint: z.string().trim().min(8).max(128),
  deviceId: z.string().uuid().optional().nullable(),
  userAgent: z.string().trim().max(2048).optional().default(""),
  screenResolution: z.string().trim().max(64).optional().default(""),
  language: z.string().trim().max(32).optional().default(""),
  timezone: z.string().trim().max(64).optional().default(""),
  platform: z.string().trim().max(64).optional().default(""),
});

export const createRegistration = createServerFn({ method: "POST" })
  .inputValidator((input) => registrationSchema.parse(input))
  .handler(async ({ data }) => {
    const headerIp =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-real-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    let ip: string | null = headerIp;
    if (!ip) {
      try {
        ip = getRequestIP({ xForwardedFor: true }) ?? null;
      } catch (err) {
        console.warn("getRequestIP failed:", err);
        ip = null;
      }
    }

    const headerUserAgent = getRequestHeader("user-agent") ?? "";
    const ua = data.userAgent?.trim() || headerUserAgent;
    const parsed = parseUserAgent(ua);
    const geo = await lookupGeoFromIp(ip);

    console.log("[createRegistration] payload diagnostic", {
      hasUserAgent: Boolean(data.userAgent),
      userAgentLength: data.userAgent?.length ?? 0,
      headerUserAgentLength: headerUserAgent.length,
      finalUaLength: ua.length,
      screenResolution: data.screenResolution,
      language: data.language,
      timezone: data.timezone,
      platform: data.platform,
      fingerprintLength: data.deviceFingerprint?.length ?? 0,
      ipResolved: Boolean(ip),
      geo,
      parsed,
    });

    const { data: existing, error: checkError } = await supabaseAdmin
      .from("registrations")
      .select("id")
      .eq("device_fingerprint", data.deviceFingerprint)
      .limit(1)
      .maybeSingle();

    if (checkError) {
      console.error("Fingerprint check failed:", checkError);
      return { success: false as const, error: "check_failed" as const };
    }

    if (existing) {
      await supabaseAdmin.storage
        .from("registration-photos")
        .remove([data.photoPath]);
      return { success: false as const, error: "duplicate_device" as const };
    }

    const insertPayload = {
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      photo_path: data.photoPath,
      device_fingerprint: data.deviceFingerprint,
      device_id: data.deviceId ?? null,
      ip_address: ip,
      user_agent: ua || null,
      device_model: parsed.device_model,
      device_os: parsed.device_os,
      device_browser: parsed.device_browser,
      screen_resolution: data.screenResolution?.trim() || null,
      device_language: data.language?.trim() || null,
      device_timezone: data.timezone?.trim() || null,
      device_platform: data.platform?.trim() || null,
      geo_city: geo.geo_city,
      geo_region: geo.geo_region,
      geo_country: geo.geo_country,
    };

    console.log("[createRegistration] insert payload", {
      ...insertPayload,
      user_agent: insertPayload.user_agent
        ? `${insertPayload.user_agent.slice(0, 80)}…`
        : null,
    });

    const { error: insertError } = await supabaseAdmin
      .from("registrations")
      .insert(insertPayload);

    if (insertError) {
      console.error("Insert failed:", insertError);
      await supabaseAdmin.storage
        .from("registration-photos")
        .remove([data.photoPath]);
      return { success: false as const, error: "insert_failed" as const };
    }

    return { success: true as const };
  });
