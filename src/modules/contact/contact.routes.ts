import { Router } from "express";
import { ContactController } from "./contact.controller.js";
import { validate } from "../../middlewares/validate.js";
import { honeypot } from "../../middlewares/security.js";
import { publicWriteLimiter } from "../../middlewares/rateLimiter.js";
import { contactInquirySchema } from "./contact.schema.js";
import { authenticate, authorizeRoles } from "../../middlewares/auth.js";
import { USER_ROLES } from "../../constants/index.js";

const router = Router();

// Public contact submission
router.post("/", honeypot, publicWriteLimiter, validate(contactInquirySchema), ContactController.create);

// Admin/Staff view & update
router.get(
  "/",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  ContactController.getAll
);

router.patch(
  "/:id/read",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  ContactController.markAsRead
);

export const contactRoutes = router;

