const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [
    {
      product_id:{type: mongoose.Schema.Types.ObjectId, ref: "Products", required:true},
      product_name:{ type: String, required: true },
      selling_price: { type: Number, required: true },
      units: { type: Number, required: true },
      
      
      // Status for each item
    },
  ],
 status: { 
  type: String, 
  enum: [
    "Pending",
    "On the way",
    "Delivered",
    "Cancelled"
  ], 
  default: "pending" 
},


  shipping_address: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    mobile_number: { type: String, required: true },
    
  },
awb_number: { type: String, default: null },
courier_charge: { type: Number, default: 0 },
  
  payment_method: { type: String, enum: ["online", "cod"], required: true },
  total_amount: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
