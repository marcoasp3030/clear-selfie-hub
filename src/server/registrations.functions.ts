import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const registrationSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(20),
  photoPath: z.string().trim().min(1).max(255),
  deviceFingerprint: z.string().trim().min(8).max(128),
});

export const createRegistration = createServerFn({ method: "POST" })
  .inputValidator((input) => registrationSchema.parse(input))
  .handler(async ({ data }) => {
    // Check if this device already registered
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
      // Cleanup orphan photo since we won't insert
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
