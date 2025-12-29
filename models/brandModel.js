const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    variant_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
  },
 
);

const modelSchema = new mongoose.Schema(
  {
    model_number: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    variants: {
      type: [variantSchema],
      default: [],
    },
  },
  
);

const brandSchema = new mongoose.Schema(
  {
    brand_name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      unique: true,
      maxlength: [100, "Brand name cannot exceed 100 characters"],
    },

    models: {
      type: [modelSchema],
      default: [],
    },

    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand;
