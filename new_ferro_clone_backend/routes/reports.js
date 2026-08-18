const express = require("express");
const router = express.Router();
const GRN = require("../models/grnModel");
const Inventory = require("../models/inventory");
const Sales = require("../models/salesModel");

// Helper function to get date ranges - FIXED
const getDateRange = (filterType, customStart, customEnd) => {
  const now = new Date();
  let startDate, endDate;

  switch (filterType) {
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'custom':
      // FIX: Set proper time for custom dates
      startDate = new Date(customStart);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      return {}; // No date filter for 'all'
  }

  return { startDate, endDate };
};

// ===================================================
// 📦 GRN REPORT  — Purchases from vendors - FIXED
// ===================================================
router.get("/grn-report", async (req, res) => {
  try {
    const { filterType = 'all', startDate, endDate } = req.query;

    let query = {};

    // Apply date filter if not 'all'
    if (filterType !== 'all') {
      const dateRange = getDateRange(filterType, startDate, endDate);
      console.log('GRN Date Range:', dateRange); // Debug log
      
      if (dateRange.startDate && dateRange.endDate) {
        // FIX: Use both createdAt and grnDate for filtering
        query = {
          $or: [
            { 
              createdAt: {
                $gte: dateRange.startDate,
                $lte: dateRange.endDate
              }
            },
            {
              grnDate: {
                $gte: dateRange.startDate.toISOString().split('T')[0],
                $lte: dateRange.endDate.toISOString().split('T')[0]
              }
            }
          ]
        };
      }
    }

    const grns = await GRN.find(query).sort({ createdAt: -1 });

    const totalGRNs = grns.length;
    let totalQty = 0;
    let totalPurchaseValue = 0;

    grns.forEach(grn => {
      grn.items.forEach(item => {
        totalQty += item.qty || 0;
        totalPurchaseValue += (item.qty || 0) * (item.rate || 0);
      });
    });

    res.status(200).json({
      reportType: "GRN Report",
      totalGRNs,
      totalQty,
      totalPurchaseValue,
      averagePurchaseValue: totalGRNs > 0 ? totalPurchaseValue / totalGRNs : 0,
      grns, // Include full data for export
      filterType,
      dateRange: filterType !== 'all' ? getDateRange(filterType, startDate, endDate) : null,
      message: "GRN report generated successfully"
    });
  } catch (error) {
    console.error("Error generating GRN report:", error);
    res.status(500).json({ message: "Failed to generate GRN report", error });
  }
});

// ===================================================
// 📊 INVENTORY REPORT  — Current stock info
// ===================================================
router.get("/inventory-report", async (req, res) => {
  try {
    const inventoryItems = await Inventory.find().sort({ createdAt: -1 });

    const totalItems = inventoryItems.length;
    let totalStock = 0;
    let totalValue = 0;
    let lowStockItems = 0;

    inventoryItems.forEach(item => {
      totalStock += item.currentStock || 0;
      totalValue += (item.currentStock || 0) * (item.averagePrice || 0);
      if (item.currentStock <= (item.minimumQty || 0)) {
        lowStockItems++;
      }
    });

    res.status(200).json({
      reportType: "Inventory Report",
      totalItems,
      totalStock,
      totalValue,
      lowStockItems,
      averageItemValue: totalItems > 0 ? totalValue / totalItems : 0,
      inventoryItems, // Include full data for export
      message: "Inventory report generated successfully"
    });
  } catch (error) {
    console.error("Error generating Inventory report:", error);
    res.status(500).json({ message: "Failed to generate inventory report", error });
  }
});

// ===================================================
// 💰 SALES REPORT  — Revenue info - FIXED
// ===================================================
router.get("/sales-report", async (req, res) => {
  try {
    const { filterType = 'all', startDate, endDate } = req.query;

    let query = {};

    // Apply date filter if not 'all'
    if (filterType !== 'all') {
      const dateRange = getDateRange(filterType, startDate, endDate);
      console.log('Sales Date Range:', dateRange); // Debug log
      
      if (dateRange.startDate && dateRange.endDate) {
        // FIX: Use both createdAt and invoiceDate for filtering
        query = {
          $or: [
            { 
              createdAt: {
                $gte: dateRange.startDate,
                $lte: dateRange.endDate
              }
            },
            {
              invoiceDate: {
                $gte: dateRange.startDate.toISOString().split('T')[0],
                $lte: dateRange.endDate.toISOString().split('T')[0]
              }
            }
          ]
        };
      }
    }

    const sales = await Sales.find(query).sort({ createdAt: -1 });

    const totalSales = sales.length;
    let totalRevenue = 0;
    let totalItemsSold = 0;

    sales.forEach(sale => {
      totalRevenue += sale.total || 0;
      sale.items.forEach(item => {
        totalItemsSold += item.quantity || 0;
      });
    });

    const avgInvoiceValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    res.status(200).json({
      reportType: "Sales Report",
      totalSales,
      totalRevenue,
      totalItemsSold,
      avgInvoiceValue,
      sales, // Include full data for export
      filterType,
      dateRange: filterType !== 'all' ? getDateRange(filterType, startDate, endDate) : null,
      message: "Sales report generated successfully"
    });
  } catch (error) {
    console.error("Error generating Sales report:", error);
    res.status(500).json({ message: "Failed to generate sales report", error });
  }
});

module.exports = router;