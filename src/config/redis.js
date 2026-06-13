import { logger } from "../utils/logger.js";

// Mock redis client to bypass real connection for Phase 1
export const redis = {
  on: (event, callback) => {
    if (event === "connect") {
      logger.info("📡 Shared Redis connection established successfully (Mock)");
      setTimeout(() => callback(), 100);
    } else if (event === "error") {
      // no-op error handler
    }
  },
  quit: async () => {
    logger.info("📡 Mock Redis connection closed.");
  }
};

