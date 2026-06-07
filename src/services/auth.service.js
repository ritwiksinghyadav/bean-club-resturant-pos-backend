import { db } from "../db/index.js";
import { users, profiles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { BadRequestError, UnauthorizedError } from "../utils/errors.js";

const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email, role: user.role };
  
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRATION,
  });
  
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRATION,
  });
  
  return { accessToken, refreshToken };
};

export const registerUser = async ({ name, email, password, phoneNumber, bio }) => {
  // Check if email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    throw new BadRequestError("A user with this email already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Perform database transaction
  const result = await db.transaction(async (tx) => {
    // 1. Insert user
    const [newUser] = await tx
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
      })
      .returning();

    // 2. Insert profile
    await tx.insert(profiles).values({
      userId: newUser.id,
      phoneNumber,
      bio,
    });

    return newUser;
  });

  // Remove sensitive fields
  const { passwordHash: _, ...userWithoutPassword } = result;
  return userWithoutPassword;
};

export const loginUser = async ({ email, password }) => {
  // Find user with profile
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: {
      profile: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // Validate password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // Generate tokens
  const tokens = generateTokens(user);

  const { passwordHash: _, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    ...tokens,
  };
};
