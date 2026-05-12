import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnostic-only: tries a HEAD against api.twilio.com to confirm the
 * Worker runtime can reach Twilio. Returns plain text result. Remove
 * after debugging.
 */
export const Route = createFileRoute("/api/public/twilio-ping")({
  server: {
    handlers: {
      GET: async () => {
        const start = Date.now();
        try {
          const res = await fetch("https://api.twilio.com/", { method: "GET" });
          const ms = Date.now() - start;
          return new Response(
            `OK status=${res.status} latency=${ms}ms`,
            { status: 200, headers: { "Content-Type": "text/plain" } }
          );
        } catch (err) {
          const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          const cause =
            err instanceof Error && "cause" in err
              ? String((err as { cause?: unknown }).cause)
              : "";
          return new Response(`FETCH_FAILED ${msg} | cause=${cause}`, {
            status: 502,
            headers: { "Content-Type": "text/plain" },
          });
        }
      },
    },
  },
});