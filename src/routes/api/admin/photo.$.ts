import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { AUTH_COOKIE_NAME, verifyAdminToken } from "@/server/auth.server";
import { readPhoto } from "@/server/storage.server";

/**
 * Serve fotos do storage local para admins autenticados via JWT.
 * No modo Supabase, este endpoint nao e usado: getPhotoAccessUrl
 * retorna uma signed URL diretamente do bucket.
 */
export const Route = createFileRoute("/api/admin/photo/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = getCookie(AUTH_COOKIE_NAME);
        if (!token || !verifyAdminToken(token)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const photoPath = params._splat ?? "";
        if (!photoPath) return new Response("Bad Request", { status: 400 });
        try {
          const { body, contentType } = await readPhoto(photoPath);
          return new Response(new Uint8Array(body), {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "private, max-age=300",
            },
          });
        } catch (err) {
          const code =
            (err as NodeJS.ErrnoException)?.code === "ENOENT" ? 404 : 500;
          return new Response(code === 404 ? "Not Found" : "Error", { status: code });
        }
      },
    },
  },
});
