const express = require("express");
const {
  addAboutUs,
  addTermsConditions,
  addPrivacyPolicy,
  getAboutUs,
  getTermsConditions,
  getPrivacyPolicy,
} = require("../controllers/companyDetailsController.js");
const protect = require("../middleware/authMiddleware.js");

const companyDetails = express.Router();
companyDetails.route("/addAboutUs").post( addAboutUs);
companyDetails.route("/addTermsConditions").post( addTermsConditions);
companyDetails.route("/addPrivacyPolicy").post( addPrivacyPolicy);

companyDetails.route("/getAboutUs").get(getAboutUs);
companyDetails.route("/getTermsConditions").get(getTermsConditions);
companyDetails.route("/getPrivacyPolicy").get(getPrivacyPolicy);

module.exports = { companyDetails };
