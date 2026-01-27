const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const protect = require("../middleware/authMiddleware.js");
const { createProduct,searchProduct, getAllProducts, deleteProductById,deleteModel,updateVariant, getModelsByBrand,deleteVariant,addVariant,getVariants,toggleProductStatus,updateProduct,updateModel,getProductById,getProductsByCategory, getRelatedProducts,recentProduct,addBrand,getBrands,updateBrand,deleteBrand,addModel, product } = require("../controllers/productControllers.js");

// Multer setup for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // .png .jpg
    const uniqueName = `${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// POST route
// Max 10 images allowed, tum change kar sakte ho
router.get("/", protect,product);
router.get("/search", protect,searchProduct);
router.post("/add", upload.array("product_images", 10), createProduct);
router.delete("/delete/:id", deleteProductById);
router.put("/status/:id",toggleProductStatus);
router.put("/update-product/:productId", upload.array("product_images", 10),updateProduct);
router.post("/getProductsByCategory", protect, getProductsByCategory);
router.post("/getRelatedProducts", protect, getRelatedProducts);
router.get("/recent-products", protect,recentProduct);
router.post("/addBrand", protect,addBrand);
router.get("/getbrand", protect,getBrands);
router.put("/updatebrand", protect,updateBrand);
router.delete("/deleteBrand/:brand_id", protect,deleteBrand);
router.post("/addModel", protect,addModel);
router.put("/updateModel", protect, updateModel);
router.delete("/deleteModel", protect, deleteModel);
router.post("/addVariant", protect, addVariant);
router.get("/getVariants", protect, getVariants);
router.put("/updateVariant", protect, updateVariant);
router.delete("/deleteVariant", protect, deleteVariant);
router.get("/getModels", protect, getModelsByBrand);



router.get("/all", getAllProducts);
router.get("/get-product/:id", getProductById);

module.exports = router;
