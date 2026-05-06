import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin.server";

/**
 * Adapter de storage com 2 backends:
 *  - "disk"     -> grava em UPLOADS_DIR (cutover VPS)
 *  - "supabase" -> usa o bucket registration-photos (Lovable Cloud, atual)
 *
 * Backend ativo e escolhido por env STORAGE_BACKEND, ou inferido:
 *  - se UPLOADS_DIR existir -> disk
 *  - caso contrario         -> supabase
 *
 * O campo `photo_path` no banco continua sendo o mesmo identificador
 * relativo nos dois modos. Assim a migracao nao precisa reescrever linhas.
 */

export type StorageBackend = "disk" | "supabase";

export function getStorageBackend(): StorageBackend {
  const explicit = process.env.STORAGE_BACKEND?.toLowerCase();
  if (explicit === "disk" || explicit === "supabase") return explicit;
  return process.env.UPLOADS_DIR ? "disk" : "supabase";
}

const BUCKET = "registration-photos";

function getUploadsDir(): string {
  const dir = process.env.UPLOADS_DIR;
  if (!dir) throw new Error("UPLOADS_DIR nao configurado");
  return dir;
}

function safeJoin(base: string, rel: string): string {
  // Impede path traversal: resolve e garante que continua dentro de `base`.
  const target = path.resolve(base, rel);
  const baseRes = path.resolve(base) + path.sep;
  if (!(target + path.sep).startsWith(baseRes) && target !== path.resolve(base)) {
    throw new Error("path fora do diretorio de uploads");
  }
  return target;
}

export function newPhotoPath(ext = "jpg"): string {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const id = crypto.randomBytes(12).toString("hex");
  return `${day}/${id}.${ext.replace(/^\./, "")}`;
}

export async function putPhoto(
  photoPath: string,
  body: Buffer | Uint8Array,
  contentType = "image/jpeg",
): Promise<void> {
  if (getStorageBackend() === "disk") {
    const full = safeJoin(getUploadsDir(), photoPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return;
  }
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(photoPath, body, { contentType, upsert: false });
  if (error) throw error;
}

export async function deletePhoto(photoPath: string): Promise<void> {
  if (!photoPath) return;
  if (getStorageBackend() === "disk") {
    try {
      await fs.unlink(safeJoin(getUploadsDir(), photoPath));
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== "ENOENT") throw err;
    }
    return;
  }
  await supabaseAdmin.storage.from(BUCKET).remove([photoPath]);
}

export async function readPhoto(
  photoPath: string,
): Promise<{ body: Buffer; contentType: string }> {
  if (getStorageBackend() === "disk") {
    const full = safeJoin(getUploadsDir(), photoPath);
    const body = await fs.readFile(full);
    return { body, contentType: guessContentType(photoPath) };
  }
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(photoPath);
  if (error || !data) throw error ?? new Error("foto nao encontrada");
  const buf = Buffer.from(await data.arrayBuffer());
  return { body: buf, contentType: data.type || guessContentType(photoPath) };
}

/**
 * URL acessivel ao admin para visualizar a foto.
 * - supabase: retorna signed URL de 1h (igual ao comportamento atual).
 * - disk:    retorna `/api/admin/photo/<path>` (handler valida o JWT).
 */
export async function getPhotoAccessUrl(photoPath: string): Promise<string> {
  if (getStorageBackend() === "disk") {
    return `/api/admin/photo/${encodeURI(photoPath)}`;
  }
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(photoPath, 60 * 60);
  if (error || !data) throw error ?? new Error("falha ao gerar signed url");
  return data.signedUrl;
}

function guessContentType(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
