import { db } from "./db.server";
import { supabaseAdmin } from "./supabaseAdmin.server";
import { getDataBackend } from "./registrationsRepo.server";

export type DiagnosticsRow = {
  id: string;
  created_at: string;
  likely_cause: string | null;
  platform: string | null;
  browser: string | null;
  in_app_browser: boolean;
  in_iframe: boolean;
  is_secure_context: boolean;
  user_agent: string | null;
};

export type InsertDiagnosticsInput = {
  likely_cause: string | null;
  results: unknown;
  platform: string | null;
  browser: string | null;
  in_app_browser: boolean;
  in_iframe: boolean;
  is_secure_context: boolean;
  device_id: string | null;
  user_agent: string | null;
};

export async function insertDiagnosticsReport(
  input: InsertDiagnosticsInput,
): Promise<{ ok: boolean }> {
  if (getDataBackend() === "pg") {
    try {
      await db.query(
        `INSERT INTO camera_diagnostics_reports
         (likely_cause, results, platform, browser,
          in_app_browser, in_iframe, is_secure_context, device_id, user_agent)
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9)`,
        [
          input.likely_cause,
          JSON.stringify(input.results ?? []),
          input.platform,
          input.browser,
          input.in_app_browser,
          input.in_iframe,
          input.is_secure_context,
          input.device_id,
          input.user_agent,
        ],
      );
      return { ok: true };
    } catch (err) {
      console.error("[diagnostics pg] insert failed", err);
      return { ok: false };
    }
  }
  const { error } = await supabaseAdmin
    .from("camera_diagnostics_reports")
    .insert([{
      likely_cause: input.likely_cause,
      results: input.results as never,
      platform: input.platform,
      browser: input.browser,
      in_app_browser: input.in_app_browser,
      in_iframe: input.in_iframe,
      is_secure_context: input.is_secure_context,
      device_id: input.device_id,
      user_agent: input.user_agent,
    }]);
  if (error) {
    console.error("[diagnostics] insert failed", error);
    return { ok: false };
  }
  return { ok: true };
}

export async function listDiagnosticsReports(
  limit = 500,
): Promise<DiagnosticsRow[]> {
  if (getDataBackend() === "pg") {
    const { rows } = await db.query<DiagnosticsRow>(
      `SELECT id::text, created_at::text, likely_cause, platform, browser,
              in_app_browser, in_iframe, is_secure_context, user_agent
         FROM camera_diagnostics_reports
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit],
    );
    return rows;
  }
  const { data, error } = await supabaseAdmin
    .from("camera_diagnostics_reports")
    .select(
      "id, created_at, likely_cause, platform, browser, in_app_browser, in_iframe, is_secure_context, user_agent",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DiagnosticsRow[];
}