import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { env } from "../config/env.js";

const byIp = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");

const tooMany = (message: string) => ({ success: false, message });

/** Every request, per IP. */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
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
