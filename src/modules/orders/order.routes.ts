import { Router } from "express";
import { OrderController } from "./order.controller.js";
import { validate } from "../../middlewares/validate.js";
import { createOrderSchema, updateOrderStatusSchema } from "./order.schema.js";
import { authenticate, authorizeRoles, optionalAuthenticate } from "../../middlewares/auth.js";
import { honeypot } from "../../middlewares/security.js";
import { publicWriteLimiter } from "../../middlewares/rateLimiter.js";
import { USER_ROLES } from "../../constants/index.js";

const router = Router();

// Public customer order placement
router.post("/", honeypot, publicWriteLimiter, validate(createOrderSchema), OrderController.create);
// Staff see any order; customers must present the secret token from their order response
router.get("/:id", optionalAuthenticate, OrderController.getById);

// Staff / Kitchen display system / Admin
router.get(
  "/",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.STAFF),
  OrderController.getAll
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.STAFF),
  validate(updateOrderStatusSchema),
  OrderController.updateStatus
);

export const orderRoutes = router;

