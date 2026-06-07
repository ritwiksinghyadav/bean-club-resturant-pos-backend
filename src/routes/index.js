import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import adminRoutes from "./admin.routes.js";
import { ApiResponse } from "../utils/response.js";

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

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);

export default router;
