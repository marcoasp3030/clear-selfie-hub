import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import {
  deleteDevice as deleteDeviceRow,
  findDeviceBySlug,
  insertDevice,
  listDevices as listDevicesRows,
  slugExists,
  type DeviceRow,
} from "./devicesRepo.server";
import { listDevicesByName } from "./devicesRepo.server";
import { probeDeviceOnline } from "./controlid.server";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const accessTokenSchema = z.string().trim().min(1);

const createSchema = z.object({
  accessToken: accessTokenSchema,
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).optional(),
  apiBaseUrl: z
    .string()
    .trim()
    .min(8)
    .max(255)
    .url("URL inválida")
    .refine((u) => /^https?:\/\//i.test(u), "URL deve começar com http:// ou https://"),
  apiLogin: z.string().trim().min(1).max(120),
  apiPassword: z.string().trim().min(1).max(255),
});

export type { DeviceRow };

export const listDevices = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: accessTokenSchema }).parse(input))
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const devices = await listDevicesRows();
    return { devices };
  });

export const createDevice = createServerFn({ method: "POST" })
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const userId = await assertAdminAccess(data.accessToken);

    let slug = (data.slug && data.slug.length > 0 ? data.slug : slugify(data.name)).toLowerCase();
    slug = slug.replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
    if (!slugRegex.test(slug)) {
      return { success: false as const, error: "invalid_slug" as const };
    }
    if (await slugExists(slug)) {
      return { success: false as const, error: "duplicate_slug" as const };
    }
    const inserted = await insertDevice({
      name: data.name,
      slug,
      api_base_url: data.apiBaseUrl.replace(/\/+$/, ""),
      api_login: data.apiLogin,
      api_password: data.apiPassword,
      created_by: userId,
    });
    if (!inserted) {
      return { success: false as const, error: "insert_failed" as const };
    }
    return { success: true as const, device: inserted };
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: accessTokenSchema, id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const res = await deleteDeviceRow(data.id);
    if (res.error) return { success: false as const, error: res.error };
    return { success: true as const };
  });

// Public lookup by slug — used by the public registration page.
export const getDeviceBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ slug: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const device = await findDeviceBySlug(data.slug.toLowerCase());
    return { device };
  });

/**
 * Público: lista os equipamentos da mesma "loja" (mesmo nome) e o status
 * online/offline de cada um. Usado na tela de cadastro pra mostrar onde o
 * cadastro será replicado.
 */
export const getStoreDevicesStatus = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ slug: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const device = await findDeviceBySlug(data.slug.toLowerCase());
    if (!device) return { storeName: "", devices: [] as Array<{
      id: string; name: string; online: boolean; error?: string;
    }> };
    const siblings = await listDevicesByName(device.name).catch(() => []);
    const targets = siblings.length > 0 ? siblings : [];
    const results = await Promise.all(
      targets.map(async (t) => {
        const r = await probeDeviceOnline(t.api_base_url, t.api_login, t.api_password);
        return {
          id: t.id,
          name: t.name,
          online: r.online,
          error: r.online ? undefined : r.error,
        };
      }),
    );
    return { storeName: device.name, devices: results };
  });