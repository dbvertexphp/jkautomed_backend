// routes/notificationRoutes.js
const express = require("express");
const { getTeacherNotifications } = require("../controllers/orderNotificationController.js");
const protect = require("../middleware/authMiddleware.js");

const orderNotificationsRoutes = express.Router();

// GET notifications for a user
orderNotificationsRoutes.route("/getTeacherNotifications").get( getTeacherNotifications);

module.exports = { orderNotificationsRoutes };
