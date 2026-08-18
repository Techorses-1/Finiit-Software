const mongoose = require("mongoose");
const crypto = require("crypto");

const inventorySchema = new mongoose.Schema(
  {
    inventoryId: {
      type: String,
      required: true,
      default: () => crypto.randomUUID(), // auto-generated UUID
    },
    itemId: {
      type: String,
      required: true,
    },
    itemName: {
      type: String,
      required: true,
    },
    hsnCode: String,
    unit: String,
    description: String,
    minimumQty: Number,

    // Stock fields
    currentStock: {
      type: Number,
      default: 0,
    },
    inUse: {
      type: Number,
      default: 0,
    },
    averagePrice: {
      type: Number,
      default: 0,
    },

    // Extra fields
    totalRateSum: {
      type: Number,
      default: 0,
    },
    rateCount: {
      type: Number,
      default: 0,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const Inventory = mongoose.model("Inventory", inventorySchema);

module.exports = Inventory;
