import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";
import { ApiError } from "../utils/apiError.js";

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed && typeof parsed === "object") {
        const p = parsed as { body?: unknown; query?: Record<string, unknown>; params?: Record<string, unknown> };
        if (p.body) req.body = p.body;
        if (p.query && typeof p.query === "object") {
          Object.assign(req.query, p.query);
          // Express 5 builds req.query afresh on every read, so the checked-and-defaulted values are also kept here.
          res.locals.query = p.query;
        }
        if (p.params && typeof p.params === "object") {
          Object.assign(req.params, p.params);
        }
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return next(ApiError.unprocessable("Validation failed", issues));
      }
      next(error);
    }
  };
};
