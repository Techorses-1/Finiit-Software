// routes/customerRoutes.js
const express = require("express");
const router = express.Router();
const Customer = require("../models/customer");

const XLSX = require("xlsx");
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
        // Map Excel columns to customer fields
        const customerData = {
          customerName: row.customerName || '',
          companyName: row.companyName || '',
          gstNumber: row.gstNumber || '',
          email: row.email || '',
          email2: row.email2 || '',
          email3: row.email3 || '',
          contactNumber: row.contactNumber || '',
          contactNumber2: row.contactNumber2 || '',
          contactNumber3: row.contactNumber3 || '',
          address: row.address || '',
          city: row.city || '',
          pincode: row.pincode || ''
        };

        // Validate required fields
        if (!customerData.email) {
          results.errors.push(`Row ${i + 2}: Email is required`);
          continue;
        }

        if (!customerData.customerName) {
          results.errors.push(`Row ${i + 2}: Customer Name is required`);
          continue;
        }

        // Check for duplicate email
        const existingCustomer = await Customer.findOne({
          email: customerData.email
        });

        if (existingCustomer) {
          results.errors.push(`Row ${i + 2}: Customer with email ${customerData.email} already exists`);
          continue;
        }

        // Create new customer
        const customer = new Customer(customerData);
        await customer.save();
        results.insertedCount++;

      } catch (error) {
        results.errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    res.status(200).json({
      message: `Bulk upload completed. Successfully inserted ${results.insertedCount} out of ${results.total} customers.`,
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

// POST create-customer
router.post("/create-customer", async (req, res) => {
  try {
    const { email } = req.body;

    // Check for existing customer
    const existingCustomer = await Customer.findOne({ email });

    if (existingCustomer) {
      return res.status(400).json({
        message: "Customer with this email already exist",
        field: "email",
      });
    }

    const customer = new Customer(req.body);
    const savedCustomer = await customer.save();
    res.status(201).json(savedCustomer);
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({
      message: "Failed to create customer",
      error: error.message,
    });
  }
});

// GET get-customers
router.get("/get-customers", async (req, res) => {
  try {
    const customers = await Customer.find();
    res.status(200).json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ message: "Failed to fetch customers", error });
  }
});

// PUT update-customer/:id
router.put("/update-customer/:id", async (req, res) => {
  try {
    const { customerId, _id, createdAt, updatedAt, ...updateData } = req.body;

    const customer = await Customer.findOneAndUpdate(
      { customerId: req.params.id },
      updateData,
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({
      message: "Failed to update customer",
      error: error.message,
    });
  }
});

// DELETE delete-customer/:id
router.delete("/delete-customer/:id", async (req, res) => {
  try {
    const deletedCustomer = await Customer.findOneAndDelete({
      customerId: req.params.id,
    });

    if (!deletedCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ message: "Failed to delete customer", error });
  }
});

module.exports = router;
