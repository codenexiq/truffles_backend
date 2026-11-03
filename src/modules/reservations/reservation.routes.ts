import { Router } from "express";
import { ReservationController } from "./reservation.controller.js";
import { validate } from "../../middlewares/validate.js";
import {
  cancelReservationSchema,
  createReservationSchema,
  updateReservationStatusSchema,
} from "./reservation.schema.js";
import { honeypot } from "../../middlewares/security.js";
import { publicWriteLimiter } from "../../middlewares/rateLimiter.js";
import { authenticate, authorizeRoles } from "../../middlewares/auth.js";
import { USER_ROLES } from "../../constants/index.js";

const router = Router();

// Public reservation booking route
router.post("/", honeypot, publicWriteLimiter, validate(createReservationSchema), ReservationController.create);

// Guest cancellation: needs the secret token that was returned when booking
router.patch("/:id/cancel", publicWriteLimiter, validate(cancelReservationSchema), ReservationController.cancel);

// Staff/Admin management routes
router.get(
  "/",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.STAFF),
  ReservationController.getAll
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.STAFF),
  ReservationController.getById
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(updateReservationStatusSchema),
  ReservationController.updateStatus
);

export const reservationRoutes = router;

