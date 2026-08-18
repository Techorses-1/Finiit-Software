// models/customer.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      default: uuidv4,
      unique: true,
    },
    customerName: { type: String },
    companyName: { type: String },
    gstNumber: { type: String },
    email: {
      type: String,
      required: true,
      unique: true, // ensures no duplicate email
    },
    email2: { type: String },
    email3: { type: String },
    contactNumber: { type: String },
    contactNumber2: { type: String },
    contactNumber3: { type: String },
    address: { type: String },
    address2: { type: String },
    city: { type: String },
    pincode: { type: String },
  },
  { timestamps: true }
);

const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
