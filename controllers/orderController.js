const asyncHandler = require("express-async-handler");
const Order = require("../models/orderModel");

// 🔐 Unique Order ID Generator
const generateOrderId = () => {
  return `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
};

const createOrder = asyncHandler(async (req, res) => {
  const {
    user_id,
    items,
    shipping_address,
    payment_method,
    total_amount,
    awb_number,
    courier_charge,
  } = req.body;

  if (
    !user_id ||
    !items ||
    items.length === 0 ||
    !shipping_address ||
    !payment_method ||
    !total_amount
  ) {
    return res.status(400).json({
      status: false,
      message: "All required fields are mandatory",
    });
  }

  let order_id;
  let isUnique = false;

  // 🔁 Ensure uniqueness
  while (!isUnique) {
    order_id = generateOrderId();
    const exists = await Order.findOne({ order_id });
    if (!exists) isUnique = true;
  }

  const order = await Order.create({
    order_id,
    user_id,
    items,
    shipping_address,
    payment_method,
    total_amount,
    awb_number,
    courier_charge,
    status: "pending",
  });

  res.status(201).json({
    status: true,
    message: "Order placed successfully",
    order_id: order.order_id,
    awb_number: order.awb_number,
    data: order,
  });
});

module.exports = { createOrder };
