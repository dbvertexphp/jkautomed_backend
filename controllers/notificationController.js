const Notification = require("../models/notificationModel.js");

const getUserNotifications = async (req, res) => {
  try {
    const { user_id } = req.params;

    const notifications = await Notification.find({ user_id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
module.exports = { getUserNotifications };