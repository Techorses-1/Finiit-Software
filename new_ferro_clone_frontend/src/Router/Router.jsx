import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "../Pages/Home/Home";
import Customer from "../Pages/Customer/Customer";
import Vendor from "../Pages/Vendor/Vendor";
import Items from "../Pages/Items/Items";
import PurchaseOrder from "../Pages/PurchaseOrder/PurchaseOrder";
import GRN from "../Pages/GRN/GRN";
import Bom from "../Pages/Bom/Bom";
import Sales from "../Pages/Sales/Sales";
import Inventory from "../Pages/Inventory/Inventory";
import Register from "../Pages/Authentication/Register/Register";
import Login from "../Pages/Authentication/Login/Login";
import ProtectedRoute from "../Components/Protected/ProtectedRoute";
import WorkOrder from "../Pages/WorkOrder/WorkOrder";
import Quatation from "../Pages/Quotation/Quotation";
import Report from "../Pages/Reports/Reports";


import Footer from "../Components/Footer/Footer";

const Router = () => {
  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh' // This ensures the container takes at least full viewport height
      }}>
        <div style={{
          flex: 1 // This makes the content area grow and push footer down
        }}>

          <Routes>
            {/* <Route path="/" element={<Home />} />  */}
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />



            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/customer" element={<ProtectedRoute><Customer /></ProtectedRoute>} />
            <Route path="/vendor" element={<ProtectedRoute><Vendor /></ProtectedRoute>} />
            <Route path="/items" element={<ProtectedRoute><Items /></ProtectedRoute>} />
            <Route path="/purchase-order" element={<ProtectedRoute><PurchaseOrder /></ProtectedRoute>} />
            <Route path="/grn" element={<ProtectedRoute><GRN /></ProtectedRoute>} />
            <Route path="/bom" element={<ProtectedRoute><Bom /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/work-order" element={<ProtectedRoute><WorkOrder /></ProtectedRoute>} />
            <Route path="/quotation" element={<ProtectedRoute><Quatation /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />

          </Routes>
        </div>
        <Footer />
      </div>
    </>
  );
};

export default Router;
