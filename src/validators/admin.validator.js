import { z } from "zod";

export const adminLoginSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
};

export const createCategorySchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().nullable().optional(),
  }),
};

export const createMenuItemSchema = {
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID").nullable().optional(),
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().nullable().optional(),
    basePrice: z.coerce.number().positive("Price must be a positive number"),
    imageUrl: z.string().url("Image URL must be a valid URL").nullable().optional().or(z.literal("")),
    tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
  }),
};

export const createItemVariantSchema = {
  body: z.object({
    menuItemId: z.string().uuid("Invalid menu item ID"),
    variantId: z.string().uuid("Invalid variant ID"),
    price: z.coerce.number().positive("Price must be a positive number"),
    sku: z.string().min(1, "SKU must not be empty").nullable().optional(),
  }),
};

export const updateCategorySchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    description: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const updateMenuItemSchema = {
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID").nullable().optional(),
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    description: z.string().nullable().optional(),
    basePrice: z.coerce.number().positive("Price must be a positive number").optional(),
    imageUrl: z.string().url("Image URL must be a valid URL").nullable().optional().or(z.literal("")),
    isActive: z.boolean().optional(),
    tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
  }),
};

export const updateAdminStatusSchema = {
  body: z.object({
    isActive: z.boolean({ required_error: "isActive status is required" }),
  }),
};

export const updateItemVariantSchema = {
  body: z.object({
    price: z.coerce.number().positive("Price must be a positive number").optional(),
    sku: z.string().min(1, "SKU must not be empty").nullable().optional(),
    isActive: z.boolean().optional(),
  }),
};

// =========================================================================
// TAG VALIDATION SCHEMAS
// =========================================================================
export const createTagSchema = {
  body: z.object({
    name: z.string().min(2, "Tag name must be at least 2 characters"),
    description: z.string().nullable().optional(),
  }),
};

export const updateTagSchema = {
  body: z.object({
    name: z.string().min(2, "Tag name must be at least 2 characters").optional(),
    description: z.string().nullable().optional(),
  }),
};

// =========================================================================
// MASTER VARIANT VALIDATION SCHEMAS
// =========================================================================
export const createMasterVariantSchema = {
  body: z.object({
    name: z.string().min(1, "Variant name is required"),
    description: z.string().nullable().optional(),
  }),
};

export const updateMasterVariantSchema = {
  body: z.object({
    name: z.string().min(1, "Variant name is required").optional(),
    description: z.string().nullable().optional(),
  }),
};

// =========================================================================
// ADMIN CRUD VALIDATION SCHEMAS
// =========================================================================
export const createAdminSchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    roleId: z.string().uuid("Invalid role ID"),
  }),
};

export const updateAdminSchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email address").optional(),
    password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
    roleId: z.string().uuid("Invalid role ID").optional(),
    isActive: z.boolean().optional(),
  }),
};

export const createOrderOnBehalfSchema = {
  body: z.object({
    name: z.string().optional().default("Walk-in Customer"),
    phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
    type: z.enum(["dinein", "takeaway"], { required_error: "Order type (dinein or takeaway) is required" }),
    items: z.array(
      z.object({
        menuItemId: z.string().uuid("Invalid menu item ID"),
        variantId: z.string().uuid("Invalid variant ID").nullable().optional(),
        quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
      })
    ).min(1, "Order must contain at least one item"),
    pointsRedeemed: z.coerce.number().int().nonnegative("Redeemed points must be non-negative").optional().default(0),
    offerCode: z.string().nullable().optional(),
  }),
};

