import { createFileRoute } from "@tanstack/react-router";
import { newPhotoPath, putPhoto } from "@/server/storage.server";

/**
 * Upload publico de foto pra cadastro facial.
 * - aceita multipart/form-data com campo "photo"
 * - retorna { photoPath } usado depois pelo createRegistration
 *
 * Limite de 8MB para evitar abuso. O createRegistration valida e
 * eventualmente apaga a foto se algum check falhar.
 */
const MAX_BYTES = 8 * 1024 * 1024;

export const Route = createFileRoute("/api/public/upload-photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "invalid_form" }, { status: 400 });
        }
        const file = form.get("photo");
        if (!(file instanceof File)) {
          return Response.json({ error: "missing_photo" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ error: "too_large" }, { status: 413 });
        }
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        const type = file.type || "image/jpeg";
        if (!allowed.includes(type)) {
          return Response.json({ error: "invalid_type" }, { status: 400 });
        }
        const ext =
          type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        const photoPath = newPhotoPath(ext);
        try {
          const buf = Buffer.from(await file.arrayBuffer());
          await putPhoto(photoPath, buf, type);
        } catch (err) {
          console.error("upload-photo failed:", err);
          return Response.json({ error: "upload_failed" }, { status: 500 });
        }
        return Response.json({ photoPath });
      },
    },
  },
});
