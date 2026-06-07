import { pgTable, uuid, varchar, text, timestamp, boolean, decimal, primaryKey, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =========================================================================
// 1. AUTHENTICATION & USER SCHEMAS (Customers)
// =========================================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  role: varchar("role", { length: 50 }).default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  avatarUrl: varchar("avatar_url", { length: 255 }),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles),
  orders: many(orders),
  loyaltyLedger: many(loyaltyLedger),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

// =========================================================================
// 2. ADMINISTRATIVE SCHEMAS (RBAC)
// =========================================================================

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(), // kitchen, admin, superadmin
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  roleId: uuid("role_id")
    .references(() => roles.id)
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rolesRelations = relations(roles, ({ many }) => ({
  admins: many(admins),
}));

export const adminsRelations = relations(admins, ({ one }) => ({
  role: one(roles, {
    fields: [admins.roleId],
    references: [roles.id],
  }),
}));

// =========================================================================
// 3. MENU SCHEMAS (Categories & Items)
// =========================================================================

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const menuItems = pgTable("menu_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id")
    .references(() => categories.id, { onDelete: "set null" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: varchar("image_url", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  menuItems: many(menuItems),
}));

// =========================================================================
// 4. TAG SCHEMAS
// =========================================================================

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const menuItemTags = pgTable("menu_item_tags", {
  menuItemId: uuid("menu_item_id")
    .references(() => menuItems.id, { onDelete: "cascade" })
    .notNull(),
  tagId: uuid("tag_id")
    .references(() => tags.id, { onDelete: "cascade" })
    .notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.menuItemId, table.tagId] })
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  menuItems: many(menuItemTags),
}));

export const menuItemTagsRelations = relations(menuItemTags, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [menuItemTags.menuItemId],
    references: [menuItems.id],
  }),
  tag: one(tags, {
    fields: [menuItemTags.tagId],
    references: [tags.id],
  }),
}));

// =========================================================================
// 5. MASTER VARIANT SCHEMAS
// =========================================================================

export const variants = pgTable("variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(), // e.g. L, XL, Regular, Medium, Large, Grande
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const itemVariants = pgTable("item_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  menuItemId: uuid("menu_item_id")
    .references(() => menuItems.id, { onDelete: "cascade" })
    .notNull(),
  variantId: uuid("variant_id")
    .references(() => variants.id, { onDelete: "cascade" })
    .notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  sku: varchar("sku", { length: 100 }).unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  menuItemVariantIdx: uniqueIndex("menu_item_variant_idx").on(table.menuItemId, table.variantId),
}));

export const variantsRelations = relations(variants, ({ many }) => ({
  itemVariants: many(itemVariants),
}));

export const itemVariantsRelations = relations(itemVariants, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [itemVariants.menuItemId],
    references: [menuItems.id],
  }),
  variant: one(variants, {
    fields: [itemVariants.variantId],
    references: [variants.id],
  }),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  variants: many(itemVariants),
  tags: many(menuItemTags),
}));

// =========================================================================
// 6. ORDERING & LOYALTY SCHEMAS
// =========================================================================

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, preparing, completed, cancelled
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  menuItemId: uuid("menu_item_id")
    .references(() => menuItems.id, { onDelete: "set null" }),
  variantId: uuid("variant_id")
    .references(() => itemVariants.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // price at time of purchase
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const loyaltyLedger = pgTable("loyalty_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  points: integer("points").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
  variant: one(itemVariants, {
    fields: [orderItems.variantId],
    references: [itemVariants.id],
  }),
}));

export const loyaltyLedgerRelations = relations(loyaltyLedger, ({ one }) => ({
  user: one(users, {
    fields: [loyaltyLedger.userId],
    references: [users.id],
  }),
}));

