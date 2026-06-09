import { Router } from "express";
import * as adminController from "../controllers/admin.controller.js";
import { protectAdmin, restrictTo } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { 
  adminLoginSchema, 
  createCategorySchema, 
  createMenuItemSchema,
  createItemVariantSchema,
  updateCategorySchema,
  updateMenuItemSchema,
  updateAdminStatusSchema,
  updateItemVariantSchema,
  createTagSchema,
  updateTagSchema,
  createMasterVariantSchema,
  updateMasterVariantSchema,
  createAdminSchema,
  updateAdminSchema
} from "../validators/admin.validator.js";
import { createOfferSchema, updateOfferSchema } from "../validators/offer.validator.js";

const router = Router();

// Public Admin Auth
router.post("/auth/login", validate(adminLoginSchema), adminController.login);

// Protected Admin Management Routes (Requires admin or superadmin privileges for mutation)

// --- Admin Status Routes ---
router.put(
  "/admins/:id/status",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(updateAdminStatusSchema),
  adminController.toggleAdminStatus
);

// --- Admin Management CRUD Routes ---
router.get(
  "/admins",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.getAdmins
);

router.post(
  "/admins",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(createAdminSchema),
  adminController.addAdmin
);

router.put(
  "/admins/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(updateAdminSchema),
  adminController.editAdmin
);

router.delete(
  "/admins/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.removeAdmin
);

router.get(
  "/roles",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.getRoles
);

// --- Category Routes ---
router.get(
  "/categories",
  protectAdmin,
  adminController.getCategories
);

router.post(
  "/categories", 
  protectAdmin, 
  restrictTo("admin", "superadmin"), 
  validate(createCategorySchema), 
  adminController.addCategory
);

router.put(
  "/categories/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(updateCategorySchema),
  adminController.editCategory
);

router.delete(
  "/categories/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.removeCategory
);

// --- Menu Item Routes ---
router.get(
  "/menu-items",
  protectAdmin,
  adminController.getMenuItems
);

router.post(
  "/menu-items", 
  protectAdmin, 
  restrictTo("admin", "superadmin"), 
  validate(createMenuItemSchema), 
  adminController.addMenuItem
);

router.put(
  "/menu-items/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(updateMenuItemSchema),
  adminController.editMenuItem
);

router.delete(
  "/menu-items/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.removeMenuItem
);

// --- Variant Routes ---
router.post(
  "/menu-items/variants", 
  protectAdmin, 
  restrictTo("admin", "superadmin"), 
  validate(createItemVariantSchema), 
  adminController.addItemVariant
);

router.put(
  "/menu-items/variants/:id", 
  protectAdmin, 
  restrictTo("admin", "superadmin"), 
  validate(updateItemVariantSchema), 
  adminController.editItemVariant
);

router.delete(
  "/menu-items/variants/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.removeItemVariant
);

// --- Tag Routes ---
router.get(
  "/tags",
  protectAdmin,
  adminController.getTags
);

router.post(
  "/tags",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(createTagSchema),
  adminController.addTag
);

router.put(
  "/tags/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(updateTagSchema),
  adminController.editTag
);

router.delete(
  "/tags/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.removeTag
);

// --- Master Variant Routes ---
router.get(
  "/variants",
  protectAdmin,
  adminController.getVariants
);

router.post(
  "/variants",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(createMasterVariantSchema),
  adminController.addVariant
);

router.put(
  "/variants/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(updateMasterVariantSchema),
  adminController.editVariant
);

router.delete(
  "/variants/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.removeVariant
);

// --- Order Routes ---
router.get(
  "/orders",
  protectAdmin,
  adminController.getOrders
);

router.get(
  "/orders/:id",
  protectAdmin,
  adminController.getOrder
);

router.put(
  "/orders/:id/status",
  protectAdmin,
  adminController.changeOrderStatus
);

// --- Customer Loyalty Management ---
router.get(
  "/users",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.getCustomers
);

router.post(
  "/users/:id/points",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.updateCustomerPoints
);

// --- Loyalty System Settings ---
router.get(
  "/settings",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.getSettings
);

router.put(
  "/settings",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.updateSettings
);

// --- Offer CRUD Routes ---
router.get(
  "/offers",
  protectAdmin,
  adminController.getOffers
);

router.post(
  "/offers",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(createOfferSchema),
  adminController.addOffer
);

router.put(
  "/offers/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  validate(updateOfferSchema),
  adminController.editOffer
);

router.delete(
  "/offers/:id",
  protectAdmin,
  restrictTo("admin", "superadmin"),
  adminController.removeOffer
);

export default router;
