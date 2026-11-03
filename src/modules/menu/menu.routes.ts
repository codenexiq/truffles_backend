import { Router } from "express";
import { MenuController } from "./menu.controller.js";
import { validate } from "../../middlewares/validate.js";
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  getMenuQuerySchema,
} from "./menu.schema.js";
import { authenticate, authorizeRoles } from "../../middlewares/auth.js";
import { USER_ROLES } from "../../constants/index.js";

const router = Router();

// Public routes
router.get("/", validate(getMenuQuerySchema), MenuController.getAll);
router.get("/:id", MenuController.getById);

// Protected routes (Admin / Manager)
router.post(
  "/",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(createMenuItemSchema),
  MenuController.create
);

router.put(
  "/:id",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(updateMenuItemSchema),
  MenuController.update
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  MenuController.delete
);

export const menuRoutes = router;

