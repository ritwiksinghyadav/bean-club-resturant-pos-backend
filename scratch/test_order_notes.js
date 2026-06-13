import { placeCustomerOrder } from "../src/services/user.service.js";
import { updateOrderStatus } from "../src/services/admin.service.js";
import { db, pool } from "../src/db/index.js";
import { users, menuItems, orders } from "../src/db/schema.js";
import { eq } from "drizzle-orm";

async function testOrderNotes() {
  console.log("=== STARTING ORDER NOTES & CANCELLATION REASON TESTS ===");

  try {
    // 1. Find or create a test customer
    let user = await db.query.users.findFirst();
    if (!user) {
      console.log("No users found. Creating a test user...");
      const [newUser] = await db.insert(users).values({
        name: "Test Customer",
        phoneNumber: "9999988888",
        role: "user"
      }).returning();
      user = newUser;
    }
    console.log(`Test Customer: ${user.name} (${user.id})`);

    // 2. Find a menu item to place an order
    const item = await db.query.menuItems.findFirst({
      where: eq(menuItems.isActive, true)
    });
    if (!item) {
      throw new Error("No active menu items available to place test order.");
    }
    console.log(`Test Menu Item: ${item.name} (${item.id})`);

    const orderItems = [{
      menuItemId: item.id,
      quantity: 2,
    }];

    // 3. Place order with specialNote
    const testNote = "Make it with less sugar and extra hot please";
    console.log("\n[TEST 1] Placing order with special note...");
    const orderData = await placeCustomerOrder(user.id, orderItems, 0, null, "takeaway", testNote);
    const orderId = orderData.order.id;
    console.log(`✅ Order placed! Order ID: ${orderId}, Token: #${orderData.order.tokenNumber}`);
    
    // Check if specialNote was stored correctly
    const savedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId)
    });
    console.log(`Stored Special Note in DB: "${savedOrder.specialNote}"`);
    if (savedOrder.specialNote !== testNote) {
      throw new Error("Special note mismatch in database!");
    }

    // 4. Try to cancel order without providing a reason (should fail)
    console.log("\n[TEST 2] Attempting status transition to cancelled without cancellation reason...");
    try {
      await updateOrderStatus(orderId, { status: "cancelled" });
      throw new Error("Cancellation should have failed without a cancelReason!");
    } catch (err) {
      console.log(`✅ Expected failure occurred: "${err.message}"`);
      if (!err.message.includes("reason is mandatory")) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }

    // 5. Cancel order with cancellation reason (should succeed)
    const testCancelReason = "Customer requested cancellation because they chose the wrong item";
    console.log("\n[TEST 3] Cancelling order with a valid cancellation reason...");
    const cancelledOrder = await updateOrderStatus(orderId, {
      status: "cancelled",
      cancelReason: testCancelReason
    });
    console.log("✅ Order cancelled successfully!");

    // Check if cancelReason was stored correctly
    const finalOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId)
    });
    console.log(`Stored Cancel Reason in DB: "${finalOrder.cancelReason}"`);
    if (finalOrder.cancelReason !== testCancelReason) {
      throw new Error("Cancel reason mismatch in database!");
    }

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
  } finally {
    await pool.end();
    console.log("Database pool closed.");
    process.exit(0);
  }
}

testOrderNotes();
