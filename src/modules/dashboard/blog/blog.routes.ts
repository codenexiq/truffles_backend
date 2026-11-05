import { Router } from "express";
import { DashboardBlogController } from "../../blog/blog.controller.js";
import { validate } from "../../../middlewares/validate.js";
import { authenticate, authorizeRoles } from "../../../middlewares/auth.js";
import { USER_ROLES } from "../../../constants/index.js";
import { createPostSchema, listPostsSchema, postIdSchema, setStatusSchema, updatePostSchema } from "../../blog/blog.schema.js";

const router = Router();

// Every dashboard route needs a logged-in staff member (same login as the rest of the API).
router.use(authenticate);

const READ = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.STAFF] as const;
// Writing and publishing: managers and above. Deleting a post for good: admins only.
const WRITE = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER] as const;
const DELETE = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN] as const;

router.get("/posts", authorizeRoles(...READ), validate(listPostsSchema), DashboardBlogController.list);
router.post("/posts", authorizeRoles(...WRITE), validate(createPostSchema), DashboardBlogController.create);
router.get("/posts/:id", authorizeRoles(...READ), validate(postIdSchema), DashboardBlogController.get);
router.put("/posts/:id", authorizeRoles(...WRITE), validate(updatePostSchema), DashboardBlogController.update);
router.patch("/posts/:id/status", authorizeRoles(...WRITE), validate(setStatusSchema), DashboardBlogController.setStatus);
router.delete("/posts/:id", authorizeRoles(...DELETE), validate(postIdSchema), DashboardBlogController.remove);

export const dashboardBlogRoutes = router;
