const express = require("express");

const protect = require("../middleware/authMiddleware.js");
const { addProductToCart } = require("../controllers/cartControllers.js");

const cartRoutes = express.Router();
cartRoutes.post("/add", protect, addProductToCart);

module.exports = {cartRoutes};