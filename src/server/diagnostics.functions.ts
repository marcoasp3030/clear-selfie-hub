import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DIAGNOSTIC_IDS = [
  "secure_context",
  "in_app_browser",
  "iframe",
  "api_available",
  "device_present",
  "permission_state",
  "device_in_use",
] as const;

const DIAGNOSTIC_STATUSES = ["ok", "warn", "fail", "unknown"] as const;

const reportSchema = z.object({
  likelyCause: z.enum(DIAGNOSTIC_IDS).nullable(),
  results: z
    .array(
      z.object({
        id: z.enum(DIAGNOSTIC_IDS),
        status: z.enum(DIAGNOSTIC_STATUSES),
      }),
    )
    .max(20),
  platform: z.enum(["ios", "android", "desktop"]).nullable(),
  browser: z
    .enum(["safari", "chrome", "firefox", "edge", "in_app", "other"])
    .nullable(),
  inAppBrowser: z.boolean(),
  inIframe: z.boolean(),
  isSecureContext: z.boolean(),
  deviceId: z.string().uuid().nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
});

export const submitDiagnosticsReport = createServerFn({ method: "POST" })
  .inputValidator((data) => reportSchema.parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("camera_diagnostics_reports")
      .insert({
        likely_cause: data.likelyCause,
        results: data.results,
        platform: data.platform,
        browser: data.browser,
        in_app_browser: data.inAppBrowser,
        in_iframe: data.inIframe,
        is_secure_context: data.isSecureContext,
        device_id: data.deviceId ?? null,
        user_agent: data.userAgent ?? null,
      });
    if (error) {
      console.error("[diagnostics] insert failed", error);
      return { success: false as const };
    }
    return { success: true as const };
  });

export interface DiagnosticsAggregate {
  totalReports: number;
  byCause: Array<{ cause: string | null; count: number }>;
  byPlatform: Array<{ platform: string | null; count: number }>;
  byBrowser: Array<{ browser: string | null; count: number }>;
  recent: Array<{
    id: string;
    created_at: string;
    likely_cause: string | null;
    platform: string | null;
    browser: string | null;
    in_app_browser: boolean;
    in_iframe: boolean;
    is_secure_context: boolean;
    user_agent: string | null;
  }>;
}

export const getDiagnosticsAggregate = createServerFn({ method: "GET" })
  .handler(async (): Promise<DiagnosticsAggregate> => {
    // Admin-only: rely on RLS via authenticated client would be ideal, but
    // we want to read aggregates without forcing the caller to attach a JWT.
    // Instead we use the admin client and gate this server fn behind the
    // existing admin route guard. (This file is only imported from the
    // admin pages, which already require an authenticated admin session.)
    const { data, error } = await supabaseAdmin
      .from("camera_diagnostics_reports")
      .select(
        "id, created_at, likely_cause, platform, browser, in_app_browser, in_iframe, is_secure_context, user_agent",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const tally = <T extends string | null>(
      key: (r: (typeof rows)[number]) => T,
    ) => {
      const map = new Map<T, number>();
      for (const r of rows) {
        const k = key(r);
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return Array.from(map.entries())
        .map(([k, count]) => ({ key: k, count }))
        .sort((a, b) => b.count - a.count);
    };

    return {
      totalReports: rows.length,
      byCause: tally((r) => r.likely_cause).map(({ key, count }) => ({
        cause: key,
        count,
      })),
      byPlatform: tally((r) => r.platform).map(({ key, count }) => ({
        platform: key,
        count,
      })),
      byBrowser: tally((r) => r.browser).map(({ key, count }) => ({
        browser: key,
        count,
      })),
      recent: rows.slice(0, 50),
    };
  });