const express = require("express");
const {
  registerUser,
  authUser,
  getUsers,
  verifyOtp,
  resendOTP,
  updateProfileData,
  forgetPassword,
  ChangePassword,
  profilePicUpload,
  logoutUser,
  bank_Detail_create,
  getAllUsers,
  getAllDashboardCount,
  addReview,
  getUserView,
  getBankDetails,
  ForgetresendOTP,
  profilePicKey,
  getReview,
  updateProfileDataByAdmin,
  searchUsers,
  getBankDetailsAdmin,
  UserAdminStatus,
  UpdateMobileAdmin,
  getCoursesByTeacherId,
  getTeacherAndCourseByTeacher_IdAndType,
  addFavoriteProduct,
  removeFavoriteProduct,
  getFavoriteTeachers,
  getCoursesByUserId,
  updateCostomerProfileData,
  getStudentsPayment,
  getAllSuppliersInAdmin,
  getProductByCategory_id,
  searchProducts,
  addToCart,
  getFavoriteProduct,
  getProductDetailByProductId,
  getCartProducts,
  increaseCartQuantity,
  decreaseCartQuantity,
  checkout,
  removeFromCart,
  getUserOrderDetails,
  getAllOrders,
  getUserOrderInAdmin,
  getAllSupplier,
  getOrderNotifications,
  getProductsByOrderAndSupplier,
  updateUserPincode,
  getProductsRendom,
  getUserDetails,
  updateNumberToString,
  updatePinCodeToString,
  updateUserRole,
  updateCancelOrder,
  sendNotificationToRole,
  getAllBothUsers,
  updateUsersTimestamp,
  change_password,
  adminLogin,
  getAllSupplierstotal,
  getAllCancelOrders,
  getAddresses,
  addOrUpdateAddress,
} = require("../controllers/userControllers.js");
const {createProduct} = require("../controllers/productControllers.js");
const { CreateCalendar, GetSpecialEntries, FindPriceByDateTime, GetNormalEntries } = require("../controllers/calendarControllers.js");
const { createHire, getHireListByUserId, updateHireStatus, getAllHireList, getHireByMe, HirePaymentUpdateStatus } = require("../controllers/hireControllers.js");
const protect = require("../middleware/authMiddleware.js");
const commonProtect = require("../middleware/comman_authMiddleware.js");
const Authorization = require("../middleware/Authorization.middleware.js");
const { addRating, getRatingsByTeacherId } = require("../controllers/ratingController.js");
const { addTeacherPaymentStatus, getTeacherPaymentStatuses, calculatePayment, getTeacherPaymentStatusById } = require("../controllers/teacherPaymentStatusController.js");
const { getPopularProduct } = require("../controllers/supplierController.js");
const userRoutes = express.Router();
const verifyToken = require('../middleware/verifytoken.js');
/*------------- Student/Teacher Both apis --------------------- */
userRoutes.route("/updateUsersTimestamp").post(updateUsersTimestamp);
userRoutes.route("/register").post(registerUser);
userRoutes.route("/login").post(authUser);
userRoutes.route("/adminlogin").post(adminLogin);
userRoutes.route("/change-password").put(authUser);
userRoutes.route("/verifyOtp").post(verifyOtp);
userRoutes.route("/resendOTP").post(resendOTP);
userRoutes.route("/ForgetresendOTP").post(ForgetresendOTP);
userRoutes.route("/forgetPassword").put(forgetPassword);
userRoutes.route("/ChangePassword").put( ChangePassword);
userRoutes.route("/logoutUser").get( logoutUser);
userRoutes.route("/getAllSupplier").get( getAllSupplier);
userRoutes.route("/getAddresses/:userId").get( getAddresses);
userRoutes.put("/update-address/:userId", addOrUpdateAddress);




/*------------- User/Admin Both apis --------------------- */

userRoutes.route("/updateCostomerProfileData").post(protect, Authorization(["user","both"]), updateCostomerProfileData);
userRoutes.route("/getProductByCategory_id").post(protect, Authorization(["user","both"]), getProductByCategory_id);
userRoutes.route("/searchProducts").post(protect, Authorization(["user","both"]), searchProducts);
userRoutes.route("/addFavoriteProduct").post(protect, Authorization(["user","both"]), addFavoriteProduct);
userRoutes.route("/removeFavoriteProduct").post(protect, Authorization(["user","both"]), removeFavoriteProduct);
userRoutes.route("/addToCart").post(protect, Authorization(["user"]), addToCart);
userRoutes.route("/getFavoriteProduct").get(protect, Authorization(["user","both"]), getFavoriteProduct);
userRoutes.route("/getProductDetailByProductId").post(protect, Authorization(["user","both"]), getProductDetailByProductId);
userRoutes.route("/getCartProducts").get(protect, Authorization(["user","both"]), getCartProducts);
userRoutes.route("/increaseCartQuantity").post(protect, Authorization(["user"]), increaseCartQuantity);
userRoutes.route("/decreaseCartQuantity").post(protect, Authorization(["user","both"]), decreaseCartQuantity);
userRoutes.route("/checkout").post(protect, Authorization(["user","both"]), checkout);
userRoutes.route("/removeFromCart").post(protect, Authorization(["user","both"]), removeFromCart);
userRoutes.route("/getUserOrderDetails").get(protect, Authorization(["user","both", "supplier"]), getUserOrderDetails);
userRoutes.route("/addRating").post(protect, Authorization(["user","both"]), addRating);
userRoutes.route("/getOrderNotifications").get(protect, Authorization(["user","both"]), getOrderNotifications);
userRoutes.route("/getPopularProduct").get(protect, Authorization(["user","both"]), getPopularProduct);
userRoutes.route("/updateUserPincode").post(protect, Authorization(["user","both"]), updateUserPincode);
userRoutes.route("/getProductsRendom").get(protect, Authorization(["user","both","admin"]), getProductsRendom);
userRoutes.route("/updateUserRole").post(protect, Authorization(["user","both","supplier"]), updateUserRole);
userRoutes.route("/updateCancelOrder").post(protect, Authorization(["user","both"]), updateCancelOrder);
userRoutes.route("/sendNotificationToRole").post(protect, Authorization(["admin"]), sendNotificationToRole);


userRoutes.route("/getCoursesByUserId").get(protect, Authorization(["student"]), getCoursesByUserId);
userRoutes.route("/getAllUsers").get(  getAllUsers);
userRoutes.route("/getAllBothUsers").get(protect, Authorization(["admin"]), getAllBothUsers);
userRoutes.route("/getFavoriteTeachers").get(protect, Authorization(["student"]), getFavoriteTeachers);
userRoutes.route("/getRatingsByTeacherId/:teacherId").get(protect, getRatingsByTeacherId);
userRoutes.route("/addReview").post(protect, Authorization(["student"]), addReview);

userRoutes.route("/change_password").put(verifyToken, change_password);
/*------------- Teacher/Admin Both apis --------------------- */
userRoutes.route("/getTeacherAndCourseByTeacher_IdAndType").post(protect, Authorization(["student", "teacher"]), getTeacherAndCourseByTeacher_IdAndType);
userRoutes.route("/addBankDetails").post(protect, Authorization(["supplier","both"]), bank_Detail_create);
userRoutes.route("/getBankDetails").get(protect, Authorization(["supplier","both"]), getBankDetails);
userRoutes.route("/getBankDetailsAdmin/:teacher_id").get(protect, Authorization(["supplier","both", "admin"]), getBankDetailsAdmin);
userRoutes.route("/calculatePayment").post(protect, Authorization(["supplier","both"]), calculatePayment);

/*------------- Admin apis --------------------- */
userRoutes.route("/getAllOrders").get(getAllOrders);
userRoutes.route("/getAllCancelOrders").get(protect, Authorization(["admin"]), getAllCancelOrders);
userRoutes.route("/getUserOrderInAdmin").post(protect, Authorization(["admin"]), getUserOrderInAdmin);
userRoutes.route("/getProductsByOrderAndSupplier/:order_id").get(protect, Authorization(["admin"]), getProductsByOrderAndSupplier);
userRoutes.route("/getUserDetails").post(protect, Authorization(["admin"]), getUserDetails);


userRoutes.route("/getTeacherPaymentStatuses").get(protect, Authorization(["admin"]), getTeacherPaymentStatuses);
userRoutes.route("/getTeacherPaymentStatusById/:teacher_id").get(protect, Authorization(["admin"]), getTeacherPaymentStatusById);
userRoutes.route("/addTeacherPaymentStatus").post(protect, Authorization(["admin"]), addTeacherPaymentStatus);
userRoutes.route("/getStudentsPayment").get(protect, Authorization(["admin"]), getStudentsPayment);
userRoutes.route("/getAllDashboardCount").get( getAllDashboardCount);

// student protect route
/*------------- Comman Auth Routes --------------------- */
userRoutes.route("/getUserView/:_id/").get(commonProtect, getUserView);

/*------------- Auth Routes --------------------- */

userRoutes.route("/").get( getUsers);

userRoutes.route("/updateUserProfile").put( updateProfileData);
userRoutes.route("/searchUsers").post( searchUsers);
userRoutes.route("/UpdateMobileAdmin").post( UpdateMobileAdmin);
userRoutes.route("/profilePicUpload").put( profilePicUpload);
userRoutes.route("/UserAdminStatus").post( UserAdminStatus);

// userRoutes.route("/updateUserWatchTime").post(protect, updateUserWatchTime);
userRoutes.route("/getReview/:id/:limit").get(getReview);
userRoutes.route("/profilePicKey").post( profilePicKey);

/*------------- Calendar Routes --------------------- */
userRoutes.route("/Createcalendar").post( CreateCalendar);
userRoutes.route("/FindPriceByDateTime").post(FindPriceByDateTime);
userRoutes.route("/GetSpecialEntries").get( GetSpecialEntries);
userRoutes.route("/GetNormalEntries").get( GetNormalEntries);
/*------------- Hire Routes --------------------- */
userRoutes.route("/createHire").post( createHire);
userRoutes.route("/updateHireStatus").post( updateHireStatus);
userRoutes.route("/HirePaymentUpdateStatus").post( HirePaymentUpdateStatus);
userRoutes.route("/getHireList").get( getHireListByUserId);
userRoutes.route("/getHireByMe").get( getHireByMe);

/*------------- Admin Routes --------------------- */

userRoutes.route("/getAllHireList").post( getAllHireList);
userRoutes.route("/updateProfileDataByAdmin").post( updateProfileDataByAdmin);
userRoutes.route("/getCoursesByTeacherId/:teacher_id").get( getCoursesByTeacherId);

userRoutes.route("/getAllSuppliersInAdmin").get( getAllSuppliersInAdmin);
userRoutes.route("/getAllSupplierstotal").get( getAllSupplierstotal);

userRoutes.route("/updateNumberToString").post(updateNumberToString);
userRoutes.route("/updatePinCodeToString").post(updatePinCodeToString);


module.exports = { userRoutes };
