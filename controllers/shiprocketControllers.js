import { shiprocketRequest } from "../shiprocket.api.js";
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
