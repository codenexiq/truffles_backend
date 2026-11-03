import type { Request, Response, NextFunction } from "express";
import { MenuService } from "./menu.service.js";
import { ApiResponse } from "../../utils/apiResponse.js";

export class MenuController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, search, availableOnly } = req.query;
      const items = await MenuService.getAll({
        category: category as string,
        search: search as string,
        availableOnly: availableOnly === "true",
      });
      return ApiResponse.success(res, "Menu items retrieved successfully", items);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const item = await MenuService.getById(id);
      return ApiResponse.success(res, "Menu item retrieved successfully", item);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await MenuService.create(req.body);
      return ApiResponse.created(res, "Menu item created successfully", item);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const item = await MenuService.update(id, req.body);
      return ApiResponse.success(res, "Menu item updated successfully", item);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await MenuService.delete(id);
      return ApiResponse.success(res, "Menu item removed successfully");
    } catch (error) {
      next(error);
    }
  }
}
