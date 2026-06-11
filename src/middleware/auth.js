import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { db } from "../db/index.js";
import { admins, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Middleware to protect customer routes (standard users)
 */
export const protect = async (req, res, next) => {
  try {
    let token;
    
    // Check Authorization header or query parameter (fallback for SSE EventSource)
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      throw new UnauthorizedError("You are not logged in. Please log in to get access.");
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      
      // Ensure the user actually exists in the database
      const userRecord = await db.query.users.findFirst({
        where: eq(users.id, decoded.id),
      });

      if (!userRecord) {
        throw new UnauthorizedError("The user belonging to this token no longer exists.");
      }

      req.user = decoded;
      next();
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError("Invalid or expired token. Please log in again.");
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to protect administrative routes (admins/superadmins/kitchen staff)
 */
export const protectAdmin = async (req, res, next) => {
  try {
    let token;
    
    // Check Authorization header or query parameter (fallback for SSE EventSource)
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      throw new UnauthorizedError("You are not logged in. Please log in to get access.");
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      
      // Look up admin user to ensure their account exists and fetch their role
      const adminUser = await db.query.admins.findFirst({
        where: eq(admins.id, decoded.id),
        with: {
          role: true,
        },
      });

      if (!adminUser) {
        throw new UnauthorizedError("The admin user belonging to this token no longer exists.");
      }

      if (!adminUser.isActive) {
        throw new UnauthorizedError("Your account has been deactivated. Please contact a superadmin.");
      }

      // Attach decoded payload & roles to request
      req.user = {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role.name, // kitchen, admin, superadmin
      };
      
      next();
    } catch (err) {
      throw new UnauthorizedError("Invalid or expired token. Please log in again.");
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Role checking middleware (RBAC restriction)
 * @param {...string} allowedRoles - roles allowed to perform this action
 */
export const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("You do not have permission to perform this action."));
    }
    next();
  };
};
