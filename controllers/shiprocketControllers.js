import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import { shiprocketRequest } from "../shiprocket.api.js";
const mapShiprocketStatus = (shipment_status) => {
  switch (shipment_status) {
    case 1:
      return "Pickup Scheduled";
    case 2:
      return "Pickup Done";
    case 3:
      return "On the way";
    case 4:
      return "Out for delivery";
    case 7:
      return "Delivered";
    case 8:
      return "RTO Initiated";
    case 9:
      return "RTO Delivered";
    default:
      return "pending";
  }
};

export const createShiprocketOrder = async (req, res) => {
  try {
    const {
      order_id,
      billing,
      items,
      courier,
      dimensions = {}, // agar frontend se na aaye
      payment_method
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items required"
      });
    }

    // 1️⃣ Pickup Location
    const pickupRes = await shiprocketRequest(
      "GET",
      "https://apiv2.shiprocket.in/v1/external/settings/company/pickup"
    );

    const pickup_location =
      pickupRes.data.data.shipping_address[0].pickup_location;

    // 2️⃣ Subtotal (multiple items safe)
    const sub_total = items.reduce(
      (sum, item) => sum + Number(item.selling_price) * Number(item.units),
      0
    );

    const order_total = sub_total + Number(courier.shipping_charge);

    // 3️⃣ Shiprocket Payload (SAFE DEFAULTS)
    const payload = {
      order_id,
      order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
      pickup_location,

      billing_customer_name: billing.name,
      billing_last_name: "",
      billing_address: billing.address,
      billing_city: billing.city,
      billing_state: billing.state,
      billing_pincode: billing.pincode,
      billing_country: "India",
      billing_email: billing.email,
      billing_phone: billing.phone,

      shipping_is_billing: true,

      order_items: items.map((item, index) => ({
        name: item.name,
        sku: `SKU_${order_id}_${index + 1}`, // ✅ auto unique
        units: item.units,
        selling_price: item.selling_price,
        discount: 0, // ✅ safe
        tax: 0,      // ✅ safe
        hsn: 0       // ✅ safe
      })),

      payment_method: payment_method === "COD" ? "COD" : "Prepaid",

      shipping_charges: courier.shipping_charge,
      sub_total,
      order_total,

      // ✅ default dimensions (delivery safe)
      length: dimensions.length || 10,
      breadth: dimensions.breadth || 10,
      height: dimensions.height || 10,
      weight: dimensions.weight || 1,

      courier_id: courier.courier_company_id
    };

    // 4️⃣ Create Order
    const response = await shiprocketRequest(
      "POST",
      "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
      payload
    );

    res.status(201).json({
      success: true,
      message: "Shiprocket order created successfully",
      shiprocket: response.data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.response?.data || err.message
    });
  }
};


export const checkServiceability = async (req, res) => {
  try {
    const response = await shiprocketRequest(
      "GET",
      "https://apiv2.shiprocket.in/v1/external/courier/serviceability",
      req.body
    );

    // Original courier list
    const courierList = response.data.data.available_courier_companies;

    // Filter prepaid couriers only (cod === 0)
    const prepaidCouriers = courierList
      .filter(courier => courier.cod === 0)
      .map(courier => ({
        courier_name: courier.courier_name,
        courier_company_id: courier.courier_company_id,
        rate: courier.rate,
        estimated_delivery_days: courier.estimated_delivery_days,
        etd: courier.etd,
        delivery_boy_contact: courier.delivery_boy_contact,
      }));

    // Find courier with minimum rate
    const cheapestCourier = prepaidCouriers.reduce((prev, curr) => {
      return prev.rate < curr.rate ? prev : curr;
    }, prepaidCouriers[0]);

    res.json({
      success: true,
      data: cheapestCourier
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.response?.data || err.message
    });
  }
};
export const trackAndUpdateOrderStatus = async (req, res) => {
  try {
    const { order_db_id, user_id, awb } = req.body;

    if (!order_db_id || !user_id || !awb) {
      return res.status(400).json({
        success: false,
        message: "order_db_id, user_id and awb required",
      });
    }

    // ✅ Validate ObjectId
    if (
      !mongoose.Types.ObjectId.isValid(order_db_id) ||
      !mongoose.Types.ObjectId.isValid(user_id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ObjectId format",
      });
    }

    // 🔍 Find order by _id + user_id (both ObjectId)
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

    // 🚚 Shiprocket Tracking API (GET)
    const trackRes = await shiprocketRequest(
      "GET",
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`
    );

    const trackingData = trackRes.data?.tracking_data;

    if (!trackingData) {
      return res.status(400).json({
        success: false,
        message: "Invalid tracking data from Shiprocket",
      });
    }

    const shipment_status = trackingData.shipment_status;
    const current_status =
      trackingData.shipment_track?.[0]?.current_status || "NA";

    // 🔁 Map status
    const updatedStatus = mapShiprocketStatus(shipment_status);

    // 📝 Update order
    order.status = updatedStatus;
    order.updated_at = new Date();

    await order.save();

    // ✅ Response
    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: {
        order_db_id: order._id,
        awb,
        shipment_status,
        shiprocket_status_text: current_status,
        order_status: updatedStatus,
        track_url: trackingData.track_url,
      },
    });
  } catch (error) {
    console.error("Tracking Error:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: error.response?.data || error.message,
    });
  }
};
export const assignAwbAndUpdateOrder = async (req, res) => {
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
};