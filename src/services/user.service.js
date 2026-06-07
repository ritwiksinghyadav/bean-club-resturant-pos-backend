import { db } from "../db/index.js";
import { users, profiles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../utils/errors.js";

export const getUserById = async (id) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    with: {
      profile: true,
    },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  const { passwordHash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const updateUserProfile = async (id, { name, phoneNumber, bio, avatarUrl }) => {
  // Run updates in a transaction
  await db.transaction(async (tx) => {
    // 1. Update user fields if name is provided
    if (name) {
      await tx
        .update(users)
        .set({ name, updatedAt: new Date() })
        .where(eq(users.id, id));
    }

    // 2. Update profile fields
    const profileUpdates = {};
    if (phoneNumber !== undefined) profileUpdates.phoneNumber = phoneNumber;
    if (bio !== undefined) profileUpdates.bio = bio;
    if (avatarUrl !== undefined) profileUpdates.avatarUrl = avatarUrl;

    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updatedAt = new Date();
      await tx
        .update(profiles)
        .set(profileUpdates)
        .where(eq(profiles.userId, id));
    }
  });

  return getUserById(id);
};
