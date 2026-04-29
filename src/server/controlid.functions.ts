import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabaseAdmin.server";
import type { Database } from "@/integrations/supabase/types";
import { syncRegistrationToControlId } from "./controlid.server";

const accessTokenSchema = z.string().trim().min(1);

let authClient: ReturnType<typeof createClient<Database>> | undefined;
function getAuthClient() {
  if (!authClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Response("Internal error", { status: 500 });
    authClient = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
  }
  return authClient;
}

async function assertAdmin(accessToken: string): Promise<void> {
  const { data, error } = await getAuthClient().auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) throw new Response("Unauthorized", { status: 401 });
  const userId = data.claims.sub;
  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleErr || !roleRow) throw new Response("Forbidden", { status: 403 });
}

async function downloadPhotoBase64(photoPath: string): Promise<string | { error: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from("registration-photos")
    .download(photoPath);
  if (error || !data) return { error: `Falha ao ler a foto: ${error?.message ?? "arquivo não encontrado"}` };
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.toString("base64");
}

/**
 * Internal helper used both by the public auto-sync (after registration)
 * and the admin retry endpoint. Updates the registration row with the result.
 */
async function runSync(registrationId: string): Promise<
  { success: true; deviceUserId: number } | { success: false; error: string }
> {
  const { data: reg, error: regErr } = await supabaseAdmin
    .from("registrations")
    .select("id,first_name,last_name,phone,cpf,photo_path,device_id")
    .eq("id", registrationId)
    .maybeSingle();

  if (regErr || !reg) {
    return { success: false, error: "Cadastro não encontrado." };
  }
  if (!reg.device_id) {
    const msg = "Cadastro não está vinculado a um equipamento.";
    await supabaseAdmin
      .from("registrations")
      .update({
        device_sync_status: "error",
        device_sync_error: msg,
        device_sync_attempted_at: new Date().toISOString(),
      })
      .eq("id", registrationId);
    return { success: false, error: msg };
  }

  const { data: device, error: devErr } = await supabaseAdmin
    .from("devices")
    .select("api_base_url,api_login,api_password")
    .eq("id", reg.device_id)
    .maybeSingle();

  if (devErr || !device) {
    const msg = "Equipamento não encontrado.";
    await supabaseAdmin
      .from("registrations")
      .update({
        device_sync_status: "error",
        device_sync_error: msg,
        device_sync_attempted_at: new Date().toISOString(),
      })
      .eq("id", registrationId);
    return { success: false, error: msg };
  }

  if (!device.api_login || !device.api_password) {
    const msg = "Equipamento sem credenciais (login/senha) configuradas.";
    await supabaseAdmin
      .from("registrations")
      .update({
        device_sync_status: "error",
        device_sync_error: msg,
        device_sync_attempted_at: new Date().toISOString(),
      })
      .eq("id", registrationId);
    return { success: false, error: msg };
  }

  const photo = await downloadPhotoBase64(reg.photo_path);
  if (typeof photo !== "string") {
    await supabaseAdmin
      .from("registrations")
      .update({
        device_sync_status: "error",
        device_sync_error: photo.error,
        device_sync_attempted_at: new Date().toISOString(),
      })
      .eq("id", registrationId);
    return { success: false, error: photo.error };
  }

  const result = await syncRegistrationToControlId({
    apiBaseUrl: device.api_base_url,
    apiLogin: device.api_login,
    apiPassword: device.api_password,
    firstName: reg.first_name,
    lastName: reg.last_name,
    phone: reg.phone,
    cpf: reg.cpf ?? "",
    imageBase64: photo,
  });

  if (result.success) {
    await supabaseAdmin
      .from("registrations")
      .update({
        device_sync_status: "success",
        device_sync_user_id: result.deviceUserId,
        device_sync_error: null,
        device_sync_attempted_at: new Date().toISOString(),
      })
      .eq("id", registrationId);
    return { success: true, deviceUserId: result.deviceUserId };
  }

  await supabaseAdmin
    .from("registrations")
    .update({
      device_sync_status: "error",
      device_sync_error: result.error,
      device_sync_attempted_at: new Date().toISOString(),
    })
    .eq("id", registrationId);
  return { success: false, error: result.error };
}

/**
 * Public endpoint called immediately after a successful registration.
 * Does NOT require admin auth (the registration was just created publicly).
 * It only operates on the registration ID returned from createRegistration.
 */
export const syncRegistration = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ registrationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    return runSync(data.registrationId);
  });

/**
 * Admin-only retry endpoint (used by the admin UI button).
 */
export const retrySyncRegistration = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        accessToken: accessTokenSchema,
        registrationId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    return runSync(data.registrationId);
  });