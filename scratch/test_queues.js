import { dummyQueue } from "../src/queues/dummy.queue.js";
import { whatsappQueue } from "../src/queues/whatsapp.queue.js";
import { startDummyWorker, stopDummyWorker } from "../src/workers/dummy.worker.js";
import { startWhatsappWorker, stopWhatsappWorker } from "../src/workers/whatsapp.worker.js";
import { redis } from "../src/config/redis.js";

async function test() {
  console.log("=== STARTING BULLMQ QUEUE TEST ===");
  console.log("Starting background workers...");
  startDummyWorker();
  startWhatsappWorker();

  console.log("Enqueuing job in dummyQueue...");
  const dummyJob = await dummyQueue.add("test_job", {
    message: "Hello from Valkey/BullMQ testing!",
    timestamp: new Date()
  });
  console.log(`Dummy job enqueued: ${dummyJob.id}`);

  console.log("Enqueuing order_completed job in whatsappQueue...");
  const whatsappJob = await whatsappQueue.add("order_completed", {
    phone: "+919876543210",
    tokenNumber: "4321",
    orderId: "test-order-uuid-9999",
    totalAmount: "890.50"
  });
  console.log(`WhatsApp job enqueued: ${whatsappJob.id}`);

  console.log("Waiting 6 seconds for workers to process jobs...");
  await new Promise((resolve) => setTimeout(resolve, 6000));

  console.log("Shutting down workers...");
  await stopDummyWorker();
  await stopWhatsappWorker();
  
  console.log("Closing Redis connection...");
  await redis.quit();

  console.log("=== QUEUE TEST COMPLETED ===");
  process.exit(0);
}

test().catch(async (err) => {
  console.error("Test execution failed:", err);
  await stopDummyWorker();
  await stopWhatsappWorker();
  await redis.quit();
  process.exit(1);
});
