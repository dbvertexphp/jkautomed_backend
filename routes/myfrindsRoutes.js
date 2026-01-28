const express = require("express");
const {
      SendFriendRequest,
      getMyFriends,
      AcceptFriendRequest,
      getMyFriendsrequests,
      getMyFriendsAdd,
} = require("../controllers/myfrindsController.js");
const protect = require("../middleware/authMiddleware.js");

const myfriendRoutes = express.Router();

myfriendRoutes.route("/Sendfriendrequest").post( SendFriendRequest);
myfriendRoutes.route("/AcceptFriendRequest").post( AcceptFriendRequest);
myfriendRoutes.route("/").post( getMyFriends);
myfriendRoutes.route("/getMyFriendsAdd").post( getMyFriendsAdd);
myfriendRoutes
      .route("/getMyFriendsrequests")
      .post( getMyFriendsrequests);

module.exports = { myfriendRoutes };
