const mongoose = require("mongoose");

const receiverSchema = new mongoose.Schema({
  companyName: String,
  name: String,
  gstin: String,
  address: String,
  address2: String, // NEW: Add address2 field
  city: String,
  pincode: String,
  contact: String,
  email: String,
  customerId: String
}, { _id: false });

const workOrderItemSchema = new mongoose.Schema({
  bomId: String,
  name: String,
  description: String,
  hsn: String,
  quantity: Number,
  unitPrice: Number,
  units: String
}, { _id: false });

const workOrderSchema = new mongoose.Schema({
  workOrderNumber: { type: String, required: true, unique: true },
  workOrderDate: String,
  poNumber: String,
  poDate: String,
  receiver: receiverSchema,
  items: [workOrderItemSchema],
  subtotal: Number,
  cgst: Number,
  sgst: Number,
  igst: Number,
  total: Number,
  status: String
}, { timestamps: true });

const WorkOrder = mongoose.model("WorkOrders", workOrderSchema);
module.exports = WorkOrder;