import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import type { AuthenticatedRequest } from "../../types/index.js";
import { BlogService } from "./blog.service.js";
import type { BlogActor, BlogQuery } from "./blog.types.js";

const actorOf = (req: Request): BlogActor => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) throw ApiError.unauthorized("Authentication required");
  return { id: user.id, name: user.name };
};

/** Handlers for the staff dashboard (login required, see the routes). */
export class DashboardBlogController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const query = res.locals.query as BlogQuery; // checked and defaulted by the validation middleware
      const { items, total } = await BlogService.list(query);
      return ApiResponse.success(res, "Posts retrieved successfully", items, {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      return ApiResponse.success(res, "Post retrieved successfully", await BlogService.getById(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      return ApiResponse.created(res, "Post created", await BlogService.create(req.body, actorOf(req)));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      return ApiResponse.success(res, "Post saved", await BlogService.update(String(req.params.id), req.body, actorOf(req)));
    } catch (error) {
      next(error);
    }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      return ApiResponse.success(res, "Post updated", await BlogService.setStatus(String(req.params.id), req.body.status, actorOf(req)));
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await BlogService.remove(String(req.params.id), actorOf(req));
      return ApiResponse.success(res, "Post deleted");
    } catch (error) {
      next(error);
    }
  }
}

/** Handlers for the public website. */
export class PublicBlogController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      // Nothing personal in here, so (unlike the rest of the API) a short cache is fine and keeps the load down.
      res.setHeader("Cache-Control", "public, max-age=60");
      res.removeHeader("Pragma");
      return ApiResponse.success(res, "Posts retrieved successfully", await BlogService.listPublished());
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.removeHeader("Pragma");
      return ApiResponse.success(res, "Post retrieved successfully", await BlogService.getPublished(String(req.params.slug)));
    } catch (error) {
      next(error);
    }
  }
}
