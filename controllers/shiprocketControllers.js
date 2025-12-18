import { shiprocketRequest } from "../shiprocket.api.js";

export const checkServiceability = async (req, res) => {
  try {
    const response = await shiprocketRequest(
      "post",
      "https://apiv2.shiprocket.in/v1/external/courier/serviceability",
      req.body
    );

    res.json({
      success: true,
      data: response.data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.response?.data || err.message
    });
  }
};
