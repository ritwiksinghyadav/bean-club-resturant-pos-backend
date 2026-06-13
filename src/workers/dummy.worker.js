import { logger } from "../utils/logger.js";

export const startDummyWorker = () => {
  logger.info("🤖 Dummy Worker (Mocked/Disabled for Phase 1) started.");
  return null;
};

export const stopDummyWorker = async () => {
  logger.info("🤖 Dummy Worker (Mocked/Disabled for Phase 1) stopped.");
};

