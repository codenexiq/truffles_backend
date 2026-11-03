import type { Request, Response, NextFunction } from "express";
import { OrderService } from "./order.service.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import type { OrderStatusType } from "../../constants/index.js";
import type { AuthenticatedRequest } from "../../types/index.js";

export class OrderController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.query;
      const orders = await OrderService.getAll({
        status: typeof status === "string" ? (status as OrderStatusType) : undefined,
      });
      return ApiResponse.success(res, "Orders retrieved successfully", orders.map(OrderService.toView));
    } catch (error) {
      next(error);
    }
  }

  /** Staff can read any order. Customers need the order id plus their secret token (x-order-token header). */
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const order = req.user
        ? await OrderService.getById(id)
        : await OrderService.getForCustomer(id, req.header("x-order-token") ?? undefined);
      return ApiResponse.success(res, "Order retrieved successfully", OrderService.toView(order));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { order, accessToken } = await OrderService.create(req.body);
      return ApiResponse.created(res, "Order placed successfully", {
        ...OrderService.toView(order),
        accessToken, // shown once; needed later to look the order up
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.updateStatus(req.params.id as string, req.body.status);
      return ApiResponse.success(res, "Order status updated successfully", OrderService.toView(order));
    } catch (error) {
      next(error);
    }
  }
}
