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
  // Check if phone number already exists
  const existingUserByPhone = await db.query.users.findFirst({
    where: eq(users.phoneNumber, phoneNumber),
  });

  if (existingUserByPhone) {
    throw new BadRequestError("A user with this phone number already exists");
  }

  if (email) {
    const existingUserByEmail = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existingUserByEmail) {
      throw new BadRequestError("A user with this email already exists");
    }
  }

  // Hash password if provided
  let passwordHash = null;
  if (password) {
    const salt = await bcrypt.genSalt(10);
    passwordHash = await bcrypt.hash(password, salt);
  }

  // Perform database transaction
  const result = await db.transaction(async (tx) => {
    // 1. Insert user
    const [newUser] = await tx
      .insert(users)
      .values({
        name,
        email: email || null,
        passwordHash,
        phoneNumber,
      })
      .returning();

    // 2. Insert profile
    await tx.insert(profiles).values({
      userId: newUser.id,
      bio,
    });

    return newUser;
  });

  // Remove sensitive fields
  const { passwordHash: _, ...userWithoutPassword } = result;
  return userWithoutPassword;
};

export const loginOrRegisterCustomer = async ({ name, phoneNumber }) => {
  if (!phoneNumber) {
    throw new BadRequestError("Phone number is required");
  }

  // Find user by phone number
  let user = await db.query.users.findFirst({
    where: eq(users.phoneNumber, phoneNumber),
    with: {
      profile: true,
    },
  });

  if (!user) {
    if (!name) {
      throw new BadRequestError("Name is required to register a new customer");
    }

    // Register a new customer
    user = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          name,
          phoneNumber,
          role: "user",
        })
        .returning();

      // Create a default profile
      await tx.insert(profiles).values({
        userId: newUser.id,
      });

      return newUser;
    });

    // Fetch again to get profile relations if needed
    user = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      with: {
        profile: true,
      },
    });
  } else if (name && user.name !== name) {
    // Update name if they provided a different name
    await db.update(users).set({ name }).where(eq(users.id, user.id));
    user.name = name;
  }

  // Generate tokens
  const tokens = generateTokens(user);

  const { passwordHash: _, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    ...tokens,
  };
};

export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw new BadRequestError("Email and password are required");
  }

  // Find user with profile
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: {
      profile: true,
    },
  });

  if (!user || !user.passwordHash) {
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
