const express = require("express");
const { checkServiceability,createShiprocketOrder } = require("../controllers/shiprocketControllers.js");

const shiprocketRoutes = express.Router();

shiprocketRoutes.get("/serviceability", checkServiceability);
shiprocketRoutes.post("/create-order", createShiprocketOrder);

module.exports = { shiprocketRoutes };
