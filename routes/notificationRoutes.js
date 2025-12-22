const express = require("express");
const { getUserNotifications} = require("../controllers/notificationController.js");

// const shiprocketRoutes = express.Router();
const notificationRoutes = express.Router();

notificationRoutes.get("/getnotifications/:user_id", getUserNotifications);

// shiprocketRoutes.get("/serviceability", checkServiceability);
// shiprocketRoutes.post("/create-order", createShiprocketOrder);
// shiprocketRoutes.post("/track-order", trackAndUpdateOrderStatus);

module.exports = { notificationRoutes };
