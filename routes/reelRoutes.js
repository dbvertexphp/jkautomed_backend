const express = require("express");
const {
      uploadReel,
      getPaginatedReel,
      streamReel,
      updateReelLike,
      addReelComment,
      updateReelViewCount,
      getReelComments,
      deleteReel,
      getReelThumbnails,
      getMyReels,
      getUserReels,
      getAllReels,
      statusUpdate,
      getReelsUploadUrlS3,
      getReel_ByCategory,
      getMyReelsWebsite,
      getMyReel_ByCategory,
      getUserReelsWebsite,
      searchReels,
      getPaginatedReelsAdmin,
      ReelsAdminStatus,
      getPaginatedReelWebsite,
      ViewCountAdd,
      ReelViewUserList,
      getPaginatedReelWebsiteFillter,
} = require("../controllers/reelControllers.js");
const protect = require("../middleware/authMiddleware.js");
const commonProtect = require("../middleware/comman_authMiddleware.js");

const reelRoutes = express.Router();
reelRoutes.route("/uploadReel").post( uploadReel);
reelRoutes.route("/ReelViewUserList").post( ReelViewUserList);
reelRoutes.route("/searchReels").post(searchReels);
reelRoutes.route("/updateReelLike").post( updateReelLike);
reelRoutes.route("/addReelComment").post( addReelComment);
reelRoutes.route("/deleteReel").delete( deleteReel);
reelRoutes.route("/updateReelViewCount").post( updateReelViewCount);
reelRoutes
      .route("/getReelComments/:reelId")
      .get(commonProtect, getReelComments);
reelRoutes
      .route("/getPaginatedReel/:page")
      .post(commonProtect, getPaginatedReel);
reelRoutes
      .route("/getPaginatedReelWebsite/:page/:share_Id")
      .post(commonProtect, getPaginatedReelWebsite);
reelRoutes
      .route("/getPaginatedReelWebsiteFillter/:page/:share_Id")
      .post(commonProtect, getPaginatedReelWebsiteFillter);
reelRoutes.route("/getReel_ByCategory").post(commonProtect, getReel_ByCategory);
reelRoutes.route("/streamReel/:reelId").get(streamReel);
reelRoutes.route("/getReelThumbnails/:limit").post(getReelThumbnails);
reelRoutes
      .route("/getUserReels/:user_id/:page")
      .get(commonProtect, getUserReels);
reelRoutes
      .route("/getUserReelsWebsite/")
      .post(commonProtect, getUserReelsWebsite);
reelRoutes.route("/getMyReels/:page").get( getMyReels);
reelRoutes.route("/getMyReel_ByCategory").post( getMyReel_ByCategory);
reelRoutes.route("/getMyReelsWebsite/:page").post( getMyReelsWebsite);
reelRoutes.route("/getReelsUploadUrlS3").get( getReelsUploadUrlS3);
reelRoutes.route("/getAllReels").post( getAllReels);
reelRoutes.route("/statusUpdate").post( statusUpdate);
reelRoutes.route("/ViewCountAdd").post( ViewCountAdd);

//---------------------- Admin -----------------------------//

reelRoutes
      .route("/getPaginatedReelsAdmin")
      .post( getPaginatedReelsAdmin);
reelRoutes.route("/ReelsAdminStatus").post( ReelsAdminStatus);

module.exports = { reelRoutes };
