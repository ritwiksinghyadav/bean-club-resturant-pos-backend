import { db } from "../db/index.js";
import { users, profiles, categories, menuItems, itemVariants, orders, orderItems, loyaltyLedger } from "../db/schema.js";
import { eq, desc, and, isNull } from "drizzle-orm";
import { NotFoundError, BadRequestError } from "../utils/errors.js";

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
    // 1. Update user fields
    const userUpdates = {};
    if (name !== undefined) userUpdates.name = name;
    if (phoneNumber !== undefined) userUpdates.phoneNumber = phoneNumber;

    if (Object.keys(userUpdates).length > 0) {
      userUpdates.updatedAt = new Date();
      await tx
        .update(users)
        .set(userUpdates)
        .where(eq(users.id, id));
    }

    // 2. Update profile fields
    const profileUpdates = {};
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

export const getCustomerMenu = async () => {
  const activeCategories = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    with: {
      menuItems: {
        where: eq(menuItems.isActive, true),
        with: {
          variants: {
            where: eq(itemVariants.isActive, true),
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
      },
    },
  });

  // Fetch active menu items that are uncategorised (categoryId is null)
  const uncategorisedItems = await db.query.menuItems.findMany({
    where: and(
      eq(menuItems.isActive, true),
      isNull(menuItems.categoryId)
    ),
    with: {
      variants: {
        where: eq(itemVariants.isActive, true),
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

  if (uncategorisedItems.length > 0) {
    activeCategories.push({
      id: "uncategorised",
      name: "Others",
      description: "Other items",
      isActive: true,
      menuItems: uncategorisedItems,
    });
  }

  return activeCategories;
};

export const placeCustomerOrder = async (userId, items) => {
  if (!items || items.length === 0) {
    throw new BadRequestError("Order must contain at least one item");
  }

  // Calculate total and validate items inside a transaction
  return await db.transaction(async (tx) => {
    let totalAmount = 0;
    const orderItemsToInsert = [];

    for (const item of items) {
      // 1. Fetch menu item
      const menuItem = await tx.query.menuItems.findFirst({
        where: eq(menuItems.id, item.menuItemId),
      });

      if (!menuItem || !menuItem.isActive) {
        throw new BadRequestError(`Menu item ${item.menuItemId} is not available`);
      }

      let itemPrice = parseFloat(menuItem.basePrice);

      // 2. If variant is specified, look it up and use its price
      if (item.variantId) {
        const variant = await tx.query.itemVariants.findFirst({
          where: eq(itemVariants.id, item.variantId),
        });

        if (!variant || !variant.isActive || variant.menuItemId !== item.menuItemId) {
          throw new BadRequestError(`Variant ${item.variantId} is not available for this item`);
        }

        itemPrice = parseFloat(variant.price);
      }

      const lineTotal = itemPrice * item.quantity;
      totalAmount += lineTotal;

      orderItemsToInsert.push({
        menuItemId: item.menuItemId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        price: itemPrice.toString(),
      });
    }

    // 3. Create the order
    const [newOrder] = await tx
      .insert(orders)
      .values({
        userId,
        status: "pending",
        totalAmount: totalAmount.toFixed(2),
      })
      .returning();

    // 4. Create the order items
    for (const orderItem of orderItemsToInsert) {
      await tx.insert(orderItems).values({
        orderId: newOrder.id,
        ...orderItem,
      });
    }

    // 5. Calculate loyalty points (1 point per $1 spent, rounded down)
    const pointsEarned = Math.floor(totalAmount);
    if (pointsEarned > 0) {
      await tx.insert(loyaltyLedger).values({
        userId,
        points: pointsEarned,
        description: `Points earned on Order #${newOrder.id.slice(0, 8)}`,
      });
    }

    return {
      order: newOrder,
      pointsEarned,
    };
  });
};

export const getCustomerOrders = async (userId) => {
  return await db.query.orders.findMany({
    where: eq(orders.userId, userId),
    orderBy: [desc(orders.createdAt)],
    with: {
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
};

export const getCustomerLoyalty = async (userId) => {
  const ledger = await db.query.loyaltyLedger.findMany({
    where: eq(loyaltyLedger.userId, userId),
    orderBy: [desc(loyaltyLedger.createdAt)],
  });

  const totalPoints = ledger.reduce((sum, entry) => sum + entry.points, 0);

  return {
    balance: totalPoints,
    ledger,
  };
};
