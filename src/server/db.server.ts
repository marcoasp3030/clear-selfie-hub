import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

/**
 * Pool Postgres compartilhado para a Etapa 2/3 da migração VPS.
 *
 * Uso (apenas server-side):
 *   import { db } from "@/server/db.server";
 *   const { rows } = await db.query<MyRow>("SELECT * FROM registrations WHERE id = $1", [id]);
 *
 * Enquanto o app ainda roda no Lovable Cloud, este módulo só é instanciado
 * quando DATABASE_URL está definido. Sem essa env, qualquer chamada lança
 * um erro claro em vez de quebrar o boot do servidor.
 */

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL nao configurado. Defina no .env da VPS (postgres://user:pass@host:5432/db).",
    );
  }

  _pool = new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Postgres interno em rede Docker normalmente NAO usa SSL.
    // Habilite via DB_SSL=true se for um Postgres gerenciado externo.
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  _pool.on("error", (err) => {
    console.error("[pg] erro inesperado no pool:", err);
  });

  return _pool;
}

export const db = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<QueryResult<T>> {
    return getPool().query<T>(text, params as unknown[] | undefined);
  },

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  async ping(): Promise<{ ok: true; now: string } | { ok: false; error: string }> {
    try {
      const { rows } = await getPool().query<{ now: string }>("SELECT now()::text AS now");
      return { ok: true, now: rows[0].now };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
