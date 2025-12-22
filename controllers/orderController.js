const asyncHandler = require("express-async-handler");
const Order = require("../models/orderModel");
const axios = require("axios");

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
const getOrdersByUserId = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({
      status: false,
      message: "user_id is required",
    });
  }

  const orders = await Order.find({ user_id }).sort({ createdAt: -1 });

  if (!orders || orders.length === 0) {
    return res.status(404).json({
      status: false,
      message: "No orders found for this user",
    });
  }

  // 🔁 Loop through orders and call tracking API if AWB exists
  const updatedOrders = await Promise.all(
    orders.map(async (order) => {
      let trackingData = null;

      if (order.awb_number) {
        try {
          const response = await axios.post(
            "https://api.jkautomed.graphicsvolume.com/api/shiprocket/track-order",
            {
              order_db_id: order._id,
              user_id: order.user_id,
              awb: order.awb_number,
            }
          );

          trackingData = response.data;
        } catch (error) {
          trackingData = {
            status: false,
            message: "Tracking API failed",
            error: error.response?.data || error.message,
          };
        }
      }

      return {
        ...order.toObject(),
        tracking: trackingData, // 👈 tracking info attach
      };
    })
  );

  res.status(200).json({
    status: true,
    count: updatedOrders.length,
    data: updatedOrders,
  });
});
const assignAwbAndUpdateOrder = asyncHandler (async(req, res) => {
  try {
    const { order_db_id, user_id, shipment_id, courier_id } = req.body;

    if (!order_db_id || !user_id || !shipment_id || !courier_id) {
      return res.status(400).json({
        success: false,
        message: "order_db_id, user_id, shipment_id, courier_id required",
      });
    }

    // ✅ ObjectId validation
    if (
      !mongoose.Types.ObjectId.isValid(order_db_id) ||
      !mongoose.Types.ObjectId.isValid(user_id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ObjectId format",
      });
    }

    // 🔍 1️⃣ Find Order by _id + user_id
    const order = await Order.findOne({
      _id: order_db_id,
      user_id: user_id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // 🚚 2️⃣ Assign AWB
    const awbRes = await shiprocketRequest(
      "POST",
      "https://apiv2.shiprocket.in/v1/external/international/courier/assign/awb",
      {
        shipment_id,
        courier_id,
      }
    );

    if (awbRes.data?.awb_assign_status !== 1) {
      return res.status(400).json({
        success: false,
        message: "AWB assignment failed",
        shiprocket: awbRes.data,
      });
    }

    // 📦 3️⃣ Extract AWB
    const awbData = awbRes.data.response.data;

    // 📝 4️⃣ Update Order
    order.awb_number = awbData.awb_code;
    order.courier_charge = awbData.freight_charges;
    order.status = "On the way";
    order.updated_at = new Date();

    await order.save();

    // ✅ 5️⃣ Response
    res.status(200).json({
      success: true,
      message: "AWB assigned & order updated successfully",
      data: {
        order_db_id: order._id,
        order_id: order.order_id,
        awb_number: order.awb_number,
        courier_charge: order.courier_charge,
      },
    });

  } catch (error) {
    console.error("AWB Assign Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data || error.message,
    });
  }
});


module.exports = { createOrder, getOrdersByUserId };