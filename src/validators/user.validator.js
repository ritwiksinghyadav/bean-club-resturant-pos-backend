import { z } from "zod";

export const updateProfileSchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    bio: z.string().optional(),
    avatarUrl: z.string().url("Avatar URL must be a valid URL").optional().or(z.literal("")),
  }),
};

export const changePhoneOtpSchema = {
  body: z.object({
    newPhoneNumber: z.string().regex(/^\d{10}$/, "New phone number must be exactly 10 digits"),
  }),
};

export const verifyChangePhoneOtpSchema = {
  body: z.object({
    code: z.string().length(6, "Verification code must be exactly 6 characters"),
  }),
};

