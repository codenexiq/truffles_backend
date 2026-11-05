import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorizeRoles } from "../../../middlewares/auth.js";
import { validate } from "../../../middlewares/validate.js";
import { USER_ROLES } from "../../../constants/index.js";
import { ApiError } from "../../../utils/apiError.js";
import { ApiResponse } from "../../../utils/apiResponse.js";
import type { AuthenticatedRequest } from "../../../types/index.js";
import { MaintenanceService } from "../../site/maintenance.service.js";
import { updateMaintenanceSchema } from "../../site/maintenance.schema.js";

const router = Router();

// Every dashboard route needs a logged-in staff member (same login as the rest of the API).
router.use(authenticate);

const READ = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.STAFF] as const;
// Switching the whole website off is a big step: administrators only.
const WRITE = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN] as const;

router.get("/", authorizeRoles(...READ), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ApiResponse.success(res, "Maintenance settings retrieved", await MaintenanceService.get());
  } catch (error) {
    next(error);
  }
});

router.get("/history", authorizeRoles(...READ), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ApiResponse.success(res, "History retrieved", await MaintenanceService.history(10));
  } catch (error) {
    next(error);
  }
});

router.put("/", authorizeRoles(...WRITE), validate(updateMaintenanceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) throw ApiError.unauthorized("Authentication required");
    return ApiResponse.success(res, "Maintenance settings saved", await MaintenanceService.update(req.body, { id: user.id, name: user.name }));
  } catch (error) {
    next(error);
  }
});

export const dashboardMaintenanceRoutes = router;
