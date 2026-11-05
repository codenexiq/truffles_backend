import type { RowDataPacket } from "mysql2/promise";
import { mockDb, pushCapped, type ReservationRecord } from "../../data/mockDb.js";
import { dbConfigured, getPool } from "../../db/pool.js";
import { fromSqlDate, toSqlDate } from "../../db/sql.js";
import type { ReservationStatusType } from "../../constants/index.js";
import { recordMemoryHistory, setStatusWithHistory, type StatusActor } from "./statusHistory.js";

/** Where reservations are kept. The service only talks to this, so it does not care which one is in use. */
export interface ReservationRepository {
  list(filters?: { date?: string; status?: ReservationStatusType }): Promise<ReservationRecord[]>;
  getById(id: string): Promise<ReservationRecord | null>;
  insert(record: ReservationRecord): Promise<void>;
  /** Returns the updated record, or null when there is no such reservation. */
  updateStatus(id: string, status: ReservationStatusType, updatedAt: string, actor: StatusActor): Promise<ReservationRecord | null>;
}

// ---------- In memory (development, or when no database is configured) ----------
class MemoryReservationRepository implements ReservationRepository {
  async list(filters?: { date?: string; status?: ReservationStatusType }) {
    let list = [...mockDb.reservations];
    if (filters?.date) list = list.filter((r) => r.date === filters.date);
    if (filters?.status) list = list.filter((r) => r.status === filters.status);
    return list.sort((a, b) => new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime());
  }
  async getById(id: string) {
    return mockDb.reservations.find((r) => r.id === id) ?? null;
  }
  async insert(record: ReservationRecord) {
    pushCapped(mockDb.reservations, record);
  }
  async updateStatus(id: string, status: ReservationStatusType, updatedAt: string, actor: StatusActor) {
    const r = mockDb.reservations.find((x) => x.id === id);
    if (!r) return null;
    recordMemoryHistory(id, r.status, status, updatedAt, actor, actor.source === "staff" ? "Staff" : null);
    r.status = status;
    r.updatedAt = updatedAt;
    return r;
  }
}

// ---------- MySQL ----------
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
  cancel_token_hash: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, name, email, phone, reservation_date, reservation_time, guests, occasion, special_requests, status, cancel_token_hash, created_at, updated_at";

const fromRow = (r: Row): ReservationRecord => ({
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
  cancelTokenHash: r.cancel_token_hash ?? undefined,
  createdAt: fromSqlDate(r.created_at),
  updatedAt: fromSqlDate(r.updated_at),
});

class MysqlReservationRepository implements ReservationRepository {
  async list(filters?: { date?: string; status?: ReservationStatusType }) {
    const where: string[] = [];
    const params: string[] = [];
    if (filters?.date) {
      where.push("reservation_date = ?");
      params.push(filters.date);
    }
    if (filters?.status) {
      where.push("status = ?");
      params.push(filters.status);
    }
    const [rows] = await getPool().query<Row[]>(
      `SELECT ${COLUMNS} FROM reservations ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY reservation_date DESC, created_at DESC LIMIT 1000`,
      params
    );
    return rows.map(fromRow);
  }

  async getById(id: string) {
    const [rows] = await getPool().query<Row[]>(`SELECT ${COLUMNS} FROM reservations WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async insert(r: ReservationRecord) {
    await getPool().query(
      `INSERT INTO reservations
         (id, name, email, phone, reservation_date, reservation_time, guests, occasion, special_requests,
          status, cancel_token_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.name,
        r.email,
        r.phone,
        r.date,
        r.time,
        r.guests,
        r.occasion ?? null,
        r.specialRequests ?? null,
        r.status,
        r.cancelTokenHash ?? null,
        toSqlDate(r.createdAt),
        toSqlDate(r.updatedAt),
      ]
    );
  }

  async updateStatus(id: string, status: ReservationStatusType, updatedAt: string, actor: StatusActor) {
    // the change and its history row are saved together (see statusHistory.ts)
    if (!(await setStatusWithHistory(id, status, updatedAt, actor))) return null;
    return this.getById(id);
  }
}

export const reservationRepository: ReservationRepository = dbConfigured
  ? new MysqlReservationRepository()
  : new MemoryReservationRepository();
