import { db } from "../db/index.js";
import { admins, categories, menuItems, itemVariants, tags, menuItemTags, variants, roles, orders, loyaltyLedger, users, systemSettings, offers } from "../db/schema.js";
import { eq, and, ne, isNull, or, ilike, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { BadRequestError, UnauthorizedError, NotFoundError } from "../utils/errors.js";
import { jobQueue } from "../utils/jobQueue.js";
import { logger } from "../utils/logger.js";
import { loginOrRegisterCustomer } from "./auth.service.js";
import { placeCustomerOrder } from "./user.service.js";

const generateAdminTokens = (admin) => {
  const payload = { 
    id: admin.id, 
    email: admin.email, 
    role: admin.role.name 
  };
  
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRATION,
  });
  
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRATION,
  });
  
  return { accessToken, refreshToken };
};

export const loginAdmin = async ({ email, password }) => {
  // Find admin with role name
  const adminUser = await db.query.admins.findFirst({
    where: eq(admins.email, email),
    with: {
      role: true,
    },
  });

  if (!adminUser) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // Check if admin is active
  if (!adminUser.isActive) {
    throw new UnauthorizedError("Your account has been deactivated. Please contact a superadmin.");
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, adminUser.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const tokens = generateAdminTokens(adminUser);

  const { passwordHash: _, ...adminWithoutPassword } = adminUser;
  return {
    admin: {
      id: adminWithoutPassword.id,
      name: adminWithoutPassword.name,
      email: adminWithoutPassword.email,
      role: adminWithoutPassword.role.name,
    },
    ...tokens,
    token: tokens.accessToken, // Backwards compatibility with next-auth client if needed
  };
};

export const refreshAdminToken = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new BadRequestError("Refresh token is required");
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    
    // Find admin with role name
    const adminUser = await db.query.admins.findFirst({
      where: eq(admins.id, decoded.id),
      with: {
        role: true,
      },
    });

    if (!adminUser) {
      throw new UnauthorizedError("Admin user no longer exists");
    }

    if (!adminUser.isActive) {
      throw new UnauthorizedError("Your account has been deactivated. Please contact a superadmin.");
    }

    const tokens = generateAdminTokens(adminUser);
    
    const { passwordHash: _, ...adminWithoutPassword } = adminUser;
    return {
      admin: {
        id: adminWithoutPassword.id,
        name: adminWithoutPassword.name,
        email: adminWithoutPassword.email,
        role: adminWithoutPassword.role.name,
      },
      ...tokens,
      token: tokens.accessToken,
    };
  } catch (err) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
};


export const createCategory = async ({ name, description }) => {
  // Check if category name already exists
  const existingCategory = await db.query.categories.findFirst({
    where: eq(categories.name, name),
  });

  if (existingCategory) {
    throw new BadRequestError(`Category with name '${name}' already exists`);
  }

  const [newCategory] = await db
    .insert(categories)
    .values({
      name,
      description,
    })
    .returning();

  return newCategory;
};

export const createMenuItem = async ({ categoryId, name, description, basePrice, imageUrl, tagIds }) => {
  // Check if category exists
  if (categoryId) {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!category) {
      throw new NotFoundError("Category not found");
    }
  }

  // Check if menu item with same name exists in this category
  const existingItem = await db.query.menuItems.findFirst({
    where: and(
      categoryId ? eq(menuItems.categoryId, categoryId) : isNull(menuItems.categoryId),
      eq(menuItems.name, name)
    ),
  });

  if (existingItem) {
    throw new BadRequestError(`Menu item '${name}' already exists`);
  }

  // Insert basePrice as string to maintain PostgreSQL numeric precision compatibility
  const [newItem] = await db
    .insert(menuItems)
    .values({
      categoryId: categoryId || null,
      name,
      description,
      basePrice: basePrice.toString(),
      imageUrl,
    })
    .returning();

  // Map tags if provided
  if (tagIds && tagIds.length > 0) {
    const tagMappings = tagIds.map((tagId) => ({
      menuItemId: newItem.id,
      tagId,
    }));
    await db.insert(menuItemTags).values(tagMappings);
  }

  // Get fully populated menu item
  const populatedItem = await db.query.menuItems.findFirst({
    where: eq(menuItems.id, newItem.id),
    with: {
      category: true,
      variants: {
        with: {
          variant: true,
        },
      },
      tags: {
        with: {
          tag: true,
        },
      },
    },
  });

  return {
    ...populatedItem,
    tags: populatedItem.tags ? populatedItem.tags.map((t) => t.tag) : [],
    variants: populatedItem.variants ? populatedItem.variants.map((v) => ({
      id: v.id,
      menuItemId: v.menuItemId,
      variantId: v.variantId,
      name: v.variant.name,
      price: v.price,
      sku: v.sku,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    })) : [],
  };
};

export const createItemVariant = async ({ menuItemId, variantId, price, sku }) => {
  // Check if menu item exists
  const menuItem = await db.query.menuItems.findFirst({
    where: eq(menuItems.id, menuItemId),
  });

  if (!menuItem) {
    throw new NotFoundError("Menu item not found");
  }

  // Check if global variant exists
  const variantRecord = await db.query.variants.findFirst({
    where: eq(variants.id, variantId),
  });

  if (!variantRecord) {
    throw new NotFoundError("Master variant not found");
  }

  // Check if variant is already mapped to this menu item
  const existingMapping = await db.query.itemVariants.findFirst({
    where: and(
      eq(itemVariants.menuItemId, menuItemId),
      eq(itemVariants.variantId, variantId)
    ),
  });

  if (existingMapping) {
    throw new BadRequestError(`Variant '${variantRecord.name}' is already mapped to this menu item`);
  }

  // Check if SKU is provided and already taken
  if (sku) {
    const existingSku = await db.query.itemVariants.findFirst({
      where: eq(itemVariants.sku, sku),
    });

    if (existingSku) {
      throw new BadRequestError(`Variant SKU '${sku}' is already taken`);
    }
  }

  // Insert price as string to maintain PostgreSQL numeric precision compatibility
  const [newVariant] = await db
    .insert(itemVariants)
    .values({
      menuItemId,
      variantId,
      price: price.toString(),
      sku,
    })
    .returning();

  return {
    ...newVariant,
    name: variantRecord.name,
  };
};

export const getCategories = async (query = {}) => {
  const { page, perPage, name, sortBy = "createdAt", sortOrder = "desc" } = query;
  
  const whereClauses = [];
  
  if (name) {
    whereClauses.push(sql`${categories.name} % ${name}`);
  }
  
  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;
  
  // Calculate total count
  const countRes = await db
    .select({ count: sql`count(*)` })
    .from(categories)
    .where(where);
  const totalItems = parseInt(countRes[0]?.count || 0, 10);
  
  // Pagination values
  let limit = undefined;
  let offset = undefined;
  if (page && perPage) {
    limit = parseInt(perPage, 10);
    offset = (parseInt(page, 10) - 1) * limit;
  }
  
  // Determine sort column and direction
  let orderColumn = categories.createdAt;
  if (sortBy === "name") orderColumn = categories.name;
  if (sortBy === "isActive") orderColumn = categories.isActive;
  
  const results = await db.query.categories.findMany({
    where,
    limit,
    offset,
    orderBy: (categories, { asc, desc }) => [
      sortOrder.toLowerCase() === "asc" ? asc(orderColumn) : desc(orderColumn)
    ],
  });
  
  return {
    categories: results,
    pagination: {
      totalItems,
      totalPages: limit ? Math.ceil(totalItems / limit) : 1,
      currentPage: page ? parseInt(page, 10) : 1,
      perPage: limit || totalItems,
    }
  };
};

export const updateCategory = async (id, { name, description, isActive }) => {
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, id),
  });

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  const updates = {};
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.isActive = isActive;
  
  if (name !== undefined) {
    const existing = await db.query.categories.findFirst({
      where: and(eq(categories.name, name), ne(categories.id, id)),
    });
    if (existing) {
      throw new BadRequestError(`Category with name '${name}' already exists`);
    }
    updates.name = name;
  }

  updates.updatedAt = new Date();

  const [updatedCategory] = await db
    .update(categories)
    .set(updates)
    .where(eq(categories.id, id))
    .returning();

  return updatedCategory;
};

export const deleteCategory = async (id) => {
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, id),
  });

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  await db.delete(categories).where(eq(categories.id, id));
  return { id };
};

export const getMenuItems = async (query = {}) => {
  const { page, perPage, name, categoryId, sortBy = "createdAt", sortOrder = "desc" } = query;
  
  const whereClauses = [];
  
  if (categoryId) {
    whereClauses.push(eq(menuItems.categoryId, categoryId));
  }
  
  if (name) {
    whereClauses.push(sql`${menuItems.name} % ${name}`);
  }
  
  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;
  
  // Calculate total count
  const countRes = await db
    .select({ count: sql`count(*)` })
    .from(menuItems)
    .where(where);
  const totalItems = parseInt(countRes[0]?.count || 0, 10);
  
  // Pagination values
  let limit = undefined;
  let offset = undefined;
  if (page && perPage) {
    limit = parseInt(perPage, 10);
    offset = (parseInt(page, 10) - 1) * limit;
  }
  
  // Determine sort column and direction
  let orderColumn = menuItems.createdAt;
  if (sortBy === "name") orderColumn = menuItems.name;
  if (sortBy === "basePrice") orderColumn = menuItems.basePrice;
  if (sortBy === "isActive") orderColumn = menuItems.isActive;
  
  const results = await db.query.menuItems.findMany({
    where,
    limit,
    offset,
    with: {
      category: true,
      variants: {
        with: {
          variant: true,
        },
      },
      tags: {
        with: {
          tag: true,
        },
      },
    },
    orderBy: (menuItems, { asc, desc }) => [
      sortOrder.toLowerCase() === "asc" ? asc(orderColumn) : desc(orderColumn)
    ],
  });

  const mappedResults = results.map(item => {
    const { tags: itemTags, variants: itemVars, ...rest } = item;
    return {
      ...rest,
      tags: itemTags ? itemTags.map(t => t.tag) : [],
      variants: itemVars ? itemVars.map(v => ({
        id: v.id,
        menuItemId: v.menuItemId,
        variantId: v.variantId,
        name: v.variant ? v.variant.name : 'Unknown',
        price: v.price,
        sku: v.sku,
        isActive: v.isActive,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })) : []
    };
  });
  
  return {
    menuItems: mappedResults,
    pagination: {
      totalItems,
      totalPages: limit ? Math.ceil(totalItems / limit) : 1,
      currentPage: page ? parseInt(page, 10) : 1,
      perPage: limit || totalItems,
    }
  };
};

export const updateMenuItem = async (id, { categoryId, name, description, basePrice, imageUrl, isActive, tagIds }) => {
  const item = await db.query.menuItems.findFirst({
    where: eq(menuItems.id, id),
  });

  if (!item) {
    throw new NotFoundError("Menu item not found");
  }

  const updates = {};
  if (description !== undefined) updates.description = description;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (isActive !== undefined) updates.isActive = isActive;

  if (basePrice !== undefined) {
    updates.basePrice = basePrice.toString();
  }

  if (categoryId !== undefined) {
    if (categoryId !== null) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
      });
      if (!category) {
        throw new NotFoundError("Category not found");
      }
    }
    updates.categoryId = categoryId;
  }

  if (name !== undefined) {
    const targetCategoryId = categoryId !== undefined ? categoryId : item.categoryId;
    
    const existing = await db.query.menuItems.findFirst({
      where: and(
        eq(menuItems.name, name),
        targetCategoryId ? eq(menuItems.categoryId, targetCategoryId) : isNull(menuItems.categoryId),
        ne(menuItems.id, id)
      ),
    });
    if (existing) {
      throw new BadRequestError(`Menu item '${name}' already exists`);
    }
    updates.name = name;
  }

  updates.updatedAt = new Date();

  await db
    .update(menuItems)
    .set(updates)
    .where(eq(menuItems.id, id));

  // Handle tag mapping updates
  if (tagIds !== undefined) {
    await db.delete(menuItemTags).where(eq(menuItemTags.menuItemId, id));
    
    if (tagIds && tagIds.length > 0) {
      const tagMappings = tagIds.map((tagId) => ({
        menuItemId: id,
        tagId,
      }));
      await db.insert(menuItemTags).values(tagMappings);
    }
  }

  // Get fully populated updated menu item
  const populatedItem = await db.query.menuItems.findFirst({
    where: eq(menuItems.id, id),
    with: {
      category: true,
      variants: {
        with: {
          variant: true,
        },
      },
      tags: {
        with: {
          tag: true,
        },
      },
    },
  });

  return {
    ...populatedItem,
    tags: populatedItem.tags ? populatedItem.tags.map((t) => t.tag) : [],
    variants: populatedItem.variants ? populatedItem.variants.map((v) => ({
      id: v.id,
      menuItemId: v.menuItemId,
      variantId: v.variantId,
      name: v.variant ? v.variant.name : 'Unknown',
      price: v.price,
      sku: v.sku,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    })) : [],
  };
};

export const deleteMenuItem = async (id) => {
  const item = await db.query.menuItems.findFirst({
    where: eq(menuItems.id, id),
  });

  if (!item) {
    throw new NotFoundError("Menu item not found");
  }

  await db.delete(menuItems).where(eq(menuItems.id, id));
  return { id };
};

export const deleteItemVariant = async (id) => {
  const variant = await db.query.itemVariants.findFirst({
    where: eq(itemVariants.id, id),
  });

  if (!variant) {
    throw new NotFoundError("Variant not found");
  }

  await db.delete(itemVariants).where(eq(itemVariants.id, id));
  return { id };
};

export const updateAdminStatus = async (targetAdminId, requesterId, { isActive }) => {
  const targetAdmin = await db.query.admins.findFirst({
    where: eq(admins.id, targetAdminId),
  });

  if (!targetAdmin) {
    throw new NotFoundError("Admin not found");
  }

  if (targetAdminId === requesterId) {
    throw new BadRequestError("You cannot toggle your own active status");
  }

  const [updatedAdmin] = await db
    .update(admins)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(admins.id, targetAdminId))
    .returning();

  return updatedAdmin;
};

export const updateItemVariant = async (id, { price, sku, isActive }) => {
  const variant = await db.query.itemVariants.findFirst({
    where: eq(itemVariants.id, id),
  });

  if (!variant) {
    throw new NotFoundError("Variant not found");
  }

  const updates = {};
  if (price !== undefined) updates.price = price.toString();
  if (sku !== undefined) updates.sku = sku || null;
  if (isActive !== undefined) updates.isActive = isActive;

  updates.updatedAt = new Date();

  const [updatedVariant] = await db
    .update(itemVariants)
    .set(updates)
    .where(eq(itemVariants.id, id))
    .returning();

  // Fetch variant name to preserve output layout
  const variantRecord = await db.query.variants.findFirst({
    where: eq(variants.id, updatedVariant.variantId)
  });

  return {
    ...updatedVariant,
    name: variantRecord ? variantRecord.name : 'Unknown'
  };
};

// =========================================================================
// 6. TAG CRUD SERVICES
// =========================================================================

export const createTag = async ({ name, description }) => {
  // Check if tag already exists
  const existingTag = await db.query.tags.findFirst({
    where: eq(tags.name, name),
  });

  if (existingTag) {
    throw new BadRequestError(`Tag with name '${name}' already exists`);
  }

  const [newTag] = await db
    .insert(tags)
    .values({
      name,
      description,
    })
    .returning();

  return newTag;
};

export const getTags = async (query = {}) => {
  const { page, perPage, name, sortBy = "createdAt", sortOrder = "desc" } = query;
  
  const whereClauses = [];
  
  if (name) {
    whereClauses.push(sql`${tags.name} % ${name}`);
  }
  
  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;
  
  // Calculate total count
  const countRes = await db
    .select({ count: sql`count(*)` })
    .from(tags)
    .where(where);
  const totalItems = parseInt(countRes[0]?.count || 0, 10);
  
  // Pagination values
  let limit = undefined;
  let offset = undefined;
  if (page && perPage) {
    limit = parseInt(perPage, 10);
    offset = (parseInt(page, 10) - 1) * limit;
  }
  
  let orderColumn = tags.createdAt;
  if (sortBy === "name") orderColumn = tags.name;
  
  const results = await db.query.tags.findMany({
    where,
    limit,
    offset,
    orderBy: (tags, { asc, desc }) => [
      sortOrder.toLowerCase() === "asc" ? asc(orderColumn) : desc(orderColumn)
    ],
  });
  
  return {
    tags: results,
    pagination: {
      totalItems,
      totalPages: limit ? Math.ceil(totalItems / limit) : 1,
      currentPage: page ? parseInt(page, 10) : 1,
      perPage: limit || totalItems,
    }
  };
};

export const updateTag = async (id, { name, description }) => {
  const tagRecord = await db.query.tags.findFirst({
    where: eq(tags.id, id),
  });

  if (!tagRecord) {
    throw new NotFoundError("Tag not found");
  }

  const updates = {};
  if (description !== undefined) updates.description = description;
  
  if (name !== undefined) {
    const existing = await db.query.tags.findFirst({
      where: and(eq(tags.name, name), ne(tags.id, id)),
    });
    if (existing) {
      throw new BadRequestError(`Tag with name '${name}' already exists`);
    }
    updates.name = name;
  }

  updates.updatedAt = new Date();

  const [updatedTag] = await db
    .update(tags)
    .set(updates)
    .where(eq(tags.id, id))
    .returning();

  return updatedTag;
};

export const deleteTag = async (id) => {
  const tagRecord = await db.query.tags.findFirst({
    where: eq(tags.id, id),
  });

  if (!tagRecord) {
    throw new NotFoundError("Tag not found");
  }

  await db.delete(tags).where(eq(tags.id, id));
  return { id };
};

// =========================================================================
// 7. MASTER VARIANT CRUD SERVICES
// =========================================================================

export const createVariant = async ({ name, description }) => {
  const existingVariant = await db.query.variants.findFirst({
    where: eq(variants.name, name),
  });

  if (existingVariant) {
    throw new BadRequestError(`Master variant with name '${name}' already exists`);
  }

  const [newVariant] = await db
    .insert(variants)
    .values({
      name,
      description,
    })
    .returning();

  return newVariant;
};

export const getVariants = async (query = {}) => {
  const { page, perPage, name, sortBy = "createdAt", sortOrder = "desc" } = query;
  
  const whereClauses = [];
  
  if (name) {
    whereClauses.push(sql`${variants.name} % ${name}`);
  }
  
  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;
  
  // Calculate total count
  const countRes = await db
    .select({ count: sql`count(*)` })
    .from(variants)
    .where(where);
  const totalItems = parseInt(countRes[0]?.count || 0, 10);
  
  // Pagination values
  let limit = undefined;
  let offset = undefined;
  if (page && perPage) {
    limit = parseInt(perPage, 10);
    offset = (parseInt(page, 10) - 1) * limit;
  }
  
  let orderColumn = variants.createdAt;
  if (sortBy === "name") orderColumn = variants.name;
  
  const results = await db.query.variants.findMany({
    where,
    limit,
    offset,
    orderBy: (variants, { asc, desc }) => [
      sortOrder.toLowerCase() === "asc" ? asc(orderColumn) : desc(orderColumn)
    ],
  });
  
  return {
    variants: results,
    pagination: {
      totalItems,
      totalPages: limit ? Math.ceil(totalItems / limit) : 1,
      currentPage: page ? parseInt(page, 10) : 1,
      perPage: limit || totalItems,
    }
  };
};

export const updateVariant = async (id, { name, description }) => {
  const variantRecord = await db.query.variants.findFirst({
    where: eq(variants.id, id),
  });

  if (!variantRecord) {
    throw new NotFoundError("Master variant not found");
  }

  const updates = {};
  if (description !== undefined) updates.description = description;
  
  if (name !== undefined) {
    const existing = await db.query.variants.findFirst({
      where: and(eq(variants.name, name), ne(variants.id, id)),
    });
    if (existing) {
      throw new BadRequestError(`Master variant with name '${name}' already exists`);
    }
    updates.name = name;
  }

  updates.updatedAt = new Date();

  const [updatedVariant] = await db
    .update(variants)
    .set(updates)
    .where(eq(variants.id, id))
    .returning();

  return updatedVariant;
};

export const deleteVariant = async (id) => {
  const variantRecord = await db.query.variants.findFirst({
    where: eq(variants.id, id),
  });

  if (!variantRecord) {
    throw new NotFoundError("Master variant not found");
  }

  await db.delete(variants).where(eq(variants.id, id));
  return { id };
};

// =========================================================================
// 8. ADMIN CRUD & ROLE SERVICES
// =========================================================================

export const getAdmins = async (query = {}) => {
  const { page, perPage, name, sortBy = "createdAt", sortOrder = "desc" } = query;
  
  const whereClauses = [];
  
  if (name) {
    whereClauses.push(
      or(
        ilike(admins.name, `%${name}%`),
        ilike(admins.email, `%${name}%`)
      )
    );
  }
  
  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;
  
  // Calculate total count
  const countRes = await db
    .select({ count: sql`count(*)` })
    .from(admins)
    .where(where);
  const totalItems = parseInt(countRes[0]?.count || 0, 10);
  
  // Pagination values
  let limit = undefined;
  let offset = undefined;
  if (page && perPage) {
    limit = parseInt(perPage, 10);
    offset = (parseInt(page, 10) - 1) * limit;
  }
  
  // Determine sort column and direction
  let orderColumn = admins.createdAt;
  if (sortBy === "name") orderColumn = admins.name;
  if (sortBy === "email") orderColumn = admins.email;
  if (sortBy === "isActive") orderColumn = admins.isActive;
  
  const results = await db.query.admins.findMany({
    where,
    limit,
    offset,
    with: {
      role: true,
    },
    orderBy: (admins, { asc, desc }) => [
      sortOrder.toLowerCase() === "asc" ? asc(orderColumn) : desc(orderColumn)
    ],
  });

  const adminsWithoutPasswords = results.map(admin => {
    const { passwordHash, ...rest } = admin;
    return rest;
  });
  
  return {
    admins: adminsWithoutPasswords,
    pagination: {
      totalItems,
      totalPages: limit ? Math.ceil(totalItems / limit) : 1,
      currentPage: page ? parseInt(page, 10) : 1,
      perPage: limit || totalItems,
    }
  };
};

export const getRoles = async () => {
  return await db.query.roles.findMany();
};

export const createAdmin = async ({ name, email, password, roleId }) => {
  const existingAdmin = await db.query.admins.findFirst({
    where: eq(admins.email, email),
  });

  if (existingAdmin) {
    throw new BadRequestError(`Admin with email '${email}' already exists`);
  }

  const roleRecord = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
  });

  if (!roleRecord) {
    throw new NotFoundError("Role not found");
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const [newAdmin] = await db
    .insert(admins)
    .values({
      name,
      email,
      passwordHash,
      roleId,
      isActive: true,
    })
    .returning();

  const populated = await db.query.admins.findFirst({
    where: eq(admins.id, newAdmin.id),
    with: {
      role: true,
    },
  });

  const { passwordHash: _, ...result } = populated;
  return result;
};

export const updateAdmin = async (id, requesterId, { name, email, password, roleId, isActive }) => {
  const targetAdmin = await db.query.admins.findFirst({
    where: eq(admins.id, id),
  });

  if (!targetAdmin) {
    throw new NotFoundError("Admin not found");
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  
  if (roleId !== undefined) {
    const roleRecord = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    });
    if (!roleRecord) {
      throw new NotFoundError("Role not found");
    }
    updates.roleId = roleId;
  }

  if (isActive !== undefined) {
    if (id === requesterId && !isActive) {
      throw new BadRequestError("You cannot toggle your own active status");
    }
    updates.isActive = isActive;
  }

  if (email !== undefined) {
    const existing = await db.query.admins.findFirst({
      where: and(eq(admins.email, email), ne(admins.id, id)),
    });
    if (existing) {
      throw new BadRequestError(`Admin with email '${email}' already exists`);
    }
    updates.email = email;
  }

  if (password !== undefined && password !== "") {
    const salt = await bcrypt.genSalt(10);
    updates.passwordHash = await bcrypt.hash(password, salt);
  }

  updates.updatedAt = new Date();

  await db
    .update(admins)
    .set(updates)
    .where(eq(admins.id, id));

  const populated = await db.query.admins.findFirst({
    where: eq(admins.id, id),
    with: {
      role: true,
    },
  });

  const { passwordHash: _, ...result } = populated;
  return result;
};

export const deleteAdmin = async (id, requesterId) => {
  const targetAdmin = await db.query.admins.findFirst({
    where: eq(admins.id, id),
  });

  if (!targetAdmin) {
    throw new NotFoundError("Admin not found");
  }

  if (id === requesterId) {
    throw new BadRequestError("You cannot delete your own admin account");
  }

  await db.delete(admins).where(eq(admins.id, id));
  return { id };
};

export const getAdminOrders = async (query = {}) => {
  const { page, perPage, status, token } = query;
  
  const whereClauses = [];
  if (status && status !== 'all') {
    whereClauses.push(eq(orders.status, status));
  }
  if (token) {
    whereClauses.push(ilike(orders.tokenNumber, `%${token}%`));
  }
  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

  // Calculate total count for the filtered results
  const countRes = await db
    .select({ count: sql`count(*)` })
    .from(orders)
    .where(where);
  const totalItems = parseInt(countRes[0]?.count || 0, 10);

  // Calculate stats for all statuses
  const statsRes = await db
    .select({
      status: orders.status,
      count: sql`count(*)`,
    })
    .from(orders)
    .groupBy(orders.status);

  const stats = {
    pending: 0,
    approved: 0,
    preparing: 0,
    completed: 0,
    cancelled: 0,
  };
  
  let allCount = 0;
  statsRes.forEach(row => {
    const val = parseInt(row.count, 10);
    if (stats[row.status] !== undefined) {
      stats[row.status] = val;
    }
    allCount += val;
  });
  stats.all = allCount;

  let limit = undefined;
  let offset = undefined;
  if (page && perPage) {
    limit = parseInt(perPage, 10);
    offset = (parseInt(page, 10) - 1) * limit;
  }

  const results = await db.query.orders.findMany({
    where,
    limit,
    offset,
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    with: {
      user: true,
      offer: true,
      items: {
        with: {
          menuItem: true,
          variant: {
            with: {
              variant: true,
            },
          },
        },
      },
    },
  });

  const ordersWithPoints = await Promise.all(
    results.map(async (o) => {
      let earnedPoints = 0;
      if (["approved", "preparing", "completed"].includes(o.status)) {
        const ledgerEntry = await db.query.loyaltyLedger.findFirst({
          where: and(
            eq(loyaltyLedger.userId, o.userId),
            eq(loyaltyLedger.description, `Points earned on Order #${o.tokenNumber}`)
          ),
        });
        if (ledgerEntry) {
          earnedPoints = ledgerEntry.points;
        }
      }
      return {
        ...o,
        earnedPoints,
      };
    })
  );

  return {
    orders: ordersWithPoints,
    stats,
    pagination: {
      totalItems,
      totalPages: limit ? Math.ceil(totalItems / limit) : 1,
      currentPage: page ? parseInt(page, 10) : 1,
      perPage: limit || totalItems,
    }
  };
};

export const getOrderById = async (id) => {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      user: true,
      offer: true,
      items: {
        with: {
          menuItem: true,
          variant: { with: { variant: true } },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  let earnedPoints = 0;
  if (["approved", "preparing", "completed"].includes(order.status)) {
    const ledgerEntry = await db.query.loyaltyLedger.findFirst({
      where: and(
        eq(loyaltyLedger.userId, order.userId),
        eq(loyaltyLedger.description, `Points earned on Order #${order.tokenNumber}`)
      ),
    });
    if (ledgerEntry) {
      earnedPoints = ledgerEntry.points;
    }
  }

  return {
    ...order,
    earnedPoints,
  };
};

export const updateOrderStatus = async (id, { status }) => {
  const orderRecord = await db.query.orders.findFirst({
    where: eq(orders.id, id),
  });

  if (!orderRecord) {
    throw new NotFoundError("Order not found");
  }

  const previousStatus = orderRecord.status;

  // Guard: prevent invalid/no-op transitions
  if (previousStatus === status) {
    return await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { user: true, offer: true, items: { with: { menuItem: true, variant: { with: { variant: true } } } } },
    });
  }

  const [updatedOrder] = await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();

  // ── AWARD POINTS on first approval / prep ───────────────────────────────
  if ((status === "approved" || status === "preparing") && previousStatus === "pending") {
    const finalAmount = parseFloat(orderRecord.totalAmount);
    
    // Fetch settings ratio and max points limit
    const ratioStr = await getSetting("loyalty_earning_percentage", "10");
    const maxStr = await getSetting("loyalty_max_points_per_order", "100");
    const ratio = parseInt(ratioStr, 10);
    const maxPoints = parseInt(maxStr, 10);

    const pointsEarned = Math.min(maxPoints, Math.floor(finalAmount * (ratio / 100)));
    if (pointsEarned > 0) {
      await db.insert(loyaltyLedger).values({
        userId: orderRecord.userId,
        points: pointsEarned,
        description: `Points earned on Order #${orderRecord.tokenNumber}`,
      });
    }
  }

  // ── RESTORE / REVERSE POINTS on cancellation ──────────────────────────────
  if (status === "cancelled" && previousStatus !== "cancelled") {
    // 1. Always restore redeemed points regardless of previous status
    const pointsRedeemed = parseInt(orderRecord.pointsRedeemed) || 0;
    if (pointsRedeemed > 0) {
      await db.insert(loyaltyLedger).values({
        userId: orderRecord.userId,
        points: pointsRedeemed,
        description: `Points restored — Order #${orderRecord.tokenNumber} cancelled`,
      });
    }

    // 2. Reverse earned points if the order had already been approved
    //    (Query ledger entries to reverse the exact points awarded)
    const wasApproved = ["approved", "preparing", "completed"].includes(previousStatus);
    if (wasApproved) {
      const earnedEntries = await db.query.loyaltyLedger.findMany({
        where: and(
          eq(loyaltyLedger.userId, orderRecord.userId),
          eq(loyaltyLedger.description, `Points earned on Order #${orderRecord.tokenNumber}`)
        ),
      });
      const pointsToReverse = earnedEntries.reduce((sum, entry) => sum + entry.points, 0);
      if (pointsToReverse > 0) {
        await db.insert(loyaltyLedger).values({
          userId: orderRecord.userId,
          points: -pointsToReverse,
          description: `Points reversed — Order #${orderRecord.tokenNumber} cancelled`,
        });
      }
    }
  }

  const finalOrder = await db.query.orders.findFirst({
    where: eq(orders.id, updatedOrder.id),
    with: {
      user: true,
      offer: true,
      items: {
        with: {
          menuItem: true,
          variant: { with: { variant: true } },
        },
      },
    },
  });

  let earnedPoints = 0;
  if (["approved", "preparing", "completed"].includes(finalOrder.status)) {
    const ledgerEntry = await db.query.loyaltyLedger.findFirst({
      where: and(
        eq(loyaltyLedger.userId, finalOrder.userId),
        eq(loyaltyLedger.description, `Points earned on Order #${finalOrder.tokenNumber}`)
      ),
    });
    if (ledgerEntry) {
      earnedPoints = ledgerEntry.points;
    }
  }

  // Enqueue status change notification job for SSE streaming to client
  try {
    await jobQueue.publish("order.status_changed", {
      orderId: finalOrder.id,
      userId: finalOrder.userId,
      status: finalOrder.status,
      tokenNumber: finalOrder.tokenNumber,
    });
  } catch (error) {
    logger.error("Failed to enqueue order.status_changed job:", error);
  }

  // Enqueue WhatsApp notification if order is completed
  if (status === "completed") {
    try {
      const customerPhone = finalOrder.user?.phoneNumber;
      if (customerPhone) {
        await jobQueue.publish("whatsapp.order_completed", {
          phone: customerPhone,
          tokenNumber: finalOrder.tokenNumber,
          orderId: finalOrder.id,
          totalAmount: finalOrder.totalAmount,
        });
      } else {
        logger.warn(`Could not enqueue WhatsApp message for completed order ${finalOrder.id} - customer has no phone number`);
      }
    } catch (error) {
      logger.error("Failed to enqueue whatsapp.order_completed job:", error);
    }
  }

  return {
    ...finalOrder,
    earnedPoints,
  };
};

// =========================================================================
// 9. SYSTEM SETTINGS & CUSTOMER LOYALTY MANAGEMENT
// =========================================================================

export const getSetting = async (key, defaultValue) => {
  try {
    const record = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, key),
    });
    return record ? record.value : defaultValue.toString();
  } catch (err) {
    console.error(`Error fetching setting ${key}:`, err);
    return defaultValue.toString();
  }
};

export const setSetting = async (key, value) => {
  const existing = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, key),
  });
  if (existing) {
    await db
      .update(systemSettings)
      .set({ value: value.toString(), updatedAt: new Date() })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({
      key,
      value: value.toString(),
    });
  }
};

export const getSettings = async () => {
  const ratio = await getSetting("loyalty_earning_percentage", "10");
  const max = await getSetting("loyalty_max_points_per_order", "100");
  return {
    earningRatioPercentage: parseInt(ratio, 10),
    maxEarningPoints: parseInt(max, 10),
  };
};

export const updateSettings = async ({ earningRatioPercentage, maxEarningPoints }) => {
  if (earningRatioPercentage !== undefined) {
    await setSetting("loyalty_earning_percentage", earningRatioPercentage);
  }
  if (maxEarningPoints !== undefined) {
    await setSetting("loyalty_max_points_per_order", maxEarningPoints);
  }
  return await getSettings();
};

export const getCustomers = async (query = {}) => {
  const { page, perPage, name } = query;
  
  const whereClauses = [eq(users.role, "user")];
  if (name) {
    whereClauses.push(
      or(
        ilike(users.name, `%${name}%`),
        ilike(users.phoneNumber, `%${name}%`)
      )
    );
  }
  
  const where = and(...whereClauses);

  // Calculate total count
  const countRes = await db
    .select({ count: sql`count(*)` })
    .from(users)
    .where(where);
  const totalItems = parseInt(countRes[0]?.count || 0, 10);

  let limit = undefined;
  let offset = undefined;
  if (page && perPage) {
    limit = parseInt(perPage, 10);
    offset = (parseInt(page, 10) - 1) * limit;
  }

  const results = await db.query.users.findMany({
    where,
    limit,
    offset,
    with: {
      loyaltyLedger: true,
    },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  const customersList = results.map((c) => {
    const pointsBalance = c.loyaltyLedger.reduce((sum, entry) => sum + entry.points, 0);
    const { passwordHash, loyaltyLedger, ...rest } = c;
    return {
      ...rest,
      pointsBalance,
    };
  });

  return {
    customers: customersList,
    pagination: {
      totalItems,
      totalPages: limit ? Math.ceil(totalItems / limit) : 1,
      currentPage: page ? parseInt(page, 10) : 1,
      perPage: limit || totalItems,
    },
  };
};

export const adjustCustomerPoints = async (userId, { points, description }) => {
  const customerRecord = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.role, "user")),
  });

  if (!customerRecord) {
    throw new NotFoundError("Customer not found");
  }

  // Calculate current points balance to prevent negative balances
  const ledger = await db.select().from(loyaltyLedger).where(eq(loyaltyLedger.userId, userId));
  const currentPoints = ledger.reduce((sum, entry) => sum + entry.points, 0);

  if (currentPoints + points < 0) {
    throw new BadRequestError(`Cannot deduct ${Math.abs(points)} points. Customer only has ${currentPoints} points.`);
  }

  await db.insert(loyaltyLedger).values({
    userId,
    points,
    description: description || (points > 0 ? "Points granted by Admin" : "Points deleted by Admin"),
  });

  return {
    userId,
    pointsBalance: currentPoints + points,
  };
};

export const createOffer = async ({ code, description, discountType, discountValue, maxDiscount, minBillAmount }) => {
  const existingOffer = await db.query.offers.findFirst({
    where: eq(offers.code, code.toUpperCase()),
  });

  if (existingOffer) {
    throw new BadRequestError(`Offer with code '${code}' already exists`);
  }

  const [newOffer] = await db
    .insert(offers)
    .values({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue: discountValue.toString(),
      maxDiscount: maxDiscount ? maxDiscount.toString() : null,
      minBillAmount: minBillAmount ? minBillAmount.toString() : "0.00",
      isActive: true,
    })
    .returning();

  return newOffer;
};

export const getOffers = async (query = {}) => {
  const { page, perPage, code, sortBy = "createdAt", sortOrder = "desc" } = query;
  
  const whereClauses = [];
  
  if (code) {
    whereClauses.push(ilike(offers.code, `%${code}%`));
  }
  
  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;
  
  // Calculate total count
  const countRes = await db
    .select({ count: sql`count(*)` })
    .from(offers)
    .where(where);
  const totalItems = parseInt(countRes[0]?.count || 0, 10);
  
  // Pagination values
  let limit = undefined;
  let offset = undefined;
  if (page && perPage) {
    limit = parseInt(perPage, 10);
    offset = (parseInt(page, 10) - 1) * limit;
  }
  
  let orderColumn = offers.createdAt;
  if (sortBy === "code") orderColumn = offers.code;
  if (sortBy === "isActive") orderColumn = offers.isActive;
  
  const results = await db.query.offers.findMany({
    where,
    limit,
    offset,
    orderBy: (offers, { asc, desc }) => [
      sortOrder.toLowerCase() === "asc" ? asc(orderColumn) : desc(orderColumn)
    ],
  });
  
  return {
    offers: results,
    pagination: {
      totalItems,
      totalPages: limit ? Math.ceil(totalItems / limit) : 1,
      currentPage: page ? parseInt(page, 10) : 1,
      perPage: limit || totalItems,
    }
  };
};

export const updateOffer = async (id, { code, description, discountType, discountValue, maxDiscount, minBillAmount, isActive }) => {
  const offerRecord = await db.query.offers.findFirst({
    where: eq(offers.id, id),
  });

  if (!offerRecord) {
    throw new NotFoundError("Offer not found");
  }

  const updates = {};
  if (description !== undefined) updates.description = description;
  if (discountType !== undefined) updates.discountType = discountType;
  if (discountValue !== undefined) updates.discountValue = discountValue.toString();
  if (maxDiscount !== undefined) updates.maxDiscount = maxDiscount ? maxDiscount.toString() : null;
  if (minBillAmount !== undefined) updates.minBillAmount = minBillAmount ? minBillAmount.toString() : "0.00";
  if (isActive !== undefined) updates.isActive = isActive;
  
  if (code !== undefined) {
    const existing = await db.query.offers.findFirst({
      where: and(eq(offers.code, code.toUpperCase()), ne(offers.id, id)),
    });
    if (existing) {
      throw new BadRequestError(`Offer with code '${code}' already exists`);
    }
    updates.code = code.toUpperCase();
  }

  updates.updatedAt = new Date();

  const [updatedOffer] = await db
    .update(offers)
    .set(updates)
    .where(eq(offers.id, id))
    .returning();

  return updatedOffer;
};

export const deleteOffer = async (id) => {
  const offerRecord = await db.query.offers.findFirst({
    where: eq(offers.id, id),
  });

  if (!offerRecord) {
    throw new NotFoundError("Offer not found");
  }

  await db.delete(offers).where(eq(offers.id, id));
  return { id };
};

export const createOrderOnBehalf = async (adminId, { name, phoneNumber, items, type, pointsRedeemed, offerCode }) => {
  // 1. Authenticate or register the customer by phone number (and name if registering)
  const authData = await loginOrRegisterCustomer({ name, phoneNumber });

  // 2. Place order for this customer (always placed as pending for POS/admin created orders)
  const orderData = await placeCustomerOrder(authData.user.id, items, pointsRedeemed, offerCode, type);

  return {
    customer: authData.user,
    order: orderData.order,
    discount: orderData.discount,
    tax: orderData.tax,
    originalAmount: orderData.originalAmount,
    pointsEarned: orderData.pointsEarned,
  };
};


