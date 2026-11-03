import type { Request } from "express";
import type { UserRoleType } from "../constants/index.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRoleType;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  /** JWT id and expiry (unix seconds) of the token used for this request. */
  tokenId?: string;
  tokenExp?: number;
}

export interface ApiResponsePayload<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  errors?: unknown;
}

