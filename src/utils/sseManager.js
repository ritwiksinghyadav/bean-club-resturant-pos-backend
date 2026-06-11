import { logger } from "./logger.js";

class SSEManager {
  constructor() {
    this.adminClients = new Set();
    this.userClients = new Map(); // userId -> Set of res objects

    // Start heartbeat to keep connections alive (every 30 seconds)
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  /**
   * Registers a new admin connection
   */
  addAdmin(res) {
    this.adminClients.add(res);
    logger.info(`Admin client connected. Total admins: ${this.adminClients.size}`);

    // Send initial ping/connection confirmation
    this.sendEvent(res, "connected", { role: "admin" });
  }

  /**
   * Unregisters an admin connection
   */
  removeAdmin(res) {
    if (this.adminClients.has(res)) {
      this.adminClients.delete(res);
      logger.info(`Admin client disconnected. Total admins: ${this.adminClients.size}`);
    }
  }

  /**
   * Registers a new customer connection
   */
  addUser(userId, res) {
    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }
    this.userClients.get(userId).add(res);
    logger.info(`User client connected (UserId: ${userId}). Total sessions for user: ${this.userClients.get(userId).size}`);

    // Send initial connection confirmation
    this.sendEvent(res, "connected", { role: "customer", userId });
  }

  /**
   * Unregisters a customer connection
   */
  removeUser(userId, res) {
    const userSessions = this.userClients.get(userId);
    if (userSessions) {
      userSessions.delete(res);
      logger.info(`User client disconnected (UserId: ${userId}). Remaining sessions: ${userSessions.size}`);
      if (userSessions.size === 0) {
        this.userClients.delete(userId);
      }
    }
  }

  /**
   * Sends SSE event to a specific response object
   */
  sendEvent(res, event, data) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error("Error writing SSE event to client connection:", error);
    }
  }

  /**
   * Broadcasts an event to all connected admin panels
   */
  broadcastToAdmins(event, data) {
    logger.debug(`Broadcasting SSE event '${event}' to ${this.adminClients.size} admins.`);
    for (const res of this.adminClients) {
      this.sendEvent(res, event, data);
    }
  }

  /**
   * Sends an event to all open connections of a specific user
   */
  sendToUser(userId, event, data) {
    const userSessions = this.userClients.get(userId);
    if (userSessions && userSessions.size > 0) {
      logger.debug(`Sending SSE event '${event}' to user ${userId} (${userSessions.size} sessions).`);
      for (const res of userSessions) {
        this.sendEvent(res, event, data);
      }
    } else {
      logger.debug(`Attempted to send SSE event to user ${userId}, but user is not online.`);
    }
  }

  /**
   * Sends heartbeat/ping comments to keep HTTP connections alive
   */
  sendHeartbeat() {
    // A comment line starting with ':' is ignored by EventSource on frontend but keeps connection alive
    const comment = ": keepalive\n\n";

    for (const res of this.adminClients) {
      try {
        res.write(comment);
      } catch (err) {
        this.removeAdmin(res);
      }
    }

    for (const [userId, sessions] of this.userClients.entries()) {
      for (const res of sessions) {
        try {
          res.write(comment);
        } catch (err) {
          this.removeUser(userId, res);
        }
      }
    }
  }

  /**
   * Cleanup interval on server shutdown
   */
  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    logger.info("SSEManager destroyed.");
  }
}

export const sseManager = new SSEManager();
