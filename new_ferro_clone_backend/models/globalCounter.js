const mongoose = require("mongoose");

const globalCounterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // e.g. 'purchaseOrder', 'grn'
  count: { type: Number, required: true, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("GlobalCounter", globalCounterSchema);
