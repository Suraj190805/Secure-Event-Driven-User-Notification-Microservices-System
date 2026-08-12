process.env.INTERNAL_API_KEY = "test-internal-key";

const request = require("supertest");
const app = require("./app");
const nats = require("./nats");

// Mock NATS helper
jest.mock("./nats", () => {
  return {
    init: jest.fn().mockResolvedValue(null),
    publish: jest.fn().mockResolvedValue({ seq: 1 }),
    drain: jest.fn().mockResolvedValue(null),
  };
});

describe("User Service Tests", () => {
  const validHeaders = {
    "x-internal-key": "test-internal-key",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /health should return 200", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "user-service" });
  });

  test("GET /api/users should return 403 Forbidden if x-internal-key is missing", async () => {
    const res = await request(app).get("/api/users");
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  test("GET /api/users should return 403 Forbidden if x-internal-key is invalid", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("x-internal-key", "wrong-key");
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  test("POST /api/users should create a user and publish an event to NATS", async () => {
    const userData = { name: "Alice", email: "alice@example.com" };
    const res = await request(app)
      .post("/api/users")
      .set(validHeaders)
      .send(userData);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe(userData.name);
    expect(res.body.email).toBe(userData.email);
    expect(res.body).toHaveProperty("createdAt");

    // Check that NATS publish was called with the correct event details
    expect(nats.publish).toHaveBeenCalledTimes(1);
    expect(nats.publish).toHaveBeenCalledWith("user.created", {
      id: res.body.id,
      name: userData.name,
      email: userData.email,
      createdAt: res.body.createdAt,
    });
  });

  test("POST /api/users should return 400 Bad Request if fields are invalid", async () => {
    const res = await request(app)
      .post("/api/users")
      .set(validHeaders)
      .send({ email: "invalid-email" }); // missing name, invalid email format

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("error", "Validation failed");
    expect(res.body).toHaveProperty("details");
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  test("POST /api/users should return 409 Conflict if email already exists", async () => {
    // Alice was created in the previous test. Let's try creating another user with the same email.
    const userData = { name: "Alice Duplicate", email: "alice@example.com" };
    const res = await request(app)
      .post("/api/users")
      .set(validHeaders)
      .send(userData);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: "Email already exists" });
  });

  test("GET /api/users should list all created users", async () => {
    const res = await request(app).get("/api/users").set(validHeaders);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((u) => u.email === "alice@example.com")).toBe(true);
  });

  test("GET /api/users/:id should return 404 for non-existent user", async () => {
    const res = await request(app)
      .get("/api/users/non-existent-uuid")
      .set(validHeaders);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "User not found" });
  });

  test("GET /api/users/:id should return user by ID", async () => {
    // Let's create a new user to retrieve
    const userData = { name: "Bob", email: "bob@example.com" };
    const createRes = await request(app)
      .post("/api/users")
      .set(validHeaders)
      .send(userData);
    const userId = createRes.body.id;

    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set(validHeaders);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(userId);
    expect(res.body.name).toBe(userData.name);
    expect(res.body.email).toBe(userData.email);
  });
});
