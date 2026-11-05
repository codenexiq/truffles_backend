/** JS ISO timestamp ("2026-11-05T10:30:00.123Z") to MySQL DATETIME(3) text in UTC. */
export const toSqlDate = (iso: string): string => iso.replace("T", " ").replace("Z", "");

/** MySQL DATETIME(3) text (UTC) back to an ISO timestamp. */
export const fromSqlDate = (sql: string): string => new Date(sql.replace(" ", "T") + "Z").toISOString();
