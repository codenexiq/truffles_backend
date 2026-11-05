import type { RowDataPacket } from "mysql2/promise";
import { dbConfigured, getPool } from "../../db/pool.js";
import { fromSqlDate, toSqlDate } from "../../db/sql.js";

export interface MaintenanceSettings {
  enabled: boolean;
  title: string;
  message: string;
  /** Free text such as "around 8 PM tonight". Optional. */
  eta: string | null;
  updatedAt: string | null;
  /** The staff member's name; null when never changed or the account was removed */
  updatedBy: string | null;
}

export interface MaintenanceLogEntry {
  id: string;
  enabled: boolean;
  title: string;
  changedAt: string;
  changedBy: string | null;
}

export interface MaintenanceInput {
  enabled: boolean;
  title: string;
  message: string;
  eta: string | null;
}

export const DEFAULT_MAINTENANCE: MaintenanceSettings = {
  enabled: false,
  title: "We'll be back soon",
  message: "Truffles Rooftop is getting a little polish. Please check back shortly, or call us to reserve a table.",
  eta: null,
  updatedAt: null,
  updatedBy: null,
};

export interface MaintenanceActor {
  id: string;
  name: string;
}

export interface MaintenanceRepository {
  get(): Promise<MaintenanceSettings>;
  /** Saves the settings and records the change in the log. */
  save(input: MaintenanceInput, now: string, actor: MaintenanceActor): Promise<MaintenanceSettings>;
  log(limit: number): Promise<MaintenanceLogEntry[]>;
}

// ---------- memory ----------
class MemoryMaintenanceRepository implements MaintenanceRepository {
  private current: MaintenanceSettings = { ...DEFAULT_MAINTENANCE };
  private entries: (MaintenanceLogEntry & { n: number })[] = [];
  private counter = 0;

  async get() {
    return { ...this.current };
  }
  async save(input: MaintenanceInput, now: string, actor: MaintenanceActor) {
    this.current = { ...input, updatedAt: now, updatedBy: actor.name };
    this.entries.push({ n: ++this.counter, id: String(this.counter), enabled: input.enabled, title: input.title, changedAt: now, changedBy: actor.name });
    return { ...this.current };
  }
  async log(limit: number) {
    return this.entries
      .slice()
      .reverse()
      .slice(0, limit)
      .map(({ n: _n, ...rest }) => rest);
  }
}

// ---------- MySQL ----------
interface Row extends RowDataPacket {
  enabled: number;
  title: string;
  message: string;
  eta: string | null;
  updated_at: string;
  updated_by_name: string | null;
}

class MysqlMaintenanceRepository implements MaintenanceRepository {
  async get(): Promise<MaintenanceSettings> {
    const [rows] = await getPool().query<Row[]>(
      `SELECT m.enabled, m.title, m.message, m.eta, m.updated_at, u.name AS updated_by_name
         FROM site_maintenance m LEFT JOIN staff_users u ON u.id = m.updated_by WHERE m.id = 1 LIMIT 1`
    );
    const r = rows[0];
    if (!r) return { ...DEFAULT_MAINTENANCE };
    return { enabled: r.enabled === 1, title: r.title, message: r.message, eta: r.eta, updatedAt: fromSqlDate(r.updated_at), updatedBy: r.updated_by_name };
  }

  async save(input: MaintenanceInput, now: string, actor: MaintenanceActor) {
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      // the sub-selects turn an unknown staff id into NULL instead of a foreign-key error
      await conn.query(
        `INSERT INTO site_maintenance (id, enabled, title, message, eta, updated_by, updated_at)
         VALUES (1, ?, ?, ?, ?, (SELECT id FROM staff_users WHERE id = ?), ?)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), title = VALUES(title), message = VALUES(message),
           eta = VALUES(eta), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
        [input.enabled ? 1 : 0, input.title, input.message, input.eta, actor.id, toSqlDate(now)]
      );
      await conn.query(
        `INSERT INTO site_maintenance_log (enabled, title, changed_by, changed_at)
         VALUES (?, ?, (SELECT id FROM staff_users WHERE id = ?), ?)`,
        [input.enabled ? 1 : 0, input.title, actor.id, toSqlDate(now)]
      );
      await conn.commit();
    } catch (error) {
      await conn.rollback().catch(() => undefined);
      throw error;
    } finally {
      conn.release();
    }
    return this.get();
  }

  async log(limit: number) {
    const [rows] = await getPool().query<(RowDataPacket & { id: number; enabled: number; title: string; changed_at: string; name: string | null })[]>(
      `SELECT l.id, l.enabled, l.title, l.changed_at, u.name
         FROM site_maintenance_log l LEFT JOIN staff_users u ON u.id = l.changed_by
        ORDER BY l.changed_at DESC, l.id DESC LIMIT ?`,
      [limit]
    );
    return rows.map((r) => ({ id: String(r.id), enabled: r.enabled === 1, title: r.title, changedAt: fromSqlDate(r.changed_at), changedBy: r.name }));
  }
}

export const maintenanceRepository: MaintenanceRepository = dbConfigured ? new MysqlMaintenanceRepository() : new MemoryMaintenanceRepository();
