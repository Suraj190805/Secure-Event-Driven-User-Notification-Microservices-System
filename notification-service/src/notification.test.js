process.env.INTERNAL_API_KEY = "test-internal-key";

const request = require("supertest");
const app = require("./app");
const notificationService = require("./services/notification.service");

// Mock NATS helper
jest.mock("./nats", () => {
  return {
    init: jest.fn().mockResolvedValue(null),
    drain: jest.fn().mockResolvedValue(null),
  };
});

describe("Notification Service Tests", () => {
  const validHeaders = {
    "x-internal-key": "test-internal-key",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /health should return 200", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "notification-service" });
  });

  test("GET /api/notifications should return 403 Forbidden if x-internal-key is missing", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  test("GET /api/notifications should return 403 Forbidden if x-internal-key is invalid", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("x-internal-key", "wrong-key");
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  test("Should handle user.created event and return notification via API", async () => {
    const eventData = {
      id: "test-user-id",
      name: "Alice",
      email: "alice@example.com",
    };

    // Simulate NATS triggering the event handler
    notificationService.handleEvent("user.created", eventData);

    // Call the API to list notifications
    const res = await request(app)
      .get("/api/notifications")
      .set(validHeaders);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    
    // Check that our simulated notification exists
    const welcomeNotification = res.body.find(
      (n) => n.userId === eventData.id && n.type === "WELCOME"
    );
    expect(welcomeNotification).toBeDefined();
    expect(welcomeNotification.message).toContain("Welcome, Alice!");
    expect(welcomeNotification.message).toContain("alice@example.com");
  });

  test("Should log warning on unknown event subject", async () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    
    notificationService.handleEvent("unknown.event", {});
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Notification] Unknown event subject: unknown.event")
    );
    
    consoleWarnSpy.mockRestore();
  });
});
