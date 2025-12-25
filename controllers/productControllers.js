const asyncHandler = require("express-async-handler");
const Products = require("../models/productsModel.js");

const generatePartNumber = async () => {
  let isUnique = false;
  let partNumber = "";

  while (!isUnique) {
    partNumber = "PN" + Date.now().toString().slice(-6);

    const exists = await Products.findOne({ part_number: partNumber });
    if (!exists) {
      isUnique = true;
    }
  }

  return partNumber;
};


const createProduct = asyncHandler(async (req, res) => {
  try {
    const part_number = await generatePartNumber();
    const {
      product_name,
      category_id,
      category_name,
      subcategory_id,
      subcategory_name,
      price,
      quantity,
      // size,           // TEXT now
      // unit_type,
      // unit_value,
      shipment_box,   // { weight, box_length, box_breadth, box_height }
      product_description,
      reference_number, // HTML string from React Quill
    } = req.body;

    // Multiple images
    let product_images = [];
    if (req.files && req.files.length > 0) {
      product_images = req.files.map((file) =>
        file.path.replace(/\\/g, "/")
      );
    }

    // Parse numbers
    const priceNum = price ? Number(price) : 0;
    const quantityNum = quantity ? Number(quantity) : 0;
    // const unitValueNum = unit_value ? Number(unit_value) : 0;

    // Validate required fields
    if (!product_name || !quantityNum ) {
      return res.status(400).json({
        status: false,
        message: "Required fields missing",
      });
    }

    // Create product
    const product = await Products.create({
      product_name,
      category_id: category_id || null,
      category_name: category_name || null,
      subcategory_id: subcategory_id || null,
      subcategory_name: subcategory_name || null,
      product_images, // array of image paths
      price: priceNum,
      quantity: quantityNum,
       part_number,                 // ✅ AUTO UNIQUE
  reference_number: reference_number || null,
      // size,           // TEXT
      // unit_type,
      // unit_value: unitValueNum,
      shipment_box: shipment_box || {}, // optional
      product_description: product_description || "",
      status: 1, // default active
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
const recentProduct = asyncHandler(async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const products = await Products.find({
      status: 1, // ✅ only active products
    })
      .sort({ created_at: -1 }) // 🔥 recent first
      .limit(10) // 🔥 latest 10 products
      .lean();

    if (!products.length) {
      return res.status(404).json({
        status: false,
        message: "No recent products found",
      });
    }

    const formattedProducts = products.map((product) => ({
      _id: product._id,
      product_name: product.product_name,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id,
      price: product.price,
      quantity: product.quantity,
      part_number:product.part_number || null,
      reference_number:product.reference_number ||null,
      category_name:product.category_name ||null,
      subcategory_name:product.subcategory_name ||null,
      product_images: product.product_images?.map(
        (img) => `${baseUrl}/${img.replace(/^\/+/, "")}`
      ),
      created_at: product.created_at,
    }));

    res.status(200).json({
      status: true,
      total: formattedProducts.length,
      data: formattedProducts,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});








const getProductById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

  const product = await Products.findOne({
  _id: id,
  status: 1
}).lean();

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const baseUrl = process.env.BASE_URL; 

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
      message: "categoryId and subcategoryIds array are required",
    });
  }

  let products = await Products.find({
    category_id: categoryId,
    subcategory_id: { $in: subcategoryIds },
    status: 1,
  }).lean();

  const baseUrl = process.env.BASE_URL;

  products = products.map((p) => ({
    ...p,

    // 🔹 images full url
    product_images: p.product_images?.map(
      (img) => `${baseUrl}/${img.replace(/^\/+/, "")}`
    ),

    // 🔥 rating fields (abhi 0)
    avgRating: 0,
    totalRating: 0,
  }));

  res.status(200).json({
    status: true,
    total: products.length,
    products,
  });
});



const getRelatedProducts = asyncHandler(async (req, res) => {
  const { categoryId, subcategoryIds, productId } = req.body;

  // 🔎 Validation
  if (!categoryId || !Array.isArray(subcategoryIds) || !subcategoryIds.length) {
    return res.status(400).json({
      status: false,
      message: "categoryId and subcategoryIds array are required",
    });
  }

  let products = await Products.find({
    category_id: categoryId,
    subcategory_id: { $in: subcategoryIds },
    status: 1,
    ...(productId && { _id: { $ne: productId } }),
  }).lean();

  const baseUrl = process.env.BASE_URL;

  products = products.map((p) => ({
    ...p,
     part_number: p.part_number || null,             // ✅ agar nahi hai toh null
    reference_number: p.reference_number || null, 
    product_images: p.product_images?.map(
      (img) => `${baseUrl}/${img.replace(/^\/+/, "")}`
    ),
  }));

  // 🎲 Shuffle products (Fisher–Yates)
  for (let i = products.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [products[i], products[j]] = [products[j], products[i]];
  }

  res.status(200).json({
    status: true,
    total: products.length,
    products,
  });
});



const updateProduct = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    // Destructure body
    let {
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
      product_description,
      shipment_box, // { weight, box_length, box_breadth, box_height }
      remove_images,
      reference_number,
      // array of images to remove
    } = req.body;

    // 🔍 Find product
    const product = await Products.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    // 🖼️ Existing product images
    let product_images = product.product_images || [];

    // ❌ Remove selected images
    if (remove_images) {
    // Agar single string hai toh array banao, agar pehle se array hai toh waisa hi rehne do
    const imagesToDelete = Array.isArray(remove_images) ? remove_images : [remove_images];
    
    console.log("Images to remove:", imagesToDelete); // Debugging ke liye

    product_images = product_images.filter(img => {
        // .includes tabhi kaam karega jab string exact match ho
        // Hum dono taraf se whitespace trim kar dete hain safety ke liye
        return !imagesToDelete.some(rem => rem.trim() === img.trim());
    });
}

    // ✅ Add new uploaded images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.path.replace(/\\/g, "/"));
      product_images = [...product_images, ...newImages];
    }

    // 🔢 Parse numbers
    const priceNum = price !== undefined ? Number(price) : product.price;
    const quantityNum = quantity !== undefined ? Number(quantity) : product.quantity;

    // 📝 Update fields
    product.product_name = product_name || product.product_name;
    product.category_id = category_id || product.category_id;
    product.category_name = category_name || product.category_name;
    product.subcategory_id = subcategory_id || product.subcategory_id;
    product.subcategory_name = subcategory_name || product.subcategory_name;
    product.price = priceNum;
    product.quantity = quantityNum;
    product.size = size || product.size;
    product.unit_type = unit_type || product.unit_type;
    product.unit_value = unit_value || product.unit_value;
    product.product_images = product_images;
    product.status = status !== undefined ? status : product.status;
    product.product_description = product_description || product.product_description;
    product.reference_number = reference_number || product.reference_number;

    // ✅ Update shipment box
    if (shipment_box) {
      product.shipment_box = {
        weight: shipment_box.weight || product.shipment_box?.weight || "",
        box_length: shipment_box.box_length || product.shipment_box?.box_length || "",
        box_breadth: shipment_box.box_breadth || product.shipment_box?.box_breadth || "",
        box_height: shipment_box.box_height || product.shipment_box?.box_height || "",
      };
    }

    // Save product
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
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";


  const query = search
    ? {
        $or: [
          { product_name: { $regex: search, $options: "i" } },
          { part_number: { $regex: search, $options: "i" } }
        ]
      }
    : {};

  const totalProducts = await Products.countDocuments(query);

  const products = await Products.find(query)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    products,
    page,
    totalPages: Math.ceil(totalProducts / limit),
    totalProducts,
  });
});


module.exports = { createProduct, getAllProducts, deleteProductById, toggleProductStatus, updateProduct,getProductById,getProductsByCategory, getRelatedProducts,recentProduct };
