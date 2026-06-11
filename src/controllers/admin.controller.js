import * as adminService from "../services/admin.service.js";
import { ApiResponse } from "../utils/response.js";
import { sseManager } from "../utils/sseManager.js";

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const data = await adminService.loginAdmin({ email, password });
    return ApiResponse.success(res, data, 200, "Admin logged in successfully");
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const data = await adminService.refreshAdminToken({ refreshToken });
    return ApiResponse.success(res, data, 200, "Admin token refreshed successfully");
  } catch (error) {
    next(error);
  }
};

export const addCategory = async (req, res, next) => {
  try {
    const category = await adminService.createCategory(req.body);
    return ApiResponse.success(res, { category }, 201, "Category created successfully");
  } catch (error) {
    next(error);
  }
};

export const addMenuItem = async (req, res, next) => {
  try {
    const menuItem = await adminService.createMenuItem(req.body);
    return ApiResponse.success(res, { menuItem }, 201, "Menu item created successfully");
  } catch (error) {
    next(error);
  }
};

export const addItemVariant = async (req, res, next) => {
  try {
    const itemVariant = await adminService.createItemVariant(req.body);
    return ApiResponse.success(res, { itemVariant }, 201, "Item variant created successfully");
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const data = await adminService.getCategories(req.query);
    return ApiResponse.success(res, data, 200, "Categories retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const editCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await adminService.updateCategory(id, req.body);
    return ApiResponse.success(res, { category }, 200, "Category updated successfully");
  } catch (error) {
    next(error);
  }
};

export const removeCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteCategory(id);
    return ApiResponse.success(res, result, 200, "Category deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const getMenuItems = async (req, res, next) => {
  try {
    const data = await adminService.getMenuItems(req.query);
    return ApiResponse.success(res, data, 200, "Menu items retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const editMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const menuItem = await adminService.updateMenuItem(id, req.body);
    return ApiResponse.success(res, { menuItem }, 200, "Menu item updated successfully");
  } catch (error) {
    next(error);
  }
};

export const removeMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteMenuItem(id);
    return ApiResponse.success(res, result, 200, "Menu item deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const removeItemVariant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteItemVariant(id);
    return ApiResponse.success(res, result, 200, "Item variant deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const toggleAdminStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;
    const { isActive } = req.body;
    const admin = await adminService.updateAdminStatus(id, requesterId, { isActive });
    return ApiResponse.success(res, { admin }, 200, `Admin status updated successfully`);
  } catch (error) {
    next(error);
  }
};

export const editItemVariant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const itemVariant = await adminService.updateItemVariant(id, req.body);
    return ApiResponse.success(res, { itemVariant }, 200, "Item variant updated successfully");
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// TAG CONTROLLERS
// =========================================================================

export const addTag = async (req, res, next) => {
  try {
    const tag = await adminService.createTag(req.body);
    return ApiResponse.success(res, { tag }, 201, "Tag created successfully");
  } catch (error) {
    next(error);
  }
};

export const getTags = async (req, res, next) => {
  try {
    const data = await adminService.getTags(req.query);
    return ApiResponse.success(res, data, 200, "Tags retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const editTag = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tag = await adminService.updateTag(id, req.body);
    return ApiResponse.success(res, { tag }, 200, "Tag updated successfully");
  } catch (error) {
    next(error);
  }
};

export const removeTag = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteTag(id);
    return ApiResponse.success(res, result, 200, "Tag deleted successfully");
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// MASTER VARIANT CONTROLLERS
// =========================================================================

export const addVariant = async (req, res, next) => {
  try {
    const variant = await adminService.createVariant(req.body);
    return ApiResponse.success(res, { variant }, 201, "Master variant created successfully");
  } catch (error) {
    next(error);
  }
};

export const getVariants = async (req, res, next) => {
  try {
    const data = await adminService.getVariants(req.query);
    return ApiResponse.success(res, data, 200, "Master variants retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const editVariant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const variant = await adminService.updateVariant(id, req.body);
    return ApiResponse.success(res, { variant }, 200, "Master variant updated successfully");
  } catch (error) {
    next(error);
  }
};

export const removeVariant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteVariant(id);
    return ApiResponse.success(res, result, 200, "Master variant deleted successfully");
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// ADMIN CRUD CONTROLLERS
// =========================================================================

export const getAdmins = async (req, res, next) => {
  try {
    const data = await adminService.getAdmins(req.query);
    return ApiResponse.success(res, data, 200, "Administrators retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const addAdmin = async (req, res, next) => {
  try {
    const admin = await adminService.createAdmin(req.body);
    return ApiResponse.success(res, { admin }, 201, "Administrator created successfully");
  } catch (error) {
    next(error);
  }
};

export const editAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;
    const admin = await adminService.updateAdmin(id, requesterId, req.body);
    return ApiResponse.success(res, { admin }, 200, "Administrator updated successfully");
  } catch (error) {
    next(error);
  }
};

export const removeAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;
    const result = await adminService.deleteAdmin(id, requesterId);
    return ApiResponse.success(res, result, 200, "Administrator deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const getRoles = async (req, res, next) => {
  try {
    const rolesList = await adminService.getRoles();
    return ApiResponse.success(res, { roles: rolesList }, 200, "Roles retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (req, res, next) => {
  try {
    const data = await adminService.getAdminOrders(req.query);
    return ApiResponse.success(res, data, 200, "Orders retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await adminService.getOrderById(id);
    return ApiResponse.success(res, { order }, 200, "Order retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const changeOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await adminService.updateOrderStatus(id, { status });
    return ApiResponse.success(res, { order }, 200, "Order status updated successfully");
  } catch (error) {
    next(error);
  }
};

export const streamOrders = async (req, res, next) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    sseManager.addAdmin(res);

    req.on("close", () => {
      sseManager.removeAdmin(res);
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const data = await adminService.getCustomers(req.query);
    return ApiResponse.success(res, data, 200, "Customers retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const updateCustomerPoints = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { points, description } = req.body;
    const result = await adminService.adjustCustomerPoints(id, { points, description });
    return ApiResponse.success(res, result, 200, "Customer loyalty points adjusted successfully");
  } catch (error) {
    next(error);
  }
};

export const getSettings = async (req, res, next) => {
  try {
    const data = await adminService.getSettings();
    return ApiResponse.success(res, data, 200, "Loyalty points settings retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const { earningRatioPercentage, maxEarningPoints } = req.body;
    const data = await adminService.updateSettings({ earningRatioPercentage, maxEarningPoints });
    return ApiResponse.success(res, data, 200, "Loyalty points settings updated successfully");
  } catch (error) {
    next(error);
  }
};

export const addOffer = async (req, res, next) => {
  try {
    const offer = await adminService.createOffer(req.body);
    return ApiResponse.success(res, { offer }, 201, "Offer created successfully");
  } catch (error) {
    next(error);
  }
};

export const getOffers = async (req, res, next) => {
  try {
    const data = await adminService.getOffers(req.query);
    return ApiResponse.success(res, data, 200, "Offers retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const editOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const offer = await adminService.updateOffer(id, req.body);
    return ApiResponse.success(res, { offer }, 200, "Offer updated successfully");
  } catch (error) {
    next(error);
  }
};

export const removeOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteOffer(id);
    return ApiResponse.success(res, result, 200, "Offer deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const createOrderOnBehalf = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const orderData = await adminService.createOrderOnBehalf(adminId, req.body);
    return ApiResponse.success(res, orderData, 201, "Order placed successfully on behalf of customer");
  } catch (error) {
    next(error);
  }
};


