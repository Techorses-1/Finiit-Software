const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  itemId: String,
  name: String,
  description: String,
  hsn: String,
  qty: Number,
  rate: Number,
  unit: String,
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  date: String,
  ownerGST: String,
  ownerPAN: String,
  companyName: String,
  vendorId: String,
  vendorName: String,
  vendorGST: String,
  vendorAddress: String,
  vendorContact: String,
  vendorEmail: String,
  shipName: String,
  shipCompany: String,
  shipPhone: String,
  consigneeAddress: String,
  deliveryAddress: String,
  extraNote: String,
  terms: String,
  gstType: String,
  items: [itemSchema],
  taxSlab: { type: Number, default: 18 },
  discount: { type: Number, default: 0 },
  discountAmount: Number,
  discountedSubtotal: Number,
  subtotal: Number,
  cgst: Number,
  sgst: Number,
  igst: Number,
  total: Number,
  pdfUrl: String,
}, { timestamps: true });

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
