const express = require("express");

const protect = require("../middleware/authMiddleware.js");
const { addProductToCart,getCartByUser } = require("../controllers/cartControllers.js");

const cartRoutes = express.Router();
cartRoutes.post("/add", protect, addProductToCart);
cartRoutes.get("/my-cart/:userId", protect, getCartByUser);
module.exports = {cartRoutes};