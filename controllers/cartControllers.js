const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel.js");

// @desc    Add product to cart
// @route   POST /api/cart/add
const addProductToCart = asyncHandler(async (req, res) => {
  const { user_id, product_id, quantity } = req.body;

  if (!user_id || !product_id || !quantity) {
    return res.status(400).json({
      status: false,
      message: "user_id, product_id, and quantity are required",
    });
  }

  const qty = quantity && quantity > 0 ? quantity : 1;

  // find user's cart
  let cart = await Cart.findOne({ user_id });

  if (!cart) {
    // create new cart
    cart = await Cart.create({
      user_id,
      products: [{ product_id, quantity: qty }],
    });
  } else {
    // check if product already exists
    const index = cart.products.findIndex(
      (p) => p.product_id.toString() === product_id
    );

    if (index > -1) {
      // product exists → increase quantity
      cart.products[index].quantity += qty;
    } else {
      // new product → push to array
      cart.products.push({ product_id, quantity: qty });
    }

    await cart.save();
  }

  res.status(200).json({
    status: true,
    message: "Product added to cart successfully",
    cart,
  });
});

module.exports = { addProductToCart };
