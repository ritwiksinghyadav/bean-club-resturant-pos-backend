import { db } from "../db/index.js";
import { otps } from "../db/schema.js";
import { eq, and, gt, desc } from "drizzle-orm";
import { BadRequestError } from "../utils/errors.js";

/**
 * Generates a new OTP or retrieves an existing unexpired OTP for the identifier/mode.
 * Default validity window is 10 minutes.
 * 
 * @param {Object} params
 * @param {string} params.identifier - Target email or phone number
 * @param {string} params.mode - OTP purpose context (e.g., 'login', 'register', 'change_phone')
 * @param {number} [params.expiresAfterMinutes=10] - validity window in minutes
 * @param {Object} [params.metadata] - contextual parameters saved as JSON
 * @returns {Promise<Object>} The OTP details
 */
export const generateOrGetOtp = async ({ identifier, mode, expiresAfterMinutes = 10, metadata = null }) => {
  if (!identifier) {
    throw new BadRequestError("Identifier (phone or email) is required");
  }
  if (!mode) {
    throw new BadRequestError("OTP mode is required");
  }

  // Check if there is an active OTP created within the expiration window
  const existingOtp = await db.query.otps.findFirst({
    where: and(
      eq(otps.identifier, identifier),
      eq(otps.mode, mode),
      gt(otps.expiresAt, new Date())
    ),
    orderBy: [desc(otps.createdAt)]
  });

  if (existingOtp) {
    return {
      code: existingOtp.code,
      expiresAt: existingOtp.expiresAt,
      isResend: true,
      metadata: existingOtp.metadata ? JSON.parse(existingOtp.metadata) : null,
    };
  }

  // Generate a new 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + expiresAfterMinutes * 60 * 1000);

  // Clear previous OTP entries for this identifier/mode to avoid database bloat
  await db.delete(otps).where(
    and(
      eq(otps.identifier, identifier),
      eq(otps.mode, mode)
    )
  );

  await db.insert(otps).values({
    identifier,
    code,
    expiresAt,
    mode,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });

  return {
    code,
    expiresAt,
    isResend: false,
    metadata,
  };
};

/**
 * Verifies an OTP code and deletes it upon success.
 * 
 * @param {Object} params
 * @param {string} params.identifier - Target email or phone number
 * @param {string} params.code - The OTP verification code
 * @param {string} params.mode - OTP purpose context
 * @returns {Promise<Object>} Contextual metadata
 */
export const verifyOtp = async ({ identifier, code, mode }) => {
  if (!identifier || !code || !mode) {
    throw new BadRequestError("Identifier, code, and mode are required for OTP verification");
  }

  const record = await db.query.otps.findFirst({
    where: and(
      eq(otps.identifier, identifier),
      eq(otps.mode, mode)
    ),
    orderBy: [desc(otps.createdAt)]
  });

  if (!record) {
    throw new BadRequestError("No verification code found or requested.");
  }

  if (record.expiresAt < new Date()) {
    await db.delete(otps).where(eq(otps.id, record.id));
    throw new BadRequestError("Verification code has expired. Please request a new one.");
  }

  if (record.code !== code) {
    throw new BadRequestError("Invalid verification code.");
  }

  // Clear OTP on successful verification
  await db.delete(otps).where(eq(otps.id, record.id));

  return record.metadata ? JSON.parse(record.metadata) : {};
};
