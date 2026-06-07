import * as authService from "../services/auth.service.js";
import { ApiResponse } from "../utils/response.js";

export const register = async (req, res, next) => {
  try {
    const user = await authService.registerUser(req.body);
    return ApiResponse.success(res, { user }, 201, "User registered successfully");
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const data = await authService.loginUser({ email, password });
    return ApiResponse.success(res, data, 200, "User logged in successfully");
  } catch (error) {
    next(error);
  }
};
