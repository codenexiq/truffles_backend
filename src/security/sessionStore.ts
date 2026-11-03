// ============================================
// In-memory security state: revoked tokens and login lockouts.
// Single-server only. With more than one server instance, move these to Redis.
// ============================================

const MAX_ENTRIES = 10_000;

/** jti -> expiry (unix seconds). A revoked token is rejected even if it has not expired. */
const revoked = new Map<string, number>();

export function revokeToken(jti: string, expSeconds: number) {
  if (revoked.size >= MAX_ENTRIES) revoked.delete(revoked.keys().next().value as string);
  revoked.set(jti, expSeconds);
}

export const isRevoked = (jti: string | undefined) => !!jti && revoked.has(jti);

// ---------- login lockout ----------
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

interface Attempt {
  fails: number;
  lockedUntil: number;
}
const attempts = new Map<string, Attempt>();

/** Counted per email address whether or not the account exists, so lockout reveals nothing. */
export function lockoutStatus(key: string): { locked: boolean; retryAfterSeconds: number } {
  const a = attempts.get(key);
  if (a && a.lockedUntil > Date.now()) {
    return { locked: true, retryAfterSeconds: Math.ceil((a.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

export function recordFailedLogin(key: string) {
  if (attempts.size >= MAX_ENTRIES && !attempts.has(key)) attempts.delete(attempts.keys().next().value as string);
  const a = attempts.get(key) ?? { fails: 0, lockedUntil: 0 };
  // A lock that already expired starts a fresh count.
  if (a.lockedUntil && a.lockedUntil <= Date.now()) {
    a.fails = 0;
    a.lockedUntil = 0;
  }
  a.fails += 1;
  if (a.fails >= MAX_FAILED_LOGINS) a.lockedUntil = Date.now() + LOCKOUT_MS;
  attempts.set(key, a);
}

export const clearFailedLogins = (key: string) => attempts.delete(key);

// Tidy up expired entries once a minute (does not keep the process alive).
setInterval(() => {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revoked) if (exp < nowSec) revoked.delete(jti);
  for (const [k, a] of attempts) if (a.lockedUntil && a.lockedUntil < Date.now()) attempts.delete(k);
}, 60_000).unref();
