import { Router } from "express";
import { ReviewController } from "./review.controller.js";
import { validate } from "../../middlewares/validate.js";
import { createReviewSchema, setApprovalSchema } from "./review.schema.js";
import { honeypot } from "../../middlewares/security.js";
import { publicWriteLimiter } from "../../middlewares/rateLimiter.js";
import { authenticate, authorizeRoles } from "../../middlewares/auth.js";
import { USER_ROLES } from "../../constants/index.js";

const router = Router();

// Public review retrieval & submission
router.get("/", ReviewController.getApproved);
router.post("/", honeypot, publicWriteLimiter, validate(createReviewSchema), ReviewController.create);

// Admin review management
router.get(
  "/admin/all",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  ReviewController.getAll
);

router.patch(
  "/:id/approval",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  validate(setApprovalSchema),
  ReviewController.setApproval
);

export const reviewRoutes = router;

