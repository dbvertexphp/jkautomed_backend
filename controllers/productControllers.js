const asyncHandler = require("express-async-handler");
const Products = require("../models/productsModel.js");
const Brand = require("../models/brandModel");

const addBrand = asyncHandler(async (req, res) => {
  const { brand_name } = req.body;

  // 🔴 Validation
  if (!brand_name || brand_name.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Brand name is required",
    });
  }

  // 🔍 Check duplicate brand
  const existingBrand = await Brand.findOne({
    brand_name: brand_name.trim(),
  });

  if (existingBrand) {
    return res.status(409).json({
      success: false,
      message: "Brand already exists",
    });
  }

  // ✅ Create brand
  const brand = await Brand.create({
    brand_name: brand_name.trim(),
  });

  res.status(201).json({
    success: true,
    message: "Brand added successfully",
    data: brand,
  });
});
// GET /api/brand/list
const getBrands = async (req, res) => {
  const brands = await Brand.find().sort({ createdAt: -1 });
  res.json({ success: true, data: brands });
};
const updateVariant = asyncHandler(async (req, res) => {
  const { variant_id, brand_id, model_id, variant_name } = req.body;

  if (!variant_id || !brand_id || !model_id || !variant_name) {
    res.status(400);
    throw new Error("Variant ID, Brand ID, Model ID & Variant Name required");
  }

  // 1️⃣ Find the brand that currently has this variant
  const oldBrand = await Brand.findOne({ "models.variants._id": variant_id });
  if (!oldBrand) {
    res.status(404);
    throw new Error("Original variant not found");
  }

  let oldModel;
  let oldVariantIndex;

  // Find the model and variant index
  oldBrand.models.forEach((m) => {
    const idx = m.variants.findIndex((v) => v._id.toString() === variant_id);
    if (idx !== -1) {
      oldModel = m;
      oldVariantIndex = idx;
    }
  });

  if (!oldModel) {
    res.status(404);
    throw new Error("Original model not found");
  }

  const variantObj = oldModel.variants[oldVariantIndex];

  // 2️⃣ Remove variant from old model
  oldModel.variants.splice(oldVariantIndex, 1);
  await oldBrand.save();

  // 3️⃣ Add variant to new model
  const newBrand = await Brand.findById(brand_id);
  if (!newBrand) {
    res.status(404);
    throw new Error("New brand not found");
  }

  const newModel = newBrand.models.id(model_id);
  if (!newModel) {
    res.status(404);
    throw new Error("New model not found");
  }

  // Update variant name
  variantObj.variant_name = variant_name;

  newModel.variants.push(variantObj);
  await newBrand.save();

  res.json({ success: true, message: "Variant updated successfully", variant: variantObj });
});
const updateBrand =async (req, res) => {
  try {
    const { brand_id, brand_name } = req.body;

    if (!brand_id || !brand_name) {
      return res.status(400).json({
        success: false,
        message: "brand_id and brand_name are required",
      });
    }

    const brand = await Brand.findById(brand_id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    // 🔁 check duplicate
    const alreadyExists = await Brand.findOne({
      brand_name,
      _id: { $ne: brand_id },
    });

    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        message: "Brand name already exists",
      });
    }

    brand.brand_name = brand_name;
    await brand.save();

    res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const addModel = asyncHandler(async (req, res) => {
  const { brand_id, model_number } = req.body;
  if (!brand_id || !model_number) {
    res.status(400);
    throw new Error("Brand & Model required");
  }

  const brand = await Brand.findById(brand_id);
  if (!brand) {
    res.status(404);
    throw new Error("Brand not found");
  }

  // check duplicate
  if (brand.models.find(m => m.model_number === model_number)) {
    res.status(400);
    throw new Error("Model already exists for this brand");
  }

  brand.models.push({ model_number });
  await brand.save();

  res.json({ success: true, message: "Model added", brand });
});
const updateModel = asyncHandler(async (req, res) => {
  const {
    old_brand_id,
    new_brand_id,
    old_model_number,
    new_model_number,
  } = req.body;

  if (
    !old_brand_id ||
    !new_brand_id ||
    !old_model_number ||
    !new_model_number
  ) {
    res.status(400);
    throw new Error("All fields are required");
  }

  const oldBrand = await Brand.findById(old_brand_id);
  if (!oldBrand) {
    res.status(404);
    throw new Error("Old brand not found");
  }

  const modelIndex = oldBrand.models.findIndex(
    (m) => m.model_number === old_model_number
  );

  if (modelIndex === -1) {
    res.status(404);
    throw new Error("Model not found in old brand");
  }

  // 🔥 Case 1: Same brand → only update name
  if (old_brand_id === new_brand_id) {
    oldBrand.models[modelIndex].model_number = new_model_number;
    await oldBrand.save();

    return res.json({
      success: true,
      message: "Model updated successfully",
    });
  }

  // 🔥 Case 2: Brand changed → move model
  const newBrand = await Brand.findById(new_brand_id);
  if (!newBrand) {
    res.status(404);
    throw new Error("New brand not found");
  }

  // Remove from old brand
  oldBrand.models.splice(modelIndex, 1);
  await oldBrand.save();

  // Add to new brand
  newBrand.models.push({
    model_number: new_model_number,
  });
  await newBrand.save();

  res.json({
    success: true,
    message: "Model moved to new brand successfully",
  });
});
const deleteModel = asyncHandler(async (req, res) => {
  const { brand_id, model_id } = req.body;

  if (!brand_id || !model_id) {
    res.status(400);
    throw new Error("Brand ID & Model ID required");
  }

  // 🔹 Find the brand
  const brand = await Brand.findById(brand_id);
  if (!brand) {
    res.status(404);
    throw new Error("Brand not found");
  }

  // 🔹 Find the model by its _id inside the models array
  const modelIndex = brand.models.findIndex(m => m._id.toString() === model_id);
  if (modelIndex === -1) {
    res.status(404);
    throw new Error("Model not found");
  }

  // 🔹 Remove the model
  brand.models.splice(modelIndex, 1);

  // 🔹 Save the brand
  await brand.save();

  res.json({ success: true, message: "Model deleted" });
});

const deleteBrand =async (req, res) => {
  try {
    const { brand_id } = req.params;

    if (!brand_id) {
      return res.status(400).json({
        success: false,
        message: "brand_id is required",
      });
    }

    const brand = await Brand.findById(brand_id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    await Brand.findByIdAndDelete(brand_id);

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const addVariant = asyncHandler(async (req, res) => {
  const { brand_id, model_id, variant_name } = req.body;

  if (!brand_id || !model_id || !variant_name) {
    res.status(400);
    throw new Error("Brand ID, Model ID & Variant Name required");
  }

  // 🔹 Brand check
  const brand = await Brand.findById(brand_id);
  if (!brand) {
    res.status(404);
    throw new Error("Brand not found");
  }

  // 🔹 Model check
  const model = brand.models.id(model_id);
  if (!model) {
    res.status(404);
    throw new Error("Model not found");
  }

  // 🔹 Duplicate check
  const exists = model.variants.some(v => v.variant_name === variant_name);
  if (exists) {
    res.status(400);
    throw new Error("Variant already exists");
  }

  // 🔹 Push variant as object (important!)
  model.variants.push({ variant_name });

  // 🔹 Save brand
  await brand.save();

  res.json({ success: true, message: "Variant added successfully", model });
});
const getVariants = asyncHandler(async (req, res) => {
  const brands = await Brand.find({ status: true }); // sirf active brands

  // Flatten all variants with brand and model info
  let variantsList = [];

  brands.forEach((brand) => {
    brand.models.forEach((model) => {
      model.variants.forEach((variant) => {
        variantsList.push({
          _id: variant._id,
          variant_name: variant.variant_name,
          brand_id: brand._id,
          brand_name: brand.brand_name,
          model_id: model._id,
          model_number: model.model_number,
        });
      });
    });
  });

  res.json({ success: true, data: variantsList });
});
const getModelsByBrand = asyncHandler(async (req, res) => {
  const { brand_id } = req.query;

  if (!brand_id) {
    return res.status(400).json({
      success: false,
      message: "brand_id is required",
    });
  }

  const brand = await Brand.findById(brand_id).select("models");

  if (!brand) {
    return res.status(404).json({
      success: false,
      message: "Brand not found",
    });
  }

  res.status(200).json({
    success: true,
    models: brand.models,
  });
});

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
      // size,           // TEXT now
      // unit_type,
      // unit_value,
      shipment_box,   // { weight, box_length, box_breadth, box_height }
      product_description,
      reference_number,
      part_number,
       brand_id,
  model_id,
  variant_id,
       // HTML string from React Quill
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
        brand_id: brand_id || null,
  model_id: model_id || null,
  variant_id: variant_id || null,
      product_images, // array of image paths
      price: priceNum,
      quantity: quantityNum,
       part_number:part_number || null,               // ✅ AUTO UNIQUE
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
      part_number,
        brand_id,
  model_id,
  variant_id,
      // array of images to remove
    } = req.body;
console.log("Brand:", brand_id, "Model:", model_id, "Variant:", variant_id);

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
    product.part_number = part_number || product.part_number;
    product.brand_id = brand_id || product.brand_id;
product.model_id = model_id || product.model_id;
product.variant_id = variant_id || product.variant_id;


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
const deleteVariant = asyncHandler(async (req, res) => {
  const { brand_id, model_id, variant_id } = req.body;

  if (!brand_id || !model_id || !variant_id) {
    res.status(400);
    throw new Error("Brand ID, Model ID & Variant ID required");
  }

  const brand = await Brand.findById(brand_id);
  if (!brand) throw new Error("Brand not found");

  const model = brand.models.id(model_id);
  if (!model) throw new Error("Model not found");

  const variant = model.variants.id(variant_id);
  if (!variant) throw new Error("Variant not found");

  variant.remove();
  await brand.save();

  res.json({ success: true, message: "Variant deleted" });
});


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
    .sort({ createdAt: -1 })
    .populate({
      path: "brand_id",
      select: "brand_name", // only include brand name
    })
    .populate({
      path: "model_id",
      select: "model_number", // only include model number
    })
    .populate({
      path: "variant_id",
      select: "variant_name", // only include variant name
    });

  res.status(200).json({
    status: true,
    products,
    page,
    totalPages: Math.ceil(totalProducts / limit),
    totalProducts,
  });
});




module.exports = { createProduct, getAllProducts, deleteProductById,getVariants,getModelsByBrand, deleteVariant,updateVariant,addVariant,deleteModel,toggleProductStatus, updateModel,updateProduct,getProductById,getProductsByCategory,addModel, getRelatedProducts,recentProduct,addBrand,getBrands,updateBrand,deleteBrand};
