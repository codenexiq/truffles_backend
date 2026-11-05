import express, { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { authenticate, authorizeRoles } from "../../middlewares/auth.js";
import { noStore } from "../../middlewares/security.js";
import { mediaReadLimiter } from "../../middlewares/rateLimiter.js";
import { USER_ROLES } from "../../constants/index.js";
import type { AuthenticatedRequest } from "../../types/index.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/apiError.js";
import { MAX_IMAGE_BYTES, MediaService } from "./media.service.js";

// ---------------------------------------------------------------------------
// Public: GET /api/v1/media/:id  (the picture itself, for the website)
// ---------------------------------------------------------------------------
const ID = /^med_[A-Za-z0-9-]{8,64}$/;

export const mediaRoutes = Router();

mediaRoutes.get("/:id", mediaReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!ID.test(id)) throw ApiError.notFound("Image not found");
    const file = await MediaService.get(id);

    const etag = `"${file.sha256}"`;
    // An image's id never changes what it shows, so browsers and the site may keep it for a year.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Pragma", "");
    res.setHeader("ETag", etag);
    // Locked down: it is only ever an <img>. (Also overrides the API-wide "same-site" so another origin may show it.)
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    if (req.headers["if-none-match"] === etag) return void res.status(304).end();

    res.type(file.mime).setHeader("Content-Length", String(file.data.length));
    res.status(200).end(file.data);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Staff only: POST /api/v1/dashboard/media  (raw image bytes in the body)
// This is mounted BEFORE the API's JSON-only body rules (see app.ts), because it takes an image, not JSON.
// ---------------------------------------------------------------------------
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: { success: false, message: "Too many uploads. Please wait a few minutes." },
});

export const mediaUploadRoutes = Router();

mediaUploadRoutes.post(
  "/",
  noStore,
  uploadLimiter,
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  express.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/gif"], limit: MAX_IMAGE_BYTES }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await MediaService.upload(req.body, (req as AuthenticatedRequest).user?.id);
      return ApiResponse.created(res, "Image uploaded", saved);
    } catch (error) {
      next(error);
    }
  }
);
