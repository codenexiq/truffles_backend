import type { RowDataPacket } from "mysql2/promise";
import { dbConfigured, getPool } from "../../db/pool.js";
import { toSqlDate } from "../../db/sql.js";
import { newId } from "../../utils/secure.js";

export interface StoredMedia {
  id: string;
  mime: string;
  size: number;
}

export interface MediaFile extends StoredMedia {
  data: Buffer;
  sha256: string;
}

/** Where uploaded images are kept: the database, or memory for local work without one. */
export interface MediaRepository {
  /** Saves the image, or returns the existing copy when the exact same file was uploaded before. */
  save(file: { mime: string; data: Buffer; sha256: string }, staffId?: string): Promise<StoredMedia>;
  get(id: string): Promise<MediaFile | null>;
}

class MemoryMediaRepository implements MediaRepository {
  private files = new Map<string, MediaFile>();

  async save(file: { mime: string; data: Buffer; sha256: string }) {
    for (const f of this.files.values()) if (f.sha256 === file.sha256) return { id: f.id, mime: f.mime, size: f.size };
    const rec: MediaFile = { id: newId("med"), mime: file.mime, size: file.data.length, data: file.data, sha256: file.sha256 };
    this.files.set(rec.id, rec);
    return { id: rec.id, mime: rec.mime, size: rec.size };
  }

  async get(id: string) {
    return this.files.get(id) ?? null;
  }
}

interface IdRow extends RowDataPacket {
  id: string;
  mime: string;
  size: number;
}
interface FileRow extends IdRow {
  data: Buffer;
  sha256: string;
}

class MysqlMediaRepository implements MediaRepository {
  private async bySha(sha256: string): Promise<StoredMedia | null> {
    const [rows] = await getPool().query<IdRow[]>("SELECT id, mime, size FROM media WHERE sha256 = ? LIMIT 1", [sha256]);
    return rows[0] ? { id: rows[0].id, mime: rows[0].mime, size: Number(rows[0].size) } : null;
  }

  async save(file: { mime: string; data: Buffer; sha256: string }, staffId?: string) {
    const existing = await this.bySha(file.sha256);
    if (existing) return existing;

    const id = newId("med");
    try {
      await getPool().query(
        // the sub-select turns an unknown staff id into NULL instead of a foreign-key error
        `INSERT INTO media (id, mime, size, sha256, data, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, (SELECT id FROM staff_users WHERE id = ?), ?)`,
        [id, file.mime, file.data.length, file.sha256, file.data, staffId ?? null, toSqlDate(new Date().toISOString())]
      );
    } catch (error) {
      // two identical uploads at the same moment: the other one won, use its copy
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        const winner = await this.bySha(file.sha256);
        if (winner) return winner;
      }
      throw error;
    }
    return { id, mime: file.mime, size: file.data.length };
  }

  async get(id: string) {
    const [rows] = await getPool().query<FileRow[]>("SELECT id, mime, size, sha256, data FROM media WHERE id = ? LIMIT 1", [id]);
    const r = rows[0];
    return r ? { id: r.id, mime: r.mime, size: Number(r.size), sha256: r.sha256, data: r.data } : null;
  }
}

export const mediaRepository: MediaRepository = dbConfigured ? new MysqlMediaRepository() : new MemoryMediaRepository();
