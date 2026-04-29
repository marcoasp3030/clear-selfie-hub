import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { assertAdminAccess } from "./admin.functions";
import { uazFetch } from "./uazapi.server";

const accessTokenSchema = z.string().trim().min(1);

type Instance = {
  id?: string;
  token?: string;
  name?: string;
  status?: string; // "disconnected" | "connecting" | "connected"
  paircode?: string;
  qrcode?: string;
  owner?: string; // jid like 5511...@s.whatsapp.net
  profileName?: string;
};

function pickStatus(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "disconnected";
  const obj = raw as Record<string, unknown>;
  const candidates = [obj.status, obj.state, obj.connectionStatus];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return "disconnected";
}

/** Returns the saved instance row (the project uses a single global instance). */
async function getSavedInstance() {
  const { data, error } = await supabaseAdmin
    .from("uazapi_instances")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Failed to load uazapi_instances:", error);
    throw new Response("Erro ao ler instância salva.", { status: 500 });
  }
  return data;
}

async function persistFromStatus(
  rowId: string,
  payload: Instance & Record<string, unknown>
) {
  const status = pickStatus(payload);
  const update: Database["public"]["Tables"]["uazapi_instances"]["Update"] = {
    status,
    last_status_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (typeof payload.owner === "string") {
    update.owner_jid = payload.owner;
    const phone = payload.owner.split("@")[0]?.replace(/\D/g, "") ?? null;
    if (phone) update.phone_connected = phone;
  }
  if (typeof payload.profileName === "string") {
    update.profile_name = payload.profileName;
  }
  if (typeof payload.id === "string") update.instance_id = payload.id;
  if (typeof payload.token === "string") update.instance_token = payload.token;

  const { error } = await supabaseAdmin
    .from("uazapi_instances")
    .update(update)
    .eq("id", rowId);
  if (error) console.error("Failed to update uazapi_instances:", error);
}

// ------------------------------------------------------------------
// Public server functions
// ------------------------------------------------------------------

/** Returns the saved instance, if any. */
export const getInstance = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const row = await getSavedInstance();
    return { instance: row };
  });

/** Creates a new instance on the uazapi server and persists token+id locally. */
export const createInstance = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; name: string }) =>
    z
      .object({
        accessToken: accessTokenSchema,
        name: z.string().trim().min(1).max(120),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const userId = await assertAdminAccess(data.accessToken);

    const created = await uazFetch<Instance & Record<string, unknown>>(
      "/instance/init",
      {
        method: "POST",
        admin: true,
        body: { name: data.name },
      }
    );

    const instanceToken =
      (typeof created?.token === "string" && created.token) ||
      (typeof (created as Record<string, unknown>)?.["instance_token"] === "string"
        ? String((created as Record<string, unknown>)["instance_token"])
        : null);
    const instanceId =
      (typeof created?.id === "string" && created.id) ||
      (typeof (created as Record<string, unknown>)?.["instance_id"] === "string"
        ? String((created as Record<string, unknown>)["instance_id"])
        : null);

    if (!instanceToken) {
      console.error("uazapi /instance/init missing token:", created);
      throw new Response("Resposta inesperada da uazapi (sem token).", {
        status: 502,
      });
    }

    // Replace any previous saved instance (single global one).
    const existing = await getSavedInstance();
    if (existing) {
      await supabaseAdmin
        .from("uazapi_instances")
        .delete()
        .eq("id", existing.id);
    }

    const { data: row, error } = await supabaseAdmin
      .from("uazapi_instances")
      .insert({
        name: data.name,
        instance_token: instanceToken,
        instance_id: instanceId,
        status: pickStatus(created),
        created_by: userId,
      })
      .select("*")
      .single();

    if (error || !row) {
      console.error("Failed to save instance:", error);
      throw new Response("Erro ao salvar instância.", { status: 500 });
    }

    return { instance: row };
  });

/** Asks uazapi to start the QR pairing process. Returns qrcode (base64 png). */
export const connectInstance = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; phone?: string }) =>
    z
      .object({
        accessToken: accessTokenSchema,
        phone: z.string().trim().max(20).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const row = await getSavedInstance();
    if (!row?.instance_token) {
      throw new Response("Nenhuma instância criada.", { status: 400 });
    }

    const body: Record<string, unknown> = {};
    if (data.phone) body.phone = data.phone.replace(/\D/g, "");

    const res = await uazFetch<Instance & Record<string, unknown>>(
      "/instance/connect",
      {
        method: "POST",
        instanceToken: row.instance_token,
        body,
      }
    );

    await supabaseAdmin
      .from("uazapi_instances")
      .update({
        last_qr_at: new Date().toISOString(),
        status: pickStatus(res) || "connecting",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return {
      status: pickStatus(res),
      qrcode: typeof res.qrcode === "string" ? res.qrcode : null,
      paircode: typeof res.paircode === "string" ? res.paircode : null,
    };
  });

/** Polls instance status. Auto-syncs status to DB. */
export const getInstanceStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const row = await getSavedInstance();
    if (!row?.instance_token) {
      return { status: "no_instance" as const, qrcode: null, instance: null };
    }

    const res = await uazFetch<Record<string, unknown>>("/instance/status", {
      method: "GET",
      instanceToken: row.instance_token,
    });

    // uazapi often nests under "instance"
    const inst =
      (res.instance && typeof res.instance === "object"
        ? (res.instance as Instance & Record<string, unknown>)
        : (res as Instance & Record<string, unknown>)) || {};

    await persistFromStatus(row.id, inst);

    const qrcode =
      typeof inst.qrcode === "string" && inst.qrcode.length > 10
        ? inst.qrcode
        : null;

    return {
      status: pickStatus(inst),
      qrcode,
      paircode: typeof inst.paircode === "string" ? inst.paircode : null,
      owner: typeof inst.owner === "string" ? inst.owner : null,
      profileName:
        typeof inst.profileName === "string" ? inst.profileName : null,
    };
  });

/** Disconnects (logs out) the WhatsApp session, keeps the instance. */
export const disconnectInstance = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const row = await getSavedInstance();
    if (!row?.instance_token) {
      throw new Response("Nenhuma instância para desconectar.", { status: 400 });
    }

    await uazFetch("/instance/disconnect", {
      method: "POST",
      instanceToken: row.instance_token,
    });

    await supabaseAdmin
      .from("uazapi_instances")
      .update({
        status: "disconnected",
        owner_jid: null,
        phone_connected: null,
        last_status_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return { success: true as const };
  });

/** Permanently deletes the instance from uazapi and locally. */
export const deleteInstance = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const row = await getSavedInstance();
    if (!row) return { success: true as const };

    if (row.instance_token) {
      try {
        await uazFetch("/instance", {
          method: "DELETE",
          admin: true,
          body: { token: row.instance_token },
        });
      } catch (err) {
        console.warn("uazapi delete instance failed (continuing):", err);
      }
    }

    const { error } = await supabaseAdmin
      .from("uazapi_instances")
      .delete()
      .eq("id", row.id);
    if (error) {
      console.error("Failed to delete local instance row:", error);
      throw new Response("Erro ao remover instância local.", { status: 500 });
    }

    return { success: true as const };
  });
