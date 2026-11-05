import crypto from "node:crypto";
import { ApiError } from "../../utils/apiError.js";
import { logger } from "../../utils/logger.js";
import { mediaRepository, type MediaFile } from "./media.repository.js";

/** Largest upload accepted (the dashboard shrinks photos in the browser before sending, so this is rarely near). */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/**
 * Works out what a file REALLY is from its first bytes. The type the browser claims is never trusted, and SVG
 * (which can carry scripts) is deliberately not accepted.
 */
export function detectImage(buf: Buffer): ImageMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const head = buf.subarray(0, 6).toString("latin1");
  if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export class MediaService {
  /** Validates and stores an uploaded image. Returns the path to use in posts (`/media/<id>`). */
  static async upload(data: unknown, staffId?: string): Promise<{ id: string; path: string; mime: string; size: number }> {
    if (!Buffer.isBuffer(data) || data.length === 0) throw ApiError.badRequest("No image was received");
    if (data.length > MAX_IMAGE_BYTES) throw ApiError.badRequest("That image is too large (3 MB maximum)");

    const mime = detectImage(data);
    if (!mime) throw ApiError.badRequest("Only JPEG, PNG, WebP or GIF images can be uploaded");

    const stored = await mediaRepository.save({ mime, data, sha256: crypto.createHash("sha256").update(data).digest("hex") }, staffId);
    logger.info(`Image stored: ${stored.id} (${mime}, ${data.length} bytes)`);
    return { id: stored.id, path: `/media/${stored.id}`, mime: stored.mime, size: stored.size };
  }

  static async get(id: string): Promise<MediaFile> {
    const file = await mediaRepository.get(id);
    if (!file) throw ApiError.notFound("Image not found");
    return file;
  }
}
