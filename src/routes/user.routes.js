import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import * as feedbackController from "../controllers/feedback.controller.js";
import { validate } from "../middleware/validate.js";
import { protect } from "../middleware/auth.js";
import { updateProfileSchema, changePhoneOtpSchema, verifyChangePhoneOtpSchema } from "../validators/user.validator.js";
import { refreshSchema, sendCustomerOtpSchema, verifyCustomerOtpSchema, customerLoginSchema } from "../validators/auth.validator.js";
import { createFeedbackSchema } from "../validators/feedback.validator.js";

const router = Router();

// Public routes
router.get("/menu", userController.getMenu);
router.post("/auth/login", validate(customerLoginSchema), userController.loginCustomer);
router.post("/auth/send-otp", validate(sendCustomerOtpSchema), userController.sendCustomerOTP);
router.post("/auth/verify-otp", validate(verifyCustomerOtpSchema), userController.verifyCustomerOTP);
router.post("/auth/refresh", validate(refreshSchema), userController.refreshCustomerToken);


// Protected routes (Require customer token)
router.get("/profile", protect, userController.getProfile);
router.put("/profile", protect, validate(updateProfileSchema), userController.updateProfile);
router.post("/profile/change-phone-otp", protect, validate(changePhoneOtpSchema), userController.sendChangePhoneOTP);
router.post("/profile/verify-phone-otp", protect, validate(verifyChangePhoneOtpSchema), userController.verifyChangePhoneOTP);
router.post("/orders", protect, userController.placeOrder);
router.get("/orders", protect, userController.getOrders);
router.get("/orders/stream", protect, userController.streamOrderUpdates);
router.get("/loyalty", protect, userController.getLoyaltyLedger);
router.get("/offers", protect, userController.getOffers);
router.post("/offers/validate", protect, userController.validateOffer);
router.post("/feedback", protect, validate(createFeedbackSchema), feedbackController.submitFeedback);

export default router;
