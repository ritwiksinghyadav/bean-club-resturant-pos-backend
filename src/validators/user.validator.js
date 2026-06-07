import { z } from "zod";

export const updateProfileSchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    phoneNumber: z.string().optional(),
    bio: z.string().optional(),
    avatarUrl: z.string().url("Avatar URL must be a valid URL").optional().or(z.literal("")),
  }),
};
