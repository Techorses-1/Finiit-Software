const mongoose = require("mongoose");

const bomItemSchema = new mongoose.Schema({
  itemId: String,
  itemName: String,
  itemDescription: String,
  requiredQty: Number,
}, { _id: false });

const bomSchema = new mongoose.Schema({
  bomId: { type: String, required: true, unique: true },
  productName: { type: String, required: true },
  description: String,
  hsnCode: String,
  items: [bomItemSchema],
}, { timestamps: true });

const BOM = mongoose.model("BOMs", bomSchema);

module.exports = BOM;
