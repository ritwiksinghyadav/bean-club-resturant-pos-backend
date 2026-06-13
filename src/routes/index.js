import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import adminRoutes from "./admin.routes.js";
import { ApiResponse } from "../utils/response.js";
import { dummyQueue } from "../queues/dummy.queue.js";
import { whatsappQueue } from "../queues/whatsapp.queue.js";

const router = Router();

// Ping endpoint
router.get("/ping", (req, res) => {
  return ApiResponse.success(
    res,
    { timestamp: new Date().toISOString() },
    200,
    "pong 🏓"
  );
});

// Test queues endpoint
router.post("/test-queue", async (req, res) => {
  try {
    const { message = "Hello, world!" } = req.body;
    
    // Add to dummy queue
    const dummyJob = await dummyQueue.add("test_job", { message, timestamp: new Date() });
    
    // Add to whatsapp queue (mock data)
    const whatsappJob = await whatsappQueue.add("order_completed", {
      phone: "+919999999999",
      tokenNumber: "9999",
      orderId: "dummy-order-id-12345",
      totalAmount: "450.00",
    });
    
    return ApiResponse.success(
      res,
      {
        dummyJobId: dummyJob.id,
        whatsappJobId: whatsappJob.id,
      },
      200,
      "Jobs enqueued successfully!"
    );
  } catch (err) {
    return ApiResponse.error(res, err.message, 500);
  }
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);

export default router;
