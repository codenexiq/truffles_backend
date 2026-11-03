import type { Request, Response, NextFunction } from "express";
import { EventService } from "./event.service.js";
import { ApiResponse } from "../../utils/apiResponse.js";

export class EventController {
  static async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const events = await EventService.getAll();
      return ApiResponse.success(res, "Events retrieved successfully", events);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const event = await EventService.getById(id);
      return ApiResponse.success(res, "Event retrieved successfully", event);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await EventService.create(req.body);
      return ApiResponse.created(res, "Event created successfully", event);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await EventService.delete(id);
      return ApiResponse.success(res, "Event deleted successfully");
    } catch (error) {
      next(error);
    }
  }
}
