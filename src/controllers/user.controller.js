import * as userService from "../services/user.service.js";
import { ApiResponse } from "../utils/response.js";

export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await userService.getUserById(userId);
    return ApiResponse.success(res, { user }, 200, "User profile retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updatedUser = await userService.updateUserProfile(userId, req.body);
    return ApiResponse.success(res, { user: updatedUser }, 200, "Profile updated successfully");
  } catch (error) {
    next(error);
  }
};
