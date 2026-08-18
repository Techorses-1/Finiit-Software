const express = require("express");
const router = express.Router();
const Item = require("../models/item");
const Inventory = require("../models/inventory");


const multer = require("multer");
const XLSX = require("xlsx");

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload an Excel file'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// POST bulk-upload
router.post("/bulk-upload", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Read the Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ message: "Excel file is empty" });
    }

    const results = {
      total: data.length,
      insertedCount: 0,
      errors: []
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Map Excel columns to item fields - NO CHANGES TO DATA
        const itemData = {
          itemName: row.itemName, // ✅ Exact same as Excel
          minimumQty: row.minimumQty, // ✅ Exact same as Excel
          hsnCode: row.hsnCode, // ✅ Exact same as Excel
          unit: row.unit, // ✅ Exact same as Excel
          description: row.description, // ✅ Exact same as Excel
          taxSlab: row.taxSlab // ✅ Exact same as Excel
        };

        // Validate required fields
        if (!itemData.itemName) {
          results.errors.push(`Row ${i + 2}: Item Name is required`);
          continue;
        }

        if (!itemData.minimumQty || itemData.minimumQty <= 0) {
          results.errors.push(`Row ${i + 2}: Minimum Quantity must be greater than 0`);
          continue;
        }

        if (!itemData.hsnCode) {
          results.errors.push(`Row ${i + 2}: HSN Code is required`);
          continue;
        }

        if (!itemData.unit) {
          results.errors.push(`Row ${i + 2}: Unit is required`);
          continue;
        }

        if (!itemData.taxSlab) {
          results.errors.push(`Row ${i + 2}: Tax Slab is required`);
          continue;
        }

        if (!itemData.description) {
          results.errors.push(`Row ${i + 2}: Description is required`);
          continue;
        }

        // Check for duplicate itemName - EXACT MATCH (including spaces and case)
        const existingItem = await Item.findOne({
          itemName: itemData.itemName // ✅ Exact match - no changes
        });

        if (existingItem) {
          results.errors.push(`Row ${i + 2}: Item with name "${itemData.itemName}" already exists`);
          continue;
        }

        // Create new item - NO DATA PROCESSING
        const item = new Item(itemData);
        const savedItem = await item.save();

        // Create corresponding inventory entry - NO DATA PROCESSING
        const inventoryItem = new Inventory({
          itemId: savedItem.itemId,
          itemName: savedItem.itemName, // ✅ Exact same
          hsnCode: savedItem.hsnCode, // ✅ Exact same
          unit: savedItem.unit, // ✅ Exact same
          description: savedItem.description, // ✅ Exact same
          minimumQty: savedItem.minimumQty, // ✅ Exact same
        });
        await inventoryItem.save();

        results.insertedCount++;

      } catch (error) {
        results.errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: `Bulk upload completed. Successfully inserted ${results.insertedCount} out of ${results.total} items.`,
      insertedCount: results.insertedCount,
      total: results.total,
      errors: results.errors
    });

  } catch (error) {
    console.error("Error in bulk upload:", error);
    res.status(500).json({
      message: "Failed to process bulk upload",
      error: error.message
    });
  }
});



// POST /items/create-item - Create a new item + inventory
router.post("/create-item", async (req, res) => {
  try {
    const { itemName } = req.body;

    // Check for duplicate itemName
    const existingItem = await Item.findOne({ itemName });
    if (existingItem) {
      return res.status(400).json({
        message: "Item with this name already exists",
        field: "itemName"
      });
    }

    // Step 1: Create Item
    const item = new Item(req.body);
    const savedItem = await item.save();

    // Step 2: Create corresponding Inventory entry
    const inventoryItem = new Inventory({
      itemId: savedItem.itemId,
      itemName: savedItem.itemName,
      hsnCode: savedItem.hsnCode,
      unit: savedItem.unit,
      description: savedItem.description,
      minimumQty: savedItem.minimumQty,
    });
    await inventoryItem.save();

    res.status(201).json(savedItem);
  } catch (error) {
    console.error("Error creating item & inventory:", error);
    res.status(500).json({
      message: "Failed to create item and inventory",
      error: error.message
    });
  }
});

// GET /items/get-items - Get all items
router.get("/get-items", async (req, res) => {
  try {
    const items = await Item.find();
    res.status(200).json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({
      message: "Failed to fetch items",
      error: error.message
    });
  }
});

// PUT /items/update-item/:id - Update item + inventory
router.put("/update-item/:id", async (req, res) => {
  try {
    const { itemId, _id, createdAt, updatedAt, ...updateData } = req.body;

    // Step 1: Update the item
    const item = await Item.findOneAndUpdate(
      { itemId: req.params.id },
      updateData,
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Step 2: Update corresponding inventory entry
    const inventoryItem = await Inventory.findOne({ itemId: req.params.id });
    if (inventoryItem) {
      inventoryItem.itemName = item.itemName;
      inventoryItem.hsnCode = item.hsnCode;
      inventoryItem.unit = item.unit;
      inventoryItem.description = item.description;
      inventoryItem.minimumQty = item.minimumQty;
      await inventoryItem.save();
    }

    res.status(200).json({
      message: "Item and Inventory updated successfully",
      item
    });
  } catch (error) {
    console.error("Error updating item & inventory:", error);
    res.status(500).json({
      message: "Failed to update item and inventory",
      error: error.message
    });
  }
});

// DELETE /items/delete-item/:id - Delete item + inventory
router.delete("/delete-item/:id", async (req, res) => {
  try {
    // Step 1: Delete Item
    const deletedItem = await Item.findOneAndDelete({ itemId: req.params.id });
    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Step 2: Delete corresponding inventory
    await Inventory.findOneAndDelete({ itemId: req.params.id });

    res.status(200).json({ message: "Item and Inventory deleted successfully" });
  } catch (error) {
    console.error("Error deleting item & inventory:", error);
    res.status(500).json({
      message: "Failed to delete item and inventory",
      error: error.message
    });
  }
});

module.exports = router;
