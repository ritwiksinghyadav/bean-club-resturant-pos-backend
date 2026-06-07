import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";
import { ApiResponse } from "../utils/response.js";

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log error details
  if (statusCode === 500) {
    logger.error(`💥 Unexpected Error: ${message}`, err);
  } else {
    logger.warn(`⚠️ Client Operational Error [${statusCode}]: ${message}`);
  }

  // Include detailed Zod validations or development stack details
  let details = err.errors || null;
  if (env.NODE_ENV === "development" && !err.errors && err.stack) {
    details = { stack: err.stack };
  }

  return ApiResponse.error(res, message, statusCode, details);
};
