import * as adminService from "../services/admin.service.js";
import { ApiResponse } from "../utils/response.js";

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const data = await adminService.loginAdmin({ email, password });
    return ApiResponse.success(res, data, 200, "Admin logged in successfully");
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

