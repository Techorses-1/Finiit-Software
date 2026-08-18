const express = require("express");
const router = express.Router();
const Quotation = require("../models/quotationModel");
const GlobalCounter = require("../models/globalCounter");
const Item = require("../models/item");

const generateQuotationNumber = async () => {
    const counterId = "quotation";
    const currentYear = new Date().getFullYear().toString();

    let counter = await GlobalCounter.findOne({ id: counterId });

    if (!counter) {
        // First time: Create counter with count 1
        counter = await GlobalCounter.create({
            id: counterId,
            count: 1,
            currentYear: currentYear  // Store year but don't reset based on it
        });
        return `QUT${currentYear}${String(1).padStart(4, "0")}`;
    } else {
        // ALWAYS increment, NEVER reset based on year
        counter.count += 1;
        counter.currentYear = currentYear;  // Just update year, keep counting
        await counter.save();
        return `QUT${currentYear}${String(counter.count).padStart(4, "0")}`;
    }
};

// Calculate totals
const calculateQuotationTotals = (items, partyGST = "", taxSlab = 18, tcsPercent = 0) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const isIntraState = typeof partyGST === 'string' && partyGST.startsWith("24");
    const taxRate = taxSlab;

    const cgst = isIntraState ? +(subtotal * (taxRate / 2 / 100)).toFixed(2) : 0;
    const sgst = isIntraState ? +(subtotal * (taxRate / 2 / 100)).toFixed(2) : 0;
    const igst = !isIntraState ? +(subtotal * (taxRate / 100)).toFixed(2) : 0;

    const totalBeforeTCS = +(subtotal + cgst + sgst + igst).toFixed(2);
    const tcs = tcsPercent ? +(totalBeforeTCS * tcsPercent / 100).toFixed(2) : 0;
    const total = +(totalBeforeTCS + tcs).toFixed(2);

    return {
        subtotal,
        cgst,
        sgst,
        igst,
        tcs,
        total,
        isIntraState,
        taxSlab: taxRate
    };
};

// Create new quotation
router.post("/create-quotation", async (req, res) => {
    try {
        const { quotationId } = req.body;

        // Validate quotation ID
        if (!quotationId) {
            return res.status(400).json({
                success: false,
                message: "Quotation ID is required"
            });
        }

        if (!/^[a-zA-Z0-9]{1,7}$/.test(quotationId)) {
            return res.status(400).json({
                success: false,
                message: "Quotation ID must be 1-7 alphanumeric characters"
            });
        }

        // Check if quotation ID already exists
        const existingQuotation = await Quotation.findOne({ quotationId });
        if (existingQuotation) {
            return res.status(400).json({
                success: false,
                message: "Quotation ID already exists"
            });
        }

        // Generate quotation number
        const quotationNumber = await generateQuotationNumber();

        // Calculate totals
        const totals = calculateQuotationTotals(
            req.body.items,
            req.body.party?.gstin || "",
            req.body.taxSlab || 18,
            req.body.tcsPercent || 0
        );

        // Create quotation object
        const quotationData = {
            ...req.body,
            quotationNumber,
            ...totals
        };

        // Save to database
        const newQuotation = new Quotation(quotationData);
        await newQuotation.save();

        res.status(201).json({
            success: true,
            message: "Quotation created successfully",
            data: newQuotation
        });

    } catch (error) {
        console.error("Error creating quotation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create quotation",
            error: error.message
        });
    }
});

// Get all quotations
router.get("/get-quotations", async (req, res) => {
    try {
        const quotations = await Quotation.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: quotations
        });
    } catch (error) {
        console.error("Error fetching quotations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch quotations",
            error: error.message
        });
    }
});

// Get single quotation
router.get("/get-quotation/:quotationId", async (req, res) => {
    try {
        const quotation = await Quotation.findOne({
            quotationId: req.params.quotationId
        });

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found"
            });
        }

        res.status(200).json({
            success: true,
            data: quotation
        });
    } catch (error) {
        console.error("Error retrieving quotation:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving quotation",
            error: error.message
        });
    }
});

// Update quotation
router.put("/update-quotation/:quotationId", async (req, res) => {
    try {
        const { createdAt, updatedAt, quotationId, quotationNumber, ...updateData } = req.body;

        // Recalculate totals if items or tax changed
        if (updateData.items || updateData.taxSlab || updateData.tcsPercent) {
            const totals = calculateQuotationTotals(
                updateData.items || [],
                updateData.party?.gstin || "",
                updateData.taxSlab || 18,
                updateData.tcsPercent || 0
            );
            Object.assign(updateData, totals);
        }

        const updatedQuotation = await Quotation.findOneAndUpdate(
            { quotationId: req.params.quotationId },
            updateData,
            { new: true }
        );

        if (!updatedQuotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found"
            });
        }

        res.status(200).json({
            success: true,
            data: updatedQuotation
        });
    } catch (error) {
        console.error("Error updating quotation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update quotation",
            error: error.message
        });
    }
});

// Delete quotation
router.delete("/delete-quotation/:quotationId", async (req, res) => {
    try {
        const deletedQuotation = await Quotation.findOneAndDelete({
            quotationId: req.params.quotationId
        });

        if (!deletedQuotation) {
            return res.status(404).json({
                success: false,
                message: "Quotation not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Quotation deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting quotation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete quotation",
            error: error.message
        });
    }
});

// NEW: Get available items for quotation
// This endpoint can be used to fetch items with search/filter capabilities
router.get("/available-items", async (req, res) => {
    try {
        // You would need to import Item model
        // const Item = require("../models/itemModel");
        
        // For now, returning a placeholder response
        // You'll need to implement this based on your Item model
        res.status(200).json({
            success: true,
            message: "This endpoint requires Item model integration",
            data: []
        });
    } catch (error) {
        console.error("Error fetching available items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch available items",
            error: error.message
        });
    }
});

module.exports = router;