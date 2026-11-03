import type { Request, Response, NextFunction } from "express";
import { ReviewService } from "./review.service.js";
import { ApiResponse } from "../../utils/apiResponse.js";

export class ReviewController {
  static async getApproved(_req: Request, res: Response, next: NextFunction) {
    try {
      const reviews = await ReviewService.getApproved();
      // Public view: only what is meant to be displayed.
      return ApiResponse.success(
        res,
        "Guest reviews retrieved successfully",
        reviews.map(({ name, rating, comment, date }) => ({ name, rating, comment, date }))
      );
    } catch (error) {
      next(error);
    }
  }

  static async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const reviews = await ReviewService.getAll();
      return ApiResponse.success(res, "All reviews retrieved successfully", reviews);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const review = await ReviewService.create(req.body);
      return ApiResponse.created(res, "Thank you for sharing your experience!", { id: review.id });
    } catch (error) {
      next(error);
    }
  }

  static async setApproval(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const review = await ReviewService.setApproval(id, req.body.isApproved);
      return ApiResponse.success(res, "Review approval status updated", review);
    } catch (error) {
      next(error);
    }
  }
}
