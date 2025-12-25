const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductSchema = new Schema(
  {
    product_name: { type: String, required: true },
    category_id: { type: Schema.Types.ObjectId, ref: "Category" },
    category_name: { type: String },
    subcategory_id: { type: Schema.Types.ObjectId, ref: "Subcategory" },
    subcategory_name: { type: String },
    product_images: { type: [String], default: [] },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    part_number: { type: String, unique: true, required: true },
    reference_number: {type: String,default: null},

    // size: { type: String, required: true },
//     unit_type: { type: String, required: true }, // piece, set, liter
// unit_value: { type: Number, required: true }, // 1, 2, 500
shipment_box: {
      weight: {
        type: Number, // kg
        default: null,
      },
      // box_length: {
      //   type: Number, // cm
      //   default: null,
      // },
      // box_breadth: {
      //   type: Number, // cm
      //   default: null,
      // },
      // box_height: {
      //   type: Number, // cm
      //   default: null,
      // },
    },
 product_description: {
      type: String,
      default: "",
    },

    status: { type: Number, required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Products = mongoose.model("Products", ProductSchema);
module.exports = Products;
