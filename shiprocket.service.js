import axios from "axios";
import ShiprocketAuth from "./models/shiprocketmodel.js";

const TOKEN_TTL = 23 * 60 * 60 * 1000; // 23 hours

// 🔁 Login + DB update
const loginAndSaveShiprocket = async () => {
  const res = await axios.post(
    "https://apiv2.shiprocket.in/v1/external/auth/login",
    {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    }
  );

  const data = res.data;

  await ShiprocketAuth.findOneAndUpdate(
    {}, // always same document
    {
      company_name: data.company_name,
      plan_id: data.plan_id,
      is_free_plan: data.is_free_plan,
      is_fixed_plan: data.is_fixed_plan,
      token: data.token,
      generatedAt: new Date()
    },
    { upsert: true, new: true }
  );

  console.log("🔥 New Shiprocket Token Generated:", data.token); // ✅ console me dikhayega
  return data.token;
};

// 🔑 Get token (with expire check)
export const getShiprocketToken = async (force = false) => {
  const record = await ShiprocketAuth.findOne();

  if (
    !force &&
    record &&
    Date.now() - new Date(record.generatedAt).getTime() < TOKEN_TTL
  ) {
    console.log("⚡ Using existing Shiprocket Token:", record.token); // ✅ console me dikhayega
    return record.token;
  }

  return await loginAndSaveShiprocket();
};

// 🔹 Test run

