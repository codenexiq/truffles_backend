import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { HONEYPOT_FIELD } from "../utils/sanitize.js";
import { logger } from "../utils/logger.js";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** API responses can contain personal data: never let browsers or proxies cache them. */
export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
}

/** Extra browser-hardening headers that helmet does not set by default. */
export function extraSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  next();
}

/** Only JSON bodies are accepted. This also blocks "simple" cross-site form posts. */
export function requireJson(req: Request, _res: Response, next: NextFunction) {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const hasBody = Number(req.headers["content-length"] ?? 0) > 0 || req.headers["transfer-encoding"] !== undefined;
    if (hasBody && !req.is("application/json")) {
      return next(new ApiError(415, "Content-Type must be application/json"));
    }
  }
  next();
}

/**
 * CSRF defence in depth: a state-changing request that carries an Origin header
 * from a website we do not recognise is refused outright (browsers always send
 * Origin on cross-site writes).
 */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (UNSAFE.has(req.method)) {
    const origin = req.headers.origin;
    if (origin && !env.allowedOrigins.includes(origin)) {
      logger.warn(`Blocked ${req.method} ${req.path} from disallowed origin ${origin}`);
      return next(ApiError.forbidden("Origin not allowed"));
    }
  }
  next();
}

/**
 * Bot trap. The public forms contain a hidden "website" input that people never
 * see or fill in. If it has a value, pretend success and quietly drop the request.
 * Runs BEFORE validation and storage.
 */
export function honeypot(req: Request, res: Response, next: NextFunction) {
  const value = (req.body as Record<string, unknown> | undefined)?.[HONEYPOT_FIELD];
  if (typeof value === "string" && value.trim() !== "") {
    logger.warn(`Honeypot triggered on ${req.method} ${req.originalUrl.split("?")[0]}`);
    return void res.status(201).json({ success: true, message: "Received", data: { id: "received" } });
  }
  next();
}
