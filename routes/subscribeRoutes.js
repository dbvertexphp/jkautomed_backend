const express = require("express");
const {
      SubscribeRequest,
      getSubscribes,
      UnsubscribeRequest,
      getSubscriptionRequest
} = require("../controllers/subscribeControllers.js");
const protect = require("../middleware/authMiddleware.js");

const subscribeRoutes = express.Router();

subscribeRoutes.route("/SubscribeRequest").post( SubscribeRequest);
subscribeRoutes.route("/UnSubscribeRequest").post( UnsubscribeRequest);
subscribeRoutes.route("/").get( getSubscribes);
subscribeRoutes.route("/getSubscriptionRequest").get( getSubscriptionRequest);

module.exports = { subscribeRoutes };
