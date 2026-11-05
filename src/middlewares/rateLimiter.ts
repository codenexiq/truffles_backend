import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { env } from "../config/env.js";

const byIp = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");

const tooMany = (message: string) => ({ success: false, message });

/** Pictures have their own, higher limit (see mediaReadLimiter), so a page full of images cannot use up this one. */
const isMediaRead = (req: Request) => req.method === "GET" && req.path.startsWith(`${env.API_PREFIX}/media/`);
/** The website checks the maintenance switch every few seconds; that must never use up the general limit. */
const isSiteStatus = (req: Request) => req.method === "GET" && req.path === `${env.API_PREFIX}/site/status`;

/** Every request, per IP. */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  skip: (req) => isMediaRead(req) || isSiteStatus(req),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: byIp,
  message: tooMany("Too many requests. Please try again later."),
});

/** Login attempts, per IP. Successful logins do not count against the limit. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: byIp,
  message: tooMany("Too many login attempts. Please try again in 15 minutes."),
});

/**
 * Public submissions (reservations, enquiries, reviews, newsletter, orders).
 * Much tighter than the global limit so forms cannot be used to flood the team.
 */
export const publicWriteLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.PUBLIC_WRITE_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: byIp,
  message: tooMany("You have sent several requests in a short time. Please wait a few minutes, or call us."),
});

/**
 * Downloads of uploaded pictures (blog covers and photos), per IP. Higher than the general limit because one page can
 * show many pictures, and browsers keep each one for a year after the first download.
 */
export const mediaReadLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX * 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: byIp,
  message: tooMany("Too many requests. Please try again later."),
});

/** The website's own "is maintenance on?" checks (a few per minute per server), generous so they are never refused. */
export const siteStatusLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX * 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: byIp,
  message: tooMany("Too many requests. Please try again later."),
});
