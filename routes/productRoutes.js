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
router.get("/", product);
router.get("/search", searchProduct);
router.post("/add", upload.array("product_images", 10), createProduct);
router.delete("/delete/:id", deleteProductById);
router.put("/status/:id",toggleProductStatus);
router.put("/update-product/:productId", upload.array("product_images", 10),updateProduct);
router.post("/getProductsByCategory",  getProductsByCategory);
router.post("/getRelatedProducts",  getRelatedProducts);
router.get("/recent-products", recentProduct);
router.post("/addBrand", addBrand);
router.get("/getbrand", getBrands);
router.put("/updatebrand", updateBrand);
router.delete("/deleteBrand/:brand_id", deleteBrand);
router.post("/addModel", addModel);
router.put("/updateModel",  updateModel);
router.delete("/deleteModel",  deleteModel);
router.post("/addVariant",  addVariant);
router.get("/getVariants",  getVariants);
router.put("/updateVariant",  updateVariant);
router.delete("/deleteVariant",  deleteVariant);
router.get("/getModels",  getModelsByBrand);



router.get("/all", getAllProducts);
router.get("/get-product/:id", getProductById);

module.exports = router;
