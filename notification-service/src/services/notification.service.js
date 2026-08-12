const { v4: uuidv4 } = require("uuid");

// In-memory notification store
const notifications = new Map();

/**
 * Handle an incoming NATS event and create a notification.
 */
function handleEvent(subject, data) {
  switch (subject) {
    case "user.created": {
      const notification = {
        id: uuidv4(),
        type: "WELCOME",
        userId: data.id,
        message: `Welcome, ${data.name}! Your account (${data.email}) has been created.`,
        createdAt: new Date().toISOString(),
      };
      notifications.set(notification.id, notification);
      console.log(`[Notification] Created: ${notification.message}`);
      break;
    }
    default:
      console.warn(`[Notification] Unknown event subject: ${subject}`);
  }
}

/**
 * List all notifications.
 */
function listNotifications() {
  return Array.from(notifications.values());
}

module.exports = { handleEvent, listNotifications };
