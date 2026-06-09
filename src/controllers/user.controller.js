import * as userService from "../services/user.service.js";
import * as authService from "../services/auth.service.js";
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

export const placeOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { items, pointsRedeemed, offerCode } = req.body;
    const orderData = await userService.placeCustomerOrder(userId, items, pointsRedeemed, offerCode);
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
