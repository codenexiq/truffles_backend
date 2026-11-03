import crypto from "node:crypto";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// ============================================
// Environment validation. This file decides whether the server is allowed to
// start, so it is deliberately strict about secrets in production.
// ============================================

const int = (def: string, min: number, max: number) =>
  z
    .string()
    .default(def)
    .transform((v) => Number.parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n >= min && n <= max, `must be an integer between ${min} and ${max}`);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: int("5001", 1, 65535),
  /** Network address to listen on. 127.0.0.1 = only this machine (nginx is the public entry point). */
  HOST: z.string().regex(/^[A-Za-z0-9.:-]+$/, "must be an IP address or hostname").default("127.0.0.1"),
  API_PREFIX: z.string().regex(/^\/[A-Za-z0-9/_-]*$/, "must start with / and contain only letters, digits, / _ -").default("/api/v1"),

  /** Comma-separated list of allowed browser origins, e.g. https://trufflescafe.com,https://www.trufflescafe.com */
  CLIENT_URL: z.string().default("http://localhost:3000"),
  /** Number of reverse-proxy hops to trust for the client IP (0 = none). Set 1 behind nginx / a load balancer. */
  TRUST_PROXY: int("0", 0, 5),

  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, 'must look like "30m", "8h" or "1d"').default("8h"),

  /** First admin account. ADMIN_PASSWORD_HASH is a bcrypt hash: run `npm run hash-password`. */
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/, "must be a bcrypt hash").optional(),

  JSON_BODY_LIMIT: z.string().regex(/^\d+(kb|mb)$/i).default("100kb"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform((v) => (v ? Number.parseInt(v, 10) : 587)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('"Truffles Rooftop Restaurant" <reservations@example.com>'),

  RATE_LIMIT_WINDOW_MS: int("900000", 1000, 86_400_000),
  RATE_LIMIT_MAX: int("100", 1, 100_000),
  /** Submissions per window per IP on public forms (reservations, contact, reviews, newsletter, orders). */
  PUBLIC_WRITE_MAX: int("10", 1, 1000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const raw = parsed.data;
const isProd = raw.NODE_ENV === "production";

// ---------- JWT secret ----------
// Values that have ever appeared in this repository or in docs are never acceptable.
const KNOWN_WEAK_SECRETS = new Set([
  "super-secret-truffles-cafe-jwt-key-change-in-production-2026",
  "secret",
  "changeme",
  "change-me",
]);

function secretProblem(secret: string | undefined): string | null {
  if (!secret) return "JWT_SECRET is not set";
  if (KNOWN_WEAK_SECRETS.has(secret)) return "JWT_SECRET is a known placeholder value that is public in the source code";
  if (secret.length < 32) return "JWT_SECRET must be at least 32 characters";
  if (new Set(secret).size < 12) return "JWT_SECRET has too little variety (looks guessable)";
  if (/(change|secret|example|your-|password|replace|test)/i.test(secret) && secret.length < 64) {
    return "JWT_SECRET looks like a placeholder";
  }
  return null;
}

let jwtSecret: string;
const problem = secretProblem(raw.JWT_SECRET);
if (problem) {
  if (isProd) {
    console.error(`FATAL: ${problem}.`);
    console.error("Generate one with:  node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
    process.exit(1);
  }
  // Development / test: use a random per-process secret instead of a shared default.
  jwtSecret = crypto.randomBytes(48).toString("hex");
  console.warn(`WARNING: ${problem}. Using a random temporary secret (logins reset on every restart).`);
} else {
  jwtSecret = raw.JWT_SECRET as string;
}

// ---------- Allowed origins ----------
const origins = raw.CLIENT_URL.split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    try {
      return new URL(s).origin;
    } catch {
      console.error(`FATAL: CLIENT_URL contains an invalid URL: "${s}"`);
      process.exit(1);
    }
  });

if (isProd) {
  if (origins.length === 0) {
    console.error("FATAL: CLIENT_URL must list your website origin(s) in production.");
    process.exit(1);
  }
  const insecure = origins.filter((o) => !o.startsWith("https://"));
  if (insecure.length) {
    console.error(`FATAL: CLIENT_URL must use https in production (found ${insecure.join(", ")}).`);
    process.exit(1);
  }
}

// In development the local site is always allowed; in production only what you list.
const allowedOrigins = isProd
  ? origins
  : Array.from(new Set([...origins, "http://localhost:3000", "http://127.0.0.1:3000"]));

export const env = {
  ...raw,
  isProd,
  JWT_SECRET: jwtSecret,
  allowedOrigins,
};
