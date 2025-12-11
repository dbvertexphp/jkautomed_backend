const asyncHandler = require("express-async-handler");
const Category = require("../models/categoryModel.js");
require("dotenv").config();
const baseURL = process.env.BASE_URL;
const ErrorHandler = require("../utils/errorHandler.js");
const multer = require("multer");
const path = require("path");
const fs = require('fs');

// const upload = require("../middleware/uploadMiddleware.js");

// const Createcategory = asyncHandler(async (req, res) => {
//   // Set the static path for category images
//   req.uploadPath = "uploads/category";

//   // Use the multer middleware to handle file upload
//   upload.single("category_image")(req, res, async (err) => {
//     if (err) {
//       throw new ErrorHandler(err.message, 400);
//     }

//     const { category_name } = req.body;
//     if (!category_name) {
//       throw new ErrorHandler("Please enter all the required fields.", 400);
//     }

//     const existingCategory = await Category.findOne({
//       category_name: { $regex: `^${category_name}$`, $options: "i" },
//     });

//     console.log("Existing Category:", existingCategory); // Debugging

//     if (existingCategory) {
//       return res.status(400).json({ message: "Category with this name already exists." });
//     }

//     // Get the file path and normalize it to use forward slashes
//     const categoryImage = req.file ? req.file.path.replace(/\\/g, "/") : null;

//     try {
//       const category = await Category.create({
//         category_name,
//         category_image: categoryImage,
//       });

//       if (category) {
//         res.status(201).json({
//           _id: category._id,
//           category_name: category.category_name,
//           category_image: category.category_image,
//           status: true,
//         });
//       } else {
//         throw new ErrorHandler("Category not created.", 400);
//       }
//     } catch (error) {
//       console.error("Error creating category:", error);
//       throw new ErrorHandler("Internal Server Error", 500);
//     }
//   });
// });



// edit by Atest

const uploadPath = path.join(__dirname, "../uploads/category");

// Ensure the directory exists before saving files
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const Createcategory = asyncHandler(async (req, res) => {
  // Set the upload path
  req.uploadPath = uploadPath;

  upload.single("category_image")(req, res, async (err) => {
    if (err) {
      console.error("Multer Error:", err);
      return res.status(400).json({ message: err.message, status: false });
    }

    const { category_name } = req.body;
    if (!category_name) {
      return res.status(400).json({ message: "Please enter all the required fields.", status: false });
    }

    const trimCategoryName = category_name.trim();

    try {
      const existingCategory = await Category.findOne({
        category_name: { $regex: `^${trimCategoryName}$`, $options: "i" },
      });

      if (existingCategory) {
        return res.status(400).json({ message: "Category with this name already exists.", status: false });
      }

      const categoryImage = req.file ? req.file.path.replace(/\\/g, "/") : null;

      const category = await Category.create({
        category_name:trimCategoryName,
        category_image: categoryImage,
      });

      return res.status(201).json({
        _id: category._id,
        category_name: category.category_name,
        category_image: category.category_image,
        status: true,
      });
    } catch (error) {
      console.error("Error creating category:", error);
      return res.status(500).json({ message: "Internal Server Error", status: false });
    }
  });
});




const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/category");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

const UpdateCategory = asyncHandler(async (req, res) => {
  upload.single("category_image")(req, res, async (err) => {
    if (err) {
      throw new ErrorHandler(err.message, 400);
    }

    const { category_id, new_category_name } = req.body;

    if (!category_id || !new_category_name) {
      throw new ErrorHandler("Please enter all the required fields.", 400);
    }

    try {
      const updateData = { category_name: new_category_name };
      if (req.file) {
        const categoryImage = req.file.path.replace(/\\/g, "/");
        updateData.category_image = categoryImage;
      }

      const category = await Category.findByIdAndUpdate(category_id, updateData, { new: true });

      if (!category) {
        throw new ErrorHandler("Category not found.", 400);
      }

      return res.status(200).json({
        category,
        message: "Category updated successfully.",
        status: true,
      });
    } catch (error) {
      console.error("Error updating category:", error);
      throw new ErrorHandler("Internal Server Error", 500);
    }
  });
});

const GetAllCategories = asyncHandler(async (req, res) => {
  try {
    // Fetch all categories from the database
    const categories = await Category.find().sort({ category_name: 1 });

    if (!categories || categories.length === 0) {
      throw new ErrorHandler("No categories found.", 400);
    }

    // Sort the categories alphabetically
    const sortedCategories = categories.sort((a, b) => {
      // "All" category should be at the top
      if (a.category_name.toLowerCase() === "all") return -1;
      if (b.category_name.toLowerCase() === "all") return 1;

      // "Other" category should be at the bottom
      if (a.category_name.toLowerCase() === "other") return 1;
      if (b.category_name.toLowerCase() === "other") return -1;

      // Sort alphabetically for other categories
      return a.category_name.localeCompare(b.category_name);
    });

    res.status(200).json(sortedCategories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw new ErrorHandler("Internal Server Error.", 500);
  }
});

const DeleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.body;
  if (!categoryId) {
    throw new ErrorHandler("Please enter all the required fields.", 400);
  }

  const category = await Category.findById(categoryId);

  if (category) {
    // Assuming the image is stored in category.image field
    const imagePath = category.category_image;
    if (imagePath) {
      // Delete the image from the server if it exists
      const filePath = path.join(__dirname, '..', 'uploads', 'category', path.basename(imagePath));

      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Error deleting image:", err);
        }
      });
    }

    // Remove the category from the database
    await category.remove();

    res.status(200).json({
      message: "Category deleted successfully.",
      status: true,
    });
  } else {
    throw new ErrorHandler("Category not found.", 400);
  }
});

const GetAllCategoriesAdmin = asyncHandler(async (req, res) => {
  try {
    // Fetch all categories from the database
    const categories = await Category.aggregate([
      {
        $project: {
          category_name: 1,
          category_image: 1, // Include category_image field
          createdAt: 1,
          updatedAt: 1,
          datetime: 1,
          isOther: {
            $cond: [{ $eq: ["$category_name", "Other"] }, 1, 0],
          },
        },
      },
      { $sort: { isOther: 1, category_name: 1 } },
    ]);

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        message: "No categories found.",
        status: false,
      });
    }

    // Map categories to remove the 'isOther' property
    const sanitizedCategories = categories.map((category) => {
      const { isOther, ...rest } = category;
      return rest;
    });

    // Filter out the "All" category from the categories array
    const filteredCategories = sanitizedCategories.filter(
      (category) => category.category_name !== "All" // Replace this ID with the actual ID of "All" category
    );

    res.status(200).json(filteredCategories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});

const GetSingleCategoryByName = asyncHandler(async (req, res) => {
  const { category_name } = req.body;
  if (!category_name) {
    throw new ErrorHandler("Please enter all the required fields.", 400);
  }
  const category = await Category.findOne({ category_name });

  if (category) {
    res.status(200).json({
      category: category,
      status: true,
    });
  } else {
    throw new ErrorHandler(`Category with name '${category_name}' not found.`, 400);
  }
});

const GetAllCategoriesAdminpage = asyncHandler(async (req, res, next) => {
  const { page = 1, search = "" } = req.body;
  const perPage = 5; // Number of documents to display per page

  // Calculate the number of documents to skip
  const skip = (page - 1) * perPage;

  try {
    // Create the search filter
    const searchFilter = search
      ? { category_name: { $regex: search, $options: "i" } } // Case-insensitive search
      : {};
    // Fetch all categories from the database
    const categories = await Category.aggregate([
      { $match: searchFilter },
      {
        $project: {
          category_name: 1,
          category_image: 1, // Include category_image field
          createdAt: 1,
          updatedAt: 1,
          datetime: 1,
          isOther: {
            $cond: [{ $eq: ["$category_name", "Other"] }, 1, 0],
          },
        },
      },
      { $sort: { updatedAt: -1 } },
      { $skip: skip }, // Skip documents based on pagination
      { $limit: perPage }, // Limit the number of documents per page
    ]);

    if (!categories || categories.length === 0) {
      return next(new ErrorHandler("No categories found.", 404));
    }

    // Map categories to remove the 'isOther' property
    const sanitizedCategories = categories.map((category) => {
      const { isOther, ...rest } = category;
      return rest;
    });

    // Filter out the "All" category from the categories array
    const filteredCategories = sanitizedCategories.filter(
      (category) => category.category_name !== "All" // Replace this ID with the actual ID of "All" category
    );

    const totalCount = await Category.countDocuments(); // Total count of documents
    const totalPages = Math.ceil(totalCount / perPage); // Total pages

    const paginationDetails = {
      current_page: page,
      data: filteredCategories,
      total_pages: totalPages,
      total_count: totalCount,
    };

    res.status(200).json(paginationDetails);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return next(new ErrorHandler("Internal Server Error.", 500));
  }
});

module.exports = {
  Createcategory,
  GetAllCategories,
  DeleteCategory,
  GetSingleCategoryByName,
  GetAllCategoriesAdmin,
  UpdateCategory,
  GetAllCategoriesAdminpage,
};
