const express = require("express");
const router = express.Router();
const BOM = require("../models/bomModel");
const GlobalCounter = require("../models/globalCounter");



// Bulk create BOMs (for Excel import)
router.post("/bulk-create-boms", async (req, res) => {
  try {
    const { boms } = req.body;

    if (!Array.isArray(boms) || boms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "BOMs array is required"
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const bomData of boms) {
      try {
        // Check if BOM already exists
        const existingBOM = await BOM.findOne({ bomId: bomData.bomId });
        if (existingBOM) {
          results.failed.push({
            bomId: bomData.bomId,
            error: "BOM ID already exists"
          });
          continue;
        }

        const newBOM = new BOM(bomData);
        await newBOM.save();
        results.successful.push(newBOM);

      } catch (error) {
        results.failed.push({
          bomId: bomData.bomId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      data: results,
      message: `Bulk upload completed: ${results.successful.length} successful, ${results.failed.length} failed`
    });

  } catch (error) {
    console.error("Error in bulk BOM creation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk create BOMs",
      error: error.message
    });
  }
});

// Create BOM with auto-generated ID
router.post("/create-bom", async (req, res) => {
  try {
    const counterId = "bom";
    let counter = await GlobalCounter.findOne({ id: counterId });

    if (!counter) {
      counter = await GlobalCounter.create({ id: counterId, count: 1 });
    } else {
      counter.count += 1;
      await counter.save();
    }

    const bomId = `BOM${String(counter.count).padStart(4, "0")}`;
    const bomData = { ...req.body, bomId };

    const newBOM = new BOM(bomData);
    await newBOM.save();

    res.status(201).json({ success: true, data: newBOM });
  } catch (error) {
    console.error("Error creating BOM:", error);
    res.status(500).json({ success: false, message: "Failed to create BOM", error: error.message });
  }
});

// Get all BOMs
router.get("/get-boms", async (req, res) => {
  try {
    const boms = await BOM.find();
    res.status(200).json({ success: true, data: boms });
  } catch (error) {
    console.error("Error fetching BOMs:", error);
    res.status(500).json({ success: false, message: "Failed to fetch BOMs", error: error.message });
  }
});

// Update BOM (only allowed fields)
router.put("/update-bom/:id", async (req, res) => {
  try {
    const { productName, description, hsnCode, items } = req.body;

    const bom = await BOM.findOneAndUpdate(
      { bomId: req.params.id },
      { productName, description, hsnCode, items },
      { new: true }
    );

    if (!bom) {
      return res.status(404).json({ success: false, message: "BOM not found" });
    }

    res.status(200).json({ success: true, data: bom });
  } catch (error) {
    console.error("Error updating BOM:", error);
    res.status(500).json({ success: false, message: "Failed to update BOM", error: error.message });
  }
});

// Delete BOM
router.delete("/delete-bom/:id", async (req, res) => {
  try {
    const deletedBOM = await BOM.findOneAndDelete({ bomId: req.params.id });

    if (!deletedBOM) {
      return res.status(404).json({ success: false, message: "BOM not found" });
    }

    res.status(200).json({ success: true, message: "BOM deleted successfully" });
  } catch (error) {
    console.error("Error deleting BOM:", error);
    res.status(500).json({ success: false, message: "Failed to delete BOM", error: error.message });
  }
});

module.exports = router;
