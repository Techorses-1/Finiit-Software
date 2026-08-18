import React, { useState, useEffect, useRef, useMemo } from "react";
import Navbar from "../../Components/Sidebar/Navbar";
import html2pdf from "html2pdf.js";
import { FaFileExport, FaSearch, FaUpload } from "react-icons/fa";
import "./Inventory.scss";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify"; // ✅ ADD THIS IMPORT
import "react-toastify/dist/ReactToastify.css"; // ✅ ADD THIS IMPORT

const Inventory = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [itemHistory, setItemHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showLoader, setShowLoader] = useState(false);
    const loaderTimeoutRef = useRef(null);

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleBulkUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.match(/\.(xlsx|xls)$/)) {
            toast.error("Please upload an Excel file (.xlsx or .xls)"); // ✅ NOW WORKS
            return;
        }

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/inventory/bulk-update`, // ✅ CORRECT ENDPOINT
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            const data = response.data;

            // Show results
            if (data.errors && data.errors.length > 0) {
                const errorCount = data.errors.length;
                toast.success(
                    `✅ ${data.updatedCount} inventory items updated successfully\n❌ ${errorCount} errors found`,
                    { autoClose: 8000 }
                );
            } else {
                toast.success(`🎉 All ${data.updatedCount} inventory items updated successfully!`);
            }

            // Refresh inventory data
            const refreshResponse = await axios.get(`${import.meta.env.VITE_API_URL}/inventory/get-inventory`);
            setInventory(Array.isArray(refreshResponse.data.data) ? refreshResponse.data.data : []);

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Error uploading inventory:', error);
            toast.error(error.response?.data?.message || 'Error updating inventory');
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);

        if (searchTerm.trim()) {
            loaderTimeoutRef.current = setTimeout(() => {
                setShowLoader(true);
            }, 300);

            const searchTimeout = setTimeout(() => {
                if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
                setDebouncedSearch(searchTerm.trim().toLowerCase());
                setShowLoader(false);
            }, 300);

            return () => {
                clearTimeout(searchTimeout);
                if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
                setShowLoader(false);
            };
        } else {
            setDebouncedSearch("");
            setShowLoader(false);
        }
    }, [searchTerm]);

    // Filter inventory
    const filteredInventory = useMemo(() => {
        if (!debouncedSearch) return inventory;

        return inventory.filter(item => {
            // Check item fields
            if (item.itemName?.toLowerCase().includes(debouncedSearch)) return true;
            if (item.hsnCode?.toLowerCase().includes(debouncedSearch)) return true;
            if (item.description?.toLowerCase().includes(debouncedSearch)) return true;

            // Check status
            const status = item.currentStock <= item.minimumQty ? "low stock" : "in stock";
            if (status.includes(debouncedSearch)) return true;

            return false;
        });
    }, [debouncedSearch, inventory]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/inventory/get-inventory`);

                if (response.data.success) {
                    setInventory(Array.isArray(response.data.data) ? response.data.data : []);
                } else {
                    setError(response.data.message || "Failed to load inventory data");
                }
                setLoading(false);
            } catch (error) {
                console.error("Error fetching inventory:", error);
                setError("Failed to load inventory data");
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const fetchItemHistory = async (itemId) => {
        setHistoryLoading(true);
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/grn/get-grns`);
            if (response.data.success) {
                // Filter GRNs that contain this item and map to item-specific details
                const history = response.data.data
                    .filter(grn => grn.items.some(item => item.name === itemId))
                    .map(grn => {
                        const itemData = grn.items.find(item => item.name === itemId);
                        return {
                            grnNumber: grn.grnNumber,
                            grnDate: grn.grnDate,
                            poNumber: grn.poNumber,
                            vendorName: grn.vendorName,
                            vendorGST: grn.vendorGST,
                            rate: itemData.rate,
                            quantity: itemData.qty,
                            unit: itemData.unit,
                            total: itemData.qty * itemData.rate,
                            gstType: grn.gstType,
                            cgst: grn.cgst,
                            sgst: grn.sgst,
                            igst: grn.igst
                        };
                    });
                setItemHistory(history);
            }
        } catch (error) {
            console.error("Error fetching item history:", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleRowClick = (item) => {
        // Close if clicking the same item
        if (selectedItem?.itemName === item.itemName) {
            setSelectedItem(null);
            return;
        }
        setSelectedItem(item);
        fetchItemHistory(item.itemName);
    };

    const handleExport = () => {
        const element = document.getElementById("inventory-table");
        html2pdf().from(element).set({
            margin: 1,
            filename: "Inventory_Report.pdf",
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
        }).save();
    };

    if (error) {
        return (
            <Navbar>
                <div className="inventory-page">
                    <div className="error-message">{error}</div>
                </div>
            </Navbar>
        );
    }

    return (
        <Navbar>
            {/* ✅ ADD TOAST CONTAINER */}
            <ToastContainer position="top-center" autoClose={3000} />

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleBulkUpload}
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
            />

            <div className="inventory-page">
                <div className="page-header">
                    <h2>Inventory</h2>
                    <div className="right-section">
                        <div className="search-container">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search inventory..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="page-actions">
                            {/* <button
                                className="bulk-upload-btn"
                                onClick={triggerFileInput}
                                disabled={isUploading}
                            >
                                <FaUpload />
                                {isUploading ? "Uploading..." : "Bulk Upload"}
                            </button> */}

                            <button className="export-btn" onClick={handleExport}>
                                <FaFileExport /> Export PDF
                            </button>
                        </div>
                    </div>
                </div>

                <div className="data-table" id="inventory-table">
                    {loading ? (
                        <div className="loading">Loading inventory...</div>
                    ) : inventory.length === 0 ? (
                        <div className="no-data">No inventory items found</div>
                    ) : (
                        <>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>HSN</th>
                                        <th>Units</th>
                                        <th>Description</th>
                                        <th>Avg Price</th>
                                        <th>Min Qty</th>
                                        <th>Current Stock</th>
                                        <th>In Use</th>
                                        <th>Status</th>
                                        <th>Notification</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {showLoader ? (
                                        <tr>
                                            <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                                                <div className="table-loader"></div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInventory.map((item, index) => (
                                            <React.Fragment key={index}>
                                                <tr
                                                    onClick={() => handleRowClick(item)}
                                                    className={`clickable-row ${selectedItem?.itemName === item.itemName ? 'selected' : ''}`}
                                                >
                                                    <td>{item.itemName}</td>
                                                    <td>{item.hsnCode || "-"}</td>
                                                    <td>{item.unit || "-"}</td>
                                                    <td>{item.description || "-"}</td>
                                                    <td>₹{item.averagePrice?.toFixed(2) || "0.00"}</td>
                                                    <td>{item.minimumQty}</td>
                                                    <td>{item.currentStock}</td>
                                                    <td>{item.inUse}</td>
                                                    <td className={item.currentStock <= item.minimumQty ? "low-stock" : "in-stock"}>
                                                        {item.currentStock <= item.minimumQty
                                                            ? "Low Stock"
                                                            : "In Stock"}
                                                    </td>
                                                    <td>
                                                        {item.currentStock <= item.minimumQty
                                                            ? <span className="alert">Reorder Needed</span>
                                                            : "-"}
                                                    </td>
                                                </tr>
                                                {selectedItem?.itemName === item.itemName && (
                                                    <tr className="history-row">
                                                        <td colSpan="10">
                                                            <div className="history-container">
                                                                <h3>Purchase History for: {selectedItem.itemName}</h3>
                                                                {historyLoading ? (
                                                                    <div className="history-loading">Loading history...</div>
                                                                ) : itemHistory.length === 0 ? (
                                                                    <div className="history-no-data">No purchase history found for this item</div>
                                                                ) : (
                                                                    <div className="history-table-container">
                                                                        <table className="history-table">
                                                                            <thead>
                                                                                <tr>
                                                                                    <th>GRN No.</th>
                                                                                    <th>Date</th>
                                                                                    <th>PO No.</th>
                                                                                    <th>Vendor</th>
                                                                                    <th>Rate (₹)</th>
                                                                                    <th>Qty</th>
                                                                                    <th>Total (₹)</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {itemHistory.map((history, idx) => (
                                                                                    <tr key={idx}>
                                                                                        <td>{history.grnNumber}</td>
                                                                                        <td>{history.grnDate}</td>
                                                                                        <td>{history.poNumber || "-"}</td>
                                                                                        <td>{history.vendorName}</td>
                                                                                        <td>{history.rate.toFixed(2)}</td>
                                                                                        <td>{history.quantity}</td>
                                                                                        <td>{history.total.toFixed(2)}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            </div>
        </Navbar>
    );
};

export default Inventory;