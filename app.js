const express = require("express");
const connectDB = require("./config/db.js");
const createSocketIO = require("./config/socket_io.js");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const http = require("http");
const ngrok = require("@ngrok/ngrok");
const bodyParser = require("body-parser");

// --------------------- Routes -------------------------------
const { userRoutes } = require("./routes/userRoutes.js");
const { chatRoutes } = require("./routes/chatRoutes.js");
const { messageRoutes } = require("./routes/messageRoutes.js");
const { categoryRoutes } = require("./routes/categoryRoutes.js");
const { videoRoutes } = require("./routes/videoRoutes.js");
const { reelRoutes } = require("./routes/reelRoutes.js");
const { companyDetails } = require("./routes/companydetailsRoutes.js");
const { jobRoutes } = require("./routes/jobRoutes.js");
const { myfriendRoutes } = require("./routes/myfrindsRoutes.js");
const { subscribeRoutes } = require("./routes/subscribeRoutes.js");
const { timelineRoutes } = require("./routes/timelineRoutes.js");
const { commanRoutes } = require("./routes/commanRoutes.js");
const { transactionRoutes } = require("./routes/transactionRoutes.js");
const { adminRoutes } = require("./routes/adminRoutes.js");
// --------------------- Routes -------------------------------
const { notFound, errorHandler } = require("./middleware/errorMiddleware.js");
const cors = require("cors");
const path = require("path");
const { subCategoryRoutes } = require("./routes/subCategoryRoutes.js");
const { supplierRoutes } = require("./routes/supplierRoutes.js");
const { fertilizerRoutes } = require("./routes/fertilizerRoutes.js");
const { toolsRoutes } = require("./routes/toolsRoutes.js");
const { orderNotificationsRoutes } = require("./routes/orderNotificationRoutes.js");
require("dotenv").config();

// --------------------------Firebase Admin SDK------------------------------

connectDB();
const app = express();
app.use(cookieParser());
const __dirname1 = path.resolve();
app.use(express.static(path.join(__dirname1, "")));
app.use("/public", express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use("/uploads", express.static("uploads/category"));
app.use("/uploads", express.static("uploads/fertilizer"));
app.use("/uploads", express.static("uploads/product"));
app.use("/uploads", express.static("uploads/profiles"));
app.use("/uploads", express.static("uploads/subcategory"));
app.use("/uploads", express.static("uploads/tools"));
app.use("/uploads", express.static("uploads/notification"));
app.use(express.json()); // to accept JSON data
// app.use(cors());

// const corsOptions = {
//   origin: (origin, callback) => {
//     if (origin === process.env.BASE_URL || !origin) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
// };




// for local
const corsOptions = {
  origin: (origin, callback) => {
      callback(null, true);
  },
};

app.use(cors(corsOptions));

// --------------------------Routes------------------------------

app.use("/api/user", userRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/fertilizer", fertilizerRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/orderNotification", orderNotificationsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/subCategory", subCategoryRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/reel", reelRoutes);
app.use("/api/CompanyDetails", companyDetails);
app.use("/api/job", jobRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/myfriend", myfriendRoutes);
app.use("/api/subscribe", subscribeRoutes);
app.use("/api/comman", commanRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/admin", adminRoutes);
// --------------------------Routes------------------------------

// --------------------------deploymentssssss------------------------------

if (process.env.NODE_ENV == "production") {
  app.use(express.static(path.join(__dirname1, "/view")));

  app.get("*", (req, res) => res.sendFile(path.resolve(__dirname1, "view", "index.html")));
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

// --------------------------deployment------------------------------

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
    status: false,
  });
});

// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

const PORT = process.env.PORT;
const BASE_URL = process.env.BASE_URL;

const server = app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}...`);
  console.log(`Base URL: ${BASE_URL}`);
});
const io = createSocketIO(server);
