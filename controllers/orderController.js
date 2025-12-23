const asyncHandler = require("express-async-handler");
const Order = require("../models/orderModel");
const axios = require("axios");
const mongoose = require("mongoose");

// 🔐 Unique Order ID Generator
const generateOrderId = () => {
  return `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
};

// const createOrder = asyncHandler(async (req, res) => {
//   const {
//     user_id,
//     items,
//     shipping_address,
//     payment_method,
//     total_amount,
//     awb_number,
//     courier_charge,
//   } = req.body;

//   if (
//     !user_id ||
//     !items ||
//     items.length === 0 ||
//     !shipping_address ||
//     !payment_method ||
//     !total_amount
//   ) {
//     return res.status(400).json({
//       status: false,
//       message: "All required fields are mandatory",
//     });
//   }

//   let order_id;
//   let isUnique = false;

//   // 🔁 Ensure uniqueness
//   while (!isUnique) {
//     order_id = generateOrderId();
//     const exists = await Order.findOne({ order_id });
//     if (!exists) isUnique = true;
//   }

//   const order = await Order.create({
//     order_id,
//     user_id,
//     items,
//     shipping_address,
//     payment_method,
//     total_amount,
//     awb_number,
//     courier_charge,
//     status: "pending",
//   });

//   res.status(201).json({
//     status: true,
//     message: "Order placed successfully",
//     order_id: order.order_id,
//     awb_number: order.awb_number,
//     data: order,
//   });
// });


// created by atul

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

  // 🔎 Validation
  if (
    !user_id ||
    !Array.isArray(items) ||
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

  // ✅ Validate items & product_id
  for (const item of items) {
    if (
      !item.product_id ||
      !mongoose.Types.ObjectId.isValid(item.product_id) ||
      !item.product_name ||
      !item.selling_price ||
      !item.units
    ) {
      return res.status(400).json({
        status: false,
        message: "Each item must have product_id, product_name, selling_price, and units",
      });
    }
  }

  // 🔁 Unique order_id
  let order_id;
  let isUnique = false;

  while (!isUnique) {
    order_id = generateOrderId();
    const exists = await Order.findOne({ order_id });
    if (!exists) isUnique = true;
  }

  const order = await Order.create({
    order_id,
    user_id,
    items: items.map(item => ({
      product_id: item.product_id, // ✅ saved
      product_name: item.product_name,
      selling_price: item.selling_price,
      units: item.units,
    })),
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

// const getOrdersByUserId = asyncHandler(async (req, res) => {
//   const { user_id } = req.params;

//   if (!user_id) {
//     return res.status(400).json({
//       status: false,
//       message: "user_id is required",
//     });
//   }

//   const orders = await Order.find({ user_id }).sort({ createdAt: -1 });

//   if (!orders || orders.length === 0) {
//     return res.status(404).json({
//       status: false,
//       message: "No orders found for this user",
//     });
//   }

//   // 🔁 Loop through orders and call tracking API if AWB exists
//   const updatedOrders = await Promise.all(
//     orders.map(async (order) => {
//       let trackingData = null;

//       if (order.awb_number) {
//         try {
//           const response = await axios.post(
//             "https://api.jkautomed.graphicsvolume.com/api/shiprocket/track-order",
//             {
//               order_db_id: order._id,
//               user_id: order.user_id,
//               awb: order.awb_number,
//             }
//           );

//           trackingData = response.data;
//         } catch (error) {
//           trackingData = {
//             status: false,
//             message: "Tracking API failed",
//             error: error.response?.data || error.message,
//           };
//         }
//       }

//       return {
//         ...order.toObject(),
//         tracking: trackingData, // 👈 tracking info attach
//       };
//     })
//   );

//   res.status(200).json({
//     status: true,
//     count: updatedOrders.length,
//     data: updatedOrders,
//   });
// });

// create by atul

const getOrdersByUserId = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({
      status: false,
      message: "user_id is required",
    });
  }

 const baseUrl = `${req.protocol}://${req.get("host")}`;


  const orders = await Order.find({ user_id })
    .sort({ created_at: -1 })
    .populate({
      path: "items.product_id",
      select: "product_name product_images",
    })
    .lean();
  console.log("ordere", orders)
  if (!orders.length) {
    return res.status(404).json({
      status: false,
      message: "No orders found",
    });
  }

  const formattedOrders = orders.map(order => ({
    ...order,
    items: order.items.map(item => ({
      _id: item._id,
      product_id: item.product_id?._id || null,
      product_name: item.product_id?.product_name || item.product_name,
      selling_price: item.selling_price,
      units: item.units,
      product_images: item.product_id?.product_images
        ? item.product_id.product_images.map(
            img => `${baseUrl}/${img.replace(/^\/+/, "")}`
          )
        : [],
    })),
  }));

  res.status(200).json({
    status: true,
    count: formattedOrders.length,
    data: formattedOrders,
  });
});




module.exports = { createOrder, getOrdersByUserId };