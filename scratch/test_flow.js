import { db } from "../src/db/index.js";
import { users, menuItems } from "../src/db/schema.js";
import { placeCustomerOrder } from "../src/services/user.service.js";
import { updateOrderStatus } from "../src/services/admin.service.js";
import { jobQueue } from "../src/utils/jobQueue.js";
import { eq } from "drizzle-orm";

async function test() {
  console.log("=== STARTING QUEUE TEST ===");
  console.log("Initializing job queue...");
  await jobQueue.start();

  console.log("Fetching a customer user...");
  const customer = await db.query.users.findFirst({
    where: eq(users.role, "user")
  });
  if (!customer) {
    console.error("No customer user found in database! Make sure DB is seeded.");
    await jobQueue.stop();
    process.exit(1);
  }
  console.log(`Found customer: ${customer.name} (Phone: ${customer.phoneNumber}, ID: ${customer.id})`);

  console.log("Fetching a menu item...");
  const menuItem = await db.query.menuItems.findFirst({
    where: eq(menuItems.isActive, true)
  });
  if (!menuItem) {
    console.error("No active menu item found!");
    await jobQueue.stop();
    process.exit(1);
  }
  console.log(`Found menu item: ${menuItem.name} (${menuItem.id})`);

  console.log("Placing order...");
  const items = [{ menuItemId: menuItem.id, quantity: 1 }];
  const orderResult = await placeCustomerOrder(customer.id, items);
  console.log("Order placed successfully. ID:", orderResult.order.id);

  // Wait a few seconds to let pg-boss process order.new
  console.log("Waiting 4 seconds for order.new job to process...");
  await new Promise(resolve => setTimeout(resolve, 4000));

  console.log("Updating order status to 'completed'...");
  const updatedOrder = await updateOrderStatus(orderResult.order.id, { status: "completed" });
  console.log("Order status updated in DB to:", updatedOrder.status);

  // Wait a few seconds to let status_changed and whatsapp.order_completed process
  console.log("Waiting 10 seconds for background jobs to process...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log("Stopping job queue...");
  await jobQueue.stop();
  console.log("=== QUEUE TEST COMPLETED ===");
  process.exit(0);
}

test().catch(async (err) => {
  console.error("Test error:", err);
  await jobQueue.stop();
  process.exit(1);
});
