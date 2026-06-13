import { db } from "../db/index.js";
import { users, profiles, categories, menuItems, itemVariants, orders, orderItems, loyaltyLedger, offers } from "../db/schema.js";
import { eq, desc, and, isNull } from "drizzle-orm";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import { sseManager } from "../utils/sseManager.js";
import { logger } from "../utils/logger.js";

export const getUserById = async (id) => {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, id), isNull(users.deletedAt)),
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

export const updateUserProfile = async (id, { name, bio, avatarUrl }) => {
  // Run updates in a transaction
  await db.transaction(async (tx) => {
    // 1. Update user fields
    const userUpdates = {};
    if (name !== undefined) userUpdates.name = name;

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
    where: and(eq(categories.isActive, true), isNull(categories.deletedAt)),
    with: {
      menuItems: {
        where: and(eq(menuItems.isActive, true), isNull(menuItems.deletedAt)),
        with: {
          variants: {
            where: and(eq(itemVariants.isActive, true), isNull(itemVariants.deletedAt)),
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
      isNull(menuItems.categoryId),
      isNull(menuItems.deletedAt)
    ),
    with: {
      variants: {
        where: and(eq(itemVariants.isActive, true), isNull(itemVariants.deletedAt)),
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

export const placeCustomerOrder = async (userId, items, pointsRedeemed = 0, offerCode = null, type = "takeaway") => {
  if (!items || items.length === 0) {
    throw new BadRequestError("Order must contain at least one item");
  }

  // Calculate total and validate items inside a transaction
  const result = await db.transaction(async (tx) => {
    let totalAmount = 0;
    const orderItemsToInsert = [];

    for (const item of items) {
      // 1. Fetch menu item
      const menuItem = await tx.query.menuItems.findFirst({
        where: and(eq(menuItems.id, item.menuItemId), isNull(menuItems.deletedAt)),
      });

      if (!menuItem || !menuItem.isActive) {
        throw new BadRequestError(`Menu item ${item.menuItemId} is not available`);
      }

      let itemPrice = parseFloat(menuItem.basePrice);

      // 2. If variant is specified, look it up and use its price
      if (item.variantId) {
        const variant = await tx.query.itemVariants.findFirst({
          where: and(eq(itemVariants.id, item.variantId), isNull(itemVariants.deletedAt)),
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

    // 2.5 Process Offer Discount first
    let offerDiscount = 0;
    let offerId = null;
    if (offerCode) {
      const offer = await tx.query.offers.findFirst({
        where: and(eq(offers.code, offerCode.toUpperCase()), eq(offers.isActive, true), isNull(offers.deletedAt)),
      });
      if (!offer) {
        throw new BadRequestError(`Invalid or inactive offer code: ${offerCode}`);
      }
      if (totalAmount < parseFloat(offer.minBillAmount)) {
        throw new BadRequestError(`Minimum bill amount to apply this offer is ₹${parseFloat(offer.minBillAmount).toFixed(2)}`);
      }

      if (offer.discountType === "percentage") {
        let calculated = (totalAmount * parseFloat(offer.discountValue)) / 100;
        if (offer.maxDiscount && parseFloat(offer.maxDiscount) > 0) {
          calculated = Math.min(calculated, parseFloat(offer.maxDiscount));
        }
        offerDiscount = calculated;
      } else if (offer.discountType === "fixed") {
        offerDiscount = Math.min(parseFloat(offer.discountValue), totalAmount);
      }
      offerId = offer.id;
    }

    const remainingAmount = Math.max(0, totalAmount - offerDiscount);

    // 3. Process loyalty points redemption (1 point = 1 rupee)
    let loyaltyDiscount = 0;
    let pointsToDeduct = 0;
    if (pointsRedeemed > 0) {
      // Fetch user's current loyalty points balance
      const ledger = await tx
        .select()
        .from(loyaltyLedger)
        .where(eq(loyaltyLedger.userId, userId));
      const currentPoints = ledger.reduce((sum, entry) => sum + entry.points, 0);

      if (pointsRedeemed > currentPoints) {
        throw new BadRequestError(`Insufficient loyalty points. Available: ${currentPoints}, requested: ${pointsRedeemed}`);
      }

      // Max points to redeem cannot exceed the cost of the order after offer
      pointsToDeduct = Math.min(pointsRedeemed, Math.floor(remainingAmount));
      loyaltyDiscount = pointsToDeduct; // 1 point = 1 rupee
    }

    const totalDiscount = offerDiscount + loyaltyDiscount;
    const netAmount = Math.max(0, totalAmount - totalDiscount);
    const tax = netAmount * 0.05; // 5% GST/Tax
    const finalAmount = netAmount + tax;
    
    // Generate a random 4-digit token number
    const tokenNumber = Math.floor(1000 + Math.random() * 9000).toString();

    // 4. Create the order
    const [newOrder] = await tx
      .insert(orders)
      .values({
        userId,
        status: "pending",
        totalAmount: finalAmount.toFixed(2),
        tokenNumber,
        pointsRedeemed: pointsToDeduct,
        discount: totalDiscount.toFixed(2),
        offerId,
        offerDiscount: offerDiscount.toFixed(2),
        type: type || "takeaway",
      })
      .returning();

    // 5. Create the order items
    for (const orderItem of orderItemsToInsert) {
      await tx.insert(orderItems).values({
        orderId: newOrder.id,
        ...orderItem,
      });
    }

    // 6. Deduct loyalty points if redeemed
    if (pointsToDeduct > 0) {
      await tx.insert(loyaltyLedger).values({
        userId,
        points: -pointsToDeduct,
        description: `Redeemed points on Order #${tokenNumber}`,
      });
    }

    // 7. Loyalty points are awarded when the order is APPROVED (not on placement)
    // See: admin.service.js updateOrderStatus

    // Retrieve order with populated offer relation
    const orderWithOffer = await tx.query.orders.findFirst({
      where: eq(orders.id, newOrder.id),
      with: {
        offer: true
      }
    });

    return {
      order: orderWithOffer,
      discount: totalDiscount,
      tax,
      originalAmount: totalAmount,
      pointsEarned: 0, // will be credited on approval
    };
  });

  // Broadcast new order to admins directly via SSE
  try {
    sseManager.broadcastToAdmins("new_order", result.order);
  } catch (error) {
    logger.error("Failed to broadcast new_order SSE message after order placement:", error);
  }

  return result;
};

export const getCustomerOrders = async (userId) => {
  const results = await db.query.orders.findMany({
    where: eq(orders.userId, userId),
    orderBy: [desc(orders.createdAt)],
    with: {
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

  return await Promise.all(
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

export const getActiveOffers = async () => {
  return await db.query.offers.findMany({
    where: and(eq(offers.isActive, true), isNull(offers.deletedAt)),
    orderBy: [desc(offers.createdAt)],
  });
};

export const validateOfferCode = async (code, subtotal) => {
  const offer = await db.query.offers.findFirst({
    where: and(eq(offers.code, code.toUpperCase()), eq(offers.isActive, true), isNull(offers.deletedAt)),
  });

  if (!offer) {
    throw new BadRequestError(`Invalid or inactive offer code: ${code}`);
  }

  const minBill = parseFloat(offer.minBillAmount);
  if (parseFloat(subtotal) < minBill) {
    throw new BadRequestError(`Minimum bill amount to apply this offer is ₹${minBill.toFixed(2)}`);
  }

  let discountAmount = 0;
  if (offer.discountType === "percentage") {
    discountAmount = (parseFloat(subtotal) * parseFloat(offer.discountValue)) / 100;
    if (offer.maxDiscount && parseFloat(offer.maxDiscount) > 0) {
      discountAmount = Math.min(discountAmount, parseFloat(offer.maxDiscount));
    }
  } else if (offer.discountType === "fixed") {
    discountAmount = Math.min(parseFloat(offer.discountValue), parseFloat(subtotal));
  }

  return {
    valid: true,
    discountAmount,
    offer,
  };
};
