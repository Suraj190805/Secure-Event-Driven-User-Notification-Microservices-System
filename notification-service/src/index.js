const app = require("./app");
const nats = require("./nats");
const notificationService = require("./services/notification.service");
const PORT = process.env.PORT || 3002;

async function start() {
  // Initialize NATS and subscribe — route events to the service handler
  await nats.init((subject, data) => {
    notificationService.handleEvent(subject, data);
  });

  app.listen(PORT, () =>
    console.log(`Notification Service listening on port ${PORT}`)
  );
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down…");
  await nats.drain();
  process.exit(0);
});

start().catch((err) => {
  console.error("Failed to start Notification Service:", err);
  process.exit(1);
});
