const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const cookie = require("cookie");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const { generateToken, blacklistToken } = require("../config/generateToken.js");
const { User, NotificationMessages, AdminDashboard, WebNotification } = require("../models/userModel.js");
const Category = require("../models/categoryModel.js");
const Review = require("../models/reviewModel.js");
const BankDetails = require("../models/bankdetailsModel.js");
const Transaction = require("../models/transactionModel");
const { AdminNotificationMessages } = require("../models/adminnotificationsmodel.js");
const MyFriends = require("../models/myfrindsModel.js");
const { Hire, HireStatus } = require("../models/hireModel.js");
require("dotenv").config();
const baseURL = process.env.BASE_URL;
const { createNotification } = require("./notificationControllers.js");
const { PutObjectProfilePic, getSignedUrlS3, DeleteSignedUrlS3 } = require("../config/aws-s3.js");
const dayjs = require("dayjs");
const { createConnectyCubeUser } = require("../utils/connectyCubeUtils.js");
const ErrorHandler = require("../utils/errorHandler.js");
const http = require("https");
const jwt = require("jsonwebtoken");
const upload = require("../middleware/uploadMiddleware.js");
const Product = require("../models/productModel.js");
const Cart = require("../models/cartModel.js");
const Order = require("../models/orderModel.js");
const TeacherPayment = require("../models/TeacherPaymentModel.js");
const OrderNotification = require("../models/orderNotificationModel.js");
const Favorite = require("../models/favorite.js");
const Rating = require("../models/ratingModel.js");
const fs = require("fs");
const { addNotification } = require("./orderNotificationController");
const { sendFCMNotification } = require("./notificationControllers");
const sendEmail = require("../utils/emailSender");
const argon2 = require("argon2");

const getUsers = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(200).json({
        message: "User Not Found",
        status: false,
      });
    }

    // Convert dob to desired format using dayjs
    const formattedDOB = dayjs(user.dob).format("YYYY-MM-DD");

    const updatedUser = {
      ...user._doc,
      pic: user.pic,
      watch_time: convertSecondsToReadableTime(user.watch_time),
      dob: formattedDOB, // Update dob with formatted date
    };

    res.json({
      user: updatedUser,
      status: true,
    });
  } catch (error) {
    console.error("GetUsers API error:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const getUserView = asyncHandler(async (req, res) => {
  const user_id = req.params;

  try {
    // Fields jo query se exclude karna hai ko specify karein
    const excludedFields = ["otp_verified", "mobile", "password", "otp"];

    // Exclude karne wale fields ke liye projection object banayein
    const projection = {};
    excludedFields.forEach((field) => {
      projection[field] = 0;
    });

    // User ko user_id ke basis par find karein aur specified fields ko exclude karke select karein
    const user = await User.findById(user_id).select(projection);

    // Agar user nahi mila, toh User Not Found ka response bhejein
    if (!user) {
      return res.status(200).json({
        message: "User Not Found",
        status: false,
      });
    }

    // Friend_status ko "No" se set karein
    let Friend_status = "No";

    // Token header mein present hai ya nahi check karein
    const token = req.header("Authorization");
    if (token) {
      // Check karein ki user ne current post ko like kiya hai ya nahi
      const isFriend = await MyFriends.exists({
        $or: [
          { my_id: req.user._id, friends_id: user_id._id },
          { my_id: user_id._id, friends_id: req.user._id },
        ],
      });

      const isRequestPending = await MyFriends.exists({
        my_id: user_id._id,
        request_id: req.user._id,
      });
      const isRequestAccept = await MyFriends.exists({
        my_id: req.user._id,
        request_id: user_id._id,
      });

      // User ne post ko like kiya hai ya nahi, is par based Friend_status set karein
      if (isFriend) {
        Friend_status = "Yes";
      } else if (isRequestPending) {
        Friend_status = "Pending";
      } else if (isRequestAccept) {
        Friend_status = "Accept";
      }
    }

    // User ke pic field mein BASE_URL append karein
    const updatedUser = {
      Friend_status,
      ...user._doc,
      pic: user.pic,
      watch_time: convertSecondsToReadableTime(user.watch_time),
    };
    console.log(updatedUser);

    // Response mein updatedUser aur status ka json bhejein
    res.json({
      user: updatedUser,
      status: true,
    });
  } catch (error) {
    // Agar koi error aaye toh usko console mein log karein aur Internal Server Error ka response bhejein
    console.error("GetUsers API error:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

function sendOTP(name, mobile, otp) {
  console.log(name);
  console.log(mobile);

  const options = {
    method: "POST",
    hostname: "control.msg91.com",
    port: null,
    path: `/api/v5/otp?template_id=${process.env.TEMPLATE_ID}&mobile=91${mobile}&authkey=${process.env.MSG91_API_KEY}&realTimeResponse=1`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = http.request(options, function (res) {
    const chunks = [];

    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function () {
      const body = Buffer.concat(chunks);
      console.log(body.toString());
    });
  });

  const payload = JSON.stringify({
    name: name,
    OTP: otp,
  });

  req.write(payload);
  req.end();
}

const registerUser = asyncHandler(async (req, res, next) => {
  req.uploadPath = "uploads/profiles";
  upload.single("profile_pic")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }

    const { full_name, email, mobile, password, role, firebase_token, pin_code } = req.body;
    if (!full_name || !email || !mobile || !password || !role) {
      return next(new ErrorHandler("Please enter all the required fields.", 400));
    }

    const mobileExists = await User.findOne({ mobile });
    if (mobileExists) {
      return next(new ErrorHandler("User with this mobile number already exists.", 400));
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return next(new ErrorHandler("User with this Email already exists.", 400));
    }

    // Generate a 4-digit random OTP
    const otp = generateOTP();

    // Get the profile picture path if uploaded
    const profile_pic = req.file ? `${req.uploadPath}/${req.file.filename}` : null;

    const user = await User.create({
      full_name,
      email,
      mobile,
      role,
      password,
      otp, // Add the OTP field
      firebase_token,
      pin_code,
      profile_pic, // Add profile_pic field
    });

    if (user) {
      const sendEmailAsync = async () => {
        const subject = "Welcome to Our Service!";
        const text = `Hello ${full_name},\n\nThank you for registering. Your OTP for verification is: ${otp}`;

        try {
          await sendEmail(email, subject, text); // Send email after user registration
        } catch (error) {
          console.error("Failed to send email notification:", error);
        }
      };

      // Schedule the email to be sent
      setImmediate(sendEmailAsync);
      // sendOTP(full_name, mobile, otp);
      try {
        const adminDashboard = await AdminDashboard.findOne();
        if (adminDashboard) {
          adminDashboard.user_count++;
          await adminDashboard.save();
        } else {
          console.error("AdminDashboard not found");
        }
      } catch (error) {
        console.error("Failed to update admin dashboard:", error);
      }

      res.status(201).json({
        _id: user._id,
        full_name: user.full_name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        otp_verified: user.otp_verified,
        otp: user.otp,
        firebase_token,
        pin_code,
        profile_pic: user.profile_pic, // Include profile_pic in response
        token: generateToken(user._id),
        status: true,
      });
    } else {
      return next(new ErrorHandler("User registration failed.", 400));
    }
  });
});

const authUser = asyncHandler(async (req, res) => {
  const { mobile, password, firebase_token } = req.body; // Include firebase_token from request body
  const userdata = await User.findOne({ mobile });

  if (!userdata) {
    throw new ErrorHandler("User Not Found.", 400);
  }

  const isPasswordMatch = await userdata.matchPassword(password);

  if (!isPasswordMatch) {
    throw new ErrorHandler("Invalid Password", 400);
  }

  if (userdata.otp_verified === 0) {
    const otp = generateOTP();
    // sendOTP(userdata.full_name, mobile, otp);
    await User.updateOne({ _id: userdata._id }, { $set: { otp } });
    // throw new ErrorHandler("OTP Not verified", 400);
    res.status(400).json({
      otp,
      message: "OTP Not verified",
      status: false,
    });
  }

  // Save firebase_token if provided
  if (firebase_token) {
    userdata.firebase_token = firebase_token;
    await userdata.save();
  }

  if (isPasswordMatch) {
    if (!process.env.JWT_SECRET) {
      throw new ErrorHandler("JWT_SECRET is not defined in environment variables", 500);
    }

    const token = jwt.sign({ _id: userdata._id, role: userdata.role }, process.env.JWT_SECRET);

    // Set the token in a cookie for 30 days
    res.setHeader(
      "Set-Cookie",
      cookie.serialize("Websitetoken", token, {
        httpOnly: true,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60), // 30 days (30 * 60 minutes * 60 seconds * 1000 ms)
        path: "/",
      })
    );

    const user = {
      ...userdata.toObject(),
      profile_pic: userdata.profile_pic, // No base URL added here
    };

    res.json({
      user,
      token,
      status: true,
    });
  } else {
    throw new ErrorHandler("Invalid Password", 400);
  }
});

const adminLogin = asyncHandler(async (req, res) => {
  const { mobile, password } = req.body; // Get mobile and password from request body

  // Check if both mobile and password are provided
  if (!mobile || !password) {
    return res.status(400).json({ message: "Please provide both mobile and password." });
  }

  // Find the user by mobile number and check if the role is 'admin'
  const user = await User.findOne({ mobile, role: "admin" });

  if (!user) {
    return res.status(400).json({ message: "Admin not found or invalid credentials." });
  }

  // Compare the provided password with the stored hashed password (using argon2)
  try {
    const isMatch = await argon2.verify(user.password, password); // Verify the hashed password with argon2

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password." });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error comparing passwords. Please try again later." });
  }

  // Generate JWT token for the admin, including their role
  const token = jwt.sign({ _id: user._id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1hr" });

  // Set the JWT token in a cookie for 1hour
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("Websitetoken", token, {
      httpOnly: true,
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour (60 minutes * 60 seconds * 1000 ms)
      path: "/",
    })
  );

  // Send response with user details and the token
  const userResponse = {
    ...user.toObject(),
    profile_pic: user.profile_pic, // Optionally include profile picture
  };

  res.json({
    user: userResponse,
    token,
    status: true,
  });
});

const logoutUser = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1]; // Extract token from "Bearer {token}"

    blacklistToken(token);

    // Expire the cookie immediately
    res.setHeader(
      "Set-Cookie",
      cookie.serialize("Websitetoken", "", {
        httpOnly: false,
        expires: new Date(0),
        path: "/",
      })
    );

    res.json({ message: "Logout successful", status: true });
  } else {
    res.status(200).json({ message: "Invalid token", status: false });
  }
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  try {
    const user = await User.findOne({ mobile });

    if (!user) {
      throw new ErrorHandler("User Not Found. ", 400);
    }

    if (user.otp_verified) {
      throw new ErrorHandler("User is already OTP verified.", 400);
    }

    // Check if the provided OTP matches the OTP in the user document
    if (user.otp !== otp) {
      throw new ErrorHandler("Invalid OTP.", 400);
    }

    // Update the user's otp_verified field to 1 (OTP verified)
    const result = await User.updateOne(
      { _id: user._id },
      {
        $set: {
          otp_verified: 1,
        },
      }
    );

    if (result.nModified > 0) {
      console.log("OTP verification status updated successfully.");
    } else {
      console.log("No matching user found or OTP verification status already set.");
    }

    // Retrieve the updated user document
    const updatedUser = await User.findById(user._id);

    const authToken = jwt.sign({ _id: updatedUser._id, role: updatedUser.role }, process.env.JWT_SECRET);

    res.json({
      user: updatedUser,
      token: authToken,
      status: true,
    });
  } catch (error) {
    throw new ErrorHandler(error.message, 500);
  }
});

const resendOTP = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  // Generate a new OTP
  const newOTP = generateOTP();

  // Find the user by mobile number
  const user = await User.findOne({ mobile });

  if (!user) {
    throw new ErrorHandler("User Not Found.", 400);
  }

  // Update the user's otp field with the new OTP
  const result = await User.updateOne({ _id: user._id }, { $set: { otp: newOTP } });

  // Send the new OTP to the user's email
  const sendEmailAsync = async () => {
    const subject = "Your OTP has been Sent";
    const text = `Hello ${user.full_name},\n\nYour new OTP for verification is: ${newOTP}`;

    try {
      await sendEmail(user.email, subject, text); // Send email with new OTP
    } catch (error) {
      console.error("Failed to send OTP email:", error);
    }
  };

  // Schedule the email to be sent
  setImmediate(sendEmailAsync);

  res.json({
    message: "New OTP sent successfully.",
    newOTP, // You can return the OTP here, but remember this might be insecure
    status: true,
  });
});

const ForgetresendOTP = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  const userdata = await User.findOne({ mobile: mobile });

  if (!userdata) {
    throw new ErrorHandler("Mobile Number Not Found", 400);
  }
  // Generate a new OTP
  const newOTP = generateOTP();

  // Find the user by mobile number
  const user = await User.findOne({ mobile });

  sendOTP(user.first_name, mobile, newOTP);
  if (!user) {
    res.status(200).json({
      message: "User Not Found.",
      status: false,
    });
    return;
  }

  const result = await User.updateOne({ _id: user._id }, { $set: { otp: newOTP } });

  // Send the new OTP to the user (you can implement this logic)

  res.status(200).json({
    message: "New OTP sent successfully.",
    otp: newOTP,
    status: true,
  });
});

const profilePicUpload = asyncHandler(async (req, res) => {
  // upload.single("profilePic")(req, res, async (err) => {
  //   if (err) {
  //     // Handle file upload error
  //     throw new ErrorHandler("File upload error", 400);
  //   }
  //   const userId = req.user._id; // Assuming you have user authentication middleware
  //   // Check if the user exists
  //   const user = await User.findById(userId);
  //   if (!user) {
  //     throw new ErrorHandler("User not found", 400);
  //   }
  //   //     const pic_name_url = await getSignedUrlS3(user.pic);
  //   // Update the user's profile picture (if uploaded)
  //   if (req.file) {
  //     const uploadedFileName = req.file.filename;
  //     user.pic = "uploads/profiles/" + uploadedFileName;
  //     await user.save();
  //     return res.status(200).json({
  //       message: "Profile picture uploaded successfully",
  //       pic: user.pic,
  //       status: true,
  //     });
  //   }
  //   throw new ErrorHandler("No file uploaded", 400);
  // });
});

const profilePicKey = asyncHandler(async (req, res) => {
  const userId = req.user._id; // Assuming you have user authentication middleware
  const profilePicKeys = req.body.profilePicKey;
  // Check if the user exists
  const user = await User.findById(userId);

  if (!user) {
    return res.status(200).json({ message: "User not found" });
  }
  // Update the user's profile picture (if uploaded)
  user.pic = profilePicKeys;
  await user.save();
  const pic_name_url = await getSignedUrlS3(user.pic);
  return res.status(200).json({
    message: "Profile picture uploaded successfully",
    pic: pic_name_url,
    status: true,
  });
  return res.status(200).json({ message: "No file uploaded" });
});

const updateProfileData = asyncHandler(async (req, res) => {
  const { interest, about_me, last_name, first_name, dob, address } = req.body;

  const userId = req.user._id; // Assuming you have user authentication middleware
  const full_name = `${first_name} ${last_name}`;

  console.log(dob);

  try {
    // Update the user's profile fields if they are provided in the request
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          interest: interest,
          about_me: about_me,
          last_name: last_name,
          first_name: first_name,
          dob: dob,
          address: address,
          full_name: full_name,
        },
      },
      { new: true }
    ); // Option to return the updated document

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      _id: updatedUser._id,
      interest: updatedUser.interest,
      about_me: updatedUser.about_me,
      address: updatedUser.address,
      last_name: updatedUser.last_name,
      first_name: updatedUser.first_name,
      dob: updatedUser.dob,
      pic: updatedUser.pic,
      email: updatedUser.email,
      mobile: updatedUser.mobile,
      username: updatedUser.username,
      status: true,
    });
  } catch (error) {
    console.error("Error updating user profile:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

const forgetPassword = asyncHandler(async (req, res) => {
  const { newPassword, mobile, otp } = req.body;

  if (!newPassword || !mobile || !otp) {
    res.status(200).json({
      message: "Please enter all the required fields.",
      status: false,
    });
    return;
  }

  // Find the user by _id
  const user = await User.findOne({ mobile });

  if (!user) {
    res.status(200).json({
      message: "User Not Found.",
      status: false,
    });
    return;
  }
  if (user.otp !== otp) {
    res.status(200).json({
      message: "Invalid OTP.",
      status: false,
    });
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const result = await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });
  if (result.nModified === 1) {
    // Fetch the updated user
    const updatedUser = await User.findById(user._id);

    const sendEmailAsync = async () => {
      const subject = "Password Reset Successful!";
      const text = `Hello ${updatedUser.full_name},\n\nYour password has been successfully reset. You can now log in with your new password.\n\nIf you did not request this change, please contact our support team immediately.\n\nThank you!`;

      try {
        await sendEmail(updatedUser.email, subject, text); // Send email after user registration
      } catch (error) {
        console.error("Failed to send email notification:", error);
      }
    };

    // Schedule the email to be sent
    setImmediate(sendEmailAsync);

    res.status(200).json({
      message: "Password reset successfully.",
      updatedUser,
      status: true,
    });
  } else {
    res.status(500).json({
      message: "Password reset failed.",
      status: false,
    });
  }
});

const ChangePassword = asyncHandler(async (req, res, next) => {
  const userId = req.headers.userID; // Assuming you have user authentication middleware
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword || !userId) {
    return next(new ErrorHandler("Please enter all the required fields.", 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new ErrorHandler("New password and confirm password do not match.", 400));
  }

  // Find the user by _id
  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorHandler("User Not Found.", 404));
  }

  // Check if the old password is correct
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    return next(new ErrorHandler("Old password is incorrect.", 400));
  }

  // Hash the new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Update the password in MongoDB
  try {
    const result = await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

    // Fetch the updated user
    const updatedUser = await User.findById(user._id);
    const sendEmailAsync = async () => {
      const subject = "Password changed Successful!";
      const text = `Hello ${updatedUser.full_name},\n\nYour password has been successfully changed. You can now log in with your new password.\n\nIf you did not request this change, please contact our support team immediately.\n\nThank you!`;

      try {
        await sendEmail(updatedUser.email, subject, text); // Send email after user registration
      } catch (error) {
        console.error("Failed to send email notification:", error);
      }
    };

    // Schedule the email to be sent
    setImmediate(sendEmailAsync);

    res.status(200).json({
      message: "Password changed successfully.",
      updatedUser,
      status: true,
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to update password in MongoDB.", 500));
  }
});

const getAllSupplier = asyncHandler(async (req, res) => {
  try {
    const supplier = await User.find({ role: { $in: ["supplier", "both"] } }).select("full_name _id");

    if (!supplier) {
      return res.status(200).json({
        message: "Supplier Not Found",
        status: false,
      });
    }

    res.json({
      Supplier: supplier,
      status: true,
    });
  } catch (error) {
    console.error("Get Supplier API error:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});
// Controller function to get products by category_id
const getProductByCategory_id = asyncHandler(async (req, res) => {
  const { category_id } = req.body;
  const userID = req.headers.userID;
  try {
    // Fetch the user data to get their pin code
    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: "User not found", status: false });
    }

    const userPinCode = user.pin_code;
    // Validate category_id
    if (!category_id) {
      return res.status(400).json({ message: "Category ID is required", status: false });
    }

    // Find all suppliers whose pin codes match the user's pin code
    const matchingSuppliers = await User.find({
      role: { $in: ["supplier", "both"] },
      pin_code: { $in: userPinCode },
      _id: { $ne: userID },
    }).select("_id");

    const supplierIds = matchingSuppliers.map((supplier) => supplier._id);

    // Fetch products by category_id
    const products = await Product.find({ category_id, active: true, supplier_id: { $in: supplierIds } }).populate("");

    // Check if products are found
    if (!products.length) {
      return res.status(404).json({ message: "No products found for the given category", status: false });
    }

    // For each product, check if it is favorited by the user
    const productsWithFavoriteStatus = await Promise.all(
      products.map(async (product) => {
        const isFavorite = await Favorite.findOne({
          user_id: userID,
          product_id: product._id,
        });

        return {
          ...product.toObject(),
          isFavorite: !!isFavorite, // true if the product is favorited, false otherwise
        };
      })
    );

    // Return the products
    res.status(200).json({
      status: true,
      products: productsWithFavoriteStatus,
    });
  } catch (error) {
    console.error("Error fetching products by category_id:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Controller function to search products
const searchProducts = asyncHandler(async (req, res) => {
  const { q } = req.body; // Query parameter for search terms
  const userID = req.headers.userID;

  try {
    // Validate search query
    if (!q) {
      return res.status(400).json({ message: "Search query is required", status: false });
    }

    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Create a regex pattern for case-insensitive search
    const regex = new RegExp(q, "i");

    // Fetch products matching the search query
    const products = await Product.find({
      $or: [{ english_name: regex }, { local_name: regex }, { other_name: regex }],
      active: true,
    }).populate("category_id", "_id category_name");

    // Check if products are found
    if (!products.length) {
      return res.status(404).json({ message: "No products found matching the search query", status: false });
    }

    // For each product, check if it is favorited by the user
    const productsWithFavoriteStatus = await Promise.all(
      products.map(async (product) => {
        const isFavorite = await Favorite.findOne({
          user_id: userID,
          product_id: product._id,
        });

        return {
          ...product.toObject(),
          isFavorite: !!isFavorite, // true if the product is favorited, false otherwise
        };
      })
    );

    // Return the products with favorite status
    res.status(200).json({
      status: true,
      products: productsWithFavoriteStatus,
    });
  } catch (error) {
    console.error("Error searching products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Define the addFavoriteProduct function
const addFavoriteProduct = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  const userID = req.headers.userID;

  try {
    // Validate product_id and userID
    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required", status: false });
    }
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Check if the product exists
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ message: "Product not found", status: false });
    }

    // Create a new favorite record
    const favorite = new Favorite({
      user_id: userID,
      product_id,
    });

    // Save the favorite record
    await favorite.save();

    // Return success response
    res.status(201).json({
      status: true,
      message: "Product added to favorites successfully",
      favorite,
    });
  } catch (error) {
    console.error("Error adding favorite product:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Define the removeFavoriteProduct function
const removeFavoriteProduct = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  const userID = req.headers.userID;

  try {
    // Validate product_id and userID
    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required", status: false });
    }
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Find and remove the favorite record
    const favorite = await Favorite.findOneAndDelete({
      user_id: userID,
      product_id: product_id,
    });

    if (!favorite) {
      return res.status(404).json({ message: "Favorite product not found", status: false });
    }

    // Return success response
    res.status(200).json({
      status: true,
      message: "Product removed from favorites successfully",
    });
  } catch (error) {
    console.error("Error removing favorite product:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getFavoriteProduct = asyncHandler(async (req, res) => {
  const userID = req.headers.userID;

  try {
    // Validate userID
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Find all favorite products for the user
    //     const favorites = await Favorite.find({ user_id: userID }).sort({ createdAt: -1 }).populate("product_id");
    const favorites = await Favorite.find({ user_id: userID })
      .sort({ createdAt: -1 })
      .populate({
        path: "product_id",
        model: "Product",
        match: { delete_status: true }, // Filters products inside populate
      });

    if (!favorites.length) {
      return res.status(404).json({ message: "No favorite products found", status: false });
    }

    // Return success response
    res.status(200).json({
      status: true,
      message: "Favorite products retrieved successfully",
      favorites,
    });
  } catch (error) {
    console.error("Error getting favorite products:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Define the addToCart function
const addToCart = asyncHandler(async (req, res) => {
  const { product_id, quantity } = req.body;
  const userID = req.headers.userID;

  try {
    // Validate product_id, quantity, and userID
    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required", status: false });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: "Quantity should be a positive number", status: false });
    }
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Find the user and check if they exist
    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: "User not found", status: false });
    }

    // Check if the product exists and populate supplier information
    //     const product = await Product.findById(product_id).populate({
    //       path: "supplier_id",
    //       model: "User",
    //     });
    const product = await Product.findOne({
      _id: product_id,
      delete_status: true,
    }).populate({
      path: "supplier_id",
      model: "User",
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found", status: false });
    }

    // Prevent the supplier from adding their own product to the cart
    if (product.supplier_id._id.toString() === user._id.toString()) {
      return res.status(400).json({ message: "You cannot add your own product to the cart", status: false });
    }

    // Ensure there is a supplier and pin codes to check
    if (!product.supplier_id || !product.supplier_id.pin_code || !user.pin_code) {
      return res.status(400).json({ message: "Supplier or User pin codes are missing", status: false });
    }

    // Check if any user pin code matches any supplier pin code
    const isPinCodeMatch = user.pin_code.some((pin) => product.supplier_id.pin_code.includes(pin));
    if (!isPinCodeMatch) {
      return res.status(400).json({ message: "User's location is not eligible for this supplier's product", status: false });
    }

    // Check if the requested quantity exceeds available stock
    if (quantity > product.quantity) {
      return res.status(400).json({ message: "Requested quantity exceeds available stock", status: false });
    }

    // Check if the product is already in the cart
    let cartItem = await Cart.findOne({ user_id: userID, product_id: product_id });
    if (cartItem) {
      // Update the quantity of the existing cart item
      cartItem.quantity += quantity;
    } else {
      // Create a new cart item
      cartItem = new Cart({
        user_id: userID,
        product_id: product_id,
        quantity: quantity,
        supplier_id: product.supplier_id,
      });
    }

    // Save the cart item
    await cartItem.save();

    // Return success response
    res.status(201).json({
      status: true,
      message: "Product added to cart successfully",
      cartItem,
    });
  } catch (error) {
    console.error("Error adding product to cart:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const removeFromCart = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  const userID = req.headers.userID;

  try {
    // Validate product_id and userID
    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required", status: false });
    }
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Check if the product is in the cart
    const cartItem = await Cart.findOne({ user_id: userID, product_id: product_id });
    if (!cartItem) {
      return res.status(404).json({ message: "Product not found in cart", status: false });
    }

    // Remove the product from the cart
    await Cart.deleteOne({ user_id: userID, product_id: product_id });

    // Return success response
    res.status(200).json({
      status: true,
      message: "Product removed from cart successfully",
    });
  } catch (error) {
    console.error("Error removing product from cart:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getProductDetailByProductId = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  const userID = req.headers.userID;

  try {
    // Validate product_id
    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required", status: false });
    }

    // Find the product by ID
    //     const product = await Product.findById(product_id);

    const product = await Product.findOne({
      _id: product_id,
      delete_status: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found", status: false });
    }

    // Check if the product is favorited by the user
    const isFavorite = await Favorite.findOne({
      user_id: userID,
      product_id: product._id,
    });

    // Return success response
    res.status(200).json({
      status: true,
      message: "Product details retrieved successfully",
      product: {
        ...product.toObject(),
        isFavorite: !!isFavorite, // true if the product is favorited, false otherwise
      },
    });
  } catch (error) {
    console.error("Error getting product details:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// const getCartProducts = asyncHandler(async (req, res) => {
//   const userID = req.headers.userID;

//   try {
//     // Validate userID
//     if (!userID) {
//       return res.status(400).json({ message: "User ID is required", status: false });
//     }

//     // Find all cart items for the user
//     const cartItems = await Cart.find({ user_id: userID }).populate("product_id");

//     if (!cartItems || cartItems.length === 0) {
//       return res.status(404).json({ message: "No items found in cart", status: false });
//     }

//     //Calculate total amount
//     let totalAmount = 0;
//     cartItems.forEach((item) => {
//       totalAmount += item.product_id.price * item.quantity;
//     });

//     // Return success response
//     res.status(200).json({
//       status: true,
//       message: "Cart items retrieved successfully",
//       cartItems,
//       totalAmount,
//     });
//   } catch (error) {
//     console.error("Error getting cart items:", error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// edit by Atest

const getCartProducts = asyncHandler(async (req, res) => {
  const userID = req.headers.userID;

  try {
    // Validate that userID exists in the headers
    if (!userID) {
      console.log("No userID found in the headers.");
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Check if the userID is a valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userID)) {
      console.log(`Invalid userID format: ${userID}`);
      return res.status(400).json({ message: "Invalid User ID format", status: false });
    }

    // Find cart items for the given userID with additional conditions
    console.log(`Finding cart items for userID: ${userID}`);
    const cartItems = await Cart.find({
      user_id: userID,
    }).populate({
      path: "product_id",
      match: { delete_status: true, quantity: { $gt: 0 } }, // Quantity should be greater than 0 } // Only populate products where delete_status is true
    });

    // Filter out cart items where the product_id is null (i.e., product didn't match delete_status)
    console.log(cartItems);
    const filteredCartItems = cartItems.filter((item) => item.product_id);

    // Log the filtered cart items
    console.log("Filtered Cart Items:", filteredCartItems);

    if (!filteredCartItems || filteredCartItems.length === 0) {
      console.log("No valid cart items found for this user.");
      return res.status(404).json({ message: "No valid items found in cart", status: false });
    }

    // Calculate total amount
    let totalAmount = 0;
    filteredCartItems.forEach((item) => {
      if (item.product_id && item.product_id.price) {
        console.log(`Calculating for item: ${item.product_id.name}`);
        totalAmount += item.product_id.price * item.quantity;
      } else {
        console.log(`Skipping item due to missing price or product_id: ${item._id}`);
      }
    });

    // Return success response
    console.log(`Total amount calculated: ${totalAmount}`);
    res.status(200).json({
      status: true,
      message: "Cart items retrieved successfully",
      cartItems: filteredCartItems,
      totalAmount,
    });
  } catch (error) {
    // Enhanced error logging
    console.error("Error in getCartProducts:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

const increaseCartQuantity = asyncHandler(async (req, res) => {
  const { product_id, quantity } = req.body;
  const userID = req.headers.userID;

  try {
    // Validate inputs
    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required", status: false });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: "Quantity should be a positive number", status: false });
    }
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Check if the cart item exists
    let cartItem = await Cart.findOne({ user_id: userID, product_id: product_id });
    if (!cartItem) {
      return res.status(404).json({ message: "Product not found in cart", status: false });
    }

    // Check if the requested quantity exceeds available stock
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ message: "Product not found", status: false });
    }
    if (cartItem.quantity + quantity > product.quantity) {
      return res.status(400).json({ message: "Requested quantity exceeds available stock", status: false });
    }

    // Update the quantity
    cartItem.quantity += quantity;
    await cartItem.save();

    // Return success response
    res.status(200).json({
      status: true,
      message: "Cart quantity increased successfully",
      cartItem,
    });
  } catch (error) {
    console.error("Error increasing cart quantity:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const decreaseCartQuantity = asyncHandler(async (req, res) => {
  const { product_id, quantity } = req.body;
  const userID = req.headers.userID;

  try {
    // Validate inputs
    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required", status: false });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: "Quantity should be a positive number", status: false });
    }
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Check if the cart item exists
    let cartItem = await Cart.findOne({ user_id: userID, product_id: product_id });
    if (!cartItem) {
      return res.status(404).json({ message: "Product not found in cart", status: false });
    }

    // Ensure the quantity to be decreased is valid
    if (cartItem.quantity - quantity < 1) {
      return res.status(400).json({ message: "Quantity cannot be less than 1", status: false });
    }

    // Decrease the quantity
    cartItem.quantity -= quantity;
    await cartItem.save();

    // Return success response
    res.status(200).json({
      status: true,
      message: "Cart quantity decreased successfully",
      cartItem,
    });
  } catch (error) {
    console.error("Error decreasing cart quantity:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// const checkout = asyncHandler(async (req, res) => {
//   const userID = req.headers.userID;
//   const { shipping_address, payment_method } = req.body;

//   try {
//     // Validate userID, shipping_address, and payment_method (as before)

//     // Find all cart items for the user
//     const cartItems = await Cart.find({ user_id: userID }).populate("product_id");

//     if (!cartItems || cartItems.length === 0) {
//       return res.status(404).json({ message: "No items found in cart", status: false });
//     }

//     // Calculate total amount and validate stock
//     let totalAmount = 0;
//     const verificationCodes = {};
//     const supplierIds = new Set(); // Create a Set to collect unique supplier IDs

//     const items = cartItems.map((item) => {
//       if (item.quantity > item.product_id.quantity) {
//         return res.status(400).json({ message: `Requested quantity for ${item.product_id.english_name} exceeds available stock`, status: false });
//       }
//       totalAmount += item.product_id.price * item.quantity;

//       // Add supplier ID to the Set
//       supplierIds.add(item.product_id.supplier_id.toString());

//       // Generate a unique verification code for each supplier_id
//       const supplierId = item.product_id.supplier_id.toString();
//       if (!verificationCodes[supplierId]) {
//         verificationCodes[supplierId] = generateVerificationCode();
//       }

//       return {
//         product_id: item.product_id._id,
//         quantity: item.quantity,
//         supplier_id: supplierId,
//         verification_code: verificationCodes[supplierId],
//         status: "order",
//       };
//     });

//     // Generate a unique order ID and create the order (as before)
//     const orderId = generateOrderID();

//     const order = new Order({
//       order_id: orderId,
//       user_id: userID,
//       items,
//       shipping_address,
//       payment_method,
//       total_amount: totalAmount,
//     });

//     const savedOrder = await order.save();

//     // Send notification to the user
//     const user = await User.findById(userID);
//     if (user.firebase_token || user.firebase_token == "dummy_token") {
//       const registrationToken = user.firebase_token;
//       const title = "Order Placed";
//       const body = `Your order has been successfully placed!`;

//       const notificationResult = await sendFCMNotification(registrationToken, title, body);
//       if (notificationResult.success) {
//         console.log("Notification sent successfully:", notificationResult.response);
//       } else {
//         console.error("Failed to send notification:", notificationResult.error);
//       }

//       // Pass supplier IDs as an array to the addNotification function
//       await addNotification(savedOrder.user_id, savedOrder._id, body, savedOrder.total_amount, null, title, "order");
//     }

//     // Send email
//     const sendEmailAsync = async () => {
//       const subject = "Thank You for Your Purchase!";
//       const text = `Hello ${user.full_name},\n\nThank you for your purchase! We appreciate your business. If you have any questions or need assistance, feel free to reach out to us.`;

//       try {
//         await sendEmail(user.email, subject, text); // Send email after user registration
//       } catch (error) {
//         console.error("Failed to send email notification:", error);
//       }
//     };

//     // Schedule the email to be sent
//     setImmediate(sendEmailAsync);

//     // Send notification to each supplier
//     const supplierArray = Array.from(supplierIds);
//     const suppliers = await User.find({ _id: { $in: supplierArray } });

//     for (const supplier of suppliers) {
//       if (supplier.firebase_token || supplier.firebase_token == "dummy_token") {
//         const supplierToken = supplier.firebase_token;
//         const supplierTitle = "Product Sold";
//         const supplierBody = `A product has been purchased from your inventory!`;

//         const supplierNotificationResult = await sendFCMNotification(supplierToken, supplierTitle, supplierBody);
//         if (supplierNotificationResult.success) {
//           console.log("Notification sent successfully to supplier:", supplierNotificationResult.response);
//         } else {
//           console.error("Failed to send notification to supplier:", supplierNotificationResult.error);
//         }
//         await addNotification(savedOrder.user_id, savedOrder._id, supplierBody, savedOrder.total_amount, Array.from(supplierIds), supplierTitle, "order");
//       }

//       // Send email
//       const sendEmailAsync = async () => {
//         const subject = "Thank You for Your Purchase!";
//         const text = `Hello ${supplier.full_name},\n\nThank you for your purchase! We appreciate your business. If you have any questions or need assistance, feel free to reach out to us.`;

//         try {
//           await sendEmail(supplier.email, subject, text); // Send email after user registration
//         } catch (error) {
//           console.error("Failed to send email notification:", error);
//         }
//       };

//       // Schedule the email to be sent
//       setImmediate(sendEmailAsync);
//     }

//     // Update product stock and clear user's cart (as before)
//     for (const item of cartItems) {
//       await Product.findByIdAndUpdate(item.product_id._id, { $inc: { quantity: -item.quantity } });
//     }
//     await Cart.deleteMany({ user_id: userID });

//     res.status(201).json({
//       status: true,
//       message: "Order placed successfully",
//       order: savedOrder,
//     });
//   } catch (error) {
//     console.error("Error during checkout:", error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// edit by Atest

// const checkout = asyncHandler(async (req, res) => {
//       const userID = req.headers.userID;
//       const { shipping_address, payment_method } = req.body;

//       try {
//         // Validate required fields
//         if (!userID || !shipping_address || !payment_method) {
//           return res.status(400).json({ message: "Missing required fields", status: false });
//         }

//         // Fetch all cart items for the user and populate product details
//         const cartItems = await Cart.find({ user_id: userID }).populate("product_id");

//         if (!cartItems || cartItems.length === 0) {
//           return res.status(404).json({ message: "No items found in cart", status: false });
//         }

//         // **Filter out products that should NOT be included in checkout**
//         const validCartItems = cartItems.filter(item =>
//           item.product_id && item.product_id.delete_status === true && item.product_id.quantity > 0
//         );

//         if (validCartItems.length === 0) {
//           return res.status(400).json({ message: "All products in cart are unavailable or out of stock.", status: false });
//         }

//         let totalAmount = 0;
//         const verificationCodes = {};
//         const supplierIds = new Set();
//         const items = [];

//         // **Process Valid Cart Items**
//         for (const item of validCartItems) {
//           const product = item.product_id;
//           totalAmount += product.price * item.quantity;
//           supplierIds.add(product.supplier_id.toString());

//           // Generate unique verification code for each supplier
//           const supplierId = product.supplier_id.toString();
//           if (!verificationCodes[supplierId]) {
//             verificationCodes[supplierId] = generateVerificationCode();
//           }

//           items.push({
//             product_id: product._id,
//             quantity: item.quantity,
//             supplier_id: supplierId,
//             verification_code: verificationCodes[supplierId],
//             status: "order",
//           });
//         }

//         // **Proceed with Order Creation**
//         const orderId = generateOrderID();
//         const order = new Order({
//           order_id: orderId,
//           user_id: userID,
//           items,
//           shipping_address,
//           payment_method,
//           total_amount: totalAmount,
//         });

//         const savedOrder = await order.save();

//         // **Update Product Stock**
//         for (const item of validCartItems) {
//           await Product.findByIdAndUpdate(item.product_id._id, {
//             $inc: { quantity: -item.quantity }
//           });
//         }

//         // **Clear Cart**
//         await Cart.deleteMany({ user_id: userID });

//         res.status(201).json({
//           status: true,
//           message: "Order placed successfully",
//           order: savedOrder,
//         });

//       } catch (error) {
//         console.error("Error during checkout:", error.message);
//         res.status(500).json({ error: "Internal Server Error" });
//       }
//     });

const checkout = asyncHandler(async (req, res) => {
  const userID = req.headers.userID;
  const { shipping_address, payment_method } = req.body;

  try {
    // Validate required fields
    if (!userID || !shipping_address || !payment_method) {
      return res.status(400).json({ message: "Missing required fields", status: false });
    }

    // Fetch all cart items for the user and populate product details
    const cartItems = await Cart.find({ user_id: userID }).populate("product_id");

    if (!cartItems || cartItems.length === 0) {
      return res.status(404).json({ message: "No items found in cart", status: false });
    }

    // **Filter out products that should NOT be included in checkout**
    const validCartItems = cartItems.filter((item) => item.product_id && item.product_id.delete_status === true && item.product_id.active === true && item.product_id.quantity > 0);

    if (validCartItems.length === 0) {
      return res.status(400).json({ message: "All products in cart are unavailable or out of stock.", status: false });
    }

    // **Recheck Product Quantities Before Proceeding**
    for (const item of validCartItems) {
      const product = await Product.findById(item.product_id._id); // Fetch latest product data

      if (!product || product.quantity < item.quantity) {
        return res.status(400).json({
          status: false,
          message: `Insufficient quantity stock for '${product ? product.english_name : "a product"}'. Remaning qantity is ${product.quantity}`,
        });
      }
    }

    let totalAmount = 0;
    const verificationCodes = {};
    const supplierIds = new Set();
    const items = [];

    // **Process Valid Cart Items**
    for (const item of validCartItems) {
      const product = item.product_id;
      totalAmount += product.price * item.quantity;
      supplierIds.add(product.supplier_id.toString());

      // Generate unique verification code for each supplier
      const supplierId = product.supplier_id.toString();
      if (!verificationCodes[supplierId]) {
        verificationCodes[supplierId] = generateVerificationCode();
      }

      items.push({
        product_id: product._id,
        quantity: item.quantity,
        supplier_id: supplierId,
        verification_code: verificationCodes[supplierId],
        status: "order",
      });
    }

    // **Proceed with Order Creation**
    const orderId = generateOrderID();
    const order = new Order({
      order_id: orderId,
      user_id: userID,
      items,
      shipping_address,
      payment_method,
      total_amount: totalAmount,
    });

    const savedOrder = await order.save();

    // **Update Product Stock**
    for (const item of validCartItems) {
      await Product.findByIdAndUpdate(item.product_id._id, {
        $inc: { quantity: -item.quantity },
      });
    }

    // **Clear Cart**
    await Cart.deleteMany({ user_id: userID });

    res.status(201).json({
      status: true,
      message: "Order placed successfully",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Error during checkout:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// const getOrderNotifications = asyncHandler(async (req, res) => {
//   const userID = req.headers.userID;

//   try {
//     // Validate userID
//     if (!userID) {
//       return res.status(400).json({ message: "User ID is required", status: false });
//     }

//     // Fetch notifications for the user
//     const notifications = await OrderNotification.find({ user_id: userID }).sort({ created_at: -1 });

//     if (!notifications || notifications.length === 0) {
//       return res.status(404).json({ message: "No notifications found", status: false });
//     }

//     // Mark all unread notifications as read for the supplier
//     await OrderNotification.updateMany({ user_id: userID, userstatus: "unread" }, { $set: { userstatus: "read" } });

//     res.status(200).json({
//       status: true,
//       message: "Notifications retrieved successfully",
//       notifications,
//     });
//   } catch (error) {
//     console.error("Error retrieving notifications:", error.message);
//     res.status(500).json({ message: "Internal Server Error", status: false });
//   }
// });

// const generateVerificationCode = () => {
//   const characters = "0123456789";
//   let code = "";
//   for (let i = 0; i < 6; i++) {
//     code += characters.charAt(Math.floor(Math.random() * characters.length));
//   }
//   return code;
// };

//edit by Atest

const getOrderNotifications = asyncHandler(async (req, res) => {
  const userID = req.headers.userID;

  try {
    // Validate userID
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Fetch notifications and populate order details along with product and supplier names
    const notifications = await OrderNotification.find({ user_id: userID })
      .sort({ created_at: -1 })
      .populate({
        path: "order_id",
        model: "Order",
        populate: [
          {
            path: "items.product_id", // Populate product details inside items array
            model: "Product",
            select: "english_name", // Select only the name field of the product
          },
          {
            path: "items.supplier_id", // Populate supplier details
            model: "User", // Assuming 'User' is your model for suppliers
            select: "full_name", // Select only the name field of the supplier
          },
        ],
      });

    if (!notifications || notifications.length === 0) {
      return res.status(404).json({ message: "No notifications found", status: false });
    }

    // Mark all unread notifications as read for the supplier
    await OrderNotification.updateMany({ user_id: userID, userstatus: "unread" }, { $set: { userstatus: "read" } });

    res.status(200).json({
      status: true,
      message: "Notifications retrieved successfully",
      notifications,
    });
  } catch (error) {
    console.error("Error retrieving notifications:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateOrderID = () => {
  const randomNumber = Math.floor(Math.random() * 10000000); // Generate a number between 0 and 9999999
  return `#${randomNumber.toString().padStart(7, "0")}`; // Pad with leading zeros to ensure it has 7 digits
};

// const getAllOrders = asyncHandler(async (req, res) => {
//   const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
//   const limit = parseInt(req.query.limit) || 10; // Number of orders per page, default to 10
//   const search = req.query.search || ""; // Search term
//   const sortBy = req.query.sortBy || "created_at"; // Field to sort by, default to 'createdAt'
//   const order = req.query.order === "asc" ? 1 : -1; // Sorting order, default to descending

//   try {
//     const query = search
//       ? {
//           $or: [{ "shipping_address.name": { $regex: search, $options: "i" } }, { payment_method: { $regex: search, $options: "i" } }, { order_id: { $regex: search, $options: "i" } }],
//         }
//       : {};

//     const totalOrders = await Order.countDocuments(query);
//     const orders = await Order.find(query)
//       .sort({ [sortBy]: order })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .populate("user_id", "full_name email") // Populate user details
//       .populate("items.product_id", "english_name price") // Populate product details
//       .populate("items.supplier_id", "full_name"); // Populate supplier details

//     // Fetch payment status from the Transaction collection
//     const ordersWithPaymentStatus = await Promise.all(
//       orders.map(async (order) => {
//         const transaction = await Transaction.findOne({ order_id: order._id });
//         return {
//           ...order.toObject(),
//           payment_status: transaction ? transaction.payment_status : "Cash",
//         };
//       })
//     );

//     res.status(200).json({
//       orders: ordersWithPaymentStatus,
//       page,
//       totalPages: Math.ceil(totalOrders / limit),
//       totalOrders,
//       status: true,
//     });
//   } catch (error) {
//     console.error("Error fetching orders:", error.message);
//     res.status(500).json({ message: "Internal Server Error", status: false });
//   }
// });

const getAllOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const sortBy = req.query.sortBy || "created_at";
  const order = req.query.order === "asc" ? 1 : -1;

  try {
    const query = search
      ? {
          $or: [{ "shipping_address.name": { $regex: search, $options: "i" } }, { payment_method: { $regex: search, $options: "i" } }, { order_id: { $regex: search, $options: "i" } }],
        }
      : {};

    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.aggregate([
      { $match: query },
      { $sort: { [sortBy]: order } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "users",
          localField: "items.supplier_id",
          foreignField: "_id",
          as: "supplier",
        },
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "transactions",
          localField: "_id",
          foreignField: "order_id",
          as: "transaction",
        },
      },
      { $unwind: { path: "$transaction", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          order_id: 1,
          total_amount: 1,
          payment_method: 1,
          //   created_at: {
          //     $dateToString: { format: "%Y-%m-%d %H:%M:%S", date: "$created_at" }
          //   },
          created_at: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$created_at",
              timezone: "+05:30",
            },
          },
          user_name: { $ifNull: ["$user.full_name", "N/A"] },
          user_email: "$user.email",
          user_mobile: "$user.mobile",
          item_status: "$items.status",
          product_id: "$items.product_id",
          quantity: "$items.quantity",
          verification_code: "$items.verification_code",
          supplier_name: "$supplier.full_name",
          payment_status: { $ifNull: ["$transaction.payment_status", "Cash"] },
        },
      },
    ]);

    res.status(200).json({
      orders,
      page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const getAllCancelOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const sortBy = req.query.sortBy || "created_at";
  const order = req.query.order === "asc" ? 1 : -1;

  try {
    const query = search
      ? {
          $or: [{ "shipping_address.name": { $regex: search, $options: "i" } }, { payment_method: { $regex: search, $options: "i" } }, { order_id: { $regex: search, $options: "i" } }],
        }
      : {};

    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.aggregate([
      { $match: query },
      { $match: { "items.status": "cancelled" } },
      { $sort: { [sortBy]: order } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "users",
          localField: "items.supplier_id",
          foreignField: "_id",
          as: "supplier",
        },
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "transactions",
          localField: "_id",
          foreignField: "order_id",
          as: "transaction",
        },
      },
      { $unwind: { path: "$transaction", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          order_id: 1,
          total_amount: 1,
          payment_method: 1,
          //     created_at: {
          //       $dateToString: { format: "%Y-%m-%d %H:%M:%S", date: "$created_at" },
          //     },
          created_at: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$created_at",
              timezone: "+05:30",
            },
          },
          user_name: { $ifNull: ["$user.full_name", "N/A"] },
          user_email: "$user.email",
          user_mobile: "$user.mobile",
          item_status: "$items.status",
          product_id: "$items.product_id",
          quantity: "$items.quantity",
          verification_code: "$items.verification_code",
          supplier_name: "$supplier.full_name",
          payment_status: { $ifNull: ["$transaction.payment_status", "Cash"] },
        },
      },
    ]);

    res.status(200).json({
      orders,
      page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

// const getProductsByOrderAndSupplier = asyncHandler(async (req, res) => {
//   const { order_id } = req.params;

//   try {
//     // Validate order_id
//     if (!order_id) {
//       return res.status(400).json({ message: "Order ID is required", status: false });
//     }

//     // Find the order
//     const order = await Order.findById(order_id)
//       .populate("user_id", "full_name email") // Populate user details
//       .populate("items.product_id", "english_name price") // Populate product details
//       .populate("items.supplier_id", "full_name email mobile profile_pic") // Populate user details // Populate supplier details for items
//       .exec();

//     if (!order) {
//       return res.status(404).json({ message: "Order not found", status: false });
//     }

//     // Get product IDs from the order
//     const productIds = order.items.map((item) => item.product_id).filter((id) => id); // Filter out null values

//     // Fetch product details
//     const products = await Product.find({ _id: { $in: productIds } })
//       .populate("supplier_id", "full_name email mobile profile_pic") // Populate supplier details if needed
//       .exec();

//     res.status(200).json({
//       order: {
//         _id: order._id,
//         order_id: order.order_id,
//         payment_method: order.payment_method,
//         total_amount: order.total_amount,
//         created_at: order.created_at,
//         updated_at: order.updated_at,
//         payment_status: order.payment_status,
//         shipping_address: order.shipping_address,
//         user_id: {
//           _id: order.user_id._id,
//           full_name: order.user_id.full_name,
//           email: order.user_id.email,
//         },
//         items: order.items.map((item) => ({
//           _id: item._id,
//           product_id: item.product_id,
//           quantity: item.quantity,
//           status: item.status,
//           verification_code: item.verification_code,
//           supplier_id: {
//             _id: item.supplier_id._id,
//             full_name: item.supplier_id.full_name,
//             email: item.supplier_id.email,
//             mobile: item.supplier_id.mobile,
//             pin_code: item.supplier_id.pin_code,
//             profile_pic: item.supplier_id.profile_pic,
//           },
//         })),
//       },
//       products,
//       status: true,
//     });
//   } catch (error) {
//     console.error("Error fetching products by order:", error.message);
//     res.status(500).json({ message: "Internal Server Error", status: false });
//   }
// });

// edit by Atest

// const getProductsByOrderAndSupplier = asyncHandler(async (req, res) => {
//       const { order_id } = req.params;
//       console.log(order_id);

//       try {
//         // Validate userID
//         if (!order_id) {
//             return res.status(404).json({ message: "Order not found", status: false });
//         }

//         // Find all orders for the user
//         const orders = await Order.find({ _id: order_id })
//           .sort({ created_at: -1 })
//           .populate({
//             path: "items.product_id",
//             populate: {
//               path: "supplier_id",
//               select: "full_name", // Assuming supplier schema has a field 'full_name'
//             },
//           });

//         if (!orders || orders.length === 0) {
//           return res.status(404).json({ message: "No orders found for this user", status: false });
//         }

//         // Get all product IDs from the orders
//         const productIds = orders.flatMap((order) => order.items.map((item) => item.product_id._id));

//         // Find all ratings for these products by the user
//         const ratings = await Rating.find({ product_id: { $in: productIds }, user_id: userID });

//         // Create a map of product IDs to ratings
//         const ratingMap = ratings.reduce((map, rating) => {
//           map[rating.product_id.toString()] = true; // true indicates that the product has been rated
//           return map;
//         }, {});

//         // Organize order details
//         const response = orders.map((order) => {
//           const supplierDetails = {};
//           order.items.forEach((item) => {
//             const supplierId = item.supplier_id.toString();
//             if (!supplierDetails[supplierId]) {
//               supplierDetails[supplierId] = {
//                 total_amount: 0,
//                 full_name: item.product_id.supplier_id.full_name,
//                 verification_code: item.verification_code,
//                 products: [],
//               };
//             }

//             const productIdStr = item.product_id._id.toString();
//             const hasRated = ratingMap[productIdStr] || false;

//             supplierDetails[supplierId].total_amount += item.product_id.price * item.quantity;
//             supplierDetails[supplierId].products.push({
//               status: item.status,
//               product_id: item.product_id._id,
//               quantity: item.quantity,
//               price: item.product_id.price,
//               product_images: item.product_id.product_images,
//               product_name: item.product_id.english_name,
//               has_rated: hasRated,
//             });
//           });

//           return {
//             _id: order._id,
//             order_id: order.order_id,
//             order_status: order.status,
//             payment_method: order.payment_method,
//             created_at: order.created_at,
//             updated_at: order.updated_at,
//             details: Object.keys(supplierDetails).map((supplierId) => ({
//               supplier_id: supplierId,
//               full_name: supplierDetails[supplierId].full_name,
//               verification_code: supplierDetails[supplierId].verification_code,
//               total_amount: supplierDetails[supplierId].total_amount,
//               products: supplierDetails[supplierId].products,
//             })),
//           };
//         });

//         res.status(200).json({
//           status: true,
//           message: "User order details fetched successfully",
//           orders: response,
//         });
//       } catch (error) {
//         console.error("Error fetching user order details:", error.message);
//         res.status(500).json({ error: "Internal Server Error" });
//       }
//     });

const getProductsByOrderAndSupplier = asyncHandler(async (req, res) => {
  const { order_id } = req.params;
  console.log(order_id);

  try {
    if (!order_id) {
      return res.status(404).json({ message: "Order ID is required", status: false });
    }

    // Find the order by order_id
    const order = await Order.findOne({ _id: order_id }) // Using order_id instead of _id
      .populate({
        path: "items.product_id",
        populate: {
          path: "supplier_id",
          select: "full_name", // Assuming supplier schema has a field 'full_name'
        },
      });

    if (!order) {
      return res.status(404).json({ message: "Order not found", status: false });
    }

    // Get all product IDs from the order
    const productIds = order.items.map((item) => item.product_id._id);

    // Find all ratings for these products
    const ratings = await Rating.find({ product_id: { $in: productIds } });

    // Create a map of product IDs to ratings
    const ratingMap = ratings.reduce((map, rating) => {
      map[rating.product_id.toString()] = true; // true indicates that the product has been rated
      return map;
    }, {});

    // Organize order details
    const supplierDetails = {};
    order.items.forEach((item) => {
      const supplierId = item.supplier_id._id.toString();
      if (!supplierDetails[supplierId]) {
        supplierDetails[supplierId] = {
          total_amount: 0,
          full_name: item.product_id.supplier_id.full_name,
          verification_code: item.verification_code,
          products: [],
        };
      }

      const productIdStr = item.product_id._id.toString();
      const hasRated = ratingMap[productIdStr] || false;

      supplierDetails[supplierId].total_amount += item.product_id.price * item.quantity;
      supplierDetails[supplierId].products.push({
        status: item.status,
        product_id: item.product_id._id,
        quantity: item.quantity,
        price: item.product_id.price,
        product_images: item.product_id.product_images,
        product_name: item.product_id.english_name,
        has_rated: hasRated,
      });
    });

    const response = {
      _id: order._id,
      order_id: order.order_id,
      order_status: order.status,
      payment_method: order.payment_method,
      created_at: order.created_at,
      updated_at: order.updated_at,
      details: Object.keys(supplierDetails).map((supplierId) => ({
        supplier_id: supplierId,
        full_name: supplierDetails[supplierId].full_name,
        verification_code: supplierDetails[supplierId].verification_code,
        total_amount: supplierDetails[supplierId].total_amount,
        products: supplierDetails[supplierId].products,
      })),
    };

    res.status(200).json({
      status: true,
      message: "Order details fetched successfully",
      order: response,
    });
  } catch (error) {
    console.error("Error fetching order details:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getUserOrderInAdmin = asyncHandler(async (req, res) => {
  const { userID } = req.body;

  try {
    // Validate userID
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Find all orders for the user
    const orders = await Order.find({ user_id: userID }).populate({
      path: "items.product_id",
      populate: {
        path: "supplier_id",
        select: "full_name", // Assuming supplier schema has a field 'full_name'
      },
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this user", status: false });
    }

    // Organize order details
    const response = orders.map((order) => {
      const supplierDetails = {};
      order.items.forEach((item) => {
        const supplierId = item.supplier_id.toString();
        if (!supplierDetails[supplierId]) {
          supplierDetails[supplierId] = {
            total_amount: 0,
            full_name: item.product_id.supplier_id.full_name,
            verification_code: item.verification_code,
            products: [],
          };
        }

        supplierDetails[supplierId].total_amount += item.product_id.price * item.quantity;
        supplierDetails[supplierId].products.push({
          status: item.status,
          product_id: item.product_id._id,
          quantity: item.quantity,
          price: item.product_id.price,
          product_images: item.product_id.product_images,
          product_name: item.product_id.english_name,
        });
      });

      return {
        _id: order._id,
        order_id: order.order_id,
        order_status: order.status,
        payment_method: order.payment_method,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        details: Object.keys(supplierDetails).map((supplierId) => ({
          supplier_id: supplierId,
          full_name: supplierDetails[supplierId].full_name,
          verification_code: supplierDetails[supplierId].verification_code,
          total_amount: supplierDetails[supplierId].total_amount,
          products: supplierDetails[supplierId].products,
        })),
      };
    });

    res.status(200).json({
      status: true,
      message: "User order details fetched successfully",
      orders: response,
    });
  } catch (error) {
    console.error("Error fetching user order details:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getUserOrderDetails = asyncHandler(async (req, res) => {
  const userID = req.headers.userID;
  console.log(userID);

  try {
    // Validate userID
    if (!userID) {
      return res.status(400).json({ message: "User ID is required", status: false });
    }

    // Find all orders for the user
    const orders = await Order.find({ user_id: userID })
      .sort({ created_at: -1 })
      .populate({
        path: "items.product_id",
        populate: {
          path: "supplier_id",
          select: "full_name", // Assuming supplier schema has a field 'full_name'
        },
      });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this user", status: false });
    }

    // Get all product IDs from the orders
    const productIds = orders.flatMap((order) => order.items.map((item) => item.product_id._id));

    // Find all ratings for these products by the user
    const ratings = await Rating.find({ product_id: { $in: productIds }, user_id: userID });

    // Create a map of product IDs to ratings
    const ratingMap = ratings.reduce((map, rating) => {
      map[rating.product_id.toString()] = true; // true indicates that the product has been rated
      return map;
    }, {});

    // Organize order details
    const response = orders.map((order) => {
      const supplierDetails = {};
      order.items.forEach((item) => {
        const supplierId = item.supplier_id.toString();
        if (!supplierDetails[supplierId]) {
          supplierDetails[supplierId] = {
            total_amount: 0,
            full_name: item.product_id.supplier_id.full_name,
            verification_code: item.verification_code,
            products: [],
          };
        }

        const productIdStr = item.product_id._id.toString();
        const hasRated = ratingMap[productIdStr] || false;

        supplierDetails[supplierId].total_amount += item.product_id.price * item.quantity;
        supplierDetails[supplierId].products.push({
          status: item.status,
          product_id: item.product_id._id,
          quantity: item.quantity,
          price: item.product_id.price,
          product_images: item.product_id.product_images,
          product_name: item.product_id.english_name,
          has_rated: hasRated,
        });
      });

      return {
        _id: order._id,
        order_id: order.order_id,
        order_status: order.status,
        payment_method: order.payment_method,
        created_at: order.created_at,
        updated_at: order.updated_at,
        details: Object.keys(supplierDetails).map((supplierId) => ({
          supplier_id: supplierId,
          full_name: supplierDetails[supplierId].full_name,
          verification_code: supplierDetails[supplierId].verification_code,
          total_amount: supplierDetails[supplierId].total_amount,
          products: supplierDetails[supplierId].products,
        })),
      };
    });

    res.status(200).json({
      status: true,
      message: "User order details fetched successfully",
      orders: response,
    });
  } catch (error) {
    console.error("Error fetching user order details:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const bank_Detail_create = asyncHandler(async (req, res) => {
  const { bankName, accountNumber, ifscCode, bankAddress, supplierName } = req.body;
  const supplier_id = req.headers.userID; // Assuming you have user authentication middleware

  try {
    // Create bank details
    const bankDetails = await BankDetails.create({
      bankName,
      accountNumber,
      ifscCode,
      bankAddress,
      supplierName,
      supplier_id,
    });
    res.status(201).json({
      bankDetails,
      status: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const getBankDetails = asyncHandler(async (req, res) => {
  const supplier_id = req.headers.userID; // Assuming you have user authentication middleware

  try {
    // Find bank details for the given user ID
    const bankDetails = await BankDetails.findOne({ supplier_id });

    if (bankDetails) {
      res.status(200).json({
        bankDetails,
        status: true,
      });
    } else {
      res.status(200).json({
        message: "Bank details not found for the user",
        status: false,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const getBankDetailsAdmin = asyncHandler(async (req, res) => {
  const { supplier_id } = req.params; // Extracting user_id from request parameters

  try {
    // Find bank details for the given user ID
    const bankDetails = await BankDetails.findOne({ supplier_id: supplier_id });

    if (bankDetails) {
      res.status(200).json({
        bankDetails,
        status: true,
      });
    } else {
      res.status(404).json({
        message: "Bank details not found for the user",
        status: false,
      });
    }
  } catch (error) {
    console.error("Error fetching bank details:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

// const getAllUsers = asyncHandler(async (req, res) => {
//   try {
//     const { page = 1, limit = 10, search = "" } = req.query;

//     const skip = (page - 1) * limit;
//     const searchRegex = search ? new RegExp(search, "i") : null;

//     // Convert search to a number if it is numeric
//     const mobileSearch = isNaN(search) ? null : new RegExp(search);
//     const pincodeSearch = isNaN(search) ? null : new RegExp(search);

//     // Build the query object
//     const query = {
//       role: "user",
//       $or: [
//         ...(searchRegex ? [{ full_name: searchRegex }] : []),
//         ...(searchRegex ? [{ email: searchRegex }] : []),
//         ...(mobileSearch ? [{ mobile: mobileSearch }] : []),
//         ...(pincodeSearch ? [{ pin_code: pincodeSearch }] : []),
//       ],
//     };

//     const users = await User.find(query).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit));

//     const totalUsers = await User.countDocuments(query);

//     res.json({
//       Users: users,
//       total_rows: totalUsers,
//       totalPages: Math.ceil(totalUsers / limit),
//       currentPage: Number(page),
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       message: "Internal Server Error",
//       status: false,
//     });
//   }
// });

const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (page - 1) * limit;
    const query = {
      role: "user",
    };

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ full_name: searchRegex }, { email: searchRegex }, { mobile: searchRegex }, { pin_code: { $in: [searchRegex] } }];
    }

    const totalUsers = await User.countDocuments(query);
    const users = await User.find(query).skip(skip).limit(Number(limit)).select("full_name email mobile pic updatedAt pin_code role");

    res.status(200).json({
      Users: users,
      currentPage: Number(page),
      totalPages: Math.ceil(totalUsers / limit),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

const getAllSuppliersInAdmin = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get the search keyword from query params
    const search = req.query.search || "";

    // Create case-insensitive regex for searching full_name and email
    const searchRegex = search ? new RegExp(search, "i") : null;

    // Handle numeric search for mobile
    const mobileSearch = isNaN(search) ? null : new RegExp(search);
    const pincodeSearch = isNaN(search) ? null : new RegExp(search);

    // Construct the query to search by full_name, email, or mobile and filter by role 'supplier'
    let query = {
      role: "supplier",
    };

    // Add $or condition only if there is a search term
    if (search) {
      query.$or = [...(searchRegex ? [{ full_name: searchRegex }] : []), ...(searchRegex ? [{ email: searchRegex }] : []), ...(mobileSearch !== null ? [{ mobile: mobileSearch }] : []), ...(pincodeSearch ? [{ pin_code: pincodeSearch }] : [])];
    }

    // Fetch suppliers based on the query, skip, and limit
    const suppliers = await User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    // Get the total number of suppliers that match the query
    const totalSuppliers = await User.countDocuments(query);

    // Return the results along with pagination details
    res.json({
      Suppliers: suppliers,
      total_rows: totalSuppliers,
      current_page: page,
      total_pages: Math.ceil(totalSuppliers / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

// const getAllSupplierstotal = asyncHandler(async (req, res) => {
//       try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 10;
//         const skip = (page - 1) * limit;

//         // Aggregate order data to calculate total amount per supplier only for delivered items
//         const suppliersTotal = await Order.aggregate([
//           { $unwind: "$items" }, // Flatten items array

//           {
//             $match: { "items.status": "delivered" } // Only include delivered items
//           },

//           {
//             $group: {
//               _id: "$items.supplier_id", // Group by supplier_id
//               totalAmount: { $sum: "$total_amount" } // Sum only for delivered orders
//             }
//           },

//           {
//             $lookup: {
//               from: "users", // Join with users collection
//               localField: "_id",
//               foreignField: "_id",
//               as: "supplier_info"
//             }
//           },

//           { $unwind: "$supplier_info" }, // Convert supplier_info array to object

//           { $skip: skip }, // Pagination
//           { $limit: limit },

//           {
//             $project: {
//               _id: 1,
//               totalAmount: 1,
//               supplier_name: "$supplier_info.full_name",
//               supplier_email: "$supplier_info.email",
//               supplier_mobile: "$supplier_info.mobile"
//             }
//           }
//         ]);

//         // Get the total count of suppliers who have delivered orders
//         const totalSuppliers = await Order.aggregate([
//           { $unwind: "$items" },
//           { $match: { "items.status": "delivered" } }, // Only delivered items
//           { $group: { _id: "$items.supplier_id" } },
//           { $count: "totalSuppliers" }
//         ]);

//         res.json({
//           Suppliers: suppliersTotal,
//           total_rows: totalSuppliers.length > 0 ? totalSuppliers[0].totalSuppliers : 0,
//           current_page: page,
//           total_pages: Math.ceil((totalSuppliers.length > 0 ? totalSuppliers[0].totalSuppliers : 0) / limit)
//         });

//       } catch (error) {
//         console.error("Error fetching supplier totals:", error);
//         res.status(500).json({ message: "Internal Server Error", status: false });
//       }
//     });

// const getAllSupplierstotal = asyncHandler(async (req, res) => {
//       try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 10;
//         const skip = (page - 1) * limit;

//         const suppliersTotal = await Order.aggregate([
//           { $unwind: "$items" }, // Flatten items array

//           // Only include delivered items
//           { $match: { "items.status": "delivered" } },

//           // Lookup product to get supplier_id
//           {
//             $lookup: {
//               from: "products",
//               let: { productId: "$items.product_id" },
//               pipeline: [
//                 { $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] } } },
//                 { $project: { supplier_id: 1, price: 1 } }
//               ],
//               as: "product"
//             }
//           },
//           { $unwind: "$product" }, // Convert product array to object

//           // Group by supplier_id and calculate total amount
//           {
//             $group: {
//               _id: "$product.supplier_id", // Group by supplier_id
//               totalAmount: { $sum: { $multiply: ["$items.quantity", "$product.price"] } }, // Total price calculation
//             }
//           },

//           // Lookup supplier details
//           {
//             $lookup: {
//               from: "users",
//               localField: "_id",
//               foreignField: "_id",
//               as: "supplier_info"
//             }
//           },
//           { $unwind: "$supplier_info" }, // Convert supplier_info array to object

//           // Pagination
//           { $skip: skip },
//           { $limit: limit },

//           // Final Projection
//           {
//             $project: {
//               _id: 1,
//               totalAmount: 1,
//               supplier_name: "$supplier_info.full_name",
//               supplier_email: "$supplier_info.email",
//               supplier_mobile: "$supplier_info.mobile"
//             }
//           }
//         ]);

//         // Get total count of suppliers who have delivered orders
//         const totalSuppliers = await Order.aggregate([
//           { $unwind: "$items" },
//           { $match: { "items.status": "delivered" } },
//           {
//             $lookup: {
//               from: "products",
//               let: { productId: "$items.product_id" },
//               pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] } } }],
//               as: "product"
//             }
//           },
//           { $unwind: "$product" },
//           { $group: { _id: "$product.supplier_id" } },
//           { $count: "totalSuppliers" }
//         ]);

//         res.json({
//           Suppliers: suppliersTotal,
//           total_rows: totalSuppliers.length > 0 ? totalSuppliers[0].totalSuppliers : 0,
//           current_page: page,
//           total_pages: Math.ceil((totalSuppliers.length > 0 ? totalSuppliers[0].totalSuppliers : 0) / limit)
//         });

//       } catch (error) {
//         console.error("Error fetching supplier totals:", error);
//         res.status(500).json({ message: "Internal Server Error", status: false });
//       }
//     });

const getAllSupplierstotal = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const suppliersTotal = await Order.aggregate([
      { $unwind: "$items" }, // Flatten items array

      // Only include delivered items
      { $match: { "items.status": "delivered" } },

      // Lookup product to get supplier_id
      {
        $lookup: {
          from: "products",
          let: { productId: "$items.product_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] } } }, { $project: { supplier_id: 1, price: 1 } }],
          as: "product",
        },
      },
      { $unwind: "$product" }, // Convert product array to object

      // Group by supplier_id and calculate total amount
      {
        $group: {
          _id: "$product.supplier_id", // Group by supplier_id
          totalAmount: { $sum: { $multiply: ["$items.quantity", "$product.price"] } }, // Total price calculation
          created_at: { $max: "$created_at" }, // Get the latest order date
        },
      },

      // Lookup supplier details
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "supplier_info",
        },
      },
      { $unwind: "$supplier_info" }, // Convert supplier_info array to object

      // Sort by created_at in descending order (recent first)
      { $sort: { created_at: -1 } },

      // Pagination
      { $skip: skip },
      { $limit: limit },

      // Final Projection
      {
        $project: {
          _id: 1,
          totalAmount: 1,
          supplier_name: "$supplier_info.full_name",
          supplier_email: "$supplier_info.email",
          supplier_mobile: "$supplier_info.mobile",
          created_at: 1, // Include created_at in the response
        },
      },
    ]);

    // Get total count of suppliers who have delivered orders
    const totalSuppliers = await Order.aggregate([
      { $unwind: "$items" },
      { $match: { "items.status": "delivered" } },
      {
        $lookup: {
          from: "products",
          let: { productId: "$items.product_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] } } }],
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $group: { _id: "$product.supplier_id" } },
      { $count: "totalSuppliers" },
    ]);

    res.json({
      Suppliers: suppliersTotal,
      total_rows: totalSuppliers.length > 0 ? totalSuppliers[0].totalSuppliers : 0,
      current_page: page,
      total_pages: Math.ceil((totalSuppliers.length > 0 ? totalSuppliers[0].totalSuppliers : 0) / limit),
    });
  } catch (error) {
    console.error("Error fetching supplier totals:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const getAllBothUsers = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (page - 1) * limit;
    const searchRegex = search ? new RegExp(search, "i") : null;

    // Convert search to a number if it is numeric
    const mobileSearch = isNaN(search) ? null : new RegExp(search);
    const pincodeSearch = isNaN(search) ? null : new RegExp(search);

    // Build the query object
    const query = {
      // role: { $in: ["user", "both"] },
      role: "both",
      $or: [
        ...(searchRegex ? [{ full_name: searchRegex }] : []), // Search by name if regex is valid
        ...(searchRegex ? [{ email: searchRegex }] : []), // Search by email if regex is valid
        ...(mobileSearch ? [{ mobile: mobileSearch }] : []), // Search by mobile if valid
        ...(pincodeSearch ? [{ pin_code: pincodeSearch }] : []), // Search by pincode if valid
      ],
    };

    const users = await User.find(query).skip(skip).limit(Number(limit));

    // Get total count of users matching the role and search criteria
    const totalUsers = await User.countDocuments(query);

    const transformedUsersPromises = users.map(async (user) => {
      let transformedUser = { ...user.toObject() };
      if (transformedUser.pic) {
        const getSignedUrl_pic = await getSignedUrlS3(transformedUser.pic);
        transformedUser.pic = getSignedUrl_pic;
      }
      if (transformedUser.watch_time) {
        transformedUser.watch_time = convertSecondsToReadableTimeAdmin(transformedUser.watch_time);
      }
      return { user: transformedUser };
    });

    const transformedUsers = await Promise.all(transformedUsersPromises);

    res.json({
      Users: transformedUsers,
      total_rows: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const searchUsers = asyncHandler(async (req, res) => {
  const { page = 1, name = "" } = req.body;
  const perPage = 100; // Adjust according to your requirements
  try {
    let query = {
      $or: [{ full_name: { $regex: name, $options: "i" } }, { username: { $regex: name, $options: "i" } }],
    };

    // If name contains a space, search for the last name as well

    // Exclude the current user if req.user._id is available
    if (req.user && req.user._id) {
      query._id = { $ne: req.user._id };
    }

    const users = await User.find(query)
      .select("_id first_name last_name username")
      .skip((page - 1) * perPage)
      .limit(perPage);

    let transformedUsers = users.map((user) => ({
      _id: user._id,
      title: `${user.first_name} ${user.last_name}`,
      label: "User List",
    }));

    const totalCount = await User.countDocuments(query);
    const totalPages = Math.ceil(totalCount / perPage);

    res.json({
      data: transformedUsers,
      page: page.toString(),
      total_rows: totalCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const updateProfileDataByAdmin = asyncHandler(async (req, res) => {
  const { edit_mobile_name, userId } = req.body;

  try {
    // Update only the mobile number
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { mobile: edit_mobile_name } },
      { new: true } // Option to return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      _id: updatedUser._id,
      mobile: updatedUser.mobile,
      status: true,
    });
  } catch (error) {
    console.error("Error updating mobile number:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

//comment by Atest

// const getAllDashboardCount = asyncHandler(async (req, res) => {
//   try {
//     const supplierCount = await User.countDocuments({ role: { $in: "supplier" } });
//     const userCount = await User.countDocuments({ role: { $in: "user" } });
//     const bothCount = await User.countDocuments({ role: { $in: "both" } });
//     const productCount = await Product.countDocuments({ product_role: "supplier" });
//     const fertilizerCount = await Product.countDocuments({ product_role: "fertilizer" });
//     const toolCount = await Product.countDocuments({ product_role: "tools" });
//     const adminnotifications = await OrderNotification.countDocuments();
//     const orderCount = await Order.countDocuments();
//     const transactionAmountSum = await Transaction.aggregate([
//       {
//         $group: {
//           _id: null,
//           total_amount: { $sum: "$total_amount" }, // Summing the "amount" field
//         },
//       },
//     ]);

//     // Extracting the total sum of the "amount" field
//     const transactionTotalAmount = transactionAmountSum.length > 0 ? transactionAmountSum[0].total_amount : 0;

//     res.status(200).json({
//       supplierCount: supplierCount,
//       userCount: userCount,
//       productCount: productCount,
//       fertilizerCount: fertilizerCount,
//       toolCount: toolCount,
//       bothCount: bothCount,
//       orderCount: orderCount,
//       adminnotifications: adminnotifications,
//       transactionTotalAmount: transactionTotalAmount,
//     });
//   } catch (error) {
//     console.error("Error getting dashboard counts:", error);
//     res.status(500).json({
//       message: "Internal Server Error",
//       status: false,
//     });
//   }
// });

// edit by Atest

// const getAllDashboardCount = asyncHandler(async (req, res) => {
//       try {
//         // Check if token is provided in headers
//         const token = req.headers.authorization;

//         if (!token) {
//           return res.status(401).json({
//             message: "Unauthorized: No token provided",
//             status: false,
//           });
//         }

//         // Proceed with fetching the counts
//         const supplierCount = await User.countDocuments({ role: { $in: "supplier" } });
//         const userCount = await User.countDocuments({ role: { $in: "user" } });
//         const bothCount = await User.countDocuments({ role: { $in: "both" } });
//       //   const productCount = await Product.countDocuments({ product_role: "supplier" });
//       const productCount = await Product.countDocuments({
//             product_role: "supplier",
//             delete_status: true
//           });
//         const fertilizerCount = await Product.countDocuments({ product_role: "fertilizer" });
//         const toolCount = await Product.countDocuments({ product_role: "tools" });
//         const adminnotifications = await OrderNotification.countDocuments();
//         const orderCount = await Order.countDocuments();

//         const transactionAmountSum = await Transaction.aggregate([
//           {
//             $group: {
//               _id: null,
//               total_amount: { $sum: "$total_amount" }, // Summing the "total_amount" field
//             },
//           },
//         ]);

//         const codTransactionAmountSum = await Order.aggregate([
//             {
//               $match: { "items.status": "delivered", "payment_method":"cod" } // Filter orders with at least one delivered item
//             },
//             {
//               $group: {
//                 _id: null,
//                 total_amount: { $sum: "$total_amount" } // Sum the "total_amount" field
//               }
//             }
//           ]);

//         // Extract total transaction amount
//         const transactionTotalAmount = transactionAmountSum.length > 0 ? transactionAmountSum[0].total_amount : 0;
//         const codTransactionTotalAmount = codTransactionAmountSum.length > 0 ? codTransactionAmountSum[0].total_amount : 0;
//         res.status(200).json({
//           supplierCount,
//           userCount,
//           productCount,
//           fertilizerCount,
//           toolCount,
//           bothCount,
//           orderCount,
//           adminnotifications,
//           transactionTotalAmount,
//           codTransactionTotalAmount
//         });
//       } catch (error) {
//         console.error("Error getting dashboard counts:", error);
//         res.status(500).json({
//           message: "Internal Server Error",
//           status: false,
//         });
//       }
//     });

const getAllDashboardCount = asyncHandler(async (req, res) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized: No token provided",
        status: false,
      });
    }

    // Count Documents
    const supplierCount = await User.countDocuments({ role: "supplier" });
    const userCount = await User.countDocuments({ role: "user" });
    const bothCount = await User.countDocuments({ role: "both" });
    const productCount = await Product.countDocuments({ product_role: "supplier", delete_status: true });
    const fertilizerCount = await Product.countDocuments({ product_role: "fertilizer", delete_status: true });
    const toolCount = await Product.countDocuments({ product_role: "tools", delete_status: true });
    const adminnotifications = await OrderNotification.countDocuments();
    const orderCount = await Order.countDocuments();

    // Total Transaction Amount
    const transactionAmountSum = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          total_amount: { $sum: "$total_amount" },
        },
      },
    ]);

    // COD Transaction Amount Calculation
    const codTransactionAmountSum = await Order.aggregate([
      { $unwind: "$items" }, // Unwind items first
      {
        $match: {
          "items.status": "delivered",
          payment_method: "cod", // Ensure only COD orders are considered
        },
      },
      {
        $lookup: {
          from: "products",
          let: { productId: "$items.product_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] },
              },
            },
            {
              $project: {
                price: { $toDouble: "$price" }, // Ensure price is a number
              },
            },
          ],
          as: "product",
        },
      },
      { $unwind: "$product" }, // Unwind product details
      {
        $group: {
          _id: null,
          total_amount: { $sum: { $multiply: ["$items.quantity", "$product.price"] } }, // Correct multiplication
        },
      },
    ]);

    const codTransactionTotalAmount = codTransactionAmountSum.length > 0 ? codTransactionAmountSum[0].total_amount : 0;
    console.log("Total COD Transaction Amount:", codTransactionTotalAmount);

    // Extract Total Amounts
    const transactionTotalAmount = transactionAmountSum.length > 0 ? transactionAmountSum[0].total_amount : 0;

    // Response
    res.status(200).json({
      supplierCount,
      userCount,
      productCount,
      fertilizerCount,
      toolCount,
      bothCount,
      orderCount,
      adminnotifications,
      transactionTotalAmount,
      codTransactionTotalAmount,
    });
  } catch (error) {
    console.error("Error getting dashboard counts:", error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const addReview = asyncHandler(async (req, res) => {
  const my_id = req.user._id;
  const { review_id, review_number, description, hire_list_id } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ _id: my_id });
    const user_reviewers = await User.findOne({ _id: review_id });

    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User not found.",
      });
    }

    // Find the corresponding Hire entry based on hire_list_id
    const hireEntry = await Hire.findOne({ _id: hire_list_id });

    if (!hireEntry) {
      return res.status(400).json({
        status: false,
        message: "Hire entry not found.",
      });
    }

    // Find the corresponding HireStatus entry based on status_code "3"
    const hireStatus = await HireStatus.findOne({ status_code: "3" });

    if (!hireStatus) {
      return res.status(400).json({
        status: false,
        message: "Hire status not found for code 3.",
      });
    }

    // Update the work_status of the Hire entry to the found _id
    hireEntry.work_status = hireStatus._id;

    // Save the updated Hire entry
    await hireEntry.save();

    // If review_id is not provided, create a new review
    const review = await Review.create({
      review_id,
      review_number,
      description,
      my_id,
      hire_list_id,
    });

    // Fetch all reviews for the current user
    const userReviews = await Review.find({ review_id });

    // Calculate the average review
    const totalReviews = userReviews.length;
    const sumOfReviews = userReviews.reduce((acc, review) => acc + review.review_number, 0);
    const averageReview = sumOfReviews / totalReviews;

    // Round to one decimal place
    const roundedAverage = averageReview.toFixed(1);

    // Update the user's review_name field with the rounded average
    user_reviewers.review = roundedAverage;

    await User.updateOne({ _id: review_id }, { $set: { review: user_reviewers.review } });
    //await user_reviewers.save();

    type = "Review";
    message = `Completed Review.`;
    sender_id = my_id;
    receiver_id = review_id;
    createNotification(sender_id, receiver_id, message, type);

    res.status(200).json({
      status: true,
      message: "Review created/updated successfully.",
    });
  } catch (error) {
    console.error("Error creating/updating review:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

const getReview = asyncHandler(async (req, res) => {
  try {
    const user_id = req.params.id;
    const page = req.query.page || 1;
    const pageSize = 10;

    const notifications = await Review.find({
      review_id: user_id,
    })
      .sort({ _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    if (!notifications || notifications.length === 0) {
      return res.status(200).json({ status: false, notifications: [] });
    }

    const notificationList = await Promise.all(
      notifications.map(async (notification) => {
        const senderDetails = await User.findById(notification.my_id);

        const sender = {
          _id: senderDetails._id,
          first_name: senderDetails.first_name,
          last_name: senderDetails.last_name,
          pic: `${senderDetails.pic}`,
        };

        const notificationWithSender = {
          _id: notification._id,
          sender,
          message: notification.message,
          review_number: notification.review_number,
          description: notification.description,
          type: notification.type,
          time: calculateTimeDifference(notification.datetime),
          date: notification.datetime.split(" ")[0],
        };

        return notificationWithSender;
      })
    );

    res.status(200).json({
      status: true,
      reviews: notificationList,
    });
  } catch (error) {
    console.error("Error getting notification list:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const UserAdminStatus = asyncHandler(async (req, res) => {
  const userId = req.body.userId;
  try {
    // Find the video by its _id
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Check if deleted_at field is null or has a value
    if (user.deleted_at === null) {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            deleted_at: new Date(),
          },
        },
        { new: true }
      );
    } else {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            deleted_at: null,
          },
        },
        { new: true }
      );
    }
    return res.status(200).json({
      message: "User soft delete status toggled successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

const calculateTimeDifference = (datetime) => {
  try {
    // Check if datetime is undefined or null
    if (!datetime) {
      return "Invalid date";
    }

    const currentTime = moment().tz("Asia/Kolkata"); // Get current time in Asia/Kolkata timezone
    const notificationTime = moment(datetime, "DD-MM-YYYY HH:mm:ss").tz("Asia/Kolkata");

    return notificationTime.from(currentTime); // Use from() instead of fromNow()
  } catch (error) {
    console.error("Error calculating time difference:", error.message);
    return "Invalid date format";
  }
};

function convertSecondsToReadableTimeAdmin(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds * 1000) % 1000);

  // Format the time string
  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(milliseconds).padStart(2, "3")}`;
  return timeString;
}

function convertSecondsToReadableTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours} hr`;
  } else if (hours > 0) {
    return `${hours} hr`;
  } else if (minutes > 0) {
    return `${minutes} min`;
  } else {
    return 0;
  }
}

function generateOTP() {
  const min = 1000; // Minimum 4-digit number
  const max = 9999; // Maximum 4-digit number

  // Generate a random number between min and max (inclusive)
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;

  return otp.toString(); // Convert the number to a string
}

const UpdateMobileAdmin = asyncHandler(async (req, res) => {
  const { UserId, mobile } = req.body;
  const _id = UserId;
  // Find the user by mobile number
  const user = await User.findOne({ _id });
  const usermobile = await User.findOne({ mobile });

  if (usermobile) {
    res.status(200).json({
      message: "Mobile number already exit.",
      status: true,
    });
    return;
  }
  // Update the user's otp field with the new OTP
  const result = await User.updateOne({ _id: user._id }, { $set: { mobile: mobile } });

  // Send the new OTP to the user (you can implement this logic)

  res.json({
    message: "Mobile number successfully.",
    status: true,
  });
});

const getCoursesByTeacherId = asyncHandler(async (req, res) => {
  const { teacher_id } = req.params; // Teacher ID from URL parameters
  console.log(req.params);
  const { page = 1, search = "", sort = "" } = req.body;
  const perPage = 10; // You can adjust this according to your requirements

  // Build the query based on search and teacher_id
  const query = {
    $and: [{ teacher_id }, { $or: [{ title: { $regex: search, $options: "i" } }] }],
  };

  // Sorting based on sort field
  let sortCriteria = {};
  if (sort === "startTime") {
    sortCriteria = { startTime: -1 }; // Sort by startTime in descending order
  } else if (sort === "endTime") {
    sortCriteria = { endTime: -1 }; // Sort by endTime in descending order
  } else {
    sortCriteria = { _id: -1 }; // Default sorting
  }

  try {
    const courses = await Course.find(query)
      .sort(sortCriteria)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate("category_id")
      .populate("teacher_id");

    const totalCount = await Course.countDocuments(query);
    const totalPages = Math.ceil(totalCount / perPage);

    const transformedCoursesPromises = courses.map(async (course) => {
      let transformedCourse = { ...course.toObject() }; // Convert Mongoose document to plain JavaScript object

      if (transformedCourse.startTime) {
        transformedCourse.startTime = moment(transformedCourse.startTime).format("DD/MM/YYYY");
      }
      if (transformedCourse.endTime) {
        transformedCourse.endTime = moment(transformedCourse.endTime).format("DD/MM/YYYY");
      }

      // Fetch subcategory name
      const category = await Category.findById(transformedCourse.category_id);
      const subCategory = category.subcategories.id(transformedCourse.sub_category_id);

      transformedCourse.category_name = category.category_name;
      transformedCourse.subcategory_name = subCategory.subcategory_name;

      // Remove the category and subcategory objects from the response
      delete transformedCourse.category_id.subcategories;
      delete transformedCourse.sub_category_id;

      return {
        _id: transformedCourse._id,
        title: transformedCourse.title,
        category_name: transformedCourse.category_name,
        subcategory_name: transformedCourse.subcategory_name,
        type: transformedCourse.type,
        startTime: transformedCourse.startTime,
        endTime: transformedCourse.endTime,
        teacher: transformedCourse.teacher_id,
        createdAt: transformedCourse.createdAt,
        updatedAt: transformedCourse.updatedAt,
      };
    });

    // Execute all promises concurrently
    const transformedCourses = await Promise.all(transformedCoursesPromises);

    const paginationDetails = {
      current_page: parseInt(page),
      data: transformedCourses,
      first_page_url: `${baseURL}api/courses/teacher/${teacher_id}?page=1`,
      from: (page - 1) * perPage + 1,
      last_page: totalPages,
      last_page_url: `${baseURL}api/courses/teacher/${teacher_id}?page=${totalPages}`,
      links: [
        {
          url: null,
          label: "&laquo; Previous",
          active: false,
        },
        {
          url: `${baseURL}api/courses/teacher/${teacher_id}?page=${page}`,
          label: page.toString(),
          active: true,
        },
        {
          url: null,
          label: "Next &raquo;",
          active: false,
        },
      ],
      next_page_url: null,
      path: `${baseURL}api/courses/teacher/${teacher_id}`,
      per_page: perPage,
      prev_page_url: null,
      to: (page - 1) * perPage + transformedCourses.length,
      total: totalCount,
    };

    console.log(paginationDetails);

    res.json({
      Courses: paginationDetails,
      page: page.toString(),
      total_rows: totalCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const getTeacherAndCourseByTeacher_IdAndType = async (req, res, next) => {
  const { teacher_id, type } = req.body;
  const user_id = req.headers.userID;
  try {
    // Find the teacher by ID and populate payment information
    const teacher = await User.findById(teacher_id).populate({
      path: "payment_id",
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Find courses for the teacher with the specified type
    const courses = await Course.find({
      teacher_id: teacher_id,
      type: type,
    });

    if (!courses || courses.length === 0) {
      return res.status(200).json({
        message: "Course Not Found",
        status: false,
      });
    }

    // Fetch user information for each course
    const userIds = courses.reduce((acc, course) => {
      acc.push(...course.userIds);
      return acc;
    }, []);

    const users = await User.find(
      { _id: { $in: userIds } },
      {
        profile_pic: 1,
        ConnectyCube_token: 1,
        ConnectyCube_id: 1,
        full_name: 1,
        firebase_token: 1,
      }
    );

    const userMap = users.reduce((acc, user) => {
      acc[user._id] = user;
      return acc;
    }, {});

    // Check course availability
    const coursesWithAvailability = courses.map((course) => {
      let courseAvailable;
      if (course.type === "group_course") {
        courseAvailable = course.userIds.length < 3 ? "available" : "full";
      } else if (course.type === "single_course") {
        courseAvailable = course.userIds.length < 1 ? "available" : "full";
      }

      // Check if the user has already taken a demo
      const askDemo = course.askdemoid.includes(user_id);
      return {
        ...course.toObject(),
        courseAvailable,
        users: course.userIds.map((userId) => userMap[userId]),
        askDemo,
        course_image: course.course_image,
      };
    });

    // Calculate average rating for the teacher
    const ratings = await Rating.find({ teacher_id: teacher_id });
    const averageRating = ratings.length ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length : 0;

    res.status(200).json({
      teacher: {
        ...teacher.toObject(),
        averageRating,
      },
      courses: coursesWithAvailability,
    });
  } catch (error) {
    console.error("Error fetching teacher and courses:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
};

const getFavoriteTeachers = asyncHandler(async (req, res) => {
  const user_id = req.headers.userID;

  if (!user_id) {
    return res.status(400).json({ message: "Invalid input" });
  }

  try {
    const favorite = await Favorite.findOne({ user_id }).populate({
      path: "teacher_ids",
      populate: {
        path: "payment_id",
        model: "TeacherPayment",
      },
    });

    if (!favorite) {
      return res.status(404).json({
        message: "No favorite teachers found for this user.",
      });
    }

    // Calculate average rating for each favorite teacher
    const favoriteTeachersWithRating = await Promise.all(
      favorite.teacher_ids.map(async (teacher) => {
        const ratings = await Rating.find({
          teacher_id: teacher._id,
        });
        const averageRating = ratings.length ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length : 0;

        return {
          ...teacher.toObject(),
          averageRating,
        };
      })
    );

    res.status(200).json({
      favorite_teachers: favoriteTeachersWithRating,
    });
  } catch (error) {
    console.error("Error fetching favorite teachers:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const getCoursesByUserId = asyncHandler(async (req, res) => {
  const user_id = req.headers.userID;
  const sub_category_id = req.query.sub_category_id;

  if (!user_id) {
    return res.status(400).json({ message: "Invalid input" });
  }

  let courseQuery = {
    $or: [{ userIds: user_id }, { askDemoids: user_id }],
  };

  if (sub_category_id) {
    courseQuery["sub_category_id"] = sub_category_id;
  }

  try {
    // Find courses based on the user and sub-category conditions
    const courses = await Course.find(courseQuery)
      .populate({
        path: "teacher_id",
        model: "User",
        select: "full_name profile_pic",
      })
      .exec();

    if (!courses.length) {
      return res.status(404).json({
        message: "No courses found for the given user ID and sub-category ID",
      });
    }

    // Find transactions for the user to get purchase dates
    const transactions = await Transaction.find({ user_id }).exec();

    const coursesWithDetails = await Promise.all(
      courses.map(async (course) => {
        const teacher = course.teacher_id;

        // Fetch the teacher's ratings
        const ratings = await Rating.find({ teacher_id: teacher._id });

        // Calculate the average rating
        const averageRating = ratings.length ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length : 0;

        // Check if the user has rated this teacher
        const userRating = await Rating.findOne({
          teacher_id: teacher._id,
          user_id,
        });

        // Fetch the user details based on userIds
        const userIds = course.userIds || [];
        const users = await User.find({ _id: { $in: userIds } }).select("firebase_token email profile_pic ConnectyCube_token ConnectyCube_id full_name");

        // Find the purchase date from the transactions
        const transaction = transactions.find((trans) => trans.course_id.equals(course._id));
        const purchaseDate = transaction ? transaction.datetime : null;

        return {
          ...course.toObject(),
          teacher: {
            ...teacher.toObject(),
            averageRating,
            userHasRated: !!userRating,
            userRating: userRating ? userRating.rating : null,
          },
          users,
          purchaseDate,
          course_image: course.course_image,
        };
      })
    );

    res.status(200).json({ courses: coursesWithDetails });
  } catch (error) {
    console.error("Error fetching courses:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const updateCostomerProfileData = asyncHandler(async (req, res) => {
  req.uploadPath = "uploads/profiles";
  upload.single("profile_pic")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { full_name, email, mobile, address } = req.body;
    const userId = req.headers.userID; // Assuming you have user authentication middleware

    // Get the profile picture path if uploaded
    const profile_pic = req.file ? `${req.uploadPath}/${req.file.filename}` : null;

    try {
      // Find the current user to get the old profile picture path
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Build the update object
      let updateFields = {
        datetime: moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
      };

      // Update first_name and last_name if provided
      if (full_name) {
        updateFields.full_name = full_name;
      }

      if (email) {
        updateFields.email = email;
      }

      if (mobile) {
        updateFields.mobile = mobile;
      }

      if (address) {
        updateFields.address = address;
      }

      // Only update profile_pic if a new one is uploaded
      if (profile_pic) {
        // Check if there's a new profile pic uploaded and delete the old one
        if (currentUser.profile_pic) {
          const oldProfilePicPath = currentUser.profile_pic;
          updateFields.profile_pic = profile_pic;

          // Delete the old profile picture
          deleteFile(oldProfilePicPath);
        } else {
          updateFields.profile_pic = profile_pic;
        }
      }

      // Update the user's profile fields
      const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateFields }, { new: true });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({
        _id: updatedUser._id,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        address: updatedUser.address,
        profile_pic: updatedUser.profile_pic,
        status: true,
      });
    } catch (error) {
      console.error("Error updating user profile:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

// Function to delete a file from the filesystem
function deleteFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
    } else {
      console.log(`Deleted file: ${filePath}`);
    }
  });
}

const getStudentsPayment = asyncHandler(async (req, res) => {
  const teacherId = req.headers.userID; // Assuming you have user authentication middleware

  try {
    // Find all transactions for the given teacher
    const transactions = await Transaction.find({
      teacher_id: teacherId,
    });

    // Extract student IDs from the transactions
    const studentIds = transactions.map((txn) => txn.user_id);

    // Find student information for each transaction
    const students = await User.find({ _id: { $in: studentIds } }, "profile_pic full_name");

    // Find the teacher to get the payment_id
    const teacher = await User.findById(teacherId, "payment_id");
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Prepare the response data
    const responseData = transactions.map((txn) => {
      const student = students.find((stu) => stu._id.equals(txn.user_id));

      return {
        student_id: txn.user_id,
        profile_pic: student.profile_pic,
        full_name: student.full_name,
        transaction_datetime: txn.datetime,
        amount: txn.amount,
      };
    });

    res.status(200).json({
      message: "Students fetched successfully",
      students: responseData,
    });
  } catch (error) {
    console.error("Error fetching students for teacher:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const updateUserPincode = asyncHandler(async (req, res) => {
  const { pin_code } = req.body;
  const user_id = req.headers.userID; // Assuming you have user authentication middleware

  try {
    // Find the current user to get the old image paths
    const currentUser = await User.findById(user_id);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build the update object with optional fields
    let updateFields = {
      datetime: moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
    };

    // Update optional fields if provided
    if (pin_code) {
      updateFields.pin_code = pin_code;
    }
    // Update the user's profile fields
    const updatedUser = await User.findByIdAndUpdate(
      user_id,
      {
        $set: {
          pin_code: updateFields.pin_code,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return the updated user data
    return res.status(200).json({
      user: updatedUser,
      status: true,
    });
  } catch (error) {
    console.error("Error updating user profile:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

const getProductsRendom = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit) || 4; // Number of products per page, default to 10
  const search = req.query.search || ""; // Search term
  const sortBy = req.query.sortBy || "createdAt"; // Field to sort by, default to 'createdAt'
  const order = req.query.order === "asc" ? 1 : -1; // Sorting order, default to descending

  try {
    const query = {
      $and: [
        { product_role: "supplier" },
        { active: true },
        { default_product: true },
        { delete_status: true },
        {
          $or: [{ english_name: { $regex: search, $options: "i" } }],
        },
      ],
    };

    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "supplier_id", // Path to populate
        select: "pin_code", // Only fetch the pin_code array from users collection
      });

    res.status(200).json({
      products,
      page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
});

const getUserDetails = asyncHandler(async (req, res) => {
  const { user_id } = req.body; // Assuming you have user authentication middleware

  try {
    // Find the user by ID
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return the user's profile information
    return res.status(200).json({
      user: user,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

const updateNumberToString = asyncHandler(async (req, res) => {
  try {
    // Update the specific user's mobile number to a string using aggregation
    const result = await User.updateMany(
      // Match the user by ID
      [
        {
          $set: {
            mobile: { $toString: "$mobile" }, // Convert mobile number to string
          },
        },
      ]
    );

    res.status(200).json({
      message: "Mobile number updated successfully.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const updatePinCodeToString = asyncHandler(async (req, res) => {
  try {
    // Update the pin_code array in all documents, converting each pin code to a string
    const result = await User.updateMany({}, [
      {
        $set: {
          pin_code: {
            $map: {
              input: "$pin_code", // Loop over the pin_code array
              as: "pin", // Alias for each element in the array
              in: { $toString: "$$pin" }, // Convert each pin code to string
            },
          },
        },
      },
    ]);

    res.status(200).json({
      message: "Pin codes updated successfully.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    });
  }
});

const updateUserRole = asyncHandler(async (req, res, next) => {
  const userId = req.headers.userID;
  const role = "both";

  if (!role) {
    return next(new ErrorHandler("Please provide a role to update.", 400));
  }

  try {
    // Find and update the user's role in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true } // Returns the updated document
    );

    if (!updatedUser) {
      return next(new ErrorHandler("User not found.", 404));
    }

    const token = jwt.sign({ _id: updatedUser._id, role: updatedUser.role }, process.env.JWT_SECRET);

    res.status(200).json({
      message: "User role updated successfully.",
      user: {
        _id: updatedUser._id,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        role: updatedUser.role,
        token,
      },
    });
  } catch (error) {
    next(new ErrorHandler("Failed to update user role.", 500));
  }
});

// const change_password = asyncHandler(async (req, res) => {
//       const { oldPassword, newPassword } = req.body;

//       // Ensure both old and new passwords are provided
//       if (!oldPassword || !newPassword) {
//         return res.status(400).json({ message: 'Please provide both old and new passwords.' });
//       }

//       // Ensure req.user exists (from the verifyToken middleware)
//       if (!req.user) {
//         return res.status(401).json({ message: 'User not authenticated.' });
//       }

//       // Find the user by ID (use req.user.id after JWT verification)
//       const user = await User.findById(req.user.id);

//       if (!user) {
//         return res.status(404).json({ message: 'User not found.' });
//       }

//       // Compare the old password with the stored password (hashed) using argon2
//       try {
//         const isMatch = await argon2.verify(user.password, oldPassword);
//         console.log('Password comparison result:', isMatch);  // Log comparison result

//         if (!isMatch) {
//           return res.status(401).json({ message: 'Incorrect old password.' });
//         }
//       } catch (err) {
//         console.error('Error during password comparison:', err);
//         return res.status(500).json({ message: 'Error during password comparison.' });
//       }

//       // Optionally validate new password length (uncomment this part if needed)
//       // if (newPassword.length <= 8) {
//       //   return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
//       // }

//       try {
//         // Hash the new password using argon2
//         const hashedPassword = await argon2.hash(newPassword);
//         console.log('New password hash (argon2):', hashedPassword);  // Log new hashed password

//         // Update the password directly in the database
//         const result = await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

//         // Check if update was successful
//         if (result.nModified === 0) {
//           return res.status(500).json({ message: 'Failed to update password in the database.' });
//         }

//         // Fetch the user again to verify the password was updated correctly
//         const updatedUser = await User.findById(req.user.id);

//         // Return success message
//         res.status(200).json({ message: 'Password updated successfully.' });
//       } catch (err) {
//         console.error('Error hashing new password with argon2:', err);
//         res.status(500).json({ message: 'Error hashing the new password.' });
//       }
// });

const change_password = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // Ensure both old and new passwords are provided
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: "Please provide both old and new passwords." });
  }

  // Ensure req.user exists (from the verifyToken middleware)
  if (!req.user) {
    return res.status(401).json({ message: "User not authenticated." });
  }

  // Find the user by ID (use req.user.id after JWT verification)
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // Compare the old password with the stored password (hashed) using argon2
  try {
    const isMatch = await argon2.verify(user.password, oldPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect old password." });
    }
  } catch (err) {
    console.error("Error during password comparison:", err);
    return res.status(500).json({ message: "Error during password comparison." });
  }

  try {
    // Hash the new password using argon2
    const hashedPassword = await argon2.hash(newPassword);

    // Update the password in the database
    const result = await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

    // Check if update was successful
    if (result.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update password in the database." });
    }

    // Invalidate current session by blacklisting the token
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(" ")[1]; // Extract token from "Bearer {token}"
      blacklistToken(token);

      // Expire the cookie immediately
      res.setHeader(
        "Set-Cookie",
        cookie.serialize("Websitetoken", "", {
          httpOnly: true,
          expires: new Date(0),
          path: "/",
        })
      );

      return res.json({ message: "Please login with your new password", status: true });
    }

    // Return success message if no token exists
    res.status(200).json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Error hashing new password with argon2:", err);
    res.status(500).json({ message: "Error hashing the new password." });
  }
});

const updateCancelOrder = asyncHandler(async (req, res) => {
  const { order_id, new_status } = req.body;
  const user_id = req.headers.userID;

  try {
    // Validate input
    if (!order_id || !new_status) {
      return res.status(400).json({ message: "order_id and new_status are required", status: false });
    }

    const validStatuses = ["cancelled"];
    if (!validStatuses.includes(new_status)) {
      return res.status(400).json({ message: "Invalid status", status: false });
    }

    // Update all items with status "order" to "cancelled"
    const savedOrder = await Order.findOneAndUpdate(
      {
        _id: order_id,
        user_id: user_id,
        "items.status": "order",
      },
      {
        $set: {
          "items.$[elem].status": new_status,
          updated_at: Date.now(),
        },
      },
      {
        new: true,
        arrayFilters: [{ "elem.status": "order" }],
      }
    );

    if (!savedOrder) {
      return res.status(400).json({ message: `Your order cannot be cancelled`, status: false });
    }

    // Filter items with updated status
    const filteredItems = savedOrder.items.filter((item) => item.status === new_status);

    // Update product quantities
    for (const item of filteredItems) {
      const product = await Product.findById(item.product_id);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    // Send immediate response to client
    res.status(200).json({
      status: true,
      message: "Order items status updated to 'cancelled' successfully",
      order: {
        ...savedOrder.toObject(),
        items: filteredItems,
      },
    });

    // Handle notifications and emails asynchronously
    (async () => {
      try {
        const user = await User.findById(user_id);

        // Send user notification and email
        if (user?.firebase_token) {
          const userTitle = "Order Status";
          const userBody = "Your order has been cancelled.";
          await sendFCMNotification(user.firebase_token, userTitle, userBody);
          await addNotification(user_id, order_id, userBody, savedOrder.total_amount, null, userTitle, new_status);

          const subject = "Order Cancellation Notification";
          const text = `Hello ${user.full_name},\n\nYour order (ID: ${savedOrder.order_id}) has been cancelled successfully.\n\nThank you.`;
          await sendEmail(user.email, subject, text);
        }

        // Send supplier notifications and emails
        const supplierIds = Array.from(new Set(filteredItems.map((item) => item.supplier_id)));
        for (const supplier_id of supplierIds) {
          const supplier = await User.findById(supplier_id);

          if (supplier?.firebase_token) {
            const supplierTitle = "Order Cancellation Notification";
            const supplierBody = `Order has been cancelled by ${user?.full_name}. (Order ID: ${savedOrder.order_id})`;
            await sendFCMNotification(supplier.firebase_token, supplierTitle, supplierBody);
            await addNotification(null, order_id, supplierBody, savedOrder.total_amount, [supplier_id], supplierTitle, new_status);

            const subject = "Order Cancellation Notification";
            const text = `Hello ${supplier.full_name},\n\nOrder (ID: ${savedOrder.order_id}) has been cancelled by ${user?.full_name}.\n\nThank you.`;
            await sendEmail(supplier.email, subject, text);
          }
        }
      } catch (error) {
        console.error("Error handling notifications and emails:", error.message);
      }
    })();
  } catch (error) {
    console.error("Error updating order items status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// const updateCancelOrder = asyncHandler(async (req, res) => {
//   const { order_id, new_status } = req.body;
//   const user_id = req.headers.userID;

//   try {
//     // Validate input
//     if (!order_id || !new_status) {
//       return res.status(400).json({ message: "order_id and new_status are required", status: false });
//     }

//     // Validate new_status
//     const validStatuses = ["cancelled"];
//     if (!validStatuses.includes(new_status)) {
//       return res.status(400).json({ message: "Invalid status", status: false });
//     }

//     // Update all items with status "order" to "cancelled"
//     const savedOrder = await Order.findOneAndUpdate(
//       {
//         _id: order_id,
//         user_id: user_id,
//         "items.status": "order", // Ensure there is at least one item with status "order"
//       },
//       {
//         $set: {
//           "items.$[elem].status": new_status,
//           updated_at: Date.now(),
//         },
//       },
//       {
//         new: true,
//         arrayFilters: [{ "elem.status": "order" }], // Apply filter to update all "order" status items
//       }
//     );

//     if (!savedOrder) {
//       return res.status(400).json({ message: `Your order cannot be cancelled`, status: false });
//     }

//     // Filter items to include only those with the updated status
//     const filteredItems = savedOrder.items.filter((item) => item.status === new_status);

//     // Manage product quantities
//     for (const item of filteredItems) {
//       const product = await Product.findById(item.product_id);
//       if (product) {
//         product.quantity += item.quantity; // Increment stock by the cancelled quantity
//         await product.save();
//       } else {
//         console.warn(`Product with ID ${item.product_id} not found.`);
//       }
//     }

//     // Send notification to user
//     const user = await User.findById(user_id);
//     if (user && (user.firebase_token || user.firebase_token === "dummy_token")) {
//       const userTitle = "Order Status";
//       const userBody = "Your order has been cancelled.";
//       const notificationResult = await sendFCMNotification(user.firebase_token, userTitle, userBody);
//       if (notificationResult.success) {
//         console.log("Notification sent successfully:", notificationResult.response);
//       } else {
//         console.error("Failed to send notification:", notificationResult.error);
//       }
//       await addNotification(user_id, order_id, userBody, savedOrder.total_amount, null, userTitle, new_status);

//       // Refactored send email function for user
//       const sendEmailAsync = async () => {
//         const subject = "Order Cancellation Notification";
//         const text = `Hello ${user.full_name},\n\nYour order (ID: ${savedOrder.order_id}) has been cancelled successfully.\n\nThank you.`;

//         try {
//           await sendEmail(user.email, subject, text); // Send email after user registration
//           console.log(`Email sent successfully to ${user.email}: ${subject}`);
//         } catch (error) {
//           console.error("Failed to send email notification:", error);
//         }
//       };

//       // Ensure email is sent asynchronously
//       await sendEmailAsync();
//     }

//     // Send notification to each supplier
//     const supplierIds = Array.from(new Set(filteredItems.map((item) => item.supplier_id))); // Get unique supplier IDs
//     for (const supplier_id of supplierIds) {
//       const supplier = await User.findById(supplier_id);

//       if (supplier && (supplier.firebase_token || supplier.firebase_token === "dummy_token")) {
//         const supplierTitle = "Order Cancellation Notification";
//         const supplierBody = `Order has been cancelled by the ${user.full_name}.Order(Id: ${savedOrder.order_id})`;
//         const notificationResult = await sendFCMNotification(supplier.firebase_token, supplierTitle, supplierBody);
//         if (notificationResult.success) {
//           console.log("Notification sent successfully:", notificationResult.response);
//         } else {
//           console.error("Failed to send notification:", notificationResult.error);
//         }
//         await addNotification(null, order_id, supplierBody, savedOrder.total_amount, [supplier_id], supplierTitle, new_status);

//         // Refactored send email function for supplier
//         const sendSupplierEmailAsync = async () => {
//           const subject = "Order Cancellation Notification";
//           const text = `Hello ${supplier.full_name},\n\nOrder (ID: ${savedOrder.order_id}) has been cancelled by the ${user.full_name}.\n\n.`;

//           try {
//             await sendEmail(supplier.email, subject, text); // Send email to supplier
//             console.log(`Email sent successfully to ${supplier.email}: ${subject}`);
//           } catch (error) {
//             console.error("Failed to send email notification:", error);
//           }
//         };

//         // Ensure email is sent asynchronously
//         await sendSupplierEmailAsync();
//       }
//     }

//     res.status(200).json({
//       status: true,
//       message: "Order items status updated to 'cancelled' successfully",
//       order: {
//         ...savedOrder.toObject(),
//         items: filteredItems, // Include only the filtered items in the response
//       },
//     });
//   } catch (error) {
//     console.error("Error updating order items status:", error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

const sendNotificationToRole = asyncHandler(async (req, res) => {
  req.uploadPath = "uploads/notification";
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }
    const { body, title, role } = req.body;

    if (!body || !title || !role) {
      return res.status(400).json({ message: "Invalid input", status: false });
    }

    const imageUrl = req.file ? `${process.env.BASE_URL}/${req.uploadPath}/${req.file.filename}` : null;

    try {
      // Find all users with the specified role
      const users = await User.find({ role });

      if (users.length === 0) {
        return res.status(404).json({ message: "No users with the specified role found", status: false });
      }

      // Loop through each user and send notification if they have a firebase_token
      for (const user of users) {
        if (user.firebase_token) {
          const registrationToken = user.firebase_token;
          const notificationResult = await sendFCMNotification(registrationToken, title, body, imageUrl);

          if (notificationResult.success) {
            console.log(`Notification sent successfully to ${user._id}:`, notificationResult.response);
          } else {
            console.error(`Failed to send notification to ${user._id}:`, notificationResult.error);
          }
        }

        // Determine notification parameters based on role
        if (role === "user") {
          await addNotification(user._id, null, body, null, null, title, null);
        } else if (role === "supplier") {
          await addNotification(null, null, body, null, [user._id], title, null);
        } else if (role === "both") {
          await addNotification(user._id, null, body, null, [user._id], title, null);
        }
      }

      res.status(200).json({ message: "Notifications sent successfully", status: true });
    } catch (error) {
      console.error("Error sending notifications:", error.message);
      res.status(500).json({ message: "Internal Server Error", status: false });
    }
  });
});

const updateUsersTimestamp = asyncHandler(async (req, res) => {
  try {
    const result = await Category.updateMany(
      {}, // Empty filter to target all documents
      {
        $set: {
          timestamp: moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
        },
      }
    );

    console.log(`Updated ${result.modifiedCount} user(s) with a new timestamp.`);
  } catch (error) {
    console.error("Error updating users:", error);
  }
});

module.exports = {
  getUsers,
  registerUser,
  authUser,
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
  getBankDetailsAdmin,
  ForgetresendOTP,
  profilePicKey,
  getReview,
  updateProfileDataByAdmin,
  searchUsers,
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
  removeFromCart,
  getFavoriteProduct,
  getProductDetailByProductId,
  getCartProducts,
  increaseCartQuantity,
  decreaseCartQuantity,
  checkout,
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
};
