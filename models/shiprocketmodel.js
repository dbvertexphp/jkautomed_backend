import mongoose from "mongoose";

const shiprocketAuthSchema = new mongoose.Schema({
  company_name: String,
  plan_id: Number,
  is_free_plan: Boolean,
  is_fixed_plan: Boolean,

  token: {
    type: String,
    required: true
  },

  generatedAt: {
    type: Date,
    required: true
  }
});

export default mongoose.model("ShiprocketAuth", shiprocketAuthSchema);
