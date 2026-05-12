import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import { uazFetch } from "./uazapi.server";
import {
  deleteInstanceById,
  getLatestInstance,
  insertInstance,
  updateInstance,
  type UazapiUpdate,
} from "./uazapiRepo.server";

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
    if (c && typeof c === "object") {
      const statusObj = c as Record<string, unknown>;
      if (statusObj.connected === true || statusObj.loggedIn === true) return "connected";
    }
  }
  if (obj.connected === true || obj.loggedIn === true) return "connected";
  if (typeof obj.qrcode === "string" || typeof obj.paircode === "string") return "connecting";
  return "disconnected";
}

function extractInstancePayload(raw: unknown): Instance & Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const instance = obj.instance && typeof obj.instance === "object" ? obj.instance : obj;
  return {
    ...(instance as Instance & Record<string, unknown>),
    connected: obj.connected,
    loggedIn: obj.loggedIn,
    jid: obj.jid,
    status:
      typeof (instance as Record<string, unknown>).status === "string"
        ? ((instance as Record<string, unknown>).status as string)
        : typeof obj.status === "string"
          ? obj.status
          : undefined,
  };
}

function ownerFromPayload(payload: Record<string, unknown>) {
  if (typeof payload.owner === "string") return payload.owner;
  const jid = payload.jid;
  if (jid && typeof jid === "object") {
    const obj = jid as Record<string, unknown>;
    if (typeof obj.user === "string") {
      return `${obj.user}@${typeof obj.server === "string" ? obj.server : "s.whatsapp.net"}`;
    }
  }
  return null;
}

/** Returns the saved instance row (the project uses a single global instance). */
async function getSavedInstance() {
  try {
    return await getLatestInstance();
  } catch (err) {
    console.error("Failed to load uazapi_instances:", err);
    throw new Response("Erro ao ler instância salva.", { status: 500 });
  }
}

async function describeServerError(err: unknown) {
  if (err instanceof Response) {
    return await err.clone().text().catch(() => `HTTP ${err.status}`);
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function isInvalidInstanceToken(err: unknown, message: string) {
  return (
    (err instanceof Response && err.status === 401) ||
    /invalid token|unauthorized|401/i.test(message)
  );
}

async function persistFromStatus(
  rowId: string,
  payload: Instance & Record<string, unknown>
) {
  const status = pickStatus(payload);
  const update: UazapiUpdate = {
    status,
    last_status_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const owner = ownerFromPayload(payload);
  if (owner) {
    update.owner_jid = owner;
    const phone = owner.split("@")[0]?.replace(/\D/g, "") ?? null;
    if (phone) update.phone_connected = phone;
  }
  if (typeof payload.profileName === "string") {
    update.profile_name = payload.profileName;
  }
  if (typeof payload.id === "string") update.instance_id = payload.id;
  if (typeof payload.token === "string") update.instance_token = payload.token;

  await updateInstance(rowId, update);
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

    const createdRaw = await uazFetch<Record<string, unknown>>(
      "/instance/create",
      {
        method: "POST",
        admin: true,
        body: { name: data.name },
      }
    );
    const created = extractInstancePayload(createdRaw);

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
      console.error("uazapi /instance/create missing token:", createdRaw);
      throw new Response("Resposta inesperada da uazapi (sem token).", {
        status: 502,
      });
    }

    // Replace any previous saved instance (single global one).
    const existing = await getSavedInstance();
    if (existing) {
      await deleteInstanceById(existing.id);
    }

    let row;
    try {
      row = await insertInstance({
        name: data.name,
        instance_token: instanceToken,
        instance_id: instanceId,
        status: pickStatus(created),
        created_by: userId,
      });
    } catch (err) {
      console.error("Failed to save instance:", err);
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

    const body: Record<string, unknown> = { browser: "auto" };
    if (data.phone) body.phone = data.phone.replace(/\D/g, "");

    let raw: Record<string, unknown>;
    try {
      raw = await uazFetch<Record<string, unknown>>(
        "/instance/connect",
        {
          method: "POST",
          instanceToken: row.instance_token,
          body,
        }
      );
    } catch (err) {
      const msg = await describeServerError(err);
      const isAuthErr = isInvalidInstanceToken(err, msg);
      console.warn("[uazapi] connectInstance failed:", msg);
      return {
        status: isAuthErr ? "invalid_token" : "error",
        qrcode: null,
        paircode: null,
        error: isAuthErr
          ? "O token salvo na uazapi está inválido. Exclua a instância atual e crie uma nova para gerar um novo QR Code."
          : msg || "Não foi possível conectar na uazapi. Tente novamente em instantes.",
      };
    }
    const res = extractInstancePayload(raw);

    await updateInstance(row.id, {
      last_qr_at: new Date().toISOString(),
      status: pickStatus(res) || "connecting",
      updated_at: new Date().toISOString(),
    });

    return {
      status: pickStatus(res),
      qrcode: typeof res.qrcode === "string" ? res.qrcode : null,
      paircode: typeof res.paircode === "string" ? res.paircode : null,
      error: null,
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
      return {
        status: "no_instance",
        qrcode: null,
        paircode: null,
        owner: null,
        profileName: null,
      };
    }

    let res: Record<string, unknown>;
    try {
      res = await uazFetch<Record<string, unknown>>("/instance/status", {
        method: "GET",
        instanceToken: row.instance_token,
      });
    } catch (err) {
      const msg = await describeServerError(err);
      const isAuthErr = isInvalidInstanceToken(err, msg);
      console.warn("[uazapi] getInstanceStatus failed:", msg);
      return {
        status: isAuthErr ? "invalid_token" : "error",
        qrcode: null,
        paircode: null,
        owner: null,
        profileName: null,
        error: msg || "uazapi unavailable",
      };
    }

    const inst = extractInstancePayload(res);

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

    try {
      await uazFetch("/instance/disconnect", {
        method: "POST",
        instanceToken: row.instance_token,
      });
    } catch (err) {
      const msg = await describeServerError(err);
      console.warn("[uazapi] disconnectInstance failed:", msg);

      if (!isInvalidInstanceToken(err, msg)) {
        return {
          success: false as const,
          error:
            msg ||
            "Não foi possível desconectar na uazapi. Tente novamente em instantes.",
          warning: null,
        };
      }

      await updateInstance(row.id, {
        status: "disconnected",
        owner_jid: null,
        phone_connected: null,
        last_status_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return {
        success: true as const,
        error: null,
        warning:
          "O token salvo na uazapi está inválido. Marquei a instância como desconectada localmente; se precisar usar WhatsApp novamente, exclua e crie uma nova instância.",
      };
    }

    await updateInstance(row.id, {
      status: "disconnected",
      owner_jid: null,
      phone_connected: null,
      last_status_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return { success: true as const, error: null, warning: null };
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

    try {
      await deleteInstanceById(row.id);
    } catch (err) {
      console.error("Failed to delete local instance row:", err);
      throw new Response("Erro ao remover instância local.", { status: 500 });
    }

    return { success: true as const };
  });
