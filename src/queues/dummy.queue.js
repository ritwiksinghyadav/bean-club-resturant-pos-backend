import { logger } from "../utils/logger.js";

// Mock dummyQueue to bypass BullMQ
export const dummyQueue = {
  add: async (name, data) => {
    logger.info(`[MOCK QUEUE] Intercepted dummy queue add for '${name}':`, data);
    return { id: `mock-dummy-job-${Date.now()}` };
  }
};

