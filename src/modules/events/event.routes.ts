import { Router } from "express";
import { EventController } from "./event.controller.js";
import { validate } from "../../middlewares/validate.js";
import { createEventSchema } from "./event.schema.js";
import { authenticate, authorizeRoles } from "../../middlewares/auth.js";
import { USER_ROLES } from "../../constants/index.js";

const router = Router();

// Public events listing & detail
router.get("/", EventController.getAll);
router.get("/:id", EventController.getById);

// Admin management
router.post(
  "/",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(createEventSchema),
  EventController.create
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  EventController.delete
);

export const eventRoutes = router;

