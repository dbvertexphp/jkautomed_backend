const express = require("express");

const protect = require("../middleware/authMiddleware.js");
const { addProductToCart,getCartByUser } = require("../controllers/cartControllers.js");

const cartRoutes = express.Router();
cartRoutes.post("/add",  addProductToCart);
cartRoutes.get("/my-cart/:userId",  getCartByUser);
module.exports = {cartRoutes};