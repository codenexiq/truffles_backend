import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthService } from "./auth.service.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { env } from "../../config/env.js";
import { COOKIE_NAME, extractToken } from "../../middlewares/auth.js";
import { revokeToken } from "../../security/sessionStore.js";
import { ApiError } from "../../utils/apiError.js";
import type { AuthenticatedRequest } from "../../types/index.js";

const cookieOptions = {
  httpOnly: true, // JavaScript on the page can never read the session cookie
  secure: env.isProd, // HTTPS only in production
  sameSite: "strict" as const, // never sent on cross-site requests
  path: "/",
};

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const { token, user, expiresAt } = await AuthService.login(email, password);

      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: Math.max(0, expiresAt * 1000 - Date.now()) });
      return ApiResponse.success(res, "Login successful", { token, user });
    } catch (error) {
      next(error);
    }
  }

  static async registerStaff(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized("Authentication required");
      const { name, email, password, role } = req.body;
      const created = await AuthService.registerStaff(req.user, name, email, password, role);
      return ApiResponse.created(res, "Staff account created successfully", created);
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getProfile(req.user!.id);
      return ApiResponse.success(res, "Profile retrieved successfully", user);
    } catch (error) {
      next(error);
    }
  }

  /** Logging out really ends the session: the token is revoked server-side, not just forgotten. */
  static async logout(req: Request, res: Response) {
    const found = extractToken(req);
    if (found) {
      const decoded = jwt.decode(found.token);
      if (decoded && typeof decoded !== "string" && decoded.jti && decoded.exp) revokeToken(decoded.jti, decoded.exp);
    }
    res.clearCookie(COOKIE_NAME, cookieOptions);
    return ApiResponse.success(res, "Logged out successfully");
  }
}
