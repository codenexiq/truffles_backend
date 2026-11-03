import { z } from "zod";
import { text } from "../../utils/sanitize.js";

export const createReviewSchema = z.object({
  body: z.object({
    name: text(2, 80, "Name must be at least 2 characters"),
    rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
    comment: text(5, 1000, "Review comment must be at least 5 characters"),
  }),
});

export const setApprovalSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z.object({ isApproved: z.boolean() }),
});
