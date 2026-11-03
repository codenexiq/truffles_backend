import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`=======================================================`);
  logger.info(`🍽️  Truffles Cafe & Restaurant Backend API is running!`);
  logger.info(`🚀  Mode: [${env.NODE_ENV}]`);
  logger.info(`🌐  Listening on: ${env.HOST}:${env.PORT}`);
  logger.info(`📡  URL: http://localhost:${env.PORT}${env.API_PREFIX}`);
  logger.info(`🏥  Health Check: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  logger.info(`=======================================================`);
});

// Graceful Shutdown handling
function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down server gracefully...`);
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

