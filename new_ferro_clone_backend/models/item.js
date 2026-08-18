const mongoose = require("mongoose");
const crypto = require("crypto");

const itemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      default: () => crypto.randomUUID(), // UUID auto-generated
    },
    itemName: {
      type: String,
      required: true,
      unique: true,   // ✅ unique index on itemName
      index: true,    // ✅ only one index here
    },
    minimumQty: {
      type: Number,
      required: true,
    },
    hsnCode: {
      type: String,
    },
    unit: {
      type: String,
    },
    description: {
      type: String,
    },
    taxSlab: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const Item = mongoose.model("items", itemSchema);
module.exports = Item;
