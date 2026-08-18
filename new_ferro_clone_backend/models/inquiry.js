const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const inquirySchema = new mongoose.Schema(
  {
    inquiryId: {
      type: String,
      default: uuidv4,
      unique: true,
    },
    name: { type: String, required: true },
    company: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inquiry", inquirySchema);
