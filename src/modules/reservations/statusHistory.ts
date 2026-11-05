import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool.js";
import { fromSqlDate, toSqlDate } from "../../db/sql.js";
import type { ReservationStatusType } from "../../constants/index.js";

/** Who changed a reservation's status. A guest cancelling with their secret link has no staff account. */
export interface StatusActor {
  source: "staff" | "guest";
  staffId?: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: ReservationStatusType | null;
  toStatus: ReservationStatusType;
  changedAt: string;
  /** The staff member's name, or null for a guest (or a staff account that has since been removed) */
  changedBy: string | null;
  source: "staff" | "guest";
}

// ---------- MySQL ----------
/**
 * Changes a reservation's status AND records who did it, in one transaction (both happen or neither does).
 * Returns false when there is no such reservation.
 * reservation_status_history has foreign keys to reservations and staff_users; the sub-select below turns an
 * unknown staff id into NULL instead of a constraint error.
 */
export async function setStatusWithHistory(
  id: string,
  status: ReservationStatusType,
  updatedAt: string,
  actor: StatusActor
): Promise<boolean> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<(RowDataPacket & { status: ReservationStatusType })[]>(
      "SELECT status FROM reservations WHERE id = ? FOR UPDATE",
      [id]
    );
    if (!rows[0]) {
      await conn.rollback();
      return false;
    }
    await conn.query("UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?", [status, toSqlDate(updatedAt), id]);
    await conn.query(
      `INSERT INTO reservation_status_history (reservation_id, changed_by, from_status, to_status, source, changed_at)
       VALUES (?, (SELECT id FROM staff_users WHERE id = ?), ?, ?, ?, ?)`,
      [id, actor.staffId ?? null, rows[0].status, status, actor.source, toSqlDate(updatedAt)]
    );
    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}

export async function listHistoryMysql(reservationId: string): Promise<StatusHistoryEntry[]> {
  const [rows] = await getPool().query<
    (RowDataPacket & {
      id: number;
      from_status: ReservationStatusType | null;
      to_status: ReservationStatusType;
      source: "staff" | "guest";
      changed_at: string;
      staff_name: string | null;
    })[]
  >(
    `SELECT h.id, h.from_status, h.to_status, h.source, h.changed_at, u.name AS staff_name
       FROM reservation_status_history h
       LEFT JOIN staff_users u ON u.id = h.changed_by
      WHERE h.reservation_id = ?
      ORDER BY h.changed_at DESC, h.id DESC
      LIMIT 100`,
    [reservationId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    fromStatus: r.from_status,
    toStatus: r.to_status,
    changedAt: fromSqlDate(r.changed_at),
    changedBy: r.staff_name,
    source: r.source,
  }));
}

// ---------- In memory (local work without a database) ----------
const memory: (StatusHistoryEntry & { reservationId: string })[] = [];
let memoryCounter = 0;

export function recordMemoryHistory(
  reservationId: string,
  from: ReservationStatusType | null,
  to: ReservationStatusType,
  at: string,
  actor: StatusActor,
  staffName: string | null
) {
  memory.push({ id: String(++memoryCounter), reservationId, fromStatus: from, toStatus: to, changedAt: at, changedBy: staffName, source: actor.source });
  if (memory.length > 5000) memory.shift();
}

export function listHistoryMemory(reservationId: string): StatusHistoryEntry[] {
  return memory
    .filter((h) => h.reservationId === reservationId)
    .map(({ reservationId: _r, ...rest }) => rest)
    .reverse();
}
