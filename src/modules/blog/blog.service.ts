import { ApiError } from "../../utils/apiError.js";
import { logger } from "../../utils/logger.js";
import { newId } from "../../utils/secure.js";
import { blogRepository } from "./blog.repository.js";
import type { BlogActor, BlogPost, BlogPostInput, BlogQuery, BlogStatus, Block, VideoRef } from "./blog.types.js";

/** Today in Pakistan time (UTC+5), as YYYY-MM-DD. The restaurant works on this clock, whatever the server's is. */
const today = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);

/** "Hi-Tea at Truffles: What to Expect" -> "hi-tea-at-truffles-what-to-expect" */
export function slugify(title: string): string {
  const s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  return s.length >= 3 ? s : "post";
}

const hasVideo = (body: Block[]) => body.some((b) => b.type === "video");

/** What the public website receives: no staff names, ids or draft state. */
export interface PublicPost {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogPost["category"];
  date: string;
  author: string;
  cover: string;
  coverAlt: string;
  video?: VideoRef;
  body: Block[];
}

const toPublic = (p: BlogPost): PublicPost => {
  const video = p.body.find((b): b is Extract<Block, { type: "video" }> => b.type === "video")?.video;
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    date: p.date,
    author: p.author,
    cover: p.cover,
    coverAlt: p.coverAlt,
    ...(video ? { video } : {}),
    body: p.body,
  };
};

export class BlogService {
  // ---------------- staff ----------------
  static list(query: BlogQuery) {
    return blogRepository.list(query);
  }

  static async getById(id: string): Promise<BlogPost> {
    const post = await blogRepository.getById(id);
    if (!post) throw ApiError.notFound("Post not found");
    return post;
  }

  static async create(input: Omit<BlogPostInput, "slug"> & { slug?: string }, actor: BlogActor): Promise<BlogPost> {
    let slug = input.slug;
    if (slug) {
      if (await blogRepository.slugTaken(slug)) throw ApiError.conflict("Another post already uses that web address");
    } else {
      // made from the title; a number is added if it is taken ("my-post", "my-post-2", ...)
      const base = slugify(input.title);
      slug = base;
      for (let n = 2; await blogRepository.slugTaken(slug); n++) {
        if (n > 50) throw ApiError.conflict("Could not make a unique web address; please enter one");
        slug = `${base.slice(0, 110)}-${n}`;
      }
    }
    const post = await blogRepository.insert(
      { ...input, slug, id: newId("post"), hasVideo: hasVideo(input.body) },
      new Date().toISOString(),
      actor
    );
    logger.info(`Blog post created: ${post.slug} (${post.status}) by ${actor.name}`);
    return post;
  }

  static async update(id: string, input: BlogPostInput, actor: BlogActor): Promise<BlogPost> {
    await this.getById(id);
    if (await blogRepository.slugTaken(input.slug, id)) throw ApiError.conflict("Another post already uses that web address");
    const post = await blogRepository.update(id, input, hasVideo(input.body), new Date().toISOString(), actor);
    if (!post) throw ApiError.notFound("Post not found");
    logger.info(`Blog post updated: ${post.slug} by ${actor.name}`);
    return post;
  }

  static async setStatus(id: string, status: BlogStatus, actor: BlogActor): Promise<BlogPost> {
    await this.getById(id);
    const post = await blogRepository.setStatus(id, status, new Date().toISOString(), actor);
    if (!post) throw ApiError.notFound("Post not found");
    logger.info(`Blog post ${status === "published" ? "published" : "unpublished"}: ${post.slug} by ${actor.name}`);
    return post;
  }

  static async remove(id: string, actor: BlogActor): Promise<void> {
    const post = await this.getById(id);
    await blogRepository.remove(id);
    logger.info(`Blog post deleted: ${post.slug} by ${actor.name}`);
  }

  // ---------------- public ----------------
  static async listPublished(): Promise<PublicPost[]> {
    return (await blogRepository.listPublished(today())).map(toPublic);
  }

  static async getPublished(slug: string): Promise<PublicPost> {
    const post = await blogRepository.getPublishedBySlug(slug, today());
    if (!post) throw ApiError.notFound("Post not found");
    return toPublic(post);
  }
}
