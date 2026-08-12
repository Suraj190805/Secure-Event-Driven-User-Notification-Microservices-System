const app = require("./app");
const nats = require("./nats");
const PORT = process.env.PORT || 3001;

async function start() {
  await nats.init();
  app.listen(PORT, () => console.log(`User Service listening on port ${PORT}`));
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down…");
  await nats.drain();
  process.exit(0);
});

start().catch((err) => {
  console.error("Failed to start User Service:", err);
  process.exit(1);
});
