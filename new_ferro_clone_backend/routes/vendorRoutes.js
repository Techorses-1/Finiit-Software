const express = require("express");
const router = express.Router();
const Vendor = require("../models/vendor");


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
        // Map Excel columns to vendor fields
        const vendorData = {
          vendorName: row.vendorName || '',
          companyName: row.companyName || '',
          gstNumber: row.gstNumber || '',
          email: row.email || '',
          email2: row.email2 || '',
          email3: row.email3 || '',
          contactNumber: row.contactNumber || '',
          contactNumber2: row.contactNumber2 || '',
          contactNumber3: row.contactNumber3 || '',
          address: row.address || ''
        };

        // Validate required fields
        if (!vendorData.email) {
          results.errors.push(`Row ${i + 2}: Email is required`);
          continue;
        }

        if (!vendorData.vendorName) {
          results.errors.push(`Row ${i + 2}: Contact Person is required`);
          continue;
        }

        if (!vendorData.companyName) {
          results.errors.push(`Row ${i + 2}: Company Name is required`);
          continue;
        }

        // Check for duplicate email
        const existingVendor = await Vendor.findOne({
          email: vendorData.email
        });

        if (existingVendor) {
          results.errors.push(`Row ${i + 2}: Vendor with email ${vendorData.email} already exists`);
          continue;
        }

        // Create new vendor
        const vendor = new Vendor(vendorData);
        await vendor.save();
        results.insertedCount++;

      } catch (error) {
        results.errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: `Bulk upload completed. Successfully inserted ${results.insertedCount} out of ${results.total} vendors.`,
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

// POST /api/vendors - Create a new vendor
router.post("/create-vendors", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if vendor with this email already exists
    const existingVendor = await Vendor.findOne({ email });
    if (existingVendor) {
      return res.status(400).json({
        message: "Vendor with this email already exists",
        field: "email"
      });
    }

    const vendor = new Vendor(req.body);
    const savedVendor = await vendor.save();
    res.status(201).json(savedVendor);
  } catch (error) {
    console.error("Error creating vendor:", error);
    res.status(500).json({
      message: "Failed to create vendor",
      error: error.message
    });
  }
});

// GET /api/vendors - Get all vendors
router.get("/get-vendors", async (req, res) => {
  try {
    const vendors = await Vendor.find();
    res.status(200).json(vendors);
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({ message: "Failed to fetch vendors", error });
  }
});

// PUT /api/vendors/update-vendor/:id - Update vendor
router.put("/update-vendor/:id", async (req, res) => {
  try {
    const { vendorId, _id, createdAt, updatedAt, ...updateData } = req.body;

    const vendor = await Vendor.findOneAndUpdate(
      { vendorId: req.params.id }, // match vendorId
      updateData,
      { new: true } // return updated doc
    );

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.status(200).json(vendor);
  } catch (error) {
    console.error("Error updating vendor:", error);
    res.status(500).json({
      message: "Failed to update vendor",
      error: error.message
    });
  }
});

// DELETE /api/vendors/delete-vendor/:id - Delete vendor
router.delete("/delete-vendor/:id", async (req, res) => {
  try {
    const deletedVendor = await Vendor.findOneAndDelete({ vendorId: req.params.id });

    if (!deletedVendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.status(200).json({ message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    res.status(500).json({ message: "Failed to delete vendor", error });
  }
});

module.exports = router;
