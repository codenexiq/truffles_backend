import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { isRevoked } from "../security/sessionStore.js";
import { USER_ROLES, type UserRoleType } from "../constants/index.js";
import type { AuthenticatedRequest } from "../types/index.js";
import { logger } from "../utils/logger.js";

export const JWT_ISSUER = "truffles-api";
export const JWT_AUDIENCE = "truffles-staff";
/** "__Host-" cookies are only accepted over HTTPS, for this exact host, with no Domain attribute. */
export const COOKIE_NAME = env.isProd ? "__Host-token" : "token";

const VALID_ROLES = new Set<string>(Object.values(USER_ROLES));
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function extractToken(req: Request): { token: string; via: "bearer" | "cookie" } | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ") && header.length > 7) return { token: header.slice(7).trim(), via: "bearer" };
  const cookie = req.cookies?.[COOKIE_NAME];
  if (typeof cookie === "string" && cookie) return { token: cookie, via: "cookie" };
  return null;
}

export function verifyToken(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"], // pin the algorithm: no "none", no key-confusion tricks
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  if (typeof payload === "string") throw new Error("bad payload");
  if (!payload.jti || isRevoked(payload.jti)) throw new Error("revoked");
  if (typeof payload.role !== "string" || !VALID_ROLES.has(payload.role)) throw new Error("bad role");
  return payload;
}

export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const found = extractToken(req);
  if (!found) return next(ApiError.unauthorized("Authentication token required"));

  // A cookie is sent automatically by the browser, so a cookie-authenticated write must
  // come from our own website (CSRF defence). Bearer tokens are not sent automatically.
  if (found.via === "cookie" && UNSAFE.has(req.method)) {
    const origin = req.headers.origin;
    if (!origin || !env.allowedOrigins.includes(origin)) {
      logger.warn(`Rejected cookie-authenticated ${req.method} with origin "${origin ?? "none"}"`);
      return next(ApiError.forbidden("Origin not allowed"));
    }
  }

  try {
    const p = verifyToken(found.token);
    req.user = { id: String(p.id), email: String(p.email), name: String(p.name), role: p.role as UserRoleType };
    req.tokenId = p.jti;
    req.tokenExp = p.exp;
    next();
  } catch {
    return next(ApiError.unauthorized("Invalid or expired authentication token"));
  }
}

/** Like authenticate, but anonymous requests continue (used where staff and owners share a route). */
export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const found = extractToken(req);
  if (!found) return next();
  try {
    const p = verifyToken(found.token);
    req.user = { id: String(p.id), email: String(p.email), name: String(p.name), role: p.role as UserRoleType };
  } catch {
    /* treated as anonymous */
  }
  next();
}

export function authorizeRoles(...roles: UserRoleType[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized("Authentication required"));
    if (!roles.includes(req.user.role)) {
      logger.warn(`Forbidden: ${req.user.role} tried ${req.method} ${req.path}`);
      return next(ApiError.forbidden("You do not have permission to do this"));
    }
    next();
  };
}
