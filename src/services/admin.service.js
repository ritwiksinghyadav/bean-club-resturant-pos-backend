import { db } from "../db/index.js";
import { admins, categories, menuItems, itemVariants, tags, menuItemTags, variants, roles } from "../db/schema.js";
import { eq, and, ne, isNull, or, ilike, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { BadRequestError, UnauthorizedError, NotFoundError } from "../utils/errors.js";

const generateAdminToken = (admin) => {
  const payload = { 
    id: admin.id, 
    email: admin.email, 
    role: admin.role.name 
  };
  
  return jwt.sign(payload, env.JWT_ACCESS_SECRET);
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

  const token = generateAdminToken(adminUser);

  const { passwordHash: _, ...adminWithoutPassword } = adminUser;
  return {
    admin: {
      id: adminWithoutPassword.id,
      name: adminWithoutPassword.name,
      email: adminWithoutPassword.email,
      role: adminWithoutPassword.role.name,
    },
    token,
  };
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

