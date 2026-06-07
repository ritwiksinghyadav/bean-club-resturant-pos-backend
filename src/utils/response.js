/**
 * Standardized API Response helper class
 */
export class ApiResponse {
  /**
   * Send a success response
   * @param {object} res - Express response object
   * @param {any} result - Response payload (result)
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Optional success message
   */
  static success(res, result = null, statusCode = 200, message = undefined) {
    const responseBody = {
      success: true,
      statusCode,
      result,
    };

    if (message !== undefined) {
      responseBody.message = message;
    }

    return res.status(statusCode).json(responseBody);
  }

  /**
   * Send an error response
   * @param {object} res - Express response object
   * @param {string} message - Error description
   * @param {number} statusCode - HTTP status code
   * @param {any} errors - Detailed validation/operational errors array or object
   */
  static error(res, message = "Error occurred", statusCode = 500, errors = null) {
    const responseBody = {
      success: false,
      statusCode,
      message,
    };
    
    if (errors !== null) {
      responseBody.errors = errors;
    }
    
    return res.status(statusCode).json(responseBody);
  }
}
