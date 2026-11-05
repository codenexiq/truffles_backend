import type { RowDataPacket } from "mysql2/promise";
import { dbConfigured, getPool } from "../../db/pool.js";
import { fromSqlDate, toSqlDate } from "../../db/sql.js";
import type { Block, BlogActor, BlogPost, BlogPostInput, BlogPostSummary, BlogQuery, BlogStatus } from "./blog.types.js";

/** Where blog posts are kept: the database, or memory for local work without one. */
export interface BlogRepository {
  /** Dashboard list (no bodies). */
  list(query: BlogQuery): Promise<{ items: BlogPostSummary[]; total: number }>;
  getById(id: string): Promise<BlogPost | null>;
  slugTaken(slug: string, exceptId?: string): Promise<boolean>;
  insert(post: BlogPostInput & { id: string; hasVideo: boolean }, now: string, actor: BlogActor): Promise<BlogPost>;
  update(id: string, input: BlogPostInput, hasVideo: boolean, now: string, actor: BlogActor): Promise<BlogPost | null>;
  setStatus(id: string, status: BlogStatus, now: string, actor: BlogActor): Promise<BlogPost | null>;
  remove(id: string): Promise<boolean>;
  /** Public: published posts whose date has arrived, newest first. */
  listPublished(today: string): Promise<BlogPost[]>;
  getPublishedBySlug(slug: string, today: string): Promise<BlogPost | null>;
}

const toSummary = ({ body: _body, ...rest }: BlogPost): BlogPostSummary => rest;

/** Escapes % _ and \ so a search for "50%" finds "50%" instead of everything. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ============================================================================
// Memory
// ============================================================================
class MemoryBlogRepository implements BlogRepository {
  private posts: BlogPost[] = [];

  async list(q: BlogQuery) {
    const needle = q.q?.toLowerCase();
    const all = this.posts
      .filter((p) => (!q.status || p.status === q.status) && (!q.category || p.category === q.category) && (!needle || p.title.toLowerCase().includes(needle) || p.slug.includes(needle)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const start = (q.page - 1) * q.limit;
    return { items: all.slice(start, start + q.limit).map(toSummary), total: all.length };
  }
  async getById(id: string) {
    return this.posts.find((p) => p.id === id) ?? null;
  }
  async slugTaken(slug: string, exceptId?: string) {
    return this.posts.some((p) => p.slug === slug && p.id !== exceptId);
  }
  async insert(post: BlogPostInput & { id: string; hasVideo: boolean }, now: string, actor: BlogActor) {
    const rec: BlogPost = { ...post, createdAt: now, updatedAt: now, createdBy: actor.name, updatedBy: actor.name };
    this.posts.push(rec);
    return rec;
  }
  async update(id: string, input: BlogPostInput, hasVideo: boolean, now: string, actor: BlogActor) {
    const p = this.posts.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, input, { hasVideo, updatedAt: now, updatedBy: actor.name });
    return p;
  }
  async setStatus(id: string, status: BlogStatus, now: string, actor: BlogActor) {
    const p = this.posts.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, { status, updatedAt: now, updatedBy: actor.name });
    return p;
  }
  async remove(id: string) {
    const i = this.posts.findIndex((p) => p.id === id);
    if (i < 0) return false;
    this.posts.splice(i, 1);
    return true;
  }
  async listPublished(today: string) {
    return this.posts.filter((p) => p.status === "published" && p.date <= today).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }
  async getPublishedBySlug(slug: string, today: string) {
    return this.posts.find((p) => p.slug === slug && p.status === "published" && p.date <= today) ?? null;
  }
}

// ============================================================================
// MySQL
// ============================================================================
interface Row extends RowDataPacket {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: BlogPost["category"];
  author: string;
  cover: string;
  cover_alt: string;
  body?: string;
  has_video: number;
  status: BlogStatus;
  publish_date: string;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
}

const BASE_COLUMNS = `p.id, p.slug, p.title, p.excerpt, p.category, p.author, p.cover, p.cover_alt, p.has_video, p.status,
  p.publish_date, p.created_at, p.updated_at, c.name AS created_by_name, u.name AS updated_by_name`;
const JOINS = `FROM blog_posts p
  LEFT JOIN staff_users c ON c.id = p.created_by
  LEFT JOIN staff_users u ON u.id = p.updated_by`;

function parseBody(raw: string | undefined): Block[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as Block[]) : [];
  } catch {
    return [];
  }
}

const fromRow = (r: Row): BlogPost => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt,
  category: r.category,
  author: r.author,
  cover: r.cover,
  coverAlt: r.cover_alt,
  body: parseBody(r.body),
  hasVideo: r.has_video === 1,
  status: r.status,
  date: r.publish_date,
  createdAt: fromSqlDate(r.created_at),
  updatedAt: fromSqlDate(r.updated_at),
  createdBy: r.created_by_name,
  updatedBy: r.updated_by_name,
});

class MysqlBlogRepository implements BlogRepository {
  async list(q: BlogQuery) {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (q.status) {
      where.push("p.status = ?");
      params.push(q.status);
    }
    if (q.category) {
      where.push("p.category = ?");
      params.push(q.category);
    }
    if (q.q) {
      const like = `%${likeEscape(q.q)}%`;
      where.push("(p.title LIKE ? OR p.slug LIKE ?)");
      params.push(like, like);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const pool = getPool();
    const [count] = await pool.query<(RowDataPacket & { n: number })[]>(`SELECT COUNT(*) AS n FROM blog_posts p ${clause}`, params);
    const [rows] = await pool.query<Row[]>(
      `SELECT ${BASE_COLUMNS} ${JOINS} ${clause} ORDER BY p.publish_date DESC, p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, q.limit, (q.page - 1) * q.limit]
    );
    return { items: rows.map((r) => toSummary(fromRow(r))), total: Number(count[0]?.n ?? 0) };
  }

  async getById(id: string) {
    const [rows] = await getPool().query<Row[]>(`SELECT ${BASE_COLUMNS}, p.body ${JOINS} WHERE p.id = ? LIMIT 1`, [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async slugTaken(slug: string, exceptId?: string) {
    const [rows] = await getPool().query<RowDataPacket[]>("SELECT id FROM blog_posts WHERE slug = ? AND id <> ? LIMIT 1", [slug, exceptId ?? ""]);
    return rows.length > 0;
  }

  async insert(post: BlogPostInput & { id: string; hasVideo: boolean }, now: string, actor: BlogActor) {
    await getPool().query(
      `INSERT INTO blog_posts
         (id, slug, title, excerpt, category, author, cover, cover_alt, body, has_video, status, publish_date,
          created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT id FROM staff_users WHERE id = ?), (SELECT id FROM staff_users WHERE id = ?), ?, ?)`,
      [
        post.id, post.slug, post.title, post.excerpt, post.category, post.author, post.cover, post.coverAlt,
        JSON.stringify(post.body), post.hasVideo ? 1 : 0, post.status, post.date, actor.id, actor.id, toSqlDate(now), toSqlDate(now),
      ]
    );
    return (await this.getById(post.id)) as BlogPost;
  }

  async update(id: string, input: BlogPostInput, hasVideo: boolean, now: string, actor: BlogActor) {
    await getPool().query(
      `UPDATE blog_posts SET slug = ?, title = ?, excerpt = ?, category = ?, author = ?, cover = ?, cover_alt = ?, body = ?,
         has_video = ?, status = ?, publish_date = ?, updated_by = (SELECT id FROM staff_users WHERE id = ?), updated_at = ?
       WHERE id = ?`,
      [input.slug, input.title, input.excerpt, input.category, input.author, input.cover, input.coverAlt, JSON.stringify(input.body),
        hasVideo ? 1 : 0, input.status, input.date, actor.id, toSqlDate(now), id]
    );
    // null when the post does not exist (MySQL reports 0 changed rows when nothing differs, so look it up instead)
    return this.getById(id);
  }

  async setStatus(id: string, status: BlogStatus, now: string, actor: BlogActor) {
    await getPool().query("UPDATE blog_posts SET status = ?, updated_by = (SELECT id FROM staff_users WHERE id = ?), updated_at = ? WHERE id = ?", [
      status, actor.id, toSqlDate(now), id,
    ]);
    return this.getById(id);
  }

  async remove(id: string) {
    const [res] = await getPool().query("DELETE FROM blog_posts WHERE id = ?", [id]);
    return (res as { affectedRows: number }).affectedRows > 0;
  }

  async listPublished(today: string) {
    const [rows] = await getPool().query<Row[]>(
      `SELECT ${BASE_COLUMNS}, p.body ${JOINS} WHERE p.status = 'published' AND p.publish_date <= ?
       ORDER BY p.publish_date DESC, p.created_at DESC LIMIT 100`,
      [today]
    );
    return rows.map(fromRow);
  }

  async getPublishedBySlug(slug: string, today: string) {
    const [rows] = await getPool().query<Row[]>(
      `SELECT ${BASE_COLUMNS}, p.body ${JOINS} WHERE p.slug = ? AND p.status = 'published' AND p.publish_date <= ? LIMIT 1`,
      [slug, today]
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }
}

export const blogRepository: BlogRepository = dbConfigured ? new MysqlBlogRepository() : new MemoryBlogRepository();
