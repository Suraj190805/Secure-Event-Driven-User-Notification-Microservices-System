const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const nats = require("../nats");

// In-memory user store
const users = new Map();

// Validation schema
const createUserSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().email().required(),
});

/**
 * Create a user and publish a `user.created` event via NATS.
 */
async function createUser(data) {
  const { error, value } = createUserSchema.validate(data, {
    abortEarly: false,
  });
  if (error) {
    const err = new Error("Validation failed");
    err.status = 400;
    err.details = error.details.map((d) => d.message);
    throw err;
  }

  // Check for duplicate email
  for (const user of users.values()) {
    if (user.email === value.email) {
      const err = new Error("Email already exists");
      err.status = 409;
      throw err;
    }
  }

  const user = {
    id: uuidv4(),
    name: value.name,
    email: value.email,
    createdAt: new Date().toISOString(),
  };

  users.set(user.id, user);

  // Publish event — Notification Service subscribes to this
  await nats.publish("user.created", {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  });

  return user;
}

/**
 * Retrieve a single user by ID.
 */
function getUserById(id) {
  return users.get(id) || null;
}

/**
 * List all users.
 */
function listUsers() {
  return Array.from(users.values());
}

module.exports = { createUser, getUserById, listUsers };
