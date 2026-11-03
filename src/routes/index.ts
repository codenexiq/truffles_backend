import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { menuRoutes } from "../modules/menu/menu.routes.js";
import { reservationRoutes } from "../modules/reservations/reservation.routes.js";
import { orderRoutes } from "../modules/orders/order.routes.js";
import { contactRoutes } from "../modules/contact/contact.routes.js";
import { newsletterRoutes } from "../modules/newsletter/newsletter.routes.js";
import { reviewRoutes } from "../modules/reviews/review.routes.js";
import { eventRoutes } from "../modules/events/event.routes.js";
import { ApiResponse } from "../utils/apiResponse.js";

const router = Router();

// Health check (minimal: no version, uptime or other internals)
router.get("/health", (_req, res) => {
  return ApiResponse.success(res, "OK", { status: "UP" });
});

// Domain Routes
router.use("/auth", authRoutes);
router.use("/menu", menuRoutes);
router.use("/reservations", reservationRoutes);
router.use("/orders", orderRoutes);
router.use("/contact", contactRoutes);
router.use("/newsletter", newsletterRoutes);
router.use("/reviews", reviewRoutes);
router.use("/events", eventRoutes);

export const apiRouter = router;

