const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db"); // ✅ MongoDB connection file

const app = express();

// ===== Middlewares =====
app.use(cors());
app.use(express.json());

// ===== Connect to MongoDB =====
connectDB();

// ===== API Routes =====
const vendorRoutes = require("./routes/vendorRoutes");
const itemRoutes = require("./routes/itemRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const grnRoutes = require("./routes/grnRoutes");
const customerRoutes = require("./routes/customerRoutes");
const bomRoute = require("./routes/bomRoute");
const salesRoutes = require("./routes/salesRoutes");
const authRoutes = require("./routes/authRoutes");
const workOrderRoutes = require("./routes/workorderRoutes");
const s3Routes = require("./routes/s3Routes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const ReportsRoutes = require('./routes/reports');


// FERROTUBE WEBSITE ROUTE 
const inquiryRoutes = require("./routes/inquiryRoutes");



// Use Routes
app.use("/customer", customerRoutes);
app.use("/vendors", vendorRoutes);
app.use("/items", itemRoutes);
app.use("/po", purchaseOrderRoutes);
app.use("/grn", grnRoutes);
app.use("/bom", bomRoute);
app.use("/sales", salesRoutes);
app.use("/auth", authRoutes);
app.use("/workorder", workOrderRoutes);
app.use("/s3", s3Routes);
app.use("/inventory", inventoryRoutes);
app.use("/quotation", quotationRoutes);
app.use('/reports', ReportsRoutes);





// FERROTUBE WEBSITE ROUTE 
app.use("/inquiry", inquiryRoutes);

// ===== Basic Route =====
app.get("/", (req, res) => {
  res.send("Hello New World from New Finiit Backend with MongoDB updated!");
});

// ===== Server =====
const PORT = process.env.PORT || 3090;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
