import { z } from "zod";

export const createOfferSchema = {
  body: z.object({
    code: z.string().min(2, "Offer code must be at least 2 characters").transform(val => val.toUpperCase()),
    description: z.string().min(1, "Description is required"),
    discountType: z.enum(["percentage", "fixed"], {
      errorMap: () => ({ message: "Discount type must be either 'percentage' or 'fixed'" }),
    }),
    discountValue: z.coerce.number().positive("Discount value must be a positive number"),
    maxDiscount: z.coerce.number().positive("Max discount must be a positive number").nullable().optional(),
    minBillAmount: z.coerce.number().nonnegative("Minimum bill amount cannot be negative").default(0),
  }),
};

export const updateOfferSchema = {
  body: z.object({
    code: z.string().min(2, "Offer code must be at least 2 characters").transform(val => val.toUpperCase()).optional(),
    description: z.string().min(1, "Description is required").optional(),
    discountType: z.enum(["percentage", "fixed"]).optional(),
    discountValue: z.coerce.number().positive("Discount value must be a positive number").optional(),
    maxDiscount: z.coerce.number().positive("Max discount must be a positive number").nullable().optional(),
    minBillAmount: z.coerce.number().nonnegative("Minimum bill amount cannot be negative").optional(),
    isActive: z.boolean().optional(),
  }),
};
