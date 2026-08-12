const { Router } = require("express");
const controller = require("../controllers/notification.controller");

const router = Router();

router.get("/", controller.listNotifications);

module.exports = router;
