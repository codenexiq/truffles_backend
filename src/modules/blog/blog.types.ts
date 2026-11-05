export const BLOG_CATEGORIES = ["menu", "celebrations", "videos"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const BLOG_STATUSES = ["draft", "published"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export type VideoRef = { kind: "youtube"; id: string };

/** One piece of a post's content. Same shapes the website's blog page already renders. */
export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; title?: string; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "note"; label?: string; text: string }
  | { type: "pairing"; items: { drink: string; with: string; why: string }[] }
  | { type: "gallery"; images: { src: string; alt: string }[] }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "video"; video: VideoRef; caption?: string }
  | { type: "cta"; text: string; label: string; href: string };

/** The fields an editor can change. */
export interface BlogPostInput {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  author: string;
  /** `/images/...` (the site's own pictures) or `/media/<id>` (uploaded from the dashboard) */
  cover: string;
  coverAlt: string;
  body: Block[];
  status: BlogStatus;
  /** The date shown on the post, YYYY-MM-DD. A published post with a future date appears on that day. */
  date: string;
}

export interface BlogPost extends BlogPostInput {
  id: string;
  hasVideo: boolean;
  createdAt: string;
  updatedAt: string;
  /** Names of the staff members, or null when unknown / removed */
  createdBy: string | null;
  updatedBy: string | null;
}

/** A post without its (large) body, for lists. */
export type BlogPostSummary = Omit<BlogPost, "body">;

export interface BlogQuery {
  status?: BlogStatus;
  category?: BlogCategory;
  q?: string;
  page: number;
  limit: number;
}

/** The staff member making a change (the id is stored; the name is used when there is no database). */
export interface BlogActor {
  id: string;
  name: string;
}
