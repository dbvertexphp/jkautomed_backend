const express = require("express");
const protect = require("../middleware/authMiddleware.js");
const { createOrder,getOrdersByUserId } = require("../controllers/orderController");

const orderRoutes = express.Router();
orderRoutes.post("/create-order", createOrder);
orderRoutes.get("/get-orders/:user_id", getOrdersByUserId);
module.exports = orderRoutes;