const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel.js");
const Products = require("../models/productsModel.js");


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
const getCartByUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.userId;

    let cart = await Cart.findOne({ user_id: userId })
      .populate({
        path: "products.product_id",
        model: "Products",
      });

    // 🟡 CASE 1: Cart hi nahi hai ya empty hai
    if (!cart || !cart.products || cart.products.length === 0) {

      // 🔥 Products model se saare products lao
      const allProducts = await Products.find({ status: 1 });

      return res.status(200).json({
        status: true,
        message: "Cart is empty, showing products list",
        cartEmpty: true,
        cart: [],
        products: allProducts,
      });
    }

    // 🟢 CASE 2: Cart me products hain
    return res.status(200).json({
      status: true,
      message: "Cart fetched successfully",
      cartEmpty: false,
      cart: cart.products,
    });

  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      status: false,
      message: error.message || "Server error",
    });
  }
});

module.exports = { addProductToCart,getCartByUser};
