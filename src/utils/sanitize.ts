import { z } from "zod";

// ============================================
// Input hygiene for every free-text field.
//  - length limits (so nobody can post megabytes of text)
//  - control characters removed
//  - HTML tags removed (stored text may later be shown in an admin screen)
// ============================================

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;
const HTML_TAGS = /<\/?[a-zA-Z!][^>]*>/g;

export function clean(input: string): string {
  return input.normalize("NFC").replace(CONTROL_CHARS, "").replace(HTML_TAGS, "").trim();
}

/** Required text with a length range (measured after cleaning). */
export const text = (min: number, max: number, message?: string) =>
  z
    .string({ error: message ?? "This field is required" })
    .max(max * 3, `Must be at most ${max} characters`)
    .transform(clean)
    .pipe(z.string().min(min, message ?? `Must be at least ${min} characters`).max(max, `Must be at most ${max} characters`));

/** Optional text. Empty becomes undefined. */
export const optionalText = (max: number) =>
  z
    .string()
    .max(max * 3, `Must be at most ${max} characters`)
    .transform(clean)
    .pipe(z.string().max(max, `Must be at most ${max} characters`))
    .transform((s) => (s === "" ? undefined : s))
    .optional();

export const emailField = z
  .string({ error: "Valid email required" })
  .trim()
  .max(254, "Email is too long")
  .pipe(z.email("Invalid email address"))
  .transform((e) => e.toLowerCase());

/** Digits, +, spaces, dashes, dots and brackets only. */
export const phoneField = z
  .string({ error: "Phone number required" })
  .trim()
  .regex(/^[0-9+()\-.\s]{7,20}$/, "Please enter a valid phone number");

/** Strict calendar date (YYYY-MM-DD) that really exists. */
export const dateField = z
  .string({ error: "Date is required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, "That is not a real date");

/** A web address that is safe to show later: https, or one of our own /images paths. */
export const safeImageUrl = z
  .string()
  .max(500)
  .refine((s) => /^https:\/\/[^\s<>"']+$/.test(s) || /^\/images\/[A-Za-z0-9._\-/]+$/.test(s), "Image must be an https URL or a /images/ path");

/**
 * Hidden "website" field that real visitors never see. Bots fill it in.
 * It is checked by the honeypot middleware before validation.
 */
export const HONEYPOT_FIELD = "website";

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "123456789012", "qwertyuiop12", "admin123admin", "letmein12345",
  "welcome12345", "trufflescafe", "truffles12345", "iloveyou1234", "administrator", "changeme1234",
]);

/** Staff password policy: 12+ chars, 3 of 4 character classes, not common, not repetitive. */
export const strongPassword = z
  .string({ error: "Password is required" })
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((p) => [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length >= 3, "Use at least three of: lowercase, uppercase, numbers, symbols")
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "That password is too common")
  .refine((p) => !/(.)\1{5,}/.test(p), "Password has too many repeated characters");
