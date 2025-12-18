import axios from "axios";
import { getShiprocketToken } from "./shiprocket.service.js";

export const shiprocketRequest = async (method, url, data = null) => {
  try {
    const token = await getShiprocketToken();

    return await axios({
      method,
      url,
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

  } catch (err) {
    // 🔄 Token expired unexpectedly
    if (err.response?.status === 401) {
      const newToken = await getShiprocketToken(true);

      return await axios({
        method,
        url,
        data,
        headers: {
          Authorization: `Bearer ${newToken}`,
          "Content-Type": "application/json"
        }
      });
    }

    throw err;
  }
};
