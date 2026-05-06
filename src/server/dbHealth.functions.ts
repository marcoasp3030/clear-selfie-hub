import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { assertAdminAccess } from "./admin.server";
import { db } from "./db.server";

/**
 * Testa a conexao com o Postgres da VPS (DATABASE_URL).
 * Usado pela pagina /admin/migration para validar credenciais
 * antes do cutover real do Supabase -> Postgres proprio.
 */
export const pingPostgres = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);

    const hasUrl = Boolean(process.env.DATABASE_URL);
    if (!hasUrl) {
      return {
        ok: false as const,
        configured: false as const,
        error: "DATABASE_URL nao esta definida nos secrets do projeto.",
      };
    }

    const result = await db.ping();
    if (!result.ok) {
      return { ok: false as const, configured: true as const, error: result.error };
    }

    // Conta tabelas conhecidas (se ja existirem)
    let tables: Record<string, number | null> = {};
    for (const t of ["registrations", "users", "phone_verifications", "devices"]) {
      try {
        const { rows } = await db.query<{ c: string }>(
          `SELECT count(*)::text AS c FROM ${t}`,
        );
        tables[t] = Number(rows[0].c);
      } catch {
        tables[t] = null; // tabela ainda nao existe
      }
    }

    return {
      ok: true as const,
      configured: true as const,
      now: result.now,
      tables,
    };
  });

// Re-export client helper que injeta o accessToken automaticamente
export async function pingPostgresFromClient() {
  const accessToken = await requireAdminAccessToken();
  return pingPostgres({ data: { accessToken } });
}
