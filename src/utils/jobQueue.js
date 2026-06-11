import { PgBoss } from "pg-boss";
import { env } from "../config/env.js";
import { logger } from "./logger.js";
import { sseManager } from "./sseManager.js";
import { whatsAppService } from "../services/whatsapp.service.js";

class JobQueue {
  constructor() {
    this.boss = new PgBoss({
      connectionString: env.DATABASE_URL,
    });
    this.initialized = false;
  }

  /**
   * Initialize and start the pg-boss queue
   */
  async start() {
    if (this.initialized) return;
    try {
      this.boss.on("error", (error) => logger.error("pg-boss queue error:", error));
      await this.boss.start();
      this.initialized = true;
      logger.info("pg-boss job queue started and database schema initialized.");

      // Register worker handlers
      await this.registerWorkers();
    } catch (error) {
      logger.error("Failed to start pg-boss job queue:", error);
      throw error;
    }
  }

  /**
   * Gracefully stop the queue
   */
  async stop() {
    if (!this.initialized) return;
    try {
      await this.boss.stop();
      this.initialized = false;
      logger.info("pg-boss job queue stopped.");
    } catch (error) {
      logger.error("Failed to stop pg-boss job queue:", error);
    }
  }

  /**
   * Publish a job to the background queue
   * @param {string} name - The name of the queue/job type
   * @param {object} data - Payload data for the job
   * @param {object} options - Custom publish options
   */
  async publish(name, data, options = {}) {
    if (!this.initialized) {
      logger.warn(`Job queue was not started. Auto-starting before publishing: ${name}`);
      await this.start();
    }

    const defaultOptions = {
      retryLimit: 3,
      retryBackoff: true,
      retryDelay: 10, // Try again after 10s initially
      ...options,
    };

    try {
      const jobId = await this.boss.send(name, data, defaultOptions);
      logger.info(`Job published successfully: '${name}' (Job ID: ${jobId})`);
      return jobId;
    } catch (error) {
      logger.error(`Error publishing job '${name}':`, error);
      throw error;
    }
  }

  /**
   * Register job consumers/workers
   */
  async registerWorkers() {
    // Create queues first to prevent "Queue does not exist" warnings/errors in pg-boss
    try {
      await this.boss.createQueue("order.new");
      await this.boss.createQueue("order.status_changed");
      await this.boss.createQueue("whatsapp.order_completed");
    } catch (err) {
      logger.error("Error creating queues in pg-boss:", err);
    }

    // 1. Broadcast new order to admins
    await this.boss.work("order.new", async (jobs) => {
      for (const job of jobs) {
        const { data } = job;
        logger.info(`Worker picked up 'order.new' for order: ${data.id}`);
        sseManager.broadcastToAdmins("new_order", data);
      }
    });

    // 2. Send order status change to specific customer
    await this.boss.work("order.status_changed", async (jobs) => {
      for (const job of jobs) {
        const { orderId, userId, status, tokenNumber } = job.data;
        logger.info(`Worker picked up 'order.status_changed' for order: ${orderId} (Status: ${status})`);
        sseManager.sendToUser(userId, "order_status_changed", { orderId, status, tokenNumber });
      }
    });

    // 3. Send WhatsApp confirmation on completed order
    await this.boss.work("whatsapp.order_completed", async (jobs) => {
      for (const job of jobs) {
        const { phone, tokenNumber, orderId, totalAmount } = job.data;
        logger.info(`Worker picked up 'whatsapp.order_completed' for order: ${orderId}`);
        if (!phone) {
          logger.warn(`Skipping WhatsApp message. No phone number for order: ${orderId}`);
          continue;
        }
        await whatsAppService.sendOrderCompletedNotification(phone, tokenNumber, orderId, totalAmount);
      }
    });
  }
}

export const jobQueue = new JobQueue();
