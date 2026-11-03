import { Router } from "express";
import { NewsletterController } from "./newsletter.controller.js";
import { validate } from "../../middlewares/validate.js";
import { subscribeNewsletterSchema, unsubscribeNewsletterSchema } from "./newsletter.schema.js";
import { honeypot } from "../../middlewares/security.js";
import { publicWriteLimiter } from "../../middlewares/rateLimiter.js";
import { authenticate, authorizeRoles } from "../../middlewares/auth.js";
import { USER_ROLES } from "../../constants/index.js";

const router = Router();

// Public subscribe/unsubscribe
router.post("/subscribe", honeypot, publicWriteLimiter, validate(subscribeNewsletterSchema), NewsletterController.subscribe);
router.post("/unsubscribe", publicWriteLimiter, validate(unsubscribeNewsletterSchema), NewsletterController.unsubscribe);

// Admin view
router.get(
  "/subscribers",
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER),
  NewsletterController.getAll
);

export const newsletterRoutes = router;

