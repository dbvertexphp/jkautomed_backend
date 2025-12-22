const admin = require("../firebase");
const Notification = require("../models/notificationModel");

const sendAndSaveNotification = async ({
  user_id,
  firebase_token,
  title,
  message,
  type = "general",
  order_id = null,
}) => {
  try {
    // 🔔 Firebase (non-blocking)
    try {
      if (firebase_token) {
        const payload = {
          token: firebase_token,
          notification: {
            title,
            body: message,
          },
        };

        await admin.messaging().send(payload);
        console.log("✅ Firebase sent");
      }
    } catch (firebaseError) {
      console.error("🔥 Firebase error (ignored):", firebaseError.message);
    }

    // 💾 DB SAVE (always runs)
    const notification = await Notification.create({
      user_id,
      title,
      message,
      type,
      order_id,
    });

    console.log("🔥 Notification created:", notification._id);

    return { success: true, notification };

  } catch (error) {
    console.error("❌ DB Error:", error);
    return { success: false, error: error.message };
  }
};


module.exports = sendAndSaveNotification;
