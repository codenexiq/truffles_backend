/**
 * Database structure. Each entry runs once, in order, and is recorded in `schema_migrations`,
 * so starting the API on an up-to-date database changes nothing.
 * To change the structure later, ADD a new entry at the end; never edit an old one.
 */
export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    name: "001_create_reservations",
    sql: `
CREATE TABLE IF NOT EXISTS reservations (
  id                VARCHAR(64)  NOT NULL,
  name              VARCHAR(80)  NOT NULL,
  email             VARCHAR(254) NOT NULL,
  phone             VARCHAR(40)  NOT NULL,
  reservation_date  CHAR(10)     NOT NULL,
  reservation_time  VARCHAR(20)  NOT NULL,
  guests            SMALLINT UNSIGNED NOT NULL,
  occasion          VARCHAR(60)  NULL,
  special_requests  TEXT         NULL,
  status            ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
  cancel_token_hash CHAR(64)     NULL,
  created_at        DATETIME(3)  NOT NULL,
  updated_at        DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_reservations_date (reservation_date),
  KEY idx_reservations_status (status),
  KEY idx_reservations_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: "002_create_staff_users",
    sql: `
CREATE TABLE IF NOT EXISTS staff_users (
  id            VARCHAR(64)  NOT NULL,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('super_admin','admin','manager','staff') NOT NULL,
  created_at    DATETIME(3)  NOT NULL,
  updated_at    DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    // Who changed which reservation's status, and when. Two foreign keys:
    //  - deleting a reservation removes its history with it (CASCADE);
    //  - removing a staff account keeps the history but forgets who (SET NULL).
    name: "003_create_reservation_status_history",
    sql: `
CREATE TABLE IF NOT EXISTS reservation_status_history (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id VARCHAR(64)  NOT NULL,
  changed_by     VARCHAR(64)  NULL,
  from_status    ENUM('pending','confirmed','cancelled','completed') NULL,
  to_status      ENUM('pending','confirmed','cancelled','completed') NOT NULL,
  source         ENUM('staff','guest') NOT NULL,
  changed_at     DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_status_history_reservation (reservation_id, changed_at),
  KEY idx_status_history_staff (changed_by),
  CONSTRAINT fk_status_history_reservation FOREIGN KEY (reservation_id) REFERENCES reservations (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_status_history_staff FOREIGN KEY (changed_by) REFERENCES staff_users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    // Indexes shaped like the dashboard's real queries (filter by status or date, then sort).
    // The old single-column status and date indexes are now just the first part of these, so they are dropped.
    name: "004_tune_reservation_indexes",
    sql: `
ALTER TABLE reservations
  DROP INDEX idx_reservations_status,
  DROP INDEX idx_reservations_date,
  ADD KEY idx_reservations_status_date (status, reservation_date),
  ADD KEY idx_reservations_status_created (status, created_at),
  ADD KEY idx_reservations_date_status (reservation_date, status)`,
  },
  {
    // Images uploaded from the dashboard. Kept in the database (not on the server's disk) so they survive every
    // deploy and are covered by the same backups. The same file uploaded twice is stored once (unique sha256).
    // Removing a staff account keeps their uploads (SET NULL).
    name: "005_create_media",
    sql: `
CREATE TABLE IF NOT EXISTS media (
  id         VARCHAR(64)  NOT NULL,
  mime       VARCHAR(40)  NOT NULL,
  size       INT UNSIGNED NOT NULL,
  sha256     CHAR(64)     NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  created_by VARCHAR(64)  NULL,
  created_at DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_media_sha256 (sha256),
  KEY idx_media_created_by (created_by),
  CONSTRAINT fk_media_staff FOREIGN KEY (created_by) REFERENCES staff_users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    // Blog posts managed from the dashboard. `body` is the post's content blocks as JSON (same format the public
    // blog page renders). Indexes follow the two real queries: the public list (published, newest first, optionally
    // by category) and the dashboard list (by status). Who created / last edited a post is kept with foreign keys.
    name: "006_create_blog_posts",
    sql: `
CREATE TABLE IF NOT EXISTS blog_posts (
  id           VARCHAR(64)  NOT NULL,
  slug         VARCHAR(120) NOT NULL,
  title        VARCHAR(160) NOT NULL,
  excerpt      VARCHAR(400) NOT NULL,
  category     ENUM('menu','celebrations','videos') NOT NULL,
  author       VARCHAR(80)  NOT NULL,
  cover        VARCHAR(255) NOT NULL,
  cover_alt    VARCHAR(200) NOT NULL,
  body         LONGTEXT     NOT NULL,
  has_video    TINYINT(1)   NOT NULL DEFAULT 0,
  status       ENUM('draft','published') NOT NULL DEFAULT 'draft',
  publish_date CHAR(10)     NOT NULL,
  created_by   VARCHAR(64)  NULL,
  updated_by   VARCHAR(64)  NULL,
  created_at   DATETIME(3)  NOT NULL,
  updated_at   DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blog_posts_slug (slug),
  KEY idx_blog_posts_status_date (status, publish_date),
  KEY idx_blog_posts_category_status_date (category, status, publish_date),
  KEY idx_blog_posts_created_by (created_by),
  KEY idx_blog_posts_updated_by (updated_by),
  CONSTRAINT fk_blog_posts_created_by FOREIGN KEY (created_by) REFERENCES staff_users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_blog_posts_updated_by FOREIGN KEY (updated_by) REFERENCES staff_users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    // The site-wide maintenance switch: ONE row (id is always 1). When `enabled`, the public website shows its
    // maintenance page instead of its pages. `updated_by` keeps who last changed it (SET NULL if that account is removed).
    // Every change is also written to site_maintenance_log, so there is a record of who switched it and when.
    name: "007_create_site_maintenance",
    sql: `
CREATE TABLE IF NOT EXISTS site_maintenance (
  id         TINYINT UNSIGNED NOT NULL,
  enabled    TINYINT(1)   NOT NULL DEFAULT 0,
  title      VARCHAR(80)  NOT NULL,
  message    VARCHAR(400) NOT NULL,
  eta        VARCHAR(60)  NULL,
  updated_by VARCHAR(64)  NULL,
  updated_at DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_site_maintenance_updated_by (updated_by),
  CONSTRAINT chk_site_maintenance_single_row CHECK (id = 1),
  CONSTRAINT fk_site_maintenance_staff FOREIGN KEY (updated_by) REFERENCES staff_users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: "008_create_site_maintenance_log",
    sql: `
CREATE TABLE IF NOT EXISTS site_maintenance_log (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enabled    TINYINT(1)   NOT NULL,
  title      VARCHAR(80)  NOT NULL,
  changed_by VARCHAR(64)  NULL,
  changed_at DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_maintenance_log_changed_at (changed_at),
  KEY idx_maintenance_log_changed_by (changed_by),
  CONSTRAINT fk_maintenance_log_staff FOREIGN KEY (changed_by) REFERENCES staff_users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
];
