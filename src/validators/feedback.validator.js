import { z } from "zod";

export const createFeedbackSchema = {
  body: z.object({
    subject: z.string().min(3, "Subject must be at least 3 characters").max(255, "Subject cannot exceed 255 characters"),
    description: z.string().min(5, "Description must be at least 5 characters"),
    rating: z.coerce.number().int("Rating must be an integer").min(1, "Rating must be at least 1").max(5, "Rating cannot exceed 5"),
  }),
};
