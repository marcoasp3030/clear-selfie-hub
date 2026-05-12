import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import { listMessageAttemptsRows } from "./messageAttemptsRepo.server";

export const listMessageAttempts = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accessToken: string;
      channel?: "sms" | "whatsapp" | "all";
      status?: "sent" | "failed" | "all";
      search?: string;
      limit?: number;
      offset?: number;
    }) =>
      z
        .object({
          accessToken: z.string().trim().min(1),
          channel: z.enum(["sms", "whatsapp", "all"]).optional(),
          status: z.enum(["sent", "failed", "all"]).optional(),
          search: z.string().optional(),
          limit: z.number().int().min(1).max(200).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    try {
      return await listMessageAttemptsRows({
        channel: data.channel ?? "all",
        status: data.status ?? "all",
        search: data.search,
        limit: data.limit ?? 50,
        offset: data.offset ?? 0,
      });
    } catch (err) {
      console.error("listMessageAttempts failed:", err);
      throw new Response("Erro ao listar tentativas de envio.", { status: 500 });
    }
  });