const express = require("express");
const router = express.Router();
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

// ✅ BULK UPLOAD ROUTE FOR SALES
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
      invoiceNumbers: []
    };

    // Group data by Invoice Number
    const invoiceGroups = {};
    data.forEach((row, index) => {
      const invoiceNumber = row.invoiceNumber;
      if (!invoiceNumber) {
        results.errors.push(`Row ${index + 2}: Invoice Number is required`);
        return;
      }

      if (!invoiceGroups[invoiceNumber]) {
        invoiceGroups[invoiceNumber] = {
          invoiceData: {
            invoiceNumber: invoiceNumber,
            invoiceDate: row.invoiceDate || new Date().toISOString().slice(0, 10),
            workOrderNumber: row.workOrderNumber || '',
            poNumber: row.poNumber || '',
            poDate: row.poDate || '',

            // Transport Details
            lrNumber: row.lrNumber || '',
            lrDate: row.lrDate || '',
            vehicleNumber: row.vehicleNumber || '',
            transporter: row.transporter || '',
            transportMobile: row.transportMobile || '',

            // Receiver Details
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

            // Consignee Details
            consignee: {
              name: row.consigneeName || '',
              gstin: row.consigneeGSTIN || '',
              address: row.consigneeAddress || '',
              city: row.consigneeCity || '',
              pincode: row.consigneePincode || '',
              contact: row.consigneeContact || '',
              email: row.consigneeEmail || ''
            },

            // Tax & Financial Info
            taxSlab: parseFloat(row.taxSlab) || 18,
            tcsPercent: parseFloat(row.tcsPercent) || 0,
            subtotal: parseFloat(row.subtotal) || 0,
            cgst: parseFloat(row.cgst) || 0,
            sgst: parseFloat(row.sgst) || 0,
            igst: parseFloat(row.igst) || 0,
            tcs: parseFloat(row.tcs) || 0,
            total: parseFloat(row.total) || 0,

            // Additional Info
            extraNote: row.extraNote || '',
            terms: row.terms || '',
            includeTerms: row.includeTerms === 'Yes'
          },
          items: []
        };
      }

      // Add item if item data exists
      if (row.itemName && row.itemName.trim() !== '') {
        invoiceGroups[invoiceNumber].items.push({
          bomId: row.itemBomId || '',
          name: row.itemName || '',
          description: row.itemDescription || '',
          hsn: row.itemHSN || '',
          quantity: parseFloat(row.itemQuantity) || 0,
          unitPrice: parseFloat(row.itemUnitPrice) || 0,
          units: row.itemUnits || ''
        });
      }
    });

    // Process each Invoice group
    for (const [invoiceNumber, invoiceGroup] of Object.entries(invoiceGroups)) {
      try {
        // Validate required fields
        if (!invoiceGroup.invoiceData.receiver.name) {
          results.errors.push(`Invoice ${invoiceNumber}: Receiver Name is required`);
          continue;
        }

        if (!invoiceGroup.invoiceData.receiver.gstin) {
          results.errors.push(`Invoice ${invoiceNumber}: Receiver GSTIN is required`);
          continue;
        }

        if (!invoiceGroup.invoiceData.consignee.name) {
          results.errors.push(`Invoice ${invoiceNumber}: Consignee Name is required`);
          continue;
        }

        if (!invoiceGroup.invoiceData.consignee.gstin) {
          results.errors.push(`Invoice ${invoiceNumber}: Consignee GSTIN is required`);
          continue;
        }

        if (invoiceGroup.items.length === 0) {
          results.errors.push(`Invoice ${invoiceNumber}: At least one item is required`);
          continue;
        }

        // Validate transport details
        if (!invoiceGroup.invoiceData.lrNumber) {
          results.errors.push(`Invoice ${invoiceNumber}: LR Number is required`);
          continue;
        }

        if (!invoiceGroup.invoiceData.lrDate) {
          results.errors.push(`Invoice ${invoiceNumber}: LR Date is required`);
          continue;
        }

        if (!invoiceGroup.invoiceData.vehicleNumber) {
          results.errors.push(`Invoice ${invoiceNumber}: Vehicle Number is required`);
          continue;
        }

        if (!invoiceGroup.invoiceData.transporter) {
          results.errors.push(`Invoice ${invoiceNumber}: Transporter is required`);
          continue;
        }

        // Validate items
        const invalidItems = invoiceGroup.items.filter(item =>
          !item.name || item.quantity <= 0 || item.unitPrice <= 0
        );

        if (invalidItems.length > 0) {
          results.errors.push(`Invoice ${invoiceNumber}: Invalid items found - check names, quantities, and unit prices`);
          continue;
        }

        // Check if Invoice already exists
        const existingInvoice = await Sales.findOne({ invoiceNumber });
        if (existingInvoice) {
          results.errors.push(`Invoice ${invoiceNumber}: Already exists in database`);
          continue;
        }

        // Create complete Invoice data
        const invoiceData = {
          ...invoiceGroup.invoiceData,
          items: invoiceGroup.items
        };

        // Create and save Invoice
        const invoice = new Sales(invoiceData);
        const savedInvoice = await invoice.save();

        results.insertedCount++;
        results.invoiceNumbers.push(invoiceNumber);

        console.log(`✅ Invoice ${invoiceNumber} saved successfully`);

      } catch (error) {
        console.error(`Error processing Invoice ${invoiceNumber}:`, error);
        results.errors.push(`Invoice ${invoiceNumber}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: `Bulk upload completed. Successfully inserted ${results.insertedCount} out of ${Object.keys(invoiceGroups).length} sales invoices.`,
      insertedCount: results.insertedCount,
      totalInvoices: Object.keys(invoiceGroups).length,
      totalRows: results.total,
      invoiceNumbers: results.invoiceNumbers,
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

// Create new sales invoice
router.post("/create-sale", async (req, res) => {
  try {
    const { invoiceNumber } = req.body;

    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: "Invoice number is required" });
    }

    if (!/^[a-zA-Z0-9]{1,7}$/.test(invoiceNumber)) {
      return res.status(400).json({ success: false, message: "Invoice number must be 1-7 alphanumeric characters" });
    }

    const existingInvoice = await Sales.findOne({ invoiceNumber });
    if (existingInvoice) {
      return res.status(400).json({ success: false, message: "Invoice number already exists" });
    }

    if (req.body.ewayBill) req.body.ewayBill.docNo = invoiceNumber;

    const newSale = new Sales(req.body);
    await newSale.save();

    res.status(201).json({ success: true, message: "Invoice created successfully", data: newSale });

  } catch (error) {
    console.error("Error creating sale:", error);
    res.status(500).json({ success: false, message: "Failed to create sale", error: error.message });
  }
});

// Get all sales invoices
router.get("/get-sales", async (req, res) => {
  try {
    const sales = await Sales.find();
    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch sales", error: error.message });
  }
});

// Get sales by work order number
router.get("/get-sales-by-wo", async (req, res) => {
  try {
    const { workOrderNumber } = req.query;
    if (!workOrderNumber) return res.status(400).json({ success: false, message: "Work Order Number is required" });

    const sales = await Sales.find({ workOrderNumber });
    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch sales by work order", error: error.message });
  }
});

// Get single sale
router.get("/get-sale/:invoiceNumber", async (req, res) => {
  try {
    const sale = await Sales.findOne({ invoiceNumber: req.params.invoiceNumber });
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });
    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error retrieving sale", error: error.message });
  }
});

// Update sale with image URL
router.put("/update-sale-image/:invoiceNumber", async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl) return res.status(400).json({ success: false, message: "imageUrl is required" });

    const updatedSale = await Sales.findOneAndUpdate({ invoiceNumber }, { imageUrl }, { new: true });
    res.status(200).json({ success: true, message: "Image URL updated successfully", data: updatedSale });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update sale image", error: error.message });
  }
});

// Update sale
router.put("/update-sale/:invoiceNumber", async (req, res) => {
  try {
    const { createdAt, updatedAt, invoiceNumber, ...updateData } = req.body;
    const updatedSale = await Sales.findOneAndUpdate(
      { invoiceNumber: req.params.invoiceNumber },
      updateData,
      { new: true }
    );
    res.status(200).json({ success: true, data: updatedSale });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update sale", error: error.message });
  }
});

// Delete sale
router.delete("/delete-sale/:invoiceNumber", async (req, res) => {
  try {
    await Sales.findOneAndDelete({ invoiceNumber: req.params.invoiceNumber });
    res.status(200).json({ success: true, message: "Sale deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete sale", error: error.message });
  }
});



// ✅ NEW ROUTE: Upload E-Invoice Details from Excel
router.put("/update-einvoice-details/:invoiceNumber", upload.single('excelFile'), async (req, res) => {
  try {
    const { invoiceNumber } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Excel file is required" });
    }

    // Read and parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const excelData = XLSX.utils.sheet_to_json(worksheet);

    if (excelData.length === 0) {
      return res.status(400).json({ success: false, message: "Excel file is empty" });
    }

    // Extract the first row data (assuming one invoice per file)
    const firstRow = excelData[0];

    // Extract the 3 required fields with different possible column names
    const eInvoiceData = {
      ackDate: firstRow['Ack Date'] || firstRow['AckDate'] || firstRow['ackDate'] || '',
      ackNo: firstRow['Ack No'] || firstRow['AckNo'] || firstRow['ackNo'] || '',
      irn: firstRow['IRN'] || firstRow['irn'] || ''
    };

    // Validate required fields
    if (!eInvoiceData.irn) {
      return res.status(400).json({ success: false, message: "IRN field is required in Excel file" });
    }

    // Update the sales invoice with e-invoice details
    const updatedSale = await Sales.findOneAndUpdate(
      { invoiceNumber },
      eInvoiceData,
      { new: true }
    );

    if (!updatedSale) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    res.status(200).json({
      success: true,
      message: "E-invoice details updated successfully",
      data: {
        invoiceNumber,
        ackDate: eInvoiceData.ackDate,
        ackNo: eInvoiceData.ackNo,
        irn: eInvoiceData.irn
      }
    });

  } catch (error) {
    console.error("Error updating e-invoice details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process Excel file",
      error: error.message
    });
  }
});


module.exports = router;
