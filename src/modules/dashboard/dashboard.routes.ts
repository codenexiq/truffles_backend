import { Router } from "express";
import { dashboardReservationRoutes } from "./reservations/reservation.routes.js";
import { dashboardBlogRoutes } from "./blog/blog.routes.js";
import { dashboardMaintenanceRoutes } from "./maintenance/maintenance.routes.js";

/**
 * Everything the staff dashboard needs, kept apart from the public routes.
 * Mounted at /api/v1/dashboard. Add new dashboard sections (menu, events, ...) as sibling folders here.
 */
const router = Router();

router.use("/reservations", dashboardReservationRoutes);
router.use("/blog", dashboardBlogRoutes);
router.use("/maintenance", dashboardMaintenanceRoutes);

export const dashboardRoutes = router;
