const express = require("express");
const router = express.Router();
const PurchaseOrder = require("../models/purchaseOrderModel");
const GlobalCounter = require("../models/globalCounter");
const GRN = require("../models/grnModel");

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

// Helper function to calculate totals
const calculateTotals = (items, discount = 0, vendorGST = "", taxSlab = 18) => {
  const subtotal = items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0);
  const discountAmount = +(subtotal * (discount / 100)).toFixed(2);
  const discountedSubtotal = +(subtotal - discountAmount).toFixed(2);

  const isIntraState = vendorGST && vendorGST.startsWith("24");
  let cgst = 0, sgst = 0, igst = 0;

  if (isIntraState) {
    cgst = +(discountedSubtotal * (taxSlab / 2 / 100)).toFixed(2);
    sgst = +(discountedSubtotal * (taxSlab / 2 / 100)).toFixed(2);
  } else {
    igst = +(discountedSubtotal * (taxSlab / 100)).toFixed(2);
  }

  const total = +(discountedSubtotal + cgst + sgst + igst).toFixed(2);
  return { subtotal, discountAmount, discountedSubtotal, cgst, sgst, igst, total, isIntraState };
};

// POST bulk-upload for Purchase Orders
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
      poNumbers: []
    };

    // Group data by PO Number
    const poGroups = {};
    data.forEach((row, index) => {
      const poNumber = row.poNumber;
      if (!poNumber) {
        results.errors.push(`Row ${index + 2}: PO Number is required`);
        return;
      }

      if (!poGroups[poNumber]) {
        poGroups[poNumber] = {
          poData: {
            poNumber: poNumber,
            date: row.date || new Date().toISOString().slice(0, 10),
            ownerGST: row.ownerGST || "24AAAFF2996A1ZS",
            ownerPAN: row.ownerPAN || "AAAFF2996A",
            companyName: row.companyName || '',
            vendorId: row.vendorId || '',
            vendorName: row.vendorName || '',
            vendorGST: row.vendorGST || '',
            vendorAddress: row.vendorAddress || '',
            vendorContact: row.vendorContact || '',
            vendorEmail: row.vendorEmail || '',
            shipName: row.shipName || '',
            shipCompany: row.shipCompany || "Ferro Tube And Forge Industries",
            shipPhone: row.shipPhone || '',
            consigneeAddress: row.consigneeAddress || "547, G.I.D.C. Estate, Vaghodia, Vadodara - 391760, Gujarat (India)",
            deliveryAddress: row.deliveryAddress || "547, G.I.D.C. Estate, Vaghodia, Vadodara - 391760, Gujarat (India)",
            extraNote: row.extraNote || '',
            terms: row.terms || '',
            taxSlab: parseFloat(row.taxSlab) || 18,
            discount: parseFloat(row.discount) || 0,
            gstType: row.gstType || (row.vendorGST?.startsWith('24') ? 'intra' : 'inter')
          },
          items: []
        };
      }

      // Add item if item data exists
      if (row.itemName && row.itemName.trim() !== '') {
        poGroups[poNumber].items.push({
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

    // Process each PO group
    for (const [poNumber, poGroup] of Object.entries(poGroups)) {
      try {
        // Validate required fields
        if (!poGroup.poData.companyName) {
          results.errors.push(`PO ${poNumber}: Company Name is required`);
          continue;
        }

        if (!poGroup.poData.vendorName) {
          results.errors.push(`PO ${poNumber}: Vendor Name is required`);
          continue;
        }

        if (!poGroup.poData.vendorGST) {
          results.errors.push(`PO ${poNumber}: Vendor GST is required`);
          continue;
        }

        if (poGroup.items.length === 0) {
          results.errors.push(`PO ${poNumber}: At least one item is required`);
          continue;
        }

        // Validate items
        const invalidItems = poGroup.items.filter(item =>
          !item.name || item.qty <= 0 || item.rate <= 0
        );

        if (invalidItems.length > 0) {
          results.errors.push(`PO ${poNumber}: Invalid items found - check names, quantities, and rates`);
          continue;
        }

        // Check if PO already exists
        const existingPO = await PurchaseOrder.findOne({ poNumber });
        if (existingPO) {
          results.errors.push(`PO ${poNumber}: Already exists in database`);
          continue;
        }

        // Calculate totals
        const totals = calculateTotals(
          poGroup.items,
          poGroup.poData.discount,
          poGroup.poData.vendorGST,
          poGroup.poData.taxSlab
        );

        // Create complete PO data
        const poData = {
          ...poGroup.poData,
          items: poGroup.items,
          ...totals,
          discountAmount: totals.discountAmount,
          discountedSubtotal: totals.discountedSubtotal,
          subtotal: totals.subtotal,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          total: totals.total,
          gstType: totals.isIntraState ? "intra" : "inter"
        };

        // Validate tax slab
        const validTaxSlabs = [0.1, 5, 12, 18, 28];
        if (!validTaxSlabs.includes(poData.taxSlab)) {
          results.errors.push(`PO ${poNumber}: Invalid tax slab ${poData.taxSlab}. Must be one of: ${validTaxSlabs.join(', ')}`);
          continue;
        }

        // Validate discount range
        if (poData.discount < 0 || poData.discount > 100) {
          results.errors.push(`PO ${poNumber}: Discount must be between 0 and 100`);
          continue;
        }

        // Create and save PO
        const po = new PurchaseOrder(poData);
        const savedPO = await po.save();

        results.insertedCount++;
        results.poNumbers.push(poNumber);

      } catch (error) {
        console.error(`Error processing PO ${poNumber}:`, error);
        results.errors.push(`PO ${poNumber}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: `Bulk upload completed. Successfully inserted ${results.insertedCount} out of ${Object.keys(poGroups).length} purchase orders.`,
      insertedCount: results.insertedCount,
      totalPOs: Object.keys(poGroups).length,
      totalRows: results.total,
      poNumbers: results.poNumbers,
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

// Additional route to check PO numbers for bulk upload validation
router.get("/check-existing-pos", async (req, res) => {
  try {
    const { poNumbers } = req.query;
    if (!poNumbers) {
      return res.status(400).json({ message: "PO numbers are required" });
    }

    const poArray = poNumbers.split(',');
    const existingPOs = await PurchaseOrder.find({
      poNumber: { $in: poArray }
    }).select('poNumber -_id');

    const existingPONumbers = existingPOs.map(po => po.poNumber);

    res.status(200).json({
      existingPOs: existingPONumbers,
      totalChecked: poArray.length,
      existingCount: existingPONumbers.length
    });
  } catch (error) {
    console.error("Error checking existing POs:", error);
    res.status(500).json({
      message: "Failed to check existing POs",
      error: error.message
    });
  }
});

// CREATE Purchase Order
router.post("/create-po", async (req, res) => {
  try {
    const counterId = "purchaseOrder";
    let counter = await GlobalCounter.findOne({ id: counterId });

    if (!counter) {
      counter = await GlobalCounter.create({ id: counterId, count: 1 });
    } else {
      counter.count += 1;
      await counter.save();
    }

    const newPONumber = `PO2025${String(counter.count).padStart(4, "0")}`;

    const newPO = new PurchaseOrder({ ...req.body, poNumber: newPONumber });
    await newPO.save();

    res.status(201).json({ success: true, message: "Purchase Order created", data: newPO });
  } catch (error) {
    console.error("Error creating PO:", error);
    res.status(500).json({ success: false, message: "Failed to create PO", error: error.message });
  }
});

// GET all POs
router.get("/get-pos", async (req, res) => {
  try {
    const allPOs = await PurchaseOrder.find();
    res.status(200).json({ success: true, data: allPOs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching POs", error: error.message });
  }
});

// GET PO by ID
router.get("/get-po/:poNumber", async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ poNumber: req.params.poNumber });
    if (!po) return res.status(404).json({ success: false, message: "PO not found" });
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error retrieving PO", error: error.message });
  }
});

// UPDATE PO PDF
router.put("/update-po-pdf/:poNumber", async (req, res) => {
  try {
    const { pdfUrl } = req.body;
    if (!pdfUrl) return res.status(400).json({ success: false, message: "pdfUrl is required" });

    const po = await PurchaseOrder.findOneAndUpdate({ poNumber: req.params.poNumber }, { pdfUrl }, { new: true });
    if (!po) return res.status(404).json({ success: false, message: "PO not found" });

    res.status(200).json({ success: true, message: "PDF URL updated", data: po });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update PO PDF", error: error.message });
  }
});

// UPDATE PO (items check for GRNs)
router.put("/update-po/:poNumber", async (req, res) => {
  try {
    const { poNumber } = req.params;
    const { poNumber: ignore, _id, createdAt, updatedAt, ...updateData } = req.body;

    const existingGRNs = await GRN.find({ poNumber });
    if (existingGRNs.length > 0 && updateData.items) {
      const currentPO = await PurchaseOrder.findOne({ poNumber });
      const currentItems = currentPO.items || [];
      const updatedItems = updateData.items;

      // Map item received quantities
      const receivedQuantities = {};
      existingGRNs.forEach(grn => (grn.items || []).forEach(item => {
        receivedQuantities[item.name] = (receivedQuantities[item.name] || 0) + (item.qty || 0);
      }));

      // Prevent reducing below received qty
      const invalidItems = updatedItems.filter(item => (receivedQuantities[item.name] || 0) > item.qty);
      if (invalidItems.length > 0) return res.status(400).json({
        success: false,
        message: "Cannot reduce quantity below received quantity",
        items: invalidItems.map(item => ({
          name: item.name,
          requestedQty: item.qty,
          receivedQty: receivedQuantities[item.name]
        }))
      });

      // Prevent deleting items with GRNs
      const removedItems = currentItems.filter(ci => !updatedItems.some(ui => ui.name === ci.name));
      const removedWithGRN = removedItems.filter(ri => existingGRNs.some(grn => (grn.items || []).some(i => i.name === ri.name)));
      if (removedWithGRN.length > 0) return res.status(400).json({
        success: false,
        message: `Cannot remove items that have GRNs: ${removedWithGRN.map(i => i.name).join(', ')}`
      });
    }

    const updatedPO = await PurchaseOrder.findOneAndUpdate({ poNumber }, updateData, { new: true });
    res.status(200).json({ success: true, message: "PO updated successfully", data: updatedPO });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update PO", error: error.message });
  }
});

// DELETE PO (only if no GRNs)
router.delete("/delete-po/:poNumber", async (req, res) => {
  try {
    const { poNumber } = req.params;
    const existingGRNs = await GRN.find({ poNumber });
    if (existingGRNs.length > 0) return res.status(400).json({ success: false, message: "Cannot delete PO with existing GRNs" });

    await PurchaseOrder.deleteOne({ poNumber });
    res.status(200).json({ success: true, message: "PO deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete PO", error: error.message });
  }
});

module.exports = router;
