import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { validate } from "../../middlewares/validate.js";
import { loginSchema, registerStaffSchema } from "./auth.schema.js";
import { authenticate, authorizeRoles } from "../../middlewares/auth.js";
import { authRateLimiter } from "../../middlewares/rateLimiter.js";
import { USER_ROLES } from "../../constants/index.js";

const router = Router();

// Staff login
router.post("/login", authRateLimiter, validate(loginSchema), AuthController.login);
router.post("/logout", AuthController.logout);

// Current user profile
router.get("/me", authenticate, AuthController.getMe);

// Create new staff account (Admin only)
router.post(
  "/register-staff",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  validate(registerStaffSchema),
  AuthController.registerStaff
);

export const authRoutes = router;

