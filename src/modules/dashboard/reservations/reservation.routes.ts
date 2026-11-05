import { Router } from "express";
import { DashboardReservationController } from "./reservation.controller.js";
import { validate } from "../../../middlewares/validate.js";
import { authenticate, authorizeRoles } from "../../../middlewares/auth.js";
import { USER_ROLES } from "../../../constants/index.js";
import { listReservationsSchema, reservationIdSchema, updateStatusSchema } from "./reservation.schema.js";

const router = Router();

// Every dashboard route needs a logged-in staff member (same login as the rest of the API).
router.use(authenticate);

const READ = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.STAFF] as const;
// Same rule as the existing status route: front-of-house staff can look, managers and above can change.
const WRITE = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER] as const;

router.get("/stats", authorizeRoles(...READ), DashboardReservationController.stats);
router.get("/", authorizeRoles(...READ), validate(listReservationsSchema), DashboardReservationController.list);
router.get("/:id", authorizeRoles(...READ), validate(reservationIdSchema), DashboardReservationController.getById);
router.get("/:id/history", authorizeRoles(...READ), validate(reservationIdSchema), DashboardReservationController.history);
router.patch("/:id/status", authorizeRoles(...WRITE), validate(updateStatusSchema), DashboardReservationController.updateStatus);

export const dashboardReservationRoutes = router;
