const express = require("express");

const { createOrder } = require("../controllers/orderController");

const orderRoutes = express.Router();
orderRoutes.post("/create-order", createOrder);

module.exports = orderRoutes;