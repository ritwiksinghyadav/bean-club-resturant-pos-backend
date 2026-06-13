import bcrypt from "bcryptjs";
import { db, pool } from "./index.js";
import { roles, admins } from "./schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger.js";

const seed = async () => {
  logger.info("🌱 Seeding database with roles and default superadmin...");
  try {
    // 1. Warm up database check
    const client = await pool.connect();
    client.release();

    // 2. Define default roles
    const defaultRoles = ["kitchen", "admin", "superadmin"];
    const rolesMap = {};

    for (const roleName of defaultRoles) {
      let roleRecord = await db.query.roles.findFirst({
        where: eq(roles.name, roleName),
      });

      if (!roleRecord) {
        logger.info(`Inserting role: ${roleName}`);
        const [newRole] = await db
          .insert(roles)
          .values({ name: roleName })
          .returning();
        roleRecord = newRole;
      } else {
        logger.info(`Role already exists: ${roleName}`);
      }
      rolesMap[roleName] = roleRecord.id;
    }

    // 3. Create default superadmin
    const defaultEmail = "superadmin@yopmail.com";
    const existingSuperadmin = await db.query.admins.findFirst({
      where: eq(admins.email, defaultEmail),
    });

    if (!existingSuperadmin) {
      logger.info(`Creating default superadmin account: ${defaultEmail}`);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("Test@1234", salt);

      await db.insert(admins).values({
        name: "Default Super Admin",
        email: defaultEmail,
        passwordHash,
        roleId: rolesMap["superadmin"],
      });
      logger.info("✅ Default superadmin account created successfully!");
      logger.info("   Email: superadmin@beanclub.com");
      logger.info("   Password: superadmin123");
    } else {
      logger.info("Superadmin account already exists.");
    }

    logger.info("🌱 Seeding process completed successfully!");
  } catch (error) {
    logger.error("❌ Database seeding failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

seed();
