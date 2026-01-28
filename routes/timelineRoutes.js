const express = require("express");
const {
      uploadPostTimeline,
      getPaginatedTimeline,
      updatePostTimelineLike,
      addTimelineComment,
      updateTimelineViewCount,
      getTimelineComments,
      Timelinedelete,
      getMyTimeline,
      getUserTimeline,
      getAllTimeline,
      statusUpdate,
      searchPostsOnTimeline,
      getPaginatedPostTimelinesAdmin,
      TimelineAdminStatus,
      ViewCountAdd,
} = require("../controllers/timelineControllers.js");
const protect = require("../middleware/authMiddleware.js");
const commonProtect = require("../middleware/comman_authMiddleware.js");

const timelineRoutes = express.Router();
timelineRoutes.route("/uploadPostTimeline").post( uploadPostTimeline);
timelineRoutes.route("/searchPostsOnTimeline").post(searchPostsOnTimeline);
timelineRoutes.route("/addTimelineComment").post( addTimelineComment);
timelineRoutes.route("/ViewCountAdd").post( ViewCountAdd);
timelineRoutes.route("/Timelinedelete").delete( Timelinedelete);
timelineRoutes
      .route("/updateTimelineViewCount")
      .post( updateTimelineViewCount);
timelineRoutes
      .route("/getTimelineComments/:timelineId")
      .get(commonProtect, getTimelineComments);
timelineRoutes
      .route("/getPaginatedTimeline/:page")
      .post(commonProtect, getPaginatedTimeline);
timelineRoutes
      .route("/updatePostTimelineLike")
      .post( updatePostTimelineLike);
timelineRoutes
      .route("/getUserTimeline/:user_id/:page")
      .get(commonProtect, getUserTimeline);
timelineRoutes.route("/getMyTimeline/:page").get( getMyTimeline);
timelineRoutes.route("/getAllTimeline").post( getAllTimeline);
timelineRoutes.route("/statusUpdate").post( statusUpdate);

//---------------------- Admin -----------------------------//

timelineRoutes
      .route("/getPaginatedPostTimelinesAdmin")
      .post( getPaginatedPostTimelinesAdmin);
timelineRoutes.route("/TimelineAdminStatus").post( TimelineAdminStatus);
module.exports = { timelineRoutes };
