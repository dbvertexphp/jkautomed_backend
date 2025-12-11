const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    english_name: {
      type: String,
    },
    local_name: {
      type: String,
      default: null,
    },
    other_name: {
      type: String,
      default: null,
    },
    product_images: [String],
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    price: {
      type: Number,
    },
    quantity: {
      type: Number,
    },
    product_type: {
      type: String,
      // enum: ["indoor", "outdoor", "office", "other"],
    },
    product_role: {
      type: String,
      enum: ["fertilizer", "tools", "supplier"],
    },
    product_size: {
      type: String,
      enum: ["small", "medium", "large"],
    },
    product_weight: {
      type: String,
      default: null,
    },
    categoryName:{
      type: String,
      default:null,
    },
    size:{
      type:String,
      default:null,
    },
    description: {
      type: String,
      default: null,
    },
    supplier_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: false,
    },
    default_product:{
      type: Boolean,
      default: false,
    },
    delete_status:{
     type: Boolean,
     default: true,
    }
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
