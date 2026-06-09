import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { validate } from "../middleware/validate.js";
import { protect } from "../middleware/auth.js";
import { updateProfileSchema } from "../validators/user.validator.js";

const router = Router();

// Public routes
router.get("/menu", userController.getMenu);
router.post("/auth/login", userController.loginCustomer);

// Protected routes (Require customer token)
router.get("/profile", protect, userController.getProfile);
router.put("/profile", protect, validate(updateProfileSchema), userController.updateProfile);
router.post("/orders", protect, userController.placeOrder);
router.get("/orders", protect, userController.getOrders);
router.get("/loyalty", protect, userController.getLoyaltyLedger);
router.get("/offers", protect, userController.getOffers);
router.post("/offers/validate", protect, userController.validateOffer);

export default router;
