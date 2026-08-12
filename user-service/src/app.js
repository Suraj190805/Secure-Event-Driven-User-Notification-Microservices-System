const express = require("express");
const helmet = require("helmet");
const verifyInternalKey = require("./middleware/auth");
const userRoutes = require("./routes/user.routes");

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(express.json());

// ---------------------------------------------------------------------------
// Health (no auth required)
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => res.json({ status: "ok", service: "user-service" }));

// ---------------------------------------------------------------------------
// Routes — all behind internal API key guard
// ---------------------------------------------------------------------------
app.use("/api/users", verifyInternalKey, userRoutes);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
