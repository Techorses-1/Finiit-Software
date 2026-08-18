const mongoose = require("mongoose");

const partySchema = new mongoose.Schema({
  companyName: String,
  name: String,
  gstin: String,
  address: String,
  address2: String,
  city: String,
  pincode: String,
  contactNumber: String,
  email: String,
  customerId: String
}, { _id: false });

// UPDATED: Changed from bomId to itemId
const quotationItemSchema = new mongoose.Schema({
  itemId: String,          // Changed from bomId to itemId
  name: String,           // itemName
  description: String,
  hsn: String,           // hsnCode
  quantity: Number,
  unitPrice: Number,
  units: String          // unit
}, { _id: false });

const quotationSchema = new mongoose.Schema({
  quotationId: {
    type: String,
    required: true,
    unique: true,
    match: [/^[a-zA-Z0-9]{1,7}$/, "Quotation ID must be 1-7 alphanumeric characters"]
  },
  quotationNumber: {
    type: String,
    required: true,
    unique: true
  },
  quotationDate: {
    type: String,
    required: true
  },
  refNo: {
    type: String,
    default: ""
  },
  internalDate: {
    type: String,
    required: true
  },
  party: partySchema,
  items: [quotationItemSchema],
  remarks: String,
  taxSlab: {
    type: Number,
    required: true
  },
  tcsPercent: {
    type: Number,
    default: 0
  },
  terms: String,
  includeTerms: {
    type: Boolean,
    default: false
  },

  // Calculated fields
  subtotal: Number,
  cgst: Number,
  sgst: Number,
  igst: Number,
  tcs: Number,
  total: Number,

  isIntraState: Boolean
}, { timestamps: true });

const Quotation = mongoose.model("Quotation", quotationSchema);
module.exports = Quotation;