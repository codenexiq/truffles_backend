import { z } from "zod";
import { dateField, optionalText, text } from "../../utils/sanitize.js";
import { BLOG_CATEGORIES, BLOG_STATUSES } from "./blog.types.js";

/**
 * Pictures a post may use: the site's own `/images/...` files, or an image uploaded from the dashboard
 * (`/media/<id>`). Nothing else, so a post can never pull in content from a stranger's website.
 */
const imagePath = z
  .string()
  .max(255)
  .regex(/^(\/images\/[A-Za-z0-9_\-./]+|\/media\/med_[A-Za-z0-9-]{8,64})$/, "Choose a picture from the library or upload one")
  .refine((p) => !p.includes(".."), "Invalid picture path");

/** A link in a button: a page on this site, or an https address. Never "javascript:" and friends. */
const linkHref = z
  .string()
  .trim()
  .max(300)
  .regex(/^(\/[A-Za-z0-9/_\-#?=&.%]*|https:\/\/[^\s<>"']+)$/, "Use a page on this site (like /reservations) or an https:// address");

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text: text(1, 4000) }),
  z.object({ type: z.literal("h2"), text: text(1, 200) }),
  z.object({ type: z.literal("list"), title: optionalText(100), items: z.array(text(1, 300)).min(1).max(20) }),
  z.object({ type: z.literal("quote"), text: text(1, 600), cite: optionalText(100) }),
  z.object({ type: z.literal("note"), label: optionalText(40), text: text(1, 600) }),
  z.object({
    type: z.literal("pairing"),
    items: z.array(z.object({ drink: text(1, 80), with: text(1, 80), why: text(1, 300) })).min(1).max(8),
  }),
  z.object({
    type: z.literal("gallery"),
    images: z.array(z.object({ src: imagePath, alt: text(1, 200) })).min(1).max(12),
  }),
  z.object({ type: z.literal("image"), src: imagePath, alt: text(1, 200), caption: optionalText(200) }),
  z.object({
    type: z.literal("video"),
    video: z.object({ kind: z.literal("youtube"), id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "That is not a YouTube video id") }),
    caption: optionalText(200),
  }),
  z.object({ type: z.literal("cta"), text: text(1, 200), label: text(1, 40), href: linkHref }),
]);

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "The web address must be at least 3 characters")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use only lowercase letters, numbers and single dashes");

const postFields = {
  title: text(3, 160, "Title must be at least 3 characters"),
  excerpt: text(10, 300, "The summary must be at least 10 characters"),
  category: z.enum(BLOG_CATEGORIES),
  author: text(2, 80, "Author is required"),
  cover: imagePath,
  coverAlt: text(2, 200, "Describe the cover picture (for screen readers)"),
  body: z.array(block).min(1, "Add at least one block of content").max(80),
  status: z.enum(BLOG_STATUSES),
  date: dateField,
};

export const createPostSchema = z.object({
  body: z.object({ ...postFields, slug: slug.optional() }),
});

export const updatePostSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z.object({ ...postFields, slug }),
});

export const postIdSchema = z.object({ params: z.object({ id: z.string().min(1).max(80) }) });

export const setStatusSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z.object({ status: z.enum(BLOG_STATUSES) }),
});

export const listPostsSchema = z.object({
  query: z.object({
    status: z.enum(BLOG_STATUSES).optional(),
    category: z.enum(BLOG_CATEGORIES).optional(),
    q: z.string().trim().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const publicSlugSchema = z.object({ params: z.object({ slug }) });
