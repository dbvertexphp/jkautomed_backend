import { shiprocketRequest } from "../shiprocket.api.js";

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
