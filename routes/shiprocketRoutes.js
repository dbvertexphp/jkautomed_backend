const express = require("express");
const { checkServiceability } = require("../controllers/shiprocketControllers.js");

const shiprocketRoutes = express.Router();

shiprocketRoutes.get("/serviceability", checkServiceability);

module.exports = { shiprocketRoutes };
