const asyncHandler = require("express-async-handler");
const Category = require("../models/categoryModel.js");
const Subcategory = require("../models/subCategoryModel.js");
require("dotenv").config();
const upload = require("../middleware/uploadMiddleware.js");
const ErrorHandler = require("../utils/errorHandler.js");

const baseURL = process.env.BASE_URL;

const createSubcategory = asyncHandler(async (req, res, next) => {
  // Use the multer middleware to handle file upload
  req.uploadPath = "uploads/subcategory";
  upload.single("subcategory_image")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }

    const { categoryId, subcategory_name } = req.body;
    console.log(req.body);
    const subcategory_image = req.file ? req.file.path.replace(/\\/g, "/") : null;

    if (!categoryId || !subcategory_name || !subcategory_image) {
      return next(new ErrorHandler("Please enter all the required fields.", 400));
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return next(new ErrorHandler("Category not found.", 400));
    }

    const subcategory = {
      subcategory_name,
      subcategory_image,
    };

    category.subcategories.push(subcategory);

    await category.save();

    res.status(201).json({
      _id: category._id,
      category_name: category.category_name,
      subcategories: category.subcategories,
      status: true,
    });
  });
});
const deleteSubCategory = asyncHandler(async (req, res, next) => {
  try {
    const { category_id, subcategory_id } = req.body;


    if (!category_id || !subcategory_id) {
      return res.status(400).json({
        status: false,
        message: "category_id and subcategory_id are required",
      });
    }

    // 🔍 Find category
    const category = await Category.findById(category_id);
    if (!category) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    // ❌ Remove subcategory by _id
    const originalLength = category.subcategories.length;
    category.subcategories = category.subcategories.filter(
      (sub) => sub._id.toString() !== subcategory_id
    );

    if (category.subcategories.length === originalLength) {
      return res.status(404).json({
        status: false,
        message: "Subcategory not found",
      });
    }

    // 💾 Save updated category
    await category.save();

    res.status(200).json({
      status: true,
      message: "Subcategory deleted successfully",
      subcategories: category.subcategories,
    });
  } catch (error) {
    next(error);
  }
});


// subCategoryController.js -> updateSubCategory function ko replace karo isse
const updateSubCategory = asyncHandler(async (req, res, next) => {
  req.uploadPath = "uploads/subcategory";

  upload.single("subcategory_image")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }

    try {
      const { category_id, old_category_id, subcategory_id } = req.body;

      // frontend se jo bhi aaye (safe handling)
      const subcategory_name = req.body.subcategory_name || req.body.new_subcategory_name;

      const newImage = req.file ? req.file.path.replace(/\\/g, "/") : null;

      if (!category_id || !subcategory_id || !subcategory_name) {
        return res.status(400).json({
          status: false,
          message: "Missing fields",
        });
      }

      // 🔹 SAME CATEGORY UPDATE
      if (!old_category_id || old_category_id === category_id) {
        const category = await Category.findById(category_id);

        if (!category) {
          return res.status(404).json({ message: "Category not found" });
        }

        const sub = category.subcategories.id(subcategory_id);

        if (!sub) {
          return res.status(404).json({ message: "Subcategory not found" });
        }

        sub.subcategory_name = subcategory_name;
        if (newImage) sub.subcategory_image = newImage;

        await category.save();

        return res.json({
          status: true,
          message: "Subcategory updated successfully",
        });
      }

      // 🔹 MOVE TO ANOTHER CATEGORY
      const oldCat = await Category.findById(old_category_id);
      const newCat = await Category.findById(category_id);

      if (!oldCat || !newCat) {
        return res.status(404).json({
          message: "Category not found",
        });
      }

      const sub = oldCat.subcategories.id(subcategory_id);

      if (!sub) {
        return res.status(404).json({
          message: "Subcategory not found",
        });
      }

      const movedSub = {
        _id: sub._id,
        subcategory_name: subcategory_name,
        subcategory_image: newImage || sub.subcategory_image,
        datetime: sub.datetime || new Date(),
      };

      oldCat.subcategories.pull(subcategory_id);
      await oldCat.save();

      newCat.subcategories.push(movedSub);
      await newCat.save();

      res.json({
        status: true,
        message: "Subcategory moved and updated successfully",
      });
    } catch (error) {
      console.error("Update subcategory error:", error);
      res.status(500).json({
        status: false,
        message: "Server error",
      });
    }
  });
});

const getAllSubCategories = asyncHandler(async (req, res) => {
  try {
    const { page = 1, search = "" } = req.query; // 🔥 page & search
    const perPage = 5;

    const skip = (page - 1) * perPage;

    // 🔥 Fetch all categories
    const categories = await Category.find().sort({ category_name: 1 });

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        message: "No categories found.",
        status: false,
      });
    }

    let subcategories = [];

    categories.forEach((category) => {
      category.subcategories.forEach((subcategory) => {
        subcategories.push({
          category_id: category._id.toString(),
          category_name: category.category_name,
          subcategory_id: subcategory._id.toString(),
          subcategory_name: subcategory.subcategory_name,
          subcategory_image: subcategory.subcategory_image,
          datetime: subcategory.datetime,
        });
      });
    });

    // 🔍 SEARCH FILTER
    if (search) {
      const searchLower = search.toLowerCase();
      subcategories = subcategories.filter(
        (item) =>
          item.subcategory_name.toLowerCase().includes(searchLower) ||
          item.category_name.toLowerCase().includes(searchLower)
      );
    }

    // 🔃 SORT BY NAME
    subcategories.sort((a, b) =>
      a.subcategory_name.localeCompare(b.subcategory_name)
    );

    const totalCount = subcategories.length;
    const totalPages = Math.ceil(totalCount / perPage);

    // 🔥 PAGINATION SLICE
    const paginatedData = subcategories.slice(skip, skip + perPage);

    res.status(200).json({
      status: true,
      current_page: Number(page),
      total_pages: totalPages,
      total_count: totalCount,
      data: paginatedData,
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});


const DeleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.body;

  const category = await Category.findById(categoryId);

  if (category) {
    await category.remove();
    res.status(200).json({
      message: "Category deleted successfully.",
      status: true,
    });
  } else {
    res.status(404).json({
      message: "Category not found.",
      status: false,
    });
  }
});

const GetAllCategoriesAdmin = asyncHandler(async (req, res) => {
  try {
    // Fetch all categories from the database
    const categories = await Category.aggregate([
      {
        $project: {
          category_name: 1,
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

  const category = await Category.findOne({ category_name });

  if (category) {
    res.status(200).json({
      category: category,
      status: true,
    });
  } else {
    res.status(404).json({
      message: `Category with name '${category_name}' not found.`,
      status: false,
    });
  }
});

const getAllSubCategoriesAdminpage = asyncHandler(async (req, res) => {
  const { page = 1 } = req.body;
  const perPage = 10; // Number of documents to display per page

  // Calculate the number of documents to skip
  const skip = (page - 1) * perPage;

  try {
    // Fetch all categories and their subcategories from the database
    const categories = await Category.aggregate([
      {
        $unwind: "$subcategories",
      },
      {
        $project: {
          category_name: 1,
          "subcategories.subcategory_name": 1,
          "subcategories.subcategory_image": 1,
          "subcategories.datetime": 1,
        },
      },
      {
        $sort: {
          "subcategories.subcategory_name": 1,
        },
      },
      {
        $skip: skip, // Skip documents based on pagination
      },
      {
        $limit: perPage, // Limit the number of documents per page
      },
    ]);

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        message: "No subcategories found.",
        status: false,
      });
    }

    // Map categories to extract subcategories
    const subcategories = categories.map((category) => {
      return {
        category_name: category.category_name,
        subcategory_name: category.subcategories.subcategory_name,
        subcategory_image: category.subcategories.subcategory_image,
        datetime: category.subcategories.datetime,
      };
    });

    const totalCount = await Category.aggregate([{ $unwind: "$subcategories" }, { $count: "total" }]);

    const totalPages = Math.ceil(totalCount[0]?.total / perPage);

    const paginationDetails = {
      current_page: page,
      data: subcategories,
      total_pages: totalPages,
      total_count: totalCount[0]?.total,
    };

    res.status(200).json(paginationDetails);
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});

const getSubCategoryByCategoryId = asyncHandler(async (req, res) => {
  const { category_id } = req.body;
  try {
    // Check if category_id is provided
    if (!category_id) {
      return res.status(400).json({
        message: "Please provide category ID.",
        status: false,
      });
    }

    // Find the category by ID
    const category = await Category.findById(category_id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
        status: false,
      });
    }

    // Extract subcategories
    const subcategories = category.subcategories.map((subcategory) => ({
      subcategory_name: subcategory.subcategory_name,
      subcategory_image: subcategory.subcategory_image,
      datetime: subcategory.datetime,
    }));

    // Return the subcategories
    res.status(200).json({
      category_name: category.category_name,
      subcategories,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});

const getSubCategoryByCategoryIdInAdmin = asyncHandler(async (req, res) => {
  const { category_id } = req.params;
  console.log(req.params);
  try {
    // Check if category_id is provided
    if (!category_id) {
      return res.status(400).json({
        message: "Please provide category ID.",
        status: false,
      });
    }

    // Find the category by ID
    const category = await Category.findById(category_id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
        status: false,
      });
    }

    // Extract subcategories
    const subcategories = category.subcategories.map((subcategory) => ({
      subcategory_id: subcategory._id,
      subcategory_name: subcategory.subcategory_name,
      subcategory_image: subcategory.subcategory_image,
      datetime: subcategory.datetime,
    }));

    // Return the subcategories
    res.status(200).json({
      category_name: category.category_name,
      subcategories,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      message: "Internal Server Error.",
      status: false,
    });
  }
});

module.exports = {
  createSubcategory,
  getAllSubCategories,
  DeleteCategory,
  GetSingleCategoryByName,
  GetAllCategoriesAdmin,
  updateSubCategory,
  getAllSubCategoriesAdminpage,
  getSubCategoryByCategoryId,
  getSubCategoryByCategoryIdInAdmin,
  deleteSubCategory
};
