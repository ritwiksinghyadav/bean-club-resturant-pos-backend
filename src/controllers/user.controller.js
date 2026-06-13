import * as userService from "../services/user.service.js";
import * as authService from "../services/auth.service.js";
import { ApiResponse } from "../utils/response.js";
import { sseManager } from "../utils/sseManager.js";
import { BadRequestError } from "../utils/errors.js";

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

export const getMenu = async (req, res, next) => {
  try {
    const menu = await userService.getCustomerMenu();
    return ApiResponse.success(res, { menu }, 200, "Menu retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const loginCustomer = async (req, res, next) => {
  try {
    const { name, phoneNumber } = req.body;
    const authData = await authService.loginOrRegisterCustomer({ name, phoneNumber });
    return ApiResponse.success(res, authData, 200, "Customer authenticated successfully");
  } catch (error) {
    next(error);
  }
};

export const refreshCustomerToken = async (req, res, next) => {
  try {
    let refreshToken;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      refreshToken = req.headers.authorization.split(" ")[1];
    }
    if (!refreshToken) {
      throw new BadRequestError("Refresh token is required in Authorization header");
    }
    const authData = await authService.refreshCustomerToken({ refreshToken });
    return ApiResponse.success(res, authData, 200, "Customer token refreshed successfully");
  } catch (error) {
    next(error);
  }
};

export const placeOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { items, pointsRedeemed, offerCode, type } = req.body;
    const orderData = await userService.placeCustomerOrder(userId, items, pointsRedeemed, offerCode, type);
    return ApiResponse.success(res, orderData, 201, "Order placed successfully");
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orders = await userService.getCustomerOrders(userId);
    return ApiResponse.success(res, { orders }, 200, "Orders retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const streamOrderUpdates = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    sseManager.addUser(userId, res);

    req.on("close", () => {
      sseManager.removeUser(userId, res);
    });
  } catch (error) {
    next(error);
  }
};

export const getLoyaltyLedger = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loyalty = await userService.getCustomerLoyalty(userId);
    return ApiResponse.success(res, loyalty, 200, "Loyalty points ledger retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const getOffers = async (req, res, next) => {
  try {
    const offers = await userService.getActiveOffers();
    return ApiResponse.success(res, { offers }, 200, "Active offers retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const validateOffer = async (req, res, next) => {
  try {
    const { code, billAmount } = req.body;
    const data = await userService.validateOfferCode(code, billAmount);
    return ApiResponse.success(res, data, 200, "Offer validated successfully");
  } catch (error) {
    next(error);
  }
};

export const sendCustomerOTP = async (req, res, next) => {
  try {
    const { phoneNumber, name, mode } = req.body;
    const result = await authService.sendCustomerOtp({ phoneNumber, name, mode });
    return ApiResponse.success(res, result, 200, "OTP sent successfully");
  } catch (error) {
    next(error);
  }
};

export const verifyCustomerOTP = async (req, res, next) => {
  try {
     const { phoneNumber, name, code, mode } = req.body;
     const authData = await authService.verifyCustomerOtp({ phoneNumber, name, code, mode });
     return ApiResponse.success(res, authData, 200, "Customer authenticated successfully");
  } catch (error) {
    next(error);
  }
};

export const sendChangePhoneOTP = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { newPhoneNumber } = req.body;
    const result = await authService.sendChangePhoneOtp(userId, { newPhoneNumber });
    return ApiResponse.success(res, result, 200, "Change phone OTP sent successfully");
  } catch (error) {
    next(error);
  }
};

export const verifyChangePhoneOTP = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;
    const user = await authService.verifyChangePhoneOtp(userId, { code });
    return ApiResponse.success(res, { user }, 200, "Phone number updated successfully");
  } catch (error) {
    next(error);
  }
};


