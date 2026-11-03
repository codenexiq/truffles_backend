import type { Response } from "express";
import { HTTP_STATUS } from "../constants/index.js";
import type { ApiResponsePayload } from "../types/index.js";

export class ApiResponse {
  static send<T>(
    res: Response,
    statusCode: number,
    message: string,
    data?: T,
    meta?: ApiResponsePayload["meta"]
  ) {
    const payload: ApiResponsePayload<T> = {
      success: statusCode >= 200 && statusCode < 300,
      message,
      data,
      meta,
    };
    return res.status(statusCode).json(payload);
  }

  static success<T>(
    res: Response,
    message = "Success",
    data?: T,
    meta?: ApiResponsePayload["meta"]
  ) {
    return this.send(res, HTTP_STATUS.OK, message, data, meta);
  }

  static created<T>(res: Response, message = "Created successfully", data?: T) {
    return this.send(res, HTTP_STATUS.CREATED, message, data);
  }

  static noContent(res: Response) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }
}

