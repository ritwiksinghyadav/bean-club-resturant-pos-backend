import { z } from "zod";

export const registerSchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address").optional().nullable(),
    password: z.string().min(6, "Password must be at least 6 characters").optional().nullable(),
    phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
    bio: z.string().optional(),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
};

export const refreshSchema = {};

export const sendCustomerOtpSchema = {
  body: z.object({
    phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    mode: z.enum(["login", "register"], { errorMap: () => ({ message: "Mode must be 'login' or 'register'" }) }),
  }),
};

export const verifyCustomerOtpSchema = {
  body: z.object({
    phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    code: z.string().length(6, "OTP code must be exactly 6 characters"),
    mode: z.enum(["login", "register"], { errorMap: () => ({ message: "Mode must be 'login' or 'register'" }) }),
  }),
};

export const customerLoginSchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  }),
};


