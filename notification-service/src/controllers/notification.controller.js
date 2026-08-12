const notificationService = require("../services/notification.service");

function listNotifications(_req, res) {
  return res.json(notificationService.listNotifications());
}

module.exports = { listNotifications };
