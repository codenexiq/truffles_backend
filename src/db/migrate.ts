import { getPool } from "./pool.js";
import { MIGRATIONS } from "./schema.js";
import { logger } from "../utils/logger.js";

/** Creates anything that is missing. Safe to run on every start. */
export async function runMigrations(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name VARCHAR(120) NOT NULL PRIMARY KEY,
       applied_at DATETIME(3) NOT NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  const [rows] = await pool.query("SELECT name FROM schema_migrations");
  const done = new Set((rows as { name: string }[]).map((r) => r.name));

  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    await pool.query(m.sql);
    await pool.query("INSERT INTO schema_migrations (name, applied_at) VALUES (?, UTC_TIMESTAMP(3))", [m.name]);
    logger.info(`Database: applied ${m.name}`);
  }
}

/** Checks the connection and brings the structure up to date. */
export async function initDatabase(): Promise<void> {
  const pool = getPool();
  await pool.query("SELECT 1");
  await runMigrations();
}
