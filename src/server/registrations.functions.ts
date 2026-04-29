import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseUserAgent, lookupGeoFromIp } from "./deviceParser";

const registrationSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(20),
  cpf: z.string().trim().regex(/^\d{11}$/, "CPF must be 11 digits"),
  photoPath: z.string().trim().min(1).max(255),
  deviceFingerprint: z.string().trim().min(8).max(128),
  deviceId: z.string().uuid().optional().nullable(),
  userAgent: z.string().trim().max(2048).optional().default(""),
  screenResolution: z.string().trim().max(64).optional().default(""),
  language: z.string().trim().max(32).optional().default(""),
  timezone: z.string().trim().max(64).optional().default(""),
  platform: z.string().trim().max(64).optional().default(""),
});

const checkExistingSchema = z.object({
  cpf: z.string().trim().regex(/^\d{11}$/, "CPF must be 11 digits").optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  deviceFingerprint: z.string().trim().min(8).max(128).optional(),
  deviceId: z.string().uuid().optional().nullable(),
});

export const checkExistingRegistration = createServerFn({ method: "POST" })
  .inputValidator((input) => checkExistingSchema.parse(input))
  .handler(async ({ data }) => {
    if (!data.cpf && !data.phone && !data.deviceFingerprint) {
      return { exists: false as const };
    }

    const filters: string[] = [];
    if (data.cpf) filters.push(`cpf.eq.${data.cpf}`);
    if (data.phone) filters.push(`phone.eq.${data.phone}`);
    if (data.deviceFingerprint)
      filters.push(`device_fingerprint.eq.${data.deviceFingerprint}`);

    let query = supabaseAdmin
      .from("registrations")
      .select("id, cpf, phone, device_fingerprint, first_name, last_name, created_at")
      .or(filters.join(","));

    // Duplicate is scoped per equipment: same user CAN register on a different device.
    if (data.deviceId) {
      query = query.eq("device_id", data.deviceId);
    } else {
      query = query.is("device_id", null);
    }

    const { data: row, error } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("checkExistingRegistration failed:", error);
      return { exists: false as const };
    }

    if (!row) return { exists: false as const };

    let matchedBy: "cpf" | "phone" | "device" = "device";
    if (data.cpf && row.cpf === data.cpf) matchedBy = "cpf";
    else if (data.phone && row.phone === data.phone) matchedBy = "phone";

    return {
      exists: true as const,
      matchedBy,
      firstName: row.first_name,
      lastName: row.last_name,
      createdAt: row.created_at,
    };
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

    // Duplicate check is scoped per equipment: the same browser/device can be
    // used to register the same person on different equipments, but not twice
    // on the same equipment.
    let dupQuery = supabaseAdmin
      .from("registrations")
      .select("id")
      .eq("device_fingerprint", data.deviceFingerprint);

    if (data.deviceId) {
      dupQuery = dupQuery.eq("device_id", data.deviceId);
    } else {
      dupQuery = dupQuery.is("device_id", null);
    }

    const { data: existing, error: checkError } = await dupQuery
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
      cpf: data.cpf,
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

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("registrations")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("Insert failed:", insertError);
      await supabaseAdmin.storage
        .from("registration-photos")
        .remove([data.photoPath]);
      return { success: false as const, error: "insert_failed" as const };
    }

    return { success: true as const, registrationId: inserted.id };
  });
