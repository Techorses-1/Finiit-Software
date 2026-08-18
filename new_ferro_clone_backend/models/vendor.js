const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const vendorSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      required: true,
      unique: true,
      index: true, // ✅ only one index here
      default: uuidv4,
    },
    vendorName: String,
    companyName: String,
    gstNumber: String,
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    email2: String,
    email3: String,
    contactNumber: String,
    contactNumber2: String,
    contactNumber3: String,
    address: String,
  },
  { timestamps: true }
);

const Vendor = mongoose.model("Vendors", vendorSchema);

module.exports = Vendor;
