import type { Request, Response } from "express";
import { HTTP_STATUS } from "../constants/index.js";

// Deliberately does not repeat the requested URL back (nothing to reflect).
export function notFoundHandler(_req: Request, res: Response) {
  res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Resource not found" });
}
