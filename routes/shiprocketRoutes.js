const express = require("express");
const { checkServiceability,createShiprocketOrder,trackAndUpdateOrderStatus,assignAwbAndUpdateOrder } = require("../controllers/shiprocketControllers.js");

const shiprocketRoutes = express.Router();

shiprocketRoutes.get("/serviceability", checkServiceability);
shiprocketRoutes.post("/create-order", createShiprocketOrder);
shiprocketRoutes.post("/track-order", trackAndUpdateOrderStatus);
shiprocketRoutes.post("/assign-awb", assignAwbAndUpdateOrder);

module.exports = { shiprocketRoutes };
