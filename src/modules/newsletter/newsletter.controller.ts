import type { Request, Response, NextFunction } from "express";
import { NewsletterService } from "./newsletter.service.js";
import { ApiResponse } from "../../utils/apiResponse.js";

export class NewsletterController {
  static async subscribe(req: Request, res: Response, next: NextFunction) {
    try {
      await NewsletterService.subscribe(req.body.email);
      // Same answer for new and existing subscribers (no way to probe the list).
      return ApiResponse.created(res, "Thank you for subscribing!");
    } catch (error) {
      next(error);
    }
  }

  static async unsubscribe(req: Request, res: Response, next: NextFunction) {
    try {
      await NewsletterService.unsubscribe(req.body.email, req.body.token);
      return ApiResponse.success(res, "If that address was subscribed, it has been removed.");
    } catch (error) {
      next(error);
    }
  }

  static async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const subscribers = await NewsletterService.getAll();
      return ApiResponse.success(res, "Subscribers retrieved successfully", subscribers);
    } catch (error) {
      next(error);
    }
  }
}
