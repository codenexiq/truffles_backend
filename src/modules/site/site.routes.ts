import { Router, type NextFunction, type Request, type Response } from "express";
import { ApiResponse } from "../../utils/apiResponse.js";
import { siteStatusLimiter } from "../../middlewares/rateLimiter.js";
import { MaintenanceService } from "./maintenance.service.js";

/** Public: what the website needs to know before it shows a page. Mounted at /api/v1/site. */
const router = Router();

router.get("/status", siteStatusLimiter, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // The website asks every few seconds, so a short cache keeps database work tiny however many visitors there are.
    res.setHeader("Cache-Control", "public, max-age=5");
    res.removeHeader("Pragma");
    return ApiResponse.success(res, "OK", await MaintenanceService.publicStatus());
  } catch (error) {
    next(error);
  }
});

export const siteRoutes = router;
