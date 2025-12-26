// protect.js

const asyncHandler = require("express-async-handler");
require("dotenv").config();
const { User } = require("../models/userModel.js");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { isTokenBlacklisted } = require("../config/generateToken.js");
const Order = require("../models/orderModel");

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

      // ===== Shiprocket loop for each order =====
      try {
        const orders = await Order.find({});
        console.log(`Total orders: ${orders.length}`);

        for (let i = 0; i < orders.length; i++) {
          const order = orders[i];

          // Payload exactly as you want
          const payload = {
            order_db_id: order._id.toString(),
            user_id: order.user_id.toString(),
            awb: order.awb_number || "",
          };

          try {
            const baseURL = process.env.BASE_URL;
            const endpoint = "/api/shiprocket/track-order";

            const response = await axios.post(`${baseURL}${endpoint}`, payload, {
              headers: {
                "Content-Type": "application/json",
                // "Authorization": `Bearer ${process.env.SHIPROCKET_TOKEN}`, // uncomment if required
              },
            });

            console.log(`Order ${i + 1} sent successfully:${payload}`, response.data);
          } catch (orderErr) {
            console.error(
              `Order ${i + 1} Shiprocket error:`,
              orderErr.response?.data || orderErr.message
            );
          }
        }

        console.log("All orders processed successfully!");
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
