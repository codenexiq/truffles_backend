import type { RowDataPacket } from "mysql2/promise";
import { dbConfigured, getPool } from "../../db/pool.js";
import { fromSqlDate, toSqlDate } from "../../db/sql.js";
import type { UserRoleType } from "../../constants/index.js";

/** A staff login account. */
export interface StaffRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRoleType;
  createdAt: string;
}

/** Where staff accounts are kept: the database when one is configured, memory otherwise (local work). */
export interface StaffRepository {
  findByEmail(email: string): Promise<StaffRecord | null>;
  findById(id: string): Promise<StaffRecord | null>;
  insert(record: StaffRecord): Promise<void>;
  updateCredentials(id: string, passwordHash: string, role: UserRoleType): Promise<void>;
}

// ---------- In memory ----------
class MemoryStaffRepository implements StaffRepository {
  private users: StaffRecord[] = [];
  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }
  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async insert(record: StaffRecord) {
    this.users.push(record);
  }
  async updateCredentials(id: string, passwordHash: string, role: UserRoleType) {
    const u = this.users.find((x) => x.id === id);
    if (u) {
      u.passwordHash = passwordHash;
      u.role = role;
    }
  }
}

// ---------- MySQL ----------
interface Row extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRoleType;
  created_at: string;
}

const fromRow = (r: Row): StaffRecord => ({
  id: r.id,
  name: r.name,
  email: r.email,
  passwordHash: r.password_hash,
  role: r.role,
  createdAt: fromSqlDate(r.created_at),
});

const COLUMNS = "id, name, email, password_hash, role, created_at";

class MysqlStaffRepository implements StaffRepository {
  async findByEmail(email: string) {
    const [rows] = await getPool().query<Row[]>(`SELECT ${COLUMNS} FROM staff_users WHERE email = ? LIMIT 1`, [email]);
    return rows[0] ? fromRow(rows[0]) : null;
  }
  async findById(id: string) {
    const [rows] = await getPool().query<Row[]>(`SELECT ${COLUMNS} FROM staff_users WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }
  async insert(r: StaffRecord) {
    const now = toSqlDate(new Date().toISOString());
    await getPool().query(
      `INSERT INTO staff_users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.name, r.email, r.passwordHash, r.role, toSqlDate(r.createdAt), now]
    );
  }
  async updateCredentials(id: string, passwordHash: string, role: UserRoleType) {
    await getPool().query("UPDATE staff_users SET password_hash = ?, role = ?, updated_at = ? WHERE id = ?", [
      passwordHash,
      role,
      toSqlDate(new Date().toISOString()),
      id,
    ]);
  }
}

export const staffRepository: StaffRepository = dbConfigured ? new MysqlStaffRepository() : new MemoryStaffRepository();
