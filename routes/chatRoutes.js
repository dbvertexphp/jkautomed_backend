const express = require("express");
const { accessChat, fetchChats, createGroupChat, removeFromGroup, addToGroup, renameGroup, blockUser, blockUserList } = require("../controllers/chatControllers.js");

const protect = require("../middleware/authMiddleware.js");

const chatRoutes = express.Router();

chatRoutes.route("/").post( accessChat);
chatRoutes.route("/blockUserList").get( blockUserList);
chatRoutes.route("/:limit").get( fetchChats);
chatRoutes.route("/group").post( createGroupChat);
chatRoutes.route("/blockUser").post( blockUser);

chatRoutes.route("/rename").put( renameGroup);
chatRoutes.route("/groupremove").put( removeFromGroup);
chatRoutes.route("/groupadd").put( addToGroup);

module.exports = { chatRoutes };
