const express = require("express");
const router = express.Router();
const multer = require("multer");
const protect = require("../middleware/authMiddleware.js");
const { createProduct, getAllProducts, deleteProductById, toggleProductStatus,updateProduct,getProductById,getProductsByCategory } = require("../controllers/productControllers.js");

// Multer setup for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // make sure folder exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// POST route
// Max 10 images allowed, tum change kar sakte ho
router.post("/add", upload.array("product_images", 10), createProduct);
router.delete("/delete/:id", deleteProductById);
router.put("/status/:id",toggleProductStatus);
router.put("/update-product/:productId", upload.array("product_images", 10),updateProduct);
router.get("/getProductsByCategory", protect, getProductsByCategory);


router.get("/all", getAllProducts);
router.get("/get-product/:id", getProductById);

module.exports = router;
