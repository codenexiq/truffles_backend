import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError.js";
import { HTTP_STATUS } from "../constants/index.js";
import { logger } from "../utils/logger.js";

interface HttpishError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

/**
 * Last line of defence. Clients only ever see safe, generic messages: stack traces,
 * file paths and library error text stay in the server log.
 */
export function errorHandler(err: HttpishError, req: Request, res: Response, _next: NextFunction) {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = "Something went wrong. Please try again.";
  let errors: unknown = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Request is too large";
  } else if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = "Request body is not valid JSON";
  } else if (err.type === "encoding.unsupported" || err.type === "charset.unsupported") {
    statusCode = 415;
    message = "Unsupported content encoding";
  } else {
    // Unexpected: log everything here, tell the client nothing.
    logger.error(`Unhandled error on ${req.method} ${req.path}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}
