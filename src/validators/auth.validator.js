import { z } from "zod";

export const registerSchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address").optional().nullable(),
    password: z.string().min(6, "Password must be at least 6 characters").optional().nullable(),
    phoneNumber: z.string().min(5, "Phone number must be at least 5 characters"),
    bio: z.string().optional(),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
};
