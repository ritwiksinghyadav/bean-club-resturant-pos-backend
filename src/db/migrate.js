import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";
import { logger } from "../utils/logger.js";

const runMigrations = async () => {
  logger.info("⏳ Running database schema migrations...");
  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    logger.info("✅ Database migrations applied successfully!");
  } catch (error) {
    logger.error("❌ Database migrations execution failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigrations();
