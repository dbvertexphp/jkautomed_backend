const asyncHandler = require("express-async-handler");
require("dotenv").config();
const { User } = require("../models/userModel.js");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { isTokenBlacklisted } = require("../config/generateToken.js");
const Order = require("../models/orderModel");
const sendAndSaveNotification = require("../utils/sendAndSaveNotification");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];

    if (isTokenBlacklisted(token)) {
      return res.status(401).json({
        message: "Token is expired or invalid",
        status: false,
        expired: true,
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded._id).select("-password");

      if (!user) {
        return res.status(401).json({
          message: "User not found",
          status: false,
        });
      }

      req.headers.userID = decoded._id;
      req.headers.role = decoded.role;
      req.user = user;

      // 🔥 IMPORTANT: per request ek hi notification per user
      const notifiedUsers = new Set();

      try {
        const orders = await Order.find({});
        console.log(`Total orders: ${orders.length}`);

        for (let i = 0; i < orders.length; i++) {
          const order = orders[i];
          if (!order.awb_number) continue;

          const payload = {
            order_db_id: order._id.toString(),
            user_id: order.user_id.toString(),
            awb: order.awb_number,
          };

          try {
            const baseURL = process.env.BASE_URL;
            const endpoint = "/api/shiprocket/track-order";

            const response = await axios.post(
              `${baseURL}${endpoint}`,
              payload,
              { headers: { "Content-Type": "application/json" } }
            );

            const {
              previous_status,
              new_status,
              user_id,
            } = response.data.data;

            console.log(
              `STATUS CHECK → User: ${user_id} | ${previous_status} => ${new_status}`
            );

            // ❌ Same status OR already notified → skip
            if (
              previous_status === new_status ||
              notifiedUsers.has(user_id)
            ) {
              console.log("ℹ️ Notification skipped");
              continue;
            }

            // ✅ Notification send (ONLY ONCE PER USER)
            const notifUser = await User.findById(user_id).select(
              "firebase_token full_name"
            );

            if (!notifUser) continue;

            const firebaseToken =
              notifUser.firebase_token &&
              notifUser.firebase_token !== "dummy_token"
                ? notifUser.firebase_token
                : null;

            if (firebaseToken) {
              await sendAndSaveNotification({
                user_id: notifUser._id,
                firebase_token: firebaseToken,
                title: "Order Status Updated",
                message: `Your order status has changed from ${previous_status} to ${new_status}`,
                type: "order",
              });

              notifiedUsers.add(user_id); // 🔥 mark as notified
              console.log(`✅ Notification sent to user ${user_id}`);
            } else {
              console.log("⚠️ Firebase token missing");
            }
          } catch (orderErr) {
            console.error(
              `Order ${i + 1} Shiprocket error:`,
              orderErr.response?.data || orderErr.message
            );
          }
        }

        console.log("🚀 Shiprocket tracking completed");
      } catch (shipErr) {
        console.error("Shiprocket processing error:", shipErr.message);
      }

      next();
    } catch (error) {
      console.error("Protect middleware error:", error.message);
      return res.status(401).json({
        message: "Not authorized, token failed",
        status: false,
      });
    }
  } else {
    return res.status(401).json({
      message: "Not authorized, no token",
      status: false,
    });
  }
});

module.exports = protect;
