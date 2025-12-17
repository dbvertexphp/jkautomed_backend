const asyncHandler = require("express-async-handler");
const Products = require("../models/productsModel.js");

const createProduct = asyncHandler(async (req, res) => {
  try {
    const {
      product_name,
      category_id,
      category_name,
      subcategory_id,
      subcategory_name,
      price,
      quantity,
      size,
      unit_type,
      unit_value,
    } = req.body;

    // Multiple images
    let product_images = [];
    if (req.files && req.files.length > 0) {
      product_images = req.files.map((file) => file.path.replace(/\\/g, "/"));
    }

    // Numbers ko parse karlo
    const priceNum = price ? Number(price) : 0;
    const quantityNum = quantity ? Number(quantity) : 0;
    const sizeNum = size ? Number(size) : 0;

    // Validate required fields
    if (!product_name || !priceNum || !quantityNum || !sizeNum) {
      return res.status(400).json({
        status: false,
        message: "Required fields missing",
      });
    }

    const product = await Products.create({
      product_name,
      category_id: category_id || null,
      category_name: category_name || null,
      subcategory_id: subcategory_id || null,
      subcategory_name: subcategory_name || null,
      product_images, // ✅ array me save
      price: priceNum,
      quantity: quantityNum,
      size: sizeNum,
      unit_type:  unit_type,
      unit_value: unit_value,
      status: 1, // Default status
    });

    res.status(201).json({
      status: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
      error,
    });
  }
});
const getProductById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Products.findById(id).lean();

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const baseUrl = process.env.BASE_URL; 
    // example: https://api.example.com

    // 🔥 product_images ko full URL me convert
    product.product_images = product.product_images.map(img =>
      img.startsWith("http") ? img : `${baseUrl}/${img}`
    );

    res.status(200).json({
      status: true,
      message: "Product fetched successfully",
      product,
    });

  } catch (error) {
    console.error("Get product by id error:", error);
    res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
});
const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId, subcategoryIds } = req.body;

  // validation
  if (!categoryId || !Array.isArray(subcategoryIds) || !subcategoryIds.length) {
    return res.status(400).json({
      status: false,
      message: "categoryId and subcategoryIds array are required"
    });
  }

  const products = await Products.find({
    category_id: categoryId,
    subcategory_id: { $in: subcategoryIds },
    status: 1
  }).lean();

  const baseUrl = process.env.BASE_URL;

  products.forEach(p => {
    p.product_images = p.product_images.map(img =>
      `${baseUrl}/${img.replace(/^\/+/, "")}`
    );
  });

  res.status(200).json({
    status: true,
    total: products.length,
    products
  });
});



const updateProduct = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    const {
      product_name,
      category_id,
      category_name,
      subcategory_id,
      subcategory_name,
      price,
      quantity,
      size,
      unit_type,
      unit_value,
      status,
      remove_images // optional: images remove karne ke liye
    } = req.body;

    // 🔍 Find product
    const product = await Products.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    // 🖼️ Existing images
    let product_images = product.product_images || [];

    // ❌ Remove selected images
    // remove_images array se server ko delete karne ka signal mil raha hai
if (remove_images && Array.isArray(remove_images)) {
  product_images = product_images.filter(
    (img) => !remove_images.includes(img)
  );
}

// new uploaded files ko merge kar do
if (req.files && req.files.length > 0) {
  const newImages = req.files.map((file) => file.path.replace(/\\/g, "/"));
  product_images = [...product_images, ...newImages];
}


    // 🔢 Number parsing
    const priceNum = price !== undefined ? Number(price) : product.price;
    const quantityNum = quantity !== undefined ? Number(quantity) : product.quantity;
    const sizeNum = size !== undefined ? Number(size) : product.size;

    // 📝 Update fields
    product.product_name = product_name || product.product_name;
    product.category_id = category_id || product.category_id;
    product.category_name = category_name || product.category_name;
    product.subcategory_id = subcategory_id || product.subcategory_id;
    product.subcategory_name = subcategory_name || product.subcategory_name;
    product.price = priceNum;
    product.quantity = quantityNum;
    product.size = sizeNum;
    product.unit_type = unit_type || product.unit_type;
    product.unit_value = unit_value || product.unit_value;
    product.product_images = product_images;
    product.status = status !== undefined ? status : product.status;

    await product.save();

    res.status(200).json({
      status: true,
      message: "Product updated successfully",
      product,
    });

  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
});

const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Product ID is required",
      });
    }

    const product = await Products.findById(id);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    // 🔁 Toggle status
    product.status = product.status === 1 ? 0 : 1;
    await product.save();

    return res.status(200).json({
      status: true,
      message: "Product status updated successfully",
      data: {
        product_id: product._id,
        status: product.status,
      },
    });
  } catch (error) {
    console.error("Toggle Product Status Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};
const deleteProductById = async (req, res) => {
  try {
    const { id } = req.params; // URL me id pass karenge

    if (!id) {
      return res.status(400).json({ status: false, message: "Product ID is required" });
    }

    const product = await Products.findById(id);

    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    // Hard delete
    await product.remove();

    // Agar soft delete chahiye:
    // product.deleted = true;
    // await product.save();

    res.status(200).json({ status: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.status(500).json({ status: false, message: "Server Error" });
  }
};
const getAllProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Products.find().sort({ createdAt: -1 });
    res.status(200).json({
      status: true,
      message: "Products fetched successfully",
      products,
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
      error,
    });
  }
});

module.exports = { createProduct, getAllProducts, deleteProductById, toggleProductStatus, updateProduct,getProductById,getProductsByCategory };
