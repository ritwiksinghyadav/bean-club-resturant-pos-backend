import { logger } from "../utils/logger.js";

class WhatsAppService {
  /**
   * Send a generic WhatsApp notification
   * @param {string} phone - Recipient's phone number
   * @param {string} message - Message body
   */
  async sendNotification(phone, message) {
    // Mocking the WhatsApp API call.
    // In production, you would replace this with a call to Meta Cloud API, Twilio, or another WhatsApp Gateway.
    logger.info(`[MOCK WHATSAPP] Sending message to ${phone}:`);
    console.log(`----------------------------------------\n${message}\n----------------------------------------`);
    
    // Simulate API network latency
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    return { success: true, messageId: `msg_${Math.random().toString(36).substring(2, 11)}` };
  }

  /**
   * Send order completed notification to customer
   * @param {string} phone - Customer's phone number
   * @param {string} tokenNumber - Order token number (4-digit)
   * @param {string} orderId - Order uuid
   * @param {string} totalAmount - Total cost of the order
   */
  async sendOrderCompletedNotification(phone, tokenNumber, orderId, totalAmount) {
    const message = `☕ *Bean Club Notification* ☕\n\nYour order is completed and ready to serve!\n\n*Token Number:* ${tokenNumber}\n*Total Amount:* ₹${totalAmount}\n*Order ID:* ${orderId}\n\nThank you for dining with Bean Club! See you at the pickup counter.`;
    return this.sendNotification(phone, message);
  }
}

export const whatsAppService = new WhatsAppService();
