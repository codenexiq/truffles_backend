import crypto from "node:crypto";
import { env } from "../config/env.js";

/** Unguessable identifier, e.g. res_3f2a9c1e-... (never derived from the clock). */
export const newId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;

/** 256-bit random secret for capability links (cancel / order access). Shown to its owner once. */
export const newSecretToken = (): string => crypto.randomBytes(32).toString("base64url");

/** One-way hash so tokens are never stored in the clear. */
export const sha256 = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");

/** Constant-time string comparison (avoids leaking how many characters matched). */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Signed token tying an action (like unsubscribing) to one email address. */
export function signEmailToken(email: string, purpose: string): string {
  return crypto
    .createHmac("sha256", env.JWT_SECRET)
    .update(`${purpose}:${email.toLowerCase().trim()}`)
    .digest("base64url");
}
