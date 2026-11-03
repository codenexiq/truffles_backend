import { z } from "zod";
import { dateField, safeImageUrl, text } from "../../utils/sanitize.js";

export const createEventSchema = z.object({
  body: z.object({
    title: text(3, 120, "Title must be at least 3 characters"),
    description: text(10, 2000, "Description must be at least 10 characters"),
    date: dateField,
    time: text(1, 20, "Time is required"),
    price: z.coerce.number().min(0).max(1_000_000).optional(),
    isFeatured: z.boolean().default(false),
    image: safeImageUrl.optional(),
  }),
});
