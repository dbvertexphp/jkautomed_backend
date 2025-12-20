const express = require("express");
const { checkServiceability,createShiprocketOrder,trackAndUpdateOrderStatus, } = require("../controllers/shiprocketControllers.js");

const shiprocketRoutes = express.Router();

shiprocketRoutes.get("/serviceability", checkServiceability);
shiprocketRoutes.post("/create-order", createShiprocketOrder);
shiprocketRoutes.post("/track-order", trackAndUpdateOrderStatus);

module.exports = { shiprocketRoutes };
