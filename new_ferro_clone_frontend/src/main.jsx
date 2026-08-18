import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { InventoryProvider } from "./Components/contexts/InventoryContext.jsx"; // Import the provider

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <InventoryProvider> {/* Wrap App with InventoryProvider */}
      <App />
    </InventoryProvider>
  </BrowserRouter>
);