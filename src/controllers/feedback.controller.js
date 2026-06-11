import * as feedbackService from "../services/feedback.service.js";
import { ApiResponse } from "../utils/response.js";

export const submitFeedback = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { subject, description, rating } = req.body;
    const feedback = await feedbackService.submitFeedback({
      userId,
      subject,
      description,
      rating,
    });
    return ApiResponse.success(res, { feedback }, 201, "Feedback submitted successfully");
  } catch (error) {
    next(error);
  }
};

export const getFeedbacks = async (req, res, next) => {
  try {
    const data = await feedbackService.getAllFeedbacks(req.query);
    return ApiResponse.success(res, data, 200, "Feedbacks retrieved successfully");
  } catch (error) {
    next(error);
  }
};

export const deleteFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await feedbackService.deleteFeedback(id);
    return ApiResponse.success(res, result, 200, "Feedback deleted successfully");
  } catch (error) {
    next(error);
  }
};
