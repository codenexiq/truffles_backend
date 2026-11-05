import type { Server } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { dbConfigured } from "./db/pool.js";
import { initDatabase } from "./db/migrate.js";
import { bootstrapStaff } from "./modules/auth/auth.service.js";

let server: Server | undefined;

// No top-level await anywhere in this file: the host loads it with require(), which cannot load a module that awaits.
async function start(): Promise<void> {
  // Connect to the database (and create any missing tables) BEFORE accepting traffic. If it cannot connect in
  // production the process exits, so the deploy health check fails and the previous release stays live.
  if (dbConfigured) {
    try {
      await initDatabase();
      logger.info(`Database connected (${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME})`);
    } catch (error) {
      logger.error("Database connection failed:", (error as Error).message);
      if (env.isProd) process.exit(1);
      logger.warn("Continuing without the database (development): reservations will not be saved.");
    }
  } else if (env.isProd) {
    logger.warn("No database configured (DB_NAME / DB_USER empty): reservations are kept in memory and lost on restart.");
  }

  // The administrator account (created in the database on first start; see bootstrapStaff).
  try {
    await bootstrapStaff();
  } catch (error) {
    logger.error("Could not set up the admin account:", (error as Error).message);
    if (env.isProd) process.exit(1);
  }

  const app = createApp();

  server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`=======================================================`);
    logger.info(`🍽️  Truffles Cafe & Restaurant Backend API is running!`);
    logger.info(`🚀  Mode: [${env.NODE_ENV}]`);
    logger.info(`🌐  Listening on: ${env.HOST}:${env.PORT}`);
    logger.info(`📡  URL: http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`🏥  Health Check: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
    logger.info(`=======================================================`);
  });
}

start().catch((error) => {
  logger.error("Failed to start:", error);
  process.exit(1);
});

// Graceful Shutdown handling
function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down server gracefully...`);
  if (!server) process.exit(0);
  server.close(() => {
    logger.info("Server closed successfully. Exiting process.");
    process.exit(0);
  });

  // Force close after 10s if dangling connections persist
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

// A crash handler that logs and exits cleanly, so a supervisor (pm2, systemd, Docker) restarts
// a fresh process instead of leaving a half-broken one running.
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection:", reason);
  shutdown("unhandledRejection");
});
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  shutdown("uncaughtException");
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

