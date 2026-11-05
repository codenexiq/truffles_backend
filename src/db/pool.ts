import mysql from "mysql2/promise";
import { env } from "../config/env.js";

let pool: mysql.Pool | null = null;

/** True when database settings are present (DB_NAME and DB_USER). Without them the API keeps data in memory. */
export const dbConfigured = Boolean(env.DB_NAME && env.DB_USER);

/** One shared connection pool for the whole API. */
export function getPool(): mysql.Pool {
  if (!dbConfigured) throw new Error("Database is not configured (DB_NAME / DB_USER are empty)");
  if (!pool) {
    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      connectionLimit: env.DB_CONNECTION_LIMIT,
      waitForConnections: true,
      charset: "utf8mb4",
      // Dates come back as plain strings ("2026-11-05 10:30:00.000"), which are stored and read as UTC.
      dateStrings: true,
      timezone: "Z",
      // Values are always sent as parameters, never glued into the SQL text.
      multipleStatements: false,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}
