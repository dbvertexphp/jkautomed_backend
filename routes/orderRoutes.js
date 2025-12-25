const express = require("express");
const protect = require("../middleware/authMiddleware.js");
const { createOrder,getOrdersByUserId } = require("../controllers/orderController");

const orderRoutes = express.Router();
orderRoutes.post("/create-order", protect,createOrder);
orderRoutes.get("/get-orders/:user_id", protect,getOrdersByUserId);
module.exports = orderRoutes;