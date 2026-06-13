import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

// Fallback JWT_SECRET to JWT_ACCESS_SECRET if present
if (process.env.JWT_SECRET && !process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_SECRET;
}

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection URL"),
  JWT_ACCESS_SECRET: z.string().min(8, "JWT_ACCESS_SECRET must be at least 8 characters"),
  JWT_REFRESH_SECRET: z.string().min(8, "JWT_REFRESH_SECRET must be at least 8 characters"),
  JWT_ACCESS_EXPIRATION: z.string().default("15m"),
  JWT_REFRESH_EXPIRATION: z.string().default("60d"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  WHATSAPP_API_KEY: z.string().optional(),
  WHATSAPP_API_URL: z.string().optional(),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment configuration:");
    parsed.error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  return parsed.data;
};

export const env = parseEnv();
