import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { validate } from "../middleware/validate.js";
import { protect } from "../middleware/auth.js";
import { updateProfileSchema } from "../validators/user.validator.js";

const router = Router();

router.get("/profile", protect, userController.getProfile);
router.put("/profile", protect, validate(updateProfileSchema), userController.updateProfile);

export default router;
