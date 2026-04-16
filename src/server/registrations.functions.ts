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
  userAgent: z.string().trim().max(512).optional().default(""),
  screenResolution: z.string().trim().max(64).optional().default(""),
  language: z.string().trim().max(32).optional().default(""),
  timezone: z.string().trim().max(64).optional().default(""),
  platform: z.string().trim().max(64).optional().default(""),
});

export const createRegistration = createServerFn({ method: "POST" })
  .inputValidator((input) => registrationSchema.parse(input))
  .handler(async ({ data }) => {
    const ip =
      getRequestIP({ xForwardedFor: true }) ||
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-real-ip") ||
      null;

    const ua = data.userAgent || getRequestHeader("user-agent") || "";
    const parsed = parseUserAgent(ua);
    const geo = await lookupGeoFromIp(ip);

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

    const { error: insertError } = await supabaseAdmin
      .from("registrations")
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        photo_path: data.photoPath,
        device_fingerprint: data.deviceFingerprint,
        ip_address: ip,
        user_agent: ua || null,
        device_model: parsed.device_model,
        device_os: parsed.device_os,
        device_browser: parsed.device_browser,
        screen_resolution: data.screenResolution || null,
        device_language: data.language || null,
        device_timezone: data.timezone || null,
        device_platform: data.platform || null,
        geo_city: geo.geo_city,
        geo_region: geo.geo_region,
        geo_country: geo.geo_country,
      });

    if (insertError) {
      console.error("Insert failed:", insertError);
      await supabaseAdmin.storage
        .from("registration-photos")
        .remove([data.photoPath]);
      return { success: false as const, error: "insert_failed" as const };
    }

    return { success: true as const };
  });
