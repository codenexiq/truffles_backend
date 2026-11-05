import { Router } from "express";
import { PublicBlogController } from "./blog.controller.js";
import { validate } from "../../middlewares/validate.js";
import { publicSlugSchema } from "./blog.schema.js";

/** Public, read-only: the published posts the website shows. Mounted at /api/v1/blog. */
const router = Router();

router.get("/posts", PublicBlogController.list);
router.get("/posts/:slug", validate(publicSlugSchema), PublicBlogController.get);

export const blogRoutes = router;
