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

export const refreshCustomerToken = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new BadRequestError("Refresh token is required");
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    
    // Find user with profile
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.id),
      with: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }

    const tokens = generateTokens(user);

    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      ...tokens,
    };
  } catch (err) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
};

// =========================================================================
// CUSTOMER OTP SYSTEM (Future WhatsApp Integration Ready)
// =========================================================================

const otpCache = new Map();

/**
 * Isolated dispatcher helper for OTP messages.
 * This can be updated to call Twilio or other WhatsApp API channels.
 */
const sendOtpMessage = async (phoneNumber, code) => {
  console.log(`\n--- [OTP DISPATCH] Send to ${phoneNumber} via Mock Channel: ---\n` +
              `Your Bean Club verification code is: ${code}\n` +
              `-----------------------------------------------------\n`);
  // Placeholder for WhatsApp API integration (e.g. Twilio client call)
};

export const sendCustomerOtp = async ({ phoneNumber, name, mode }) => {
  if (!phoneNumber) {
    throw new BadRequestError("Phone number is required");
  }

  // Find user by phone number
  const existingUser = await db.query.users.findFirst({
    where: eq(users.phoneNumber, phoneNumber),
  });

  if (mode === "register") {
    if (existingUser) {
      throw new BadRequestError("An account with this phone number already exists");
    }
    if (!name) {
      throw new BadRequestError("Name is required to register a new customer");
    }
  } else if (mode === "login") {
    if (!existingUser) {
      throw new BadRequestError("No account found with this phone number. Please register first.");
    }
  } else {
    throw new BadRequestError("Invalid authentication mode");
  }

  // Generate a mock 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // Valid for 5 minutes

  // Store in cache
  otpCache.set(phoneNumber, {
    code,
    expiresAt,
    name,
    mode,
  });

  await sendOtpMessage(phoneNumber, code);

  return {
    message: "OTP sent successfully",
    code, // Return code in body to facilitate front-end toast and testing
  };
};

export const verifyCustomerOtp = async ({ phoneNumber, name, code, mode }) => {
  if (!phoneNumber || !code || !mode) {
    throw new BadRequestError("Phone number, OTP code, and mode are required");
  }

  const cached = otpCache.get(phoneNumber);
  if (!cached) {
    throw new BadRequestError("No OTP requested for this phone number");
  }

  if (cached.expiresAt < Date.now()) {
    otpCache.delete(phoneNumber);
    throw new BadRequestError("OTP has expired. Please request a new one.");
  }

  if (cached.code !== code) {
    throw new BadRequestError("Invalid OTP code");
  }

  if (cached.mode !== mode) {
    throw new BadRequestError("Invalid authentication mode");
  }

  // Clear OTP from cache
  otpCache.delete(phoneNumber);

  // Authenticate (Register or Login)
  const authName = mode === "register" ? (cached.name || name) : undefined;
  const result = await loginOrRegisterCustomer({ name: authName, phoneNumber });
  return result;
};

export const sendChangePhoneOtp = async (userId, { newPhoneNumber }) => {
  if (!newPhoneNumber) {
    throw new BadRequestError("New phone number is required");
  }

  // Check if phone number is already registered by another user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.phoneNumber, newPhoneNumber),
  });

  if (existingUser) {
    throw new BadRequestError("This phone number is already registered to another account");
  }

  // Generate a mock 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

  // Store in cache
  const cacheKey = `change_phone_${userId}`;
  otpCache.set(cacheKey, {
    code,
    expiresAt,
    newPhoneNumber,
  });

  await sendOtpMessage(newPhoneNumber, code);

  return {
    message: "OTP sent successfully",
    code,
  };
};

export const verifyChangePhoneOtp = async (userId, { code }) => {
  if (!code) {
    throw new BadRequestError("Verification code is required");
  }

  const cacheKey = `change_phone_${userId}`;
  const cached = otpCache.get(cacheKey);

  if (!cached) {
    throw new BadRequestError("No phone change request found");
  }

  if (cached.expiresAt < Date.now()) {
    otpCache.delete(cacheKey);
    throw new BadRequestError("OTP has expired. Please request a new one.");
  }

  if (cached.code !== code) {
    throw new BadRequestError("Invalid OTP code");
  }

  const newPhoneNumber = cached.newPhoneNumber;
  otpCache.delete(cacheKey);

  // Update phone number in database
  const [updatedUser] = await db
    .update(users)
    .set({ phoneNumber: newPhoneNumber, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  const { passwordHash: _, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};



