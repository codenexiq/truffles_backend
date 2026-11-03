import type { Request, Response, NextFunction } from "express";
import { ReservationService } from "./reservation.service.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import type { ReservationStatusType } from "../../constants/index.js";

export class ReservationController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { date, status } = req.query;
      const reservations = await ReservationService.getAll({
        date: typeof date === "string" ? date : undefined,
        status: typeof status === "string" ? (status as ReservationStatusType) : undefined,
      });
      return ApiResponse.success(res, "Reservations retrieved successfully", reservations.map(ReservationService.toStaffView));
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await ReservationService.getById(req.params.id as string);
      return ApiResponse.success(res, "Reservation retrieved successfully", ReservationService.toStaffView(reservation));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Public booking request. The response is deliberately small: the guest's own details are
   * not echoed back, and the cancel token appears here once and is never retrievable again.
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { record, cancelToken } = await ReservationService.create(req.body);
      return ApiResponse.created(res, "Table reservation request received. We will confirm shortly.", {
        id: record.id,
        status: record.status,
        date: record.date,
        time: record.time,
        guests: record.guests,
        cancelToken,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await ReservationService.updateStatus(req.params.id as string, req.body.status);
      return ApiResponse.success(res, "Reservation status updated successfully", ReservationService.toStaffView(reservation));
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await ReservationService.cancelWithToken(req.params.id as string, req.body.token);
      return ApiResponse.success(res, "Reservation cancelled successfully", { id: reservation.id, status: reservation.status });
    } catch (error) {
      next(error);
    }
  }
}
