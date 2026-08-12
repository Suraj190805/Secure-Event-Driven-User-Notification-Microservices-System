const { Router } = require("express");
const controller = require("../controllers/user.controller");

const router = Router();

router.post("/", controller.createUser);
router.get("/", controller.listUsers);
router.get("/:id", controller.getUserById);

module.exports = router;
