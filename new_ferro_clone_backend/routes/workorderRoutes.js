const express = require("express");
const router = express.Router();
const WorkOrder = require("../models/workorderModel");
const Inventory = require("../models/inventory");
const BOM = require("../models/bomModel");
const GlobalCounter = require("../models/globalCounter");
const Sales = require("../models/salesModel");


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


// POST bulk-upload for Work Orders

// ✅ BULK UPLOAD ROUTE - NO CALCULATIONS, JUST SAVE DATA
router.post("/bulk-upload", upload.single('file'), async (req, res) => {
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
      insertedCount: 0,
      errors: [],
      workOrderNumbers: []
    };

    // Group data by Work Order Number
    const woGroups = {};
    data.forEach((row, index) => {
      const workOrderNumber = row.workOrderNumber;
      if (!workOrderNumber) {
        results.errors.push(`Row ${index + 2}: Work Order Number is required`);
        return;
      }

      if (!woGroups[workOrderNumber]) {
        woGroups[workOrderNumber] = {
          woData: {
            workOrderNumber: workOrderNumber,
            workOrderDate: row.workOrderDate || new Date().toISOString().slice(0, 10),
            poNumber: row.poNumber || '',
            poDate: row.poDate || '',
            receiver: {
              companyName: row.companyName || '',
              name: row.receiverName || '',
              gstin: row.receiverGSTIN || '',
              address: row.receiverAddress || '',
              city: row.receiverCity || '',
              pincode: row.receiverPincode || '',
              contact: row.receiverContact || '',
              email: row.receiverEmail || '',
              customerId: row.customerId || ''
            },
            // ✅ SAVE EXACT VALUES FROM EXCEL - NO CALCULATIONS
            subtotal: parseFloat(row.subtotal) || 0,
            cgst: parseFloat(row.cgst) || 0,
            sgst: parseFloat(row.sgst) || 0,
            igst: parseFloat(row.igst) || 0,
            total: parseFloat(row.total) || 0
          },
          items: []
        };
      }

      // Add product if product data exists
      if (row.productName && row.productName.trim() !== '') {
        woGroups[workOrderNumber].items.push({
          bomId: row.productBomId || '',
          name: row.productName || '',
          description: row.productDescription || '',
          hsn: row.productHSN || '',
          quantity: parseFloat(row.productQuantity) || 0,
          unitPrice: parseFloat(row.productUnitPrice) || 0,
          units: row.productUnits || ''
        });
      }
    });

    // Process each Work Order group
    for (const [workOrderNumber, woGroup] of Object.entries(woGroups)) {
      try {
        // Validate required fields
        if (!woGroup.woData.receiver.companyName) {
          results.errors.push(`Work Order ${workOrderNumber}: Company Name is required`);
          continue;
        }

        if (!woGroup.woData.receiver.name) {
          results.errors.push(`Work Order ${workOrderNumber}: Receiver Name is required`);
          continue;
        }

        if (!woGroup.woData.receiver.gstin) {
          results.errors.push(`Work Order ${workOrderNumber}: Receiver GSTIN is required`);
          continue;
        }

        if (woGroup.items.length === 0) {
          results.errors.push(`Work Order ${workOrderNumber}: At least one product is required`);
          continue;
        }

        // Validate products
        const invalidProducts = woGroup.items.filter(item =>
          !item.name || item.quantity <= 0 || item.unitPrice <= 0 || !item.bomId
        );

        if (invalidProducts.length > 0) {
          results.errors.push(`Work Order ${workOrderNumber}: Invalid products found - check names, quantities, unit prices, and BOM IDs`);
          continue;
        }

        // Check if Work Order already exists
        const existingWO = await WorkOrder.findOne({ workOrderNumber });
        if (existingWO) {
          results.errors.push(`Work Order ${workOrderNumber}: Already exists in database`);
          continue;
        }

        // ✅ NO CALCULATIONS - JUST SAVE DATA AS IS
        const woData = {
          ...woGroup.woData,
          items: woGroup.items
        };

        // Create and save Work Order
        const wo = new WorkOrder(woData);
        const savedWO = await wo.save();

        results.insertedCount++;
        results.workOrderNumbers.push(workOrderNumber);

        console.log(`✅ Work Order ${workOrderNumber} saved successfully`);

      } catch (error) {
        console.error(`Error processing Work Order ${workOrderNumber}:`, error);
        results.errors.push(`Work Order ${workOrderNumber}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: `Bulk upload completed. Successfully inserted ${results.insertedCount} out of ${Object.keys(woGroups).length} work orders.`,
      insertedCount: results.insertedCount,
      totalWorkOrders: Object.keys(woGroups).length,
      totalRows: results.total,
      workOrderNumbers: results.workOrderNumbers,
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


// Create Work Order
router.post("/create-workorder", async (req, res) => {
  try {
    const { items } = req.body;

    // Step 1: Generate Work Order number
    let counter = await GlobalCounter.findOne({ id: "workorder" });

    if (!counter) {
      counter = await GlobalCounter.create({ id: "workorder", count: 1 });
    } else {
      counter.count += 1;
      await counter.save();
    }

    const newWorkOrderNumber = `WO2025${String(counter.count).padStart(4, "0")}`;
    req.body.workOrderNumber = newWorkOrderNumber;

    // Step 2: Validate inventory using BOM ID
    for (const item of items) {
      if (!item.bomId) return res.status(400).json({ success: false, message: `BOM ID missing for item: ${item.name}` });

      const productBOM = await BOM.findOne({ bomId: item.bomId });
      if (!productBOM) return res.status(400).json({ success: false, message: `BOM not found for ID: ${item.bomId}` });

      for (const bomItem of productBOM.items) {
        const inventoryItem = await Inventory.findOne({ itemName: bomItem.itemName });
        if (!inventoryItem) return res.status(400).json({ success: false, message: `Inventory item not found: ${bomItem.itemName}` });

        const totalNeeded = bomItem.requiredQty * item.quantity;
        if ((inventoryItem.currentStock || 0) < totalNeeded) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${bomItem.itemName}". Required: ${totalNeeded}, Available: ${inventoryItem.currentStock}`
          });
        }
      }
    }

    // Step 3: Save work order
    const newWorkOrder = new WorkOrder(req.body);
    await newWorkOrder.save();

    // Step 4: Update inventory
    for (const item of items) {
      const productBOM = await BOM.findOne({ bomId: item.bomId });

      for (const bomItem of productBOM.items) {
        const inventoryItem = await Inventory.findOne({ itemName: bomItem.itemName });
        const totalUsed = bomItem.requiredQty * item.quantity;
        inventoryItem.currentStock -= totalUsed;
        inventoryItem.inUse = (inventoryItem.inUse || 0) + totalUsed;
        inventoryItem.lastUpdated = new Date();
        await inventoryItem.save();
      }
    }

    res.status(201).json({ success: true, message: "Work order created and inventory updated", data: newWorkOrder });

  } catch (error) {
    console.error("Error creating work order:", error);
    res.status(500).json({ success: false, message: "Failed to create work order", error: error.message });
  }
});

// Get all work orders
router.get("/get-workorders", async (req, res) => {
  try {
    const workOrders = await WorkOrder.find();
    res.status(200).json({ success: true, data: workOrders });
  } catch (error) {
    console.error("Error fetching work orders:", error);
    res.status(500).json({ success: false, message: "Failed to fetch work orders", error: error.message });
  }
});

// Get single work order
router.get("/get-workorder/:id", async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOne({ workOrderNumber: req.params.id });
    if (!workOrder) return res.status(404).json({ success: false, message: "Work order not found" });

    res.status(200).json({ success: true, data: workOrder });
  } catch (error) {
    console.error("Error fetching work order:", error);
    res.status(500).json({ success: false, message: "Failed to fetch work order", error: error.message });
  }
});

// Update work order
// Update work order
router.put("/update-workorder/:workOrderNumber", async (req, res) => {
  try {
    const { items, ...otherFields } = req.body;
    const { workOrderNumber } = req.params;

    const existingWorkOrder = await WorkOrder.findOne({ workOrderNumber });
    if (!existingWorkOrder)
      return res.status(404).json({ success: false, message: "Work order not found" });

    // Check sales for this work order
    const existingSales = await Sales.find({ workOrderNumber });

    // Calculate total quantities already sold for each BOM ID
    const soldQuantities = new Map();
    existingSales.forEach((sale) => {
      sale.items?.forEach((item) => {
        if (item.bomId) {
          soldQuantities.set(
            item.bomId,
            (soldQuantities.get(item.bomId) || 0) + (item.quantity || 0)
          );
        }
      });
    });

    // Validate that new quantities are not below sold quantities
    for (const newItem of items) {
      if (!newItem.bomId)
        return res.status(400).json({
          success: false,
          message: `BOM ID missing for item: ${newItem.name}`,
        });

      const alreadySold = soldQuantities.get(newItem.bomId) || 0;
      if (newItem.quantity < alreadySold) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce quantity of "${newItem.name}" below already sold quantity`,
          details: {
            productName: newItem.name,
            requestedQuantity: newItem.quantity,
            soldQuantity: alreadySold,
            bomId: newItem.bomId,
          },
        });
      }
    }

    // Inventory changes for removed/updated items
    const existingItemsMap = new Map(existingWorkOrder.items.map((i) => [i.bomId, i]));
    const newItemsMap = new Map(items.map((i) => [i.bomId, i]));

    // Restore inventory for removed items
    for (const [bomId, existingItem] of existingItemsMap) {
      if (!newItemsMap.has(bomId)) {
        const productBOM = await BOM.findOne({ bomId }); // ✅ FIXED
        if (!productBOM) continue;

        for (const bomItem of productBOM.items) {
          const inventoryItem = await Inventory.findOne({ itemName: bomItem.itemName });
          if (!inventoryItem) continue;

          const totalRestore = bomItem.requiredQty * existingItem.quantity;
          inventoryItem.currentStock += totalRestore;
          inventoryItem.inUse = Math.max(0, (inventoryItem.inUse || 0) - totalRestore);
          inventoryItem.lastUpdated = new Date();
          await inventoryItem.save();
        }
      }
    }

    // Adjust inventory for updated/new items
    for (const newItem of items) {
      const productBOM = await BOM.findOne({ bomId: newItem.bomId }); // ✅ FIXED
      if (!productBOM) continue;

      const oldQty = existingItemsMap.get(newItem.bomId)?.quantity || 0;
      const qtyDiff = newItem.quantity - oldQty;

      for (const bomItem of productBOM.items) {
        const inventoryItem = await Inventory.findOne({ itemName: bomItem.itemName });
        if (!inventoryItem) continue;

        const change = bomItem.requiredQty * qtyDiff;
        inventoryItem.currentStock -= change;
        inventoryItem.inUse = (inventoryItem.inUse || 0) + change;
        inventoryItem.lastUpdated = new Date();
        await inventoryItem.save();
      }
    }

    // Update work order
    existingWorkOrder.items = items;
    Object.assign(existingWorkOrder, otherFields);
    await existingWorkOrder.save();

    res.status(200).json({ success: true, data: existingWorkOrder });
  } catch (error) {
    console.error("Error updating work order:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update work order", error: error.message });
  }
});


// Delete work order
router.delete("/delete-workorder/:workOrderNumber", async (req, res) => {
  try {
    const { workOrderNumber } = req.params;

    const existingSales = await Sales.find({ workOrderNumber });
    if (existingSales.length > 0) return res.status(400).json({ success: false, message: "Cannot delete work order with associated sales" });

    const workOrder = await WorkOrder.findOne({ workOrderNumber });
    if (!workOrder) return res.status(404).json({ success: false, message: "Work order not found" });

    // Restore inventory
    for (const item of workOrder.items) {
      if (!item.bomId) continue;
      const productBOM = await BOM.findOne({ bomId: item.bomId });
      for (const bomItem of productBOM.items) {
        const inventoryItem = await Inventory.findOne({ itemName: bomItem.itemName });
        if (!inventoryItem) continue;

        const totalRestore = bomItem.requiredQty * item.quantity;
        inventoryItem.currentStock += totalRestore;
        inventoryItem.inUse = Math.max(0, (inventoryItem.inUse || 0) - totalRestore);
        inventoryItem.lastUpdated = new Date();
        await inventoryItem.save();
      }
    }

    await workOrder.deleteOne();
    res.status(200).json({ success: true, message: "Work order deleted and inventory restored successfully" });
  } catch (error) {
    console.error("Error deleting work order:", error);
    res.status(500).json({ success: false, message: "Failed to delete work order", error: error.message });
  }
});

// Check if work order has sales
router.get("/check-sales-for-workorder/:workOrderNumber", async (req, res) => {
  try {
    const { workOrderNumber } = req.params;
    const existingSales = await Sales.find({ workOrderNumber });
    res.status(200).json({ success: true, hasSales: existingSales.length > 0 });
  } catch (error) {
    console.error("Error checking sales for work order:", error);
    res.status(500).json({ success: false, message: "Error checking sales connection", error: error.message });
  }
});

// Check if work order has sales for a specific BOM
router.get("/check-sales-for-product-in-workorder/:workOrderNumber/:bomId", async (req, res) => {
  try {
    const { workOrderNumber, bomId } = req.params;
    const existingSales = await Sales.find({ workOrderNumber });
    const hasSales = existingSales.some(sale => sale.items?.some(item => item.bomId === bomId));
    res.status(200).json({ success: true, hasSales });
  } catch (error) {
    console.error("Error checking sales for product in work order:", error);
    res.status(500).json({ success: false, message: "Error checking sales connection", error: error.message });
  }
});

module.exports = router;
