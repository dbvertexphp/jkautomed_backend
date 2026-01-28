const express = require("express");
const {
      uploadVideo,
      getPaginatedVideos,
      getAllVideo,
      streamVideo,
      updateVideoLike,
      addVideoComment,
      updateVideoViewCount,
      getVideoComments,
      getMyVideos,
      deleteVideo,
      getVideosThumbnails,
      getUserVideos,
      getVideoUploadUrlS3,
      searchVideos,
      getPaginatedVideosAdmin,
      VideoAdminStatus,
      ViewCountAdd,
      VideoViewUserList,
} = require("../controllers/videoControllers.js");
const protect = require("../middleware/authMiddleware.js");
const commonProtect = require("../middleware/comman_authMiddleware.js");

const videoRoutes = express.Router();

videoRoutes.route("/uploadVideos").post( uploadVideo);
videoRoutes.route("/VideoViewUserList").post( VideoViewUserList);
videoRoutes.route("/searchVideos").post(searchVideos);
videoRoutes.route("/updateVideoLike").post( updateVideoLike);
videoRoutes.route("/addVideoComment").post( addVideoComment);
videoRoutes.route("/deleteVideo").delete( deleteVideo);
videoRoutes.route("/updateVideoViewCount").post( updateVideoViewCount);
videoRoutes
      .route("/getVideoComments/:videoId")
      .get(commonProtect, getVideoComments);
videoRoutes
      .route("/getPaginatedVideos/:page")
      .post(commonProtect, getPaginatedVideos);
videoRoutes.route("/getAllVideo/:page").post(commonProtect, getAllVideo);
videoRoutes.route("/streamVideo/:videoId").get(streamVideo);
videoRoutes.route("/getVideosThumbnails/:limit").post(getVideosThumbnails);
videoRoutes
      .route("/getUserVideos/:user_id/:pageNumber")
      .get( getUserVideos);
videoRoutes.route("/getMyVideos/:page").get( getMyVideos);
videoRoutes.route("/getVideoUploadUrlS3").get( getVideoUploadUrlS3);
videoRoutes.route("/ViewCountAdd").post( ViewCountAdd);

//---------------------- Admin -----------------------------//

videoRoutes
      .route("/getPaginatedVideosAdmin")
      .post( getPaginatedVideosAdmin);
videoRoutes.route("/VideoAdminStatus").post( VideoAdminStatus);

module.exports = { videoRoutes };
