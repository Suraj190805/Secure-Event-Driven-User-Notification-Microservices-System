const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");
const jwt = require("jsonwebtoken");

const app = express();

const {
  JWT_SECRET,
  INTERNAL_API_KEY,
  USER_SERVICE_URL,
  NOTIFICATION_SERVICE_URL,
} = process.env;

if (!JWT_SECRET || !INTERNAL_API_KEY) {
  console.error("FATAL: JWT_SECRET and INTERNAL_API_KEY must be set");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors());
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => res.json({ status: "ok", service: "gateway" }));

// ---------------------------------------------------------------------------
// Auth — issue JWT
// ---------------------------------------------------------------------------
app.use("/auth", express.json());

app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;

  // Hardcoded demo credentials — replace with real auth in production
  if (username === "admin" && password === "admin123") {
    const token = jwt.sign({ sub: "admin", role: "admin" }, JWT_SECRET, {
      expiresIn: "1h",
    });
    return res.json({ token });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

// ---------------------------------------------------------------------------
// JWT guard — all routes below require a valid token
// ---------------------------------------------------------------------------
const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed token" });
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

app.use("/api", authenticate);

// ---------------------------------------------------------------------------
// Proxy options factory — injects internal API key for downstream trust
// ---------------------------------------------------------------------------
const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader("x-internal-key", INTERNAL_API_KEY);
    },
  },
});

// ---------------------------------------------------------------------------
// Route proxying
// ---------------------------------------------------------------------------
app.use(
  createProxyMiddleware({
    ...proxyOptions(USER_SERVICE_URL),
    pathFilter: "/api/users",
  })
);

app.use(
  createProxyMiddleware({
    ...proxyOptions(NOTIFICATION_SERVICE_URL),
    pathFilter: "/api/notifications",
  })
);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error("Gateway error:", err.message);
  res.status(502).json({ error: "Bad gateway" });
});

module.exports = app;
