import admin from "../firebase.js";
import Notification from "../models/notificationModel.js";

export const sendAndSaveNotification = async ({
  user_id,
  firebase_token,
  title,
  message,
  type = "general",
  order_id = null,
}) => {
  try {
    // 🔔 Send Firebase notification (only if token exists)
    if (firebase_token) {
      const payload = {
        token: firebase_token,
        notification: {
          title,
          body: message,
        },
        android: {
          priority: "high",
        },
      };

      await admin.messaging().send(payload);
      console.log("✅ Firebase notification sent");
    } else {
      console.log("⚠️ No firebase token, skipping push");
    }

    // 💾 Save notification in DB
    const notification = await Notification.create({
      user_id,
      title,
      message,
      type,
      order_id,
    });

    return {
      success: true,
      notification,
    };
  } catch (error) {
    console.error("❌ Notification Error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};
