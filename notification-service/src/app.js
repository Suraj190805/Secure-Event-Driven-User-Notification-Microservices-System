const express = require("express");
const helmet = require("helmet");
const verifyInternalKey = require("./middleware/auth");
const notificationRoutes = require("./routes/notification.routes");

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(express.json());

// ---------------------------------------------------------------------------
// Health (no auth required)
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) =>
  res.json({ status: "ok", service: "notification-service" })
);

// ---------------------------------------------------------------------------
// Routes — all behind internal API key guard
// ---------------------------------------------------------------------------
app.use("/api/notifications", verifyInternalKey, notificationRoutes);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
