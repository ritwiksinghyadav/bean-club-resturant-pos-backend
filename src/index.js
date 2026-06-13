import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";
import { logger } from "./utils/logger.js";
import { startWhatsappWorker, stopWhatsappWorker } from "./workers/whatsapp.worker.js";
import { startDummyWorker, stopDummyWorker } from "./workers/dummy.worker.js";
import { redis } from "./config/redis.js";

const server = app.listen(env.PORT, async () => {
  logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);

  try {
    // Warm up pool connection and test connection
    const client = await pool.connect();
    logger.info("📡 PostgreSQL Database connected successfully");
    client.release();

    // Start background job workers (BullMQ)
    startWhatsappWorker();
    startDummyWorker();
  } catch (error) {
    logger.error("❌ PostgreSQL connection check failed on startup:", error);
    process.exit(1);
  }
});

const gracefulShutdown = () => {
  logger.info("Initiating graceful shutdown...");
  server.close(async () => {
    logger.info("HTTP server stopped. Stopping background workers...");
    try {
      await stopWhatsappWorker();
      await stopDummyWorker();
    } catch (err) {
      logger.error("Error stopping background workers during shutdown:", err);
    }
    logger.info("Background workers stopped. Closing Redis connection...");
    try {
      await redis.quit();
    } catch (err) {
      logger.error("Error closing Redis connection during shutdown:", err);
    }
    logger.info("Redis connection closed. Terminating database pool...");
    await pool.end();
    logger.info("Database pool terminated. Goodbye!");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
