const express = require("express");
const {
      uploadPostJob,
      getPaginatedJob,
      appliedPostJob,
      getAppliedJobs,
      getAppliedUsers,
      getMyJobs,
      updateJobStatus,
      getAllJob,
      statusUpdate,
      searchJobPosts,
      getPaginatedPostJobsAdmin,
      JobAdminStatus,
} = require("../controllers/jobControllers.js");
const protect = require("../middleware/authMiddleware.js");
const commonProtect = require("../middleware/comman_authMiddleware.js");

const jobRoutes = express.Router();
jobRoutes.route("/uploadPostJob").post( uploadPostJob);
jobRoutes.route("/searchJobPosts").post(searchJobPosts);
jobRoutes.route("/appliedPostJob").post( appliedPostJob);
jobRoutes.route("/updateJobStatus").post( updateJobStatus);
jobRoutes.route("/getAppliedJobs").post( getAppliedJobs);
jobRoutes.route("/getAppliedUsers/:job_id").get( getAppliedUsers);
jobRoutes.route("/getMyJobs/:page").post( getMyJobs);
jobRoutes.route("/getPaginatedJob/:page").post(commonProtect, getPaginatedJob);
jobRoutes.route("/getAllJob").post( getAllJob);
jobRoutes.route("/statusUpdate").post( statusUpdate);

//---------------------- Admin -----------------------------//

jobRoutes
      .route("/getPaginatedPostJobsAdmin")
      .post( getPaginatedPostJobsAdmin);
jobRoutes.route("/JobAdminStatus").post( JobAdminStatus);

module.exports = { jobRoutes };
