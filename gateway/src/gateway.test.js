process.env.JWT_SECRET = "test-jwt-secret";
process.env.INTERNAL_API_KEY = "test-internal-key";
process.env.USER_SERVICE_URL = "http://localhost:3001";
process.env.NOTIFICATION_SERVICE_URL = "http://localhost:3002";

const request = require("supertest");
const app = require("./app");
const jwt = require("jsonwebtoken");

jest.mock("http-proxy-middleware", () => {
  return {
    createProxyMiddleware: jest.fn().mockImplementation((config) => {
      return (req, res, next) => {
        if (config.pathFilter && !req.url.startsWith(config.pathFilter)) {
          return next();
        }
        let internalKey = null;
        if (config.on && config.on.proxyReq) {
          const mockProxyReq = {
            setHeader: (key, val) => {
              if (key.toLowerCase() === "x-internal-key") {
                internalKey = val;
              }
            },
          };
          config.on.proxyReq(mockProxyReq, req, res);
        }
        res.status(200).json({
          proxied: true,
          target: config.target,
          internalKeyUsed: internalKey,
        });
      };
    }),
  };
});

describe("API Gateway Tests", () => {
  test("GET /health should return 200 and health status", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "gateway" });
  });

  test("POST /auth/login with valid credentials should return a token", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "admin", password: "admin123" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.sub).toBe("admin");
  });

  test("POST /auth/login with invalid credentials should return 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "admin", password: "wrongpassword" });
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty("error", "Invalid credentials");
  });

  test("Protected routes should return 401 without Bearer token", async () => {
    const res = await request(app).get("/api/users");
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty("error", "Missing or malformed token");
  });

  test("Protected routes should return 401 with invalid Bearer token", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer invalidtoken");
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty("error", "Invalid or expired token");
  });

  test("GET /api/users with valid token should proxy and inject x-internal-key", async () => {
    const token = jwt.sign({ sub: "admin" }, process.env.JWT_SECRET);
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.proxied).toBe(true);
    expect(res.body.target).toBe(process.env.USER_SERVICE_URL);
    expect(res.body.internalKeyUsed).toBe(process.env.INTERNAL_API_KEY);
  });

  test("GET /api/notifications with valid token should proxy and inject x-internal-key", async () => {
    const token = jwt.sign({ sub: "admin" }, process.env.JWT_SECRET);
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.proxied).toBe(true);
    expect(res.body.target).toBe(process.env.NOTIFICATION_SERVICE_URL);
    expect(res.body.internalKeyUsed).toBe(process.env.INTERNAL_API_KEY);
  });
});
