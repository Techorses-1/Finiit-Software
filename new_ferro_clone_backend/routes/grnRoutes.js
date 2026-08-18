const express = require("express");
const router = express.Router();
const GRN = require("../models/grnModel");
const Inventory = require("../models/inventory");
const GlobalCounter = require("../models/globalCounter");
const PurchaseOrder = require("../models/purchaseOrderModel"); // Add this import




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

// Helper function to calculate GRN totals - UPDATED VERSION
const calculateGRNTotals = (items, otherCharges = 0, vendorGST = "", taxSlab = 18, discount = 0) => {
  const subtotal = items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0);
  const isIntraState = vendorGST && vendorGST.startsWith("24");

  // Apply discount
  const discountAmount = +(subtotal * (discount / 100)).toFixed(2);
  const discountedSubtotal = +(subtotal - discountAmount).toFixed(2);

  // Use tax slab for GST calculations
  const taxRate = taxSlab / 100;
  const cgst = isIntraState ? +(discountedSubtotal * (taxRate / 2)).toFixed(2) : 0;
  const sgst = isIntraState ? +(discountedSubtotal * (taxRate / 2)).toFixed(2) : 0;
  const igst = !isIntraState ? +(discountedSubtotal * taxRate).toFixed(2) : 0;

  const total = +(discountedSubtotal + cgst + sgst + igst + Number(otherCharges || 0)).toFixed(2);

  return {
    subtotal,
    discountAmount,
    discountedSubtotal,
    cgst,
    sgst,
    igst,
    total,
    gstType: isIntraState ? "intra" : "inter"
  };
};

// POST bulk-upload for GRNs
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
      errors: [],
      grnNumbers: []
    };

    // Group data by GRN Number
    const grnGroups = {};
    data.forEach((row, index) => {
      const grnNumber = row.grnNumber;
      if (!grnNumber) {
        results.errors.push(`Row ${index + 2}: GRN Number is required`);
        return;
      }

      if (!grnGroups[grnNumber]) {
        grnGroups[grnNumber] = {
          grnData: {
            grnNumber: grnNumber,
            grnDate: row.grnDate || new Date().toISOString().slice(0, 10),
            poNumber: row.poNumber || '',
            poDate: row.poDate || '',
            lrNumber: row.lrNumber || '',
            transporter: row.transporter || '',
            vehicleNo: row.vehicleNo || '',
            companyName: row.companyName || '',
            vendorId: row.vendorId || '',
            vendorName: row.vendorName || '',
            vendorGST: row.vendorGST || '',
            vendorAddress: row.vendorAddress || '',
            vendorContact: row.vendorContact || '',
            vendorEmail: row.vendorEmail || '',
            comments: row.comments || '',
            otherCharges: parseFloat(row.otherCharges) || 0
          },
          items: []
        };
      }

      // Add item if item data exists
      if (row.itemName && row.itemName.trim() !== '') {
        grnGroups[grnNumber].items.push({
          itemId: row.itemId || '',
          name: row.itemName || '',
          description: row.itemDescription || '',
          hsn: row.itemHSN || '',
          qty: parseFloat(row.itemQty) || 0,
          rate: parseFloat(row.itemRate) || 0,
          unit: row.itemUnit || ''
        });
      }
    });

    // Process each GRN group
    for (const [grnNumber, grnGroup] of Object.entries(grnGroups)) {
      try {
        // Validate required fields
        if (!grnGroup.grnData.poNumber) {
          results.errors.push(`GRN ${grnNumber}: PO Number is required`);
          continue;
        }

        if (!grnGroup.grnData.companyName) {
          results.errors.push(`GRN ${grnNumber}: Company Name is required`);
          continue;
        }

        if (!grnGroup.grnData.vendorName) {
          results.errors.push(`GRN ${grnNumber}: Vendor Name is required`);
          continue;
        }

        if (!grnGroup.grnData.vendorGST) {
          results.errors.push(`GRN ${grnNumber}: Vendor GST is required`);
          continue;
        }

        if (grnGroup.items.length === 0) {
          results.errors.push(`GRN ${grnNumber}: At least one item is required`);
          continue;
        }

        // Validate items
        const invalidItems = grnGroup.items.filter(item =>
          !item.name || item.qty <= 0 || item.rate <= 0
        );

        if (invalidItems.length > 0) {
          results.errors.push(`GRN ${grnNumber}: Invalid items found - check names, quantities, and rates`);
          continue;
        }

        // Check if GRN already exists
        const existingGRN = await GRN.findOne({ grnNumber });
        if (existingGRN) {
          results.errors.push(`GRN ${grnNumber}: Already exists in database`);
          continue;
        }

        // Check if PO exists
        const existingPO = await PurchaseOrder.findOne({ poNumber: grnGroup.grnData.poNumber });
        if (!existingPO) {
          results.errors.push(`GRN ${grnNumber}: PO ${grnGroup.grnData.poNumber} not found`);
          continue;
        }

        // Validate items against PO
        for (const grnItem of grnGroup.items) {
          const poItem = existingPO.items.find(poItem =>
            poItem.name && grnItem.name &&
            poItem.name.toString().trim().toLowerCase() ===
            grnItem.name.toString().trim().toLowerCase()
          );

          if (!poItem) {
            results.errors.push(`GRN ${grnNumber}: Item "${grnItem.name}" not found in PO`);
            continue;
          }

          // Check if quantity exceeds PO quantity
          if (grnItem.qty > poItem.qty) {
            results.errors.push(`GRN ${grnNumber}: Quantity for "${grnItem.name}" (${grnItem.qty}) exceeds PO quantity (${poItem.qty})`);
            continue;
          }
        }

        const totals = calculateGRNTotals(
          grnGroup.items,
          grnGroup.grnData.otherCharges,
          grnGroup.grnData.vendorGST,
          grnGroup.grnData.taxSlab || 18, // ADD taxSlab
          grnGroup.grnData.discount || 0   // ADD discount
        );

        // Create complete GRN data
        const grnData = {
          ...grnGroup.grnData,
          items: grnGroup.items,
          ...totals
        };

        // Create and save GRN
        const grn = new GRN(grnData);
        const savedGRN = await grn.save();

        results.insertedCount++;
        results.grnNumbers.push(grnNumber);

      } catch (error) {
        console.error(`Error processing GRN ${grnNumber}:`, error);
        results.errors.push(`GRN ${grnNumber}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: `Bulk upload completed. Successfully inserted ${results.insertedCount} out of ${Object.keys(grnGroups).length} GRNs.`,
      insertedCount: results.insertedCount,
      totalGRNs: Object.keys(grnGroups).length,
      totalRows: results.total,
      grnNumbers: results.grnNumbers,
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

// CREATE GRN
router.post("/create-grn", async (req, res) => {
  try {
    const grnData = req.body;
    const counterId = "grn";
    let counter = await GlobalCounter.findOne({ id: counterId });

    if (!counter) {
      counter = await GlobalCounter.create({ id: counterId, count: 1 });
    } else {
      counter.count += 1;
      await counter.save();
    }

    const newGRNNumber = `GRN2025${String(counter.count).padStart(4, "0")}`;
    grnData.grnNumber = newGRNNumber;

    // Update inventory stock
    for (const item of grnData.items) {
      const invItem = await Inventory.findOne({ itemName: item.name });
      if (!invItem) continue;

      const newTotalRate = (invItem.totalRateSum || 0) + item.rate;
      const newRateCount = (invItem.rateCount || 0) + 1;
      const newAveragePrice = newTotalRate / newRateCount;

      invItem.currentStock = (invItem.currentStock || 0) + item.qty;
      invItem.totalRateSum = newTotalRate;
      invItem.rateCount = newRateCount;
      invItem.averagePrice = newAveragePrice;
      invItem.lastUpdated = new Date();

      await invItem.save();
    }

    const newGRN = new GRN(grnData);
    await newGRN.save();

    res.status(201).json({ success: true, message: "GRN created", data: newGRN });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create GRN", error: error.message });
  }
});

// GET all GRNs
router.get("/get-grns", async (req, res) => {
  try {
    const grns = await GRN.find();
    res.status(200).json({ success: true, data: grns });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch GRNs", error: err.message });
  }
});

// GET GRNs by PO
router.get("/get-grns-by-po", async (req, res) => {
  try {
    const { poNumber } = req.query;
    if (!poNumber) return res.status(400).json({ error: "PO Number required" });
    const grns = await GRN.find({ poNumber });
    res.status(200).json({ success: true, data: grns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE GRN
// UPDATE GRN - UPDATED VERSION
router.put("/update-grn/:id", async (req, res) => {
  try {
    const { lrNumber, transporter, vehicleNo, grnDate, taxSlab } = req.body;

    // Get the GRN first to recalculate totals with new tax slab
    const grn = await GRN.findOne({ grnNumber: req.params.id });
    if (!grn) return res.status(404).json({ success: false, message: "GRN not found" });

    // Recalculate totals with new tax slab
    const updatedTaxSlab = taxSlab || grn.taxSlab || 18;
    const totals = calculateGRNTotals(
      grn.items,
      grn.otherCharges || 0,
      grn.vendorGST,
      updatedTaxSlab,
      grn.discount || 0
    );

    // Update GRN with all fields
    const updatedGRN = await GRN.findOneAndUpdate(
      { grnNumber: req.params.id },
      {
        lrNumber,
        transporter,
        vehicleNo,
        grnDate,
        taxSlab: updatedTaxSlab,
        ...totals
      },
      { new: true }
    );

    res.status(200).json({ success: true, data: updatedGRN });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update GRN", error: error.message });
  }
});

// DELETE GRN
router.delete("/delete-grn/:id", async (req, res) => {
  try {
    const grn = await GRN.findOne({ grnNumber: req.params.id });
    if (!grn) return res.status(404).json({ success: false, message: "GRN not found" });

    // Deduct stock from inventory
    for (const item of grn.items) {
      const invItem = await Inventory.findOne({ itemName: item.name });
      if (!invItem) continue;

      invItem.currentStock = Math.max(0, (invItem.currentStock || 0) - item.qty);
      await invItem.save();
    }

    await GRN.deleteOne({ grnNumber: req.params.id });
    res.status(200).json({ success: true, message: "GRN deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete GRN", error: error.message });
  }
});

module.exports = router;
