import type { Response, NextFunction, Request } from "express";
import { DashboardReservationService } from "./reservation.service.js";
import { ApiResponse } from "../../../utils/apiResponse.js";
import { ApiError } from "../../../utils/apiError.js";
import type { AuthenticatedRequest } from "../../../types/index.js";
import type { ReservationQuery } from "./reservation.types.js";

export class DashboardReservationController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      // checked and defaulted by the validation middleware
      const query = res.locals.query as ReservationQuery;
      const { items, total } = await DashboardReservationService.list(query);
      return ApiResponse.success(res, "Reservations retrieved successfully", items, {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await DashboardReservationService.getById(req.params.id as string);
      return ApiResponse.success(res, "Reservation retrieved successfully", item);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized("Authentication required");
      const item = await DashboardReservationService.updateStatus(req.params.id as string, req.body.status, {
        id: req.user.id,
        email: req.user.email,
      });
      return ApiResponse.success(res, "Reservation updated successfully", item);
    } catch (error) {
      next(error);
    }
  }

  static async history(req: Request, res: Response, next: NextFunction) {
    try {
      return ApiResponse.success(res, "History retrieved successfully", await DashboardReservationService.history(req.params.id as string));
    } catch (error) {
      next(error);
    }
  }

  static async stats(_req: Request, res: Response, next: NextFunction) {
    try {
      return ApiResponse.success(res, "Statistics retrieved successfully", await DashboardReservationService.stats());
    } catch (error) {
      next(error);
    }
  }
}
