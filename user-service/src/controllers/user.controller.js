const userService = require("../services/user.service");

async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json(user);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: err.message,
        ...(err.details && { details: err.details }),
      });
    }
    next(err);
  }
}

function getUserById(req, res) {
  const user = userService.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(user);
}

function listUsers(_req, res) {
  return res.json(userService.listUsers());
}

module.exports = { createUser, getUserById, listUsers };
