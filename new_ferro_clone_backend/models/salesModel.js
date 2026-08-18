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

const consigneeSchema = new mongoose.Schema({
  name: String,
  gstin: String,
  address: String,
  address2: String, // NEW: Add address2 field
  city: String,
  pincode: String,
  contact: String,
  email: String
}, { _id: false });

const saleItemSchema = new mongoose.Schema({
  name: String,
  description: String,
  hsn: String,
  quantity: Number,
  unitPrice: Number,
  units: String,
  bomId: String
}, { _id: false });

const ewayBillItemSchema = new mongoose.Schema({
  itemNo: Number,
  productName: String,
  productDesc: String,
  hsnCode: String,
  quantity: Number,
  qtyUnit: String,
  taxableAmount: Number,
  sgstRate: Number,
  cgstRate: Number,
  igstRate: Number,
  cessRate: Number,
  cessNonAdvol: Number
}, { _id: false });

const ewayBillSchema = new mongoose.Schema({
  fromGstin: String,
  fromTrdName: String,
  fromAddr1: String,
  fromAddr2: String,
  fromPlace: String,
  fromPincode: String,
  fromStateCode: Number,
  actualFromStateCode: Number,

  supplyType: String,
  subSupplyType: Number,
  transType: Number,
  vehicleType: String,
  transMode: Number,
  transDistance: Number,

  toGstin: String,
  toTrdName: String,
  toAddr1: String,
  toAddr2: String,
  toPlace: String,
  toPincode: Number,
  toStateCode: Number,
  actualToStateCode: Number,

  docType: String,
  docNo: String,
  docDate: String,

  transporterName: String,
  transDocNo: String,
  transDocDate: String,
  vehicleNo: String,

  totalValue: Number,
  cgstValue: Number,
  sgstValue: Number,
  igstValue: Number,
  totInvValue: Number,
  OthValue: Number,
  TotNonAdvolVal: Number,
  mainHsnCode: String,

  itemList: [ewayBillItemSchema]
}, { _id: false });

const salesSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  workOrderNumber: String,
  invoiceDate: String,
  poNumber: String,
  poDate: String,
  receiver: receiverSchema,
  consignee: consigneeSchema,
  items: [saleItemSchema],
  lrNumber: String,
  lrDate: String,
  transporter: String,
  vehicleNumber: String,
  transportMobile: String,
  imageUrl: String,
  otherCharges: Number,
  extraNote: String,
  terms: String,
  ackDate: String,
  ackNo: String,
  irn: String,
  packetForwardingPercent: { type: Number, default: 0 },
  freightPercent: { type: Number, default: 0 },
  inspectionPercent: { type: Number, default: 0 },
  tcsPercent: { type: Number, default: 0 },
  subtotal: Number,
  taxSlab: Number,
  cgst: Number,
  sgst: Number,
  igst: Number,
  total: Number,
  pdfUrl: String,
  isServc: {
    type: String,
    enum: ["Y", "N"],
    default: "N"
  },
  ewayBill: ewayBillSchema
}, { timestamps: true });

const Sales = mongoose.model("Sales", salesSchema);
module.exports = Sales;