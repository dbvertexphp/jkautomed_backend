const express = require("express");
const {
      Checklikestatus,
      contactUs,
      report,
      getAllContact,
      getAllReports,
      HomePage,
} = require("../controllers/commanControllers.js");
const protect = require("../middleware/authMiddleware.js");

const commanRoutes = express.Router();
commanRoutes.route("/Checklikestatus").post( Checklikestatus);
commanRoutes.route("/report").post( report);
commanRoutes.route("/contactUs").post(contactUs);
commanRoutes.route("/HomePage").post(HomePage);
commanRoutes.route("/getAllContact").post( getAllContact);
commanRoutes.route("/getAllReports").post( getAllReports);
module.exports = { commanRoutes };
