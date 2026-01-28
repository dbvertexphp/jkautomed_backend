const express = require("express");
const {
      allMessages,
      sendMessage,
      UpdateMessagesRead,
} = require("../controllers/messageControllers.js");
const protect = require("../middleware/authMiddleware.js");

const messageRoutes = express.Router();

messageRoutes.route("/:chatId").get( allMessages);
messageRoutes.route("/").post( sendMessage);
messageRoutes.route("/UpdateMessagesRead").post( UpdateMessagesRead);

module.exports = { messageRoutes };
