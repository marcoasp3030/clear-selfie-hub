import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { parseUserAgent, lookupGeoFromIp } from "./deviceParser";
import {
  findDuplicateRegistration,
  findFingerprintInDevice,
  hasVerifiedPhone,
  insertRegistration,
} from "./registrationsRepo.server";
import { deletePhoto } from "./storage.server";

function normalizePhoneE164(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

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
  cpf: z.string().trim().regex(/^\d{11}$/).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  deviceFingerprint: z.string().trim().min(8).max(128).optional(),
  deviceId: z.string().uuid().optional().nullable(),
});

export const checkExistingRegistration = createServerFn({ method: "POST" })
  .inputValidator((input) => checkExistingSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const row = await findDuplicateRegistration({
        cpf: data.cpf,
        phone: data.phone,
        deviceFingerprint: data.deviceFingerprint,
        deviceId: data.deviceId ?? null,
      });
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
    } catch (err) {
      console.error("checkExistingRegistration failed:", err);
      return { exists: false as const };
    }
  });

export const createRegistration = createServerFn({ method: "POST" })
  .inputValidator((input) => registrationSchema.parse(input))
  .handler(async ({ data }) => {
    const headerIp =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-real-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    // 1) Telefone tem que estar verificado
    const phoneE164 = normalizePhoneE164(data.phone);
    let verified = false;
    try {
      verified = await hasVerifiedPhone(phoneE164);
    } catch (err) {
      console.error("phone verification lookup failed:", err);
    }
    if (!verified) {
      await deletePhoto(data.photoPath).catch(() => {});
      return { success: false as const, error: "phone_not_verified" as const };
    }

    let ip: string | null = headerIp;
    if (!ip) {
      try {
        ip = getRequestIP({ xForwardedFor: true }) ?? null;
      } catch {
        ip = null;
      }
    }

    const headerUserAgent = getRequestHeader("user-agent") ?? "";
    const ua = data.userAgent?.trim() || headerUserAgent;
    const parsed = parseUserAgent(ua);
    const geo = await lookupGeoFromIp(ip);

    // 2) Duplicata por equipamento
    try {
      const existing = await findFingerprintInDevice(
        data.deviceFingerprint,
        data.deviceId ?? null,
      );
      if (existing) {
        await deletePhoto(data.photoPath).catch(() => {});
        return { success: false as const, error: "duplicate_device" as const };
      }
    } catch (err) {
      console.error("Fingerprint check failed:", err);
      return { success: false as const, error: "check_failed" as const };
    }

    try {
      const inserted = await insertRegistration({
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
      });
      return { success: true as const, registrationId: inserted.id };
    } catch (err) {
      console.error("Insert failed:", err);
      await deletePhoto(data.photoPath).catch(() => {});
      return { success: false as const, error: "insert_failed" as const };
    }
  });
