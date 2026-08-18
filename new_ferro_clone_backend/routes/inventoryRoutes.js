const express = require("express");
const router = express.Router();
const Inventory = require("../models/inventory");


const multer = require("multer");

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

// ✅ SIMPLE BULK UPDATE ROUTE FOR INVENTORY
router.post("/bulk-update", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Read the Excel file
    const XLSX = require('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ message: "Excel file is empty" });
    }

    const results = {
      total: data.length,
      updatedCount: 0,
      errors: [],
      updatedItems: [],
      ignoredItems: []
    };

    // Get all inventory items once for efficient matching
    const allInventoryItems = await Inventory.find({});

    // Process each row in Excel
    for (const [index, row] of data.entries()) {
      try {
        const itemName = row['Item Name'];
        const avgPrice = parseFloat(row['Avg Price']) || 0;
        const currentStock = parseFloat(row['Current Stock']) || 0;
        const inUse = parseFloat(row['In Use']) || 0;

        // Validate required fields
        if (!itemName) {
          results.errors.push(`Row ${index + 2}: Item Name is required`);
          continue;
        }

        // 🔧 SIMPLE MATCHING: Find EXACT item name match
        const matchingItem = allInventoryItems.find(invItem =>
          invItem.itemName === itemName  // ✅ Exact match only
        );

        // If item not found in inventory, ignore and continue
        if (!matchingItem) {
          results.ignoredItems.push({
            excelItemName: itemName,
            reason: "Item not found in inventory"
          });
          console.log(`⏭️ Ignoring item not found in inventory: "${itemName}"`);
          continue;
        }

        // ✅ Item found - update it
        const updateData = {
          averagePrice: avgPrice,
          currentStock: currentStock,
          inUse: inUse,
          lastUpdated: new Date()
        };

        const updatedItem = await Inventory.findByIdAndUpdate(
          matchingItem._id,
          updateData,
          { new: true }
        );

        results.updatedCount++;
        results.updatedItems.push({
          excelItemName: itemName,
          matchedItemName: updatedItem.itemName,
          averagePrice: updatedItem.averagePrice,
          currentStock: updatedItem.currentStock,
          inUse: updatedItem.inUse
        });

        console.log(`✅ Inventory item "${itemName}" updated successfully`);

      } catch (error) {
        console.error(`Error processing row ${index + 2}:`, error);
        results.errors.push(`Row ${index + 2}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: `Bulk update completed. Successfully updated ${results.updatedCount} out of ${results.total} inventory items. ${results.ignoredItems.length} items ignored (not found in inventory).`,
      updatedCount: results.updatedCount,
      ignoredCount: results.ignoredItems.length,
      totalItems: results.total,
      updatedItems: results.updatedItems,
      ignoredItems: results.ignoredItems,
      errors: results.errors
    });

  } catch (error) {
    console.error("Error in bulk update:", error);
    res.status(500).json({
      message: "Failed to process bulk update",
      error: error.message
    });
  }
});

// GET /inventory/get-inventory - Get all inventory items
router.get("/get-inventory", async (req, res) => {
  try {
    const inventory = await Inventory.find();
    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
      error: error.message,
    });
  }
});


// GET /inventory/get-inventory - Get all inventory items
router.get("/get-inventory", async (req, res) => {
  try {
    const inventory = await Inventory.find();
    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
      error: error.message,
    });
  }
});



module.exports = router;
