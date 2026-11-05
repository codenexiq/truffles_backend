import type { RowDataPacket } from "mysql2/promise";
import { env } from "../../../config/env.js";
import { mockDb, type ReservationRecord } from "../../../data/mockDb.js";
import { dbConfigured, getPool } from "../../../db/pool.js";
import { fromSqlDate } from "../../../db/sql.js";
import { RESERVATION_STATUS, type ReservationStatusType } from "../../../constants/index.js";
import { buildDemoReservations } from "./demo-data.js";
import {
  listHistoryMemory,
  listHistoryMysql,
  recordMemoryHistory,
  setStatusWithHistory,
  type StatusActor,
  type StatusHistoryEntry,
} from "../../reservations/statusHistory.js";
import type { Reservation, ReservationQuery, ReservationStats } from "./reservation.types.js";

/**
 * Where the dashboard reads reservations from: the same MySQL table the public booking form writes to.
 * (Locally, without a database, it reads the same in-memory list the public API writes to.)
 */
export interface DashboardReservationRepository {
  list(query: ReservationQuery): Promise<{ items: Reservation[]; total: number }>;
  getById(id: string): Promise<Reservation | null>;
  updateStatus(id: string, status: ReservationStatusType, updatedAt: string, actor: StatusActor): Promise<Reservation | null>;
  history(id: string): Promise<StatusHistoryEntry[]>;
  stats(today: string, weekEnd: string): Promise<ReservationStats>;
}

const emptyByStatus = (): Record<ReservationStatusType, number> => ({
  pending: 0,
  confirmed: 0,
  cancelled: 0,
  completed: 0,
});

// ============================================================================
// MySQL
// ============================================================================
interface Row extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  phone: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  occasion: string | null;
  special_requests: string | null;
  status: ReservationStatusType;
  created_at: string;
  updated_at: string;
}

// cancel_token_hash is deliberately left out of every query: the dashboard never needs the guest's secret.
const COLUMNS =
  "id, name, email, phone, reservation_date, reservation_time, guests, occasion, special_requests, status, created_at, updated_at";

const fromRow = (r: Row): Reservation => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  date: r.reservation_date,
  time: r.reservation_time,
  guests: Number(r.guests),
  occasion: r.occasion ?? undefined,
  specialRequests: r.special_requests ?? undefined,
  status: r.status,
  createdAt: fromSqlDate(r.created_at),
  updatedAt: fromSqlDate(r.updated_at),
});

/** Escapes % _ and \ so a search for "50%" finds "50%" instead of everything. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const ORDER: Record<ReservationQuery["sort"], string> = {
  newest: "created_at DESC",
  date_asc: "reservation_date ASC, created_at ASC",
  date_desc: "reservation_date DESC, created_at DESC",
};

class MysqlDashboardReservationRepository implements DashboardReservationRepository {
  async list(query: ReservationQuery) {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (query.status) {
      where.push("status = ?");
      params.push(query.status);
    }
    if (query.date) {
      where.push("reservation_date = ?");
      params.push(query.date);
    }
    if (query.from) {
      where.push("reservation_date >= ?");
      params.push(query.from);
    }
    if (query.to) {
      where.push("reservation_date <= ?");
      params.push(query.to);
    }
    if (query.q) {
      const like = `%${likeEscape(query.q)}%`;
      where.push("(name LIKE ? OR email LIKE ? OR phone LIKE ?)");
      params.push(like, like, like);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const pool = getPool();

    const [countRows] = await pool.query<(RowDataPacket & { n: number })[]>(
      `SELECT COUNT(*) AS n FROM reservations ${clause}`,
      params
    );
    const [rows] = await pool.query<Row[]>(
      `SELECT ${COLUMNS} FROM reservations ${clause} ORDER BY ${ORDER[query.sort]} LIMIT ? OFFSET ?`,
      [...params, query.limit, (query.page - 1) * query.limit]
    );
    return { items: rows.map(fromRow), total: Number(countRows[0]?.n ?? 0) };
  }

  async getById(id: string) {
    const [rows] = await getPool().query<Row[]>(`SELECT ${COLUMNS} FROM reservations WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async updateStatus(id: string, status: ReservationStatusType, updatedAt: string, actor: StatusActor) {
    // the change and its history row are saved together (see statusHistory.ts)
    if (!(await setStatusWithHistory(id, status, updatedAt, actor))) return null;
    return this.getById(id);
  }

  history(id: string) {
    return listHistoryMysql(id);
  }

  async stats(today: string, weekEnd: string): Promise<ReservationStats> {
    const pool = getPool();
    const [byStatusRows] = await pool.query<(RowDataPacket & { status: ReservationStatusType; n: number })[]>(
      "SELECT status, COUNT(*) AS n FROM reservations GROUP BY status"
    );
    const byStatus = emptyByStatus();
    for (const r of byStatusRows) byStatus[r.status] = Number(r.n);

    const [todayRows] = await pool.query<(RowDataPacket & { n: number; g: number | null })[]>(
      "SELECT COUNT(*) AS n, COALESCE(SUM(guests), 0) AS g FROM reservations WHERE reservation_date = ? AND status <> 'cancelled'",
      [today]
    );
    const [weekRows] = await pool.query<(RowDataPacket & { n: number })[]>(
      "SELECT COUNT(*) AS n FROM reservations WHERE reservation_date BETWEEN ? AND ? AND status IN ('pending','confirmed')",
      [today, weekEnd]
    );
    return {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      today: { reservations: Number(todayRows[0]?.n ?? 0), guests: Number(todayRows[0]?.g ?? 0) },
      upcomingWeek: Number(weekRows[0]?.n ?? 0),
    };
  }
}

// ============================================================================
// In memory: local development only. Shares the public API's list, so a booking made on the site shows up here.
// ============================================================================
/** The dashboard's view of a record: everything except the guest's secret. */
const toPublicShape = ({ cancelTokenHash: _secret, ...rest }: ReservationRecord): Reservation => rest;

class MemoryDashboardReservationRepository implements DashboardReservationRepository {
  constructor() {
    // A believable set of bookings so the dashboard can be tried. Never added in production.
    if (!env.isProd && mockDb.reservations.length < 5) mockDb.reservations.push(...buildDemoReservations());
  }

  private get rows() {
    return mockDb.reservations;
  }

  async list(query: ReservationQuery) {
    const q = query.q?.toLowerCase();
    const list = this.rows
      .filter(
        (r) =>
          (!query.status || r.status === query.status) &&
          (!query.date || r.date === query.date) &&
          (!query.from || r.date >= query.from) &&
          (!query.to || r.date <= query.to) &&
          (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        if (query.sort === "date_asc") return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
        if (query.sort === "date_desc") return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
        return b.createdAt.localeCompare(a.createdAt);
      });
    const start = (query.page - 1) * query.limit;
    return { items: list.slice(start, start + query.limit).map(toPublicShape), total: list.length };
  }

  async getById(id: string) {
    const r = this.rows.find((x) => x.id === id);
    return r ? toPublicShape(r) : null;
  }

  async history(id: string) {
    return listHistoryMemory(id);
  }

  async updateStatus(id: string, status: ReservationStatusType, updatedAt: string, actor: StatusActor) {
    const r = this.rows.find((x) => x.id === id);
    if (!r) return null;
    recordMemoryHistory(id, r.status, status, updatedAt, actor, actor.source === "staff" ? "Staff" : null);
    r.status = status;
    r.updatedAt = updatedAt;
    return toPublicShape(r);
  }

  async stats(today: string, weekEnd: string): Promise<ReservationStats> {
    const byStatus = emptyByStatus();
    for (const r of this.rows) byStatus[r.status]++;
    const todays = this.rows.filter((r) => r.date === today && r.status !== RESERVATION_STATUS.CANCELLED);
    return {
      total: this.rows.length,
      byStatus,
      today: { reservations: todays.length, guests: todays.reduce((a, r) => a + r.guests, 0) },
      upcomingWeek: this.rows.filter((r) => r.date >= today && r.date <= weekEnd && (r.status === "pending" || r.status === "confirmed")).length,
    };
  }
}

export const dashboardReservationRepository: DashboardReservationRepository = dbConfigured
  ? new MysqlDashboardReservationRepository()
  : new MemoryDashboardReservationRepository();
