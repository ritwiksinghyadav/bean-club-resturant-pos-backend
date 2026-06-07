import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";
import { logger } from "./utils/logger.js";

const server = app.listen(env.PORT, async () => {
  logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);

  try {
    // Warm up pool connection and test connection
    const client = await pool.connect();
    logger.info("📡 PostgreSQL Database connected successfully");
    client.release();
  } catch (error) {
    logger.error("❌ PostgreSQL connection check failed on startup:", error);
    process.exit(1);
  }
});

const gracefulShutdown = () => {
  logger.info("Initiating graceful shutdown...");
  server.close(async () => {
    logger.info("HTTP server stopped. Terminating database pool...");
    await pool.end();
    logger.info("Database pool terminated. Goodbye!");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
