import { whatsAppService } from "../services/whatsapp.service.js";
import { logger } from "../utils/logger.js";

// Mock whatsappQueue to bypass BullMQ and execute whatsAppService directly
export const whatsappQueue = {
  add: async (name, data) => {
    logger.info(`[MOCK QUEUE] Intercepted queue add for '${name}'`);
    if (name === "order_completed") {
      const { phone, tokenNumber, orderId, totalAmount } = data;
      if (phone) {
        // Direct invocation of the WhatsApp notification service
        await whatsAppService.sendOrderCompletedNotification(phone, tokenNumber, orderId, totalAmount);
      } else {
        logger.warn(`[MOCK QUEUE] Cannot notify: customer has no phone number for order ${orderId}`);
      }
    }
    return { id: `mock-whatsapp-job-${Date.now()}` };
  }
};

