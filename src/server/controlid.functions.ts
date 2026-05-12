import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { syncRegistrationToControlId } from "./controlid.server";
import { assertAdminAccess } from "./admin.server";
import {
  getRegistrationForSync,
  listPendingSyncRegistrations,
  updateRegistrationSync,
} from "./registrationsRepo.server";
import { findDeviceById } from "./devicesRepo.server";
import { readPhoto } from "./storage.server";

const accessTokenSchema = z.string().trim().min(1);

async function downloadPhotoBase64(
  photoPath: string,
): Promise<string | { error: string }> {
  try {
    const { body } = await readPhoto(photoPath);
    return Buffer.from(body).toString("base64");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "arquivo não encontrado";
    return { error: `Falha ao ler a foto: ${msg}` };
  }
}

/**
 * Internal helper used both by the public auto-sync (after registration)
 * and the admin retry endpoint. Updates the registration row with the result.
 */
async function runSync(registrationId: string): Promise<
  { success: true; deviceUserId: number } | { success: false; error: string }
> {
  const reg = await getRegistrationForSync(registrationId).catch(() => null);
  if (!reg) {
    return { success: false, error: "Cadastro não encontrado." };
  }
  if (!reg.device_id) {
    const msg = "Cadastro não está vinculado a um equipamento.";
    await updateRegistrationSync(registrationId, {
      device_sync_status: "error",
      device_sync_error: msg,
      device_sync_attempted_at: new Date().toISOString(),
    });
    return { success: false, error: msg };
  }

  const device = await findDeviceById(reg.device_id).catch(() => null);
  if (!device) {
    const msg = "Equipamento não encontrado.";
    await updateRegistrationSync(registrationId, {
      device_sync_status: "error",
      device_sync_error: msg,
      device_sync_attempted_at: new Date().toISOString(),
    });
    return { success: false, error: msg };
  }

  if (!device.api_login || !device.api_password) {
    const msg = "Equipamento sem credenciais (login/senha) configuradas.";
    await updateRegistrationSync(registrationId, {
      device_sync_status: "error",
      device_sync_error: msg,
      device_sync_attempted_at: new Date().toISOString(),
    });
    return { success: false, error: msg };
  }

  const photo = await downloadPhotoBase64(reg.photo_path);
  if (typeof photo !== "string") {
    await updateRegistrationSync(registrationId, {
      device_sync_status: "error",
      device_sync_error: photo.error,
      device_sync_attempted_at: new Date().toISOString(),
    });
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
    await updateRegistrationSync(registrationId, {
      device_sync_status: "success",
      device_sync_user_id: result.deviceUserId,
      device_sync_error: null,
      device_sync_attempted_at: new Date().toISOString(),
    });
    return { success: true, deviceUserId: result.deviceUserId };
  }

  await updateRegistrationSync(registrationId, {
    device_sync_status: "error",
    device_sync_error: result.error,
    device_sync_attempted_at: new Date().toISOString(),
  });
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
    await assertAdminAccess(data.accessToken);
    return runSync(data.registrationId);
  });

/**
 * Admin: lista cadastros pendentes/com erro de sincronização (offline).
 */
export const listPendingSyncs = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: accessTokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const rows = await listPendingSyncRegistrations(500);
    return { rows };
  });

/**
 * Admin: reprocessa em massa todos os cadastros pendentes/com erro.
 * Roda sequencialmente para não sobrecarregar o equipamento.
 */
export const bulkRetrySync = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        accessToken: accessTokenSchema,
        ids: z.array(z.string().uuid()).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);

    let targets = data.ids ?? [];
    if (targets.length === 0) {
      const pending = await listPendingSyncRegistrations(500);
      targets = pending.map((r) => r.id);
    }

    let success = 0;
    let failed = 0;
    const failures: Array<{ id: string; error: string }> = [];

    for (const id of targets) {
      try {
        const r = await runSync(id);
        if (r.success) success++;
        else {
          failed++;
          failures.push({ id, error: r.error });
        }
      } catch (err) {
        failed++;
        failures.push({
          id,
          error: err instanceof Error ? err.message : "Erro inesperado",
        });
      }
    }

    return {
      total: targets.length,
      success,
      failed,
      failures: failures.slice(0, 20),
    };
  });