import { createFileRoute } from "@tanstack/react-router";
import { handleUazapiWebhook } from "@/server/uazapiWebhook.server";

/**
 * uazapi webhook receiver.
 * Configure in the uazapi dashboard to POST message events to:
 *   https://<your-domain>/api/public/uazapi-webhook
 *
 * All logic lives in `@/server/uazapiWebhook.server` so the
 * `client.server` import never reaches the client bundle.
 */
export const Route = createFileRoute("/api/public/uazapi-webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleUazapiWebhook(request),
      GET: () => new Response("uazapi-webhook ok", { status: 200 }),
    },
  },
});
