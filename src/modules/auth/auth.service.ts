import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/apiError.js";
import { logger } from "../../utils/logger.js";
import { newId } from "../../utils/secure.js";
import { JWT_AUDIENCE, JWT_ISSUER } from "../../middlewares/auth.js";
import { clearFailedLogins, lockoutStatus, recordFailedLogin } from "../../security/sessionStore.js";
import type { AuthUser } from "../../types/index.js";
import type { UserRoleType } from "../../constants/index.js";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRoleType;
  createdAt: string;
}

const BCRYPT_ROUNDS = 12;
const users: UserRecord[] = [];

/**
 * A real hash of a random value. Comparing against it when the email is unknown
 * makes "no such user" take as long as "wrong password" (no timing side channel).
 */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), BCRYPT_ROUNDS);

// ---------- First admin account (there are NO built-in default passwords) ----------
function bootstrapAdmin() {
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD_HASH) {
    users.push({
      id: newId("user"),
      name: "Administrator",
      email: env.ADMIN_EMAIL.toLowerCase(),
      passwordHash: env.ADMIN_PASSWORD_HASH,
      role: "super_admin",
      createdAt: new Date().toISOString(),
    });
    logger.info(`Admin account loaded from environment: ${env.ADMIN_EMAIL}`);
    return;
  }

  if (!env.isProd) {
    // Development convenience: a random password, printed once, never stored in the repo.
    const password = crypto.randomBytes(18).toString("base64url");
    users.push({
      id: newId("user"),
      name: "Development Admin",
      email: "admin@truffles.local",
      passwordHash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
      role: "super_admin",
      createdAt: new Date().toISOString(),
    });
    logger.warn("-------------------------------------------------------");
    logger.warn("DEVELOPMENT ADMIN (new random password each start):");
    logger.warn(`  email:    admin@truffles.local`);
    logger.warn(`  password: ${password}`);
    logger.warn("-------------------------------------------------------");
    return;
  }

  logger.warn(
    "No admin account configured: staff login is disabled. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH (see `npm run hash-password`)."
  );
}
bootstrapAdmin();

const toAuthUser = (u: UserRecord): AuthUser => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export class AuthService {
  static async login(emailInput: string, password: string): Promise<{ token: string; user: AuthUser; expiresAt: number }> {
    const email = emailInput.toLowerCase().trim();

    // Locked accounts are refused before any password work happens.
    const lock = lockoutStatus(email);
    if (lock.locked) {
      throw ApiError.tooManyRequests(`Too many failed attempts. Try again in ${Math.ceil(lock.retryAfterSeconds / 60)} minutes.`);
    }

    const user = users.find((u) => u.email === email);
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !ok) {
      recordFailedLogin(email);
      logger.warn("Failed staff login attempt");
      // Identical message and timing whether the email exists or not.
      throw ApiError.unauthorized("Invalid email or password");
    }

    clearFailedLogins(email);

    const authUser = toAuthUser(user);
    const token = jwt.sign(authUser, env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      jwtid: crypto.randomUUID(),
    });
    const decoded = jwt.decode(token) as { exp: number };

    logger.info(`Staff login: ${authUser.role}`);
    return { token, user: authUser, expiresAt: decoded.exp };
  }

  static async registerStaff(
    actor: AuthUser,
    name: string,
    emailInput: string,
    password: string,
    role: "admin" | "manager" | "staff"
  ): Promise<AuthUser> {
    // Privilege escalation guard: only a super admin may create another admin.
    if (role === "admin" && actor.role !== "super_admin") {
      throw ApiError.forbidden("Only a super admin can create admin accounts");
    }

    const email = emailInput.toLowerCase().trim();
    if (users.some((u) => u.email === email)) {
      throw ApiError.conflict("User with this email already exists");
    }

    const created: UserRecord = {
      id: newId("user"),
      name,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role,
      createdAt: new Date().toISOString(),
    };
    users.push(created);
    logger.info(`Staff account created (${role}) by ${actor.role}`);
    return toAuthUser(created);
  }

  static async getProfile(userId: string): Promise<AuthUser> {
    const user = users.find((u) => u.id === userId);
    if (!user) throw ApiError.notFound("User not found");
    return toAuthUser(user);
  }
}
