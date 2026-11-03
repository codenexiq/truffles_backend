import { z } from "zod";
import { optionalText, text } from "../../utils/sanitize.js";

const categoryEnum = z.enum(["starters", "mains", "desserts", "beverages", "specials", "kids", "sides"]);
const tags = z.array(text(1, 30)).max(10);
const price = z.number().positive("Price must be greater than zero").max(1_000_000, "Price is too large");

export const createMenuItemSchema = z.object({
  body: z.object({
    name: text(2, 100, "Dish name must be at least 2 characters"),
    description: text(5, 600, "Description must be at least 5 characters"),
    price,
    category: categoryEnum,
    tags: tags.default([]),
    isAvailable: z.boolean().default(true),
    isPopular: z.boolean().optional(),
    isNew: z.boolean().optional(),
    allergens: tags.optional(),
    calories: z.number().int().positive().max(10_000).optional(),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Menu item ID is required").max(80),
  }),
  body: z.object({
    name: text(2, 100).optional(),
    description: text(5, 600).optional(),
    price: price.optional(),
    category: categoryEnum.optional(),
    tags: tags.optional(),
    isAvailable: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    isNew: z.boolean().optional(),
    allergens: tags.optional(),
    calories: z.number().int().positive().max(10_000).optional(),
  }),
});

export const getMenuQuerySchema = z.object({
  query: z.object({
    category: categoryEnum.optional(),
    search: optionalText(80),
    availableOnly: z.enum(["true", "false"]).optional(),
  }),
});
