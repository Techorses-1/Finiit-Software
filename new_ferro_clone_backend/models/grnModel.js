const mongoose = require("mongoose");

const grnItemSchema = new mongoose.Schema({
  itemId: String,
  name: String,
  description: String,
  hsn: String,
  qty: Number,
  rate: Number,
  unit: String
}, { _id: false });

const grnSchema = new mongoose.Schema({
  grnNumber: { type: String, required: true, unique: true },
  grnDate: String,
  poNumber: String,
  poDate: String,
  lrNumber: String,
  transporter: String,
  vehicleNo: String,
  companyName: String,
  vendorId: String,
  vendorName: String,
  vendorGST: String,
  vendorAddress: String,
  vendorContact: String,
  vendorEmail: String,
  items: [grnItemSchema],
  comments: String,
  otherCharges: Number,

  // ADD THESE FIELDS:
  discount: { type: Number, default: 0 },
  discountAmount: Number,
  discountedSubtotal: Number,
  taxSlab: { type: Number, default: 18 },

  // Existing fields
  subtotal: Number,
  cgst: Number,
  sgst: Number,
  igst: Number,
  total: Number,
  gstType: String,
}, { timestamps: true });

module.exports = mongoose.model("GRN", grnSchema);