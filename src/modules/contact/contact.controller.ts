import type { Request, Response, NextFunction } from "express";
import { ContactService } from "./contact.service.js";
import { ApiResponse } from "../../utils/apiResponse.js";

export class ContactController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const inquiry = await ContactService.create(req.body);
      return ApiResponse.created(
        res,
        "Your message has been sent successfully. We will be in touch soon!",
        { id: inquiry.id } // never echo the sender's details back
      );
    } catch (error) {
      next(error);
    }
  }

  static async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const list = await ContactService.getAll();
      return ApiResponse.success(res, "Inquiries retrieved successfully", list);
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const inquiry = await ContactService.markAsRead(id);
      return ApiResponse.success(res, "Inquiry marked as read", inquiry);
    } catch (error) {
      next(error);
    }
  }
}
