import React, { useState, useEffect, useMemo, useRef } from "react";
import { Formik, Form, Field, FieldArray, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { FaPlus, FaFileExport, FaFileExcel, FaSearch, FaTrash, FaEdit, FaSave, FaUpload } from "react-icons/fa";
import Navbar from "../../Components/Sidebar/Navbar";
import html2pdf from "html2pdf.js";
import PurchaseOrderPrint from "./PurchaseOrderPrint";
import "react-toastify/dist/ReactToastify.css";
import "./PurchaseOrder.scss";
import axios from "axios";
import * as XLSX from 'xlsx';
import Select from 'react-select';


const TAX_SLABS = [
    { label: '0.1%', value: 0.1 },
    { label: '5%', value: 5 },
    { label: '12%', value: 12 },
    { label: '18%', value: 18 },
    { label: '28%', value: 28 },
];

// Terms and conditions text
const TERMS_CONDITIONS = `
All orders are subject to acceptance by the seller.
Prices are subject to change without notice.
`;

// Static addresses
const CONSIGNEE_ADDRESS = "Vadodara - 390001, Gujarat (India)";
const DELIVERY_ADDRESS = "Vadodara - 39000, Gujarat (India)";

const PurchaseOrder = () => {
    const [showForm, setShowForm] = useState(false);
    const [orders, setOrders] = useState([]);
    const [selectedPO, setSelectedPO] = useState(null);
    const [gstType, setGstType] = useState("intra");
    const [vendors, setVendors] = useState([]);
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);


    // Bulk Upload Functionality for POs
    const handleBulkUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.match(/\.(xlsx|xls)$/)) {
            toast.error("Please upload an Excel file (.xlsx or .xls)");
            return;
        }

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/po/bulk-upload`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            const data = response.data;

            // Show detailed results
            if (data.errors && data.errors.length > 0) {
                const errorCount = data.errors.length;

                toast.success(
                    `✅ ${data.insertedCount} POs uploaded successfully\n❌ ${errorCount} errors found`,
                    {
                        autoClose: 8000,
                        closeOnClick: false,
                    }
                );

                // Log all errors to console for debugging
                console.log('📋 PO Bulk Upload Results:');
                console.log(`✅ Successfully uploaded: ${data.insertedCount}`);
                console.log(`📊 Total POs processed: ${data.totalPOs}`);
                console.log(`📝 Total rows: ${data.totalRows}`);
                console.log('🎯 Successful POs:', data.poNumbers);
                console.log('❌ Errors:', data.errors);

                // Show first 3 errors as warnings
                if (errorCount > 0) {
                    setTimeout(() => {
                        const firstErrors = data.errors.slice(0, 3);
                        firstErrors.forEach(error => {
                            toast.warning(error, { autoClose: 6000 });
                        });

                        if (errorCount > 3) {
                            toast.info(`...and ${errorCount - 3} more errors. Check console for details.`, {
                                autoClose: 8000
                            });
                        }
                    }, 1000);
                }
            } else {
                toast.success(`🎉 All ${data.insertedCount} purchase orders uploaded successfully!`);
            }

            // Refresh PO list
            const fetchResponse = await axios.get(`${import.meta.env.VITE_API_URL}/po/get-pos`);
            const poData = fetchResponse.data.data;
            setOrders(poData);

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Error uploading purchase orders:', error);

            if (error.response?.data?.errors) {
                const errorData = error.response.data;
                toast.error(
                    `Upload completed with issues. ${errorData.insertedCount || 0} POs uploaded, ${errorData.errors.length} errors. Check console for details.`,
                    { autoClose: 8000 }
                );
                console.log('Upload errors:', errorData.errors);
            } else {
                toast.error(error.response?.data?.message || 'Error uploading purchase orders');
            }
        } finally {
            setIsUploading(false);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };


    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim().toLowerCase());
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const vendorsRes = await axios.get(`${import.meta.env.VITE_API_URL}/vendors/get-vendors`);
                const sortedVendors = vendorsRes.data.sort((a, b) =>
                    new Date(b.createdAt || b.date || Date.now()) - new Date(a.createdAt || a.date || Date.now())
                );
                setVendors(sortedVendors);

                const itemsRes = await axios.get(`${import.meta.env.VITE_API_URL}/items/get-items`);
                const sortedItems = itemsRes.data.sort((a, b) =>
                    new Date(b.createdAt || b.date || Date.now()) - new Date(a.createdAt || a.date || Date.now())
                );
                setItems(sortedItems);

                const poRes = await axios.get(`${import.meta.env.VITE_API_URL}/po/get-pos`);
                // Sort by PO number in descending order (highest numbers first)
                const sortedOrders = poRes.data.data.sort((a, b) => {
                    // Extract numeric parts from PO numbers for proper numeric comparison
                    const extractNumber = (poNumber) => {
                        const numMatch = poNumber.match(/\d+/);
                        return numMatch ? parseInt(numMatch[0]) : 0;
                    };

                    const aNum = extractNumber(a.poNumber);
                    const bNum = extractNumber(b.poNumber);

                    return bNum - aNum; // Descending order (highest first)
                });
                setOrders(sortedOrders);
            } catch (error) {
                toast.error("Failed to fetch data");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const initialValues = {
        ownerGST: "24AAAFF299.....",
        ownerPAN: "AAAFF.....",
        companyName: "",
        vendorId: "",
        vendorName: "",
        vendorGST: "",
        vendorAddress: "",
        vendorContact: "",
        vendorEmail: "",
        shipName: "",
        shipCompany: "Welcome",
        shipPhone: "",
        consigneeAddress: CONSIGNEE_ADDRESS,
        deliveryAddress: DELIVERY_ADDRESS,
        extraNote: "",
        includeTerms: false,
        poNumber: "",
        date: new Date().toISOString().slice(0, 10),
        discount: 0,
        taxSlab: "",
        items: [{ name: "", description: "", hsn: "", qty: "", rate: "", unit: "", itemId: "" }],
    };

    const validationSchema = Yup.object({
        companyName: Yup.string().required("Company Name is required"),
        vendorName: Yup.string().required("Contact Person is required"),
        vendorGST: Yup.string().required("Vendor GST is required"),
        vendorAddress: Yup.string().required("Vendor Address is required"),
        vendorContact: Yup.string().required("Vendor Contact is required"),
        vendorEmail: Yup.string().email("Invalid email").required("Vendor Email is required"),
        // shipName: Yup.string().required("Contact Person is required"), 
        // shipCompany: Yup.string().required("Shipping Company is required"), 
        // shipPhone: Yup.string().required("Shipping Phone is required"), 
        taxSlab: Yup.number()
            .required("Tax slab is required")
            .oneOf(TAX_SLABS.map(slab => slab.value), "Please select a valid tax slab"),
        items: Yup.array().of(
            Yup.object({
                name: Yup.string().required("Item Name is required"),
                qty: Yup.number()
                    .required("Quantity is required")
                    .moreThan(0, "Quantity must be more than 0"),
                rate: Yup.number().required("Rate is required").moreThan(0, "Rate must be more than 0"),
            })
        ),
    });

    const filteredOrders = useMemo(() => {
        if (!debouncedSearch) return orders;
        return orders.filter(order => {
            if (order.poNumber?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.date?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.vendorName?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.companyName?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.vendorGST?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.vendorAddress?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.vendorContact?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.vendorEmail?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.shipName?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.shipCompany?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.shipPhone?.toLowerCase().includes(debouncedSearch)) return true;
            if (order.items?.some(item =>
                item.name?.toLowerCase().includes(debouncedSearch) ||
                item.description?.toLowerCase().includes(debouncedSearch) ||
                item.hsn?.toLowerCase().includes(debouncedSearch)
            )) return true;
            return false;
        });
    }, [debouncedSearch, orders]);

    const calculateTotals = (items, discount = 0, vendorGST = "", taxSlab = 18) => {
        const subtotal = items.reduce((sum, item) => sum + item.qty * item.rate, 0);
        const discountAmount = +(subtotal * (discount / 100)).toFixed(2);
        const discountedSubtotal = +(subtotal - discountAmount).toFixed(2);

        // Determine if intra-state based on GSTIN
        const isIntraState = vendorGST && vendorGST.startsWith("24");

        // Calculate GST based on tax slab
        let cgst = 0, sgst = 0, igst = 0;
        if (isIntraState) {
            cgst = +(discountedSubtotal * (taxSlab / 2 / 100)).toFixed(2);
            sgst = +(discountedSubtotal * (taxSlab / 2 / 100)).toFixed(2);
        } else {
            igst = +(discountedSubtotal * (taxSlab / 100)).toFixed(2);
        }

        const total = +(discountedSubtotal + cgst + sgst + igst).toFixed(2);
        return { subtotal, discountAmount, discountedSubtotal, cgst, sgst, igst, total, isIntraState, taxSlab };
    };

    const handleVendorSelect = (e, setFieldValue) => {
        const selectedCompanyName = e.target.value;
        const selectedVendor = vendors.find(v => v.companyName === selectedCompanyName);
        if (selectedVendor) {
            setFieldValue("companyName", selectedVendor.companyName);
            setFieldValue("vendorName", selectedVendor.vendorName);
            setFieldValue("vendorGST", selectedVendor.gstNumber);
            setFieldValue("vendorAddress", selectedVendor.address);
            setFieldValue("vendorContact", selectedVendor.contactNumber);
            setFieldValue("vendorEmail", selectedVendor.email);
            setFieldValue("vendorId", selectedVendor.vendorId);

            // Update GST type based on vendor's GSTIN
            if (selectedVendor.gstNumber && selectedVendor.gstNumber.length >= 2) {
                const stateCode = selectedVendor.gstNumber.slice(0, 2);
                setGstType(stateCode === "24" ? "intra" : "inter");
            }
        }
    }


    const handleItemSelect = (e, index, setFieldValue) => {
        const selectedItemName = e.target.value;
        const selectedItem = items.find(i => i.itemName === selectedItemName);
        if (selectedItem) {
            setFieldValue(`items.${index}.name`, selectedItem.itemName);
            setFieldValue(`items.${index}.description`, selectedItem.description);
            setFieldValue(`items.${index}.hsn`, selectedItem.hsnCode);
            setFieldValue(`items.${index}.unit`, selectedItem.unit);
            setFieldValue(`items.${index}.itemId`, selectedItem.itemId);

            if (selectedItem.rate) {
                setFieldValue(`items.${index}.rate`, selectedItem.rate);
            }
        }
    };

    const handleSubmit = async (values, { resetForm, setSubmitting, validateForm }) => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        const errors = await validateForm(values);
        if (Object.keys(errors).length > 0) {
            Object.entries(errors).forEach(([field, error]) => {
                if (typeof error === "string") {
                    toast.error(`${field}: ${error}`);
                }
                if (field === "items" && Array.isArray(error)) {
                    error.forEach((itemError, index) => {
                        if (itemError && typeof itemError === "object") {
                            Object.entries(itemError).forEach(([key, val]) => {
                                toast.error(`Item ${index + 1} - ${key}: ${val}`);
                            });
                        }
                    });
                }
            });
            setIsSubmitting(false);
            setSubmitting(false);
            return;
        }

        try {
            const totals = calculateTotals(values.items, values.discount, values.vendorGST, values.taxSlab);
            const newOrder = {
                ...values,
                ...totals,
                discount: values.discount || 0,
                gstType: totals.isIntraState ? "intra" : "inter", // Set gstType based on calculation
                terms: values.includeTerms ? TERMS_CONDITIONS : ""
            };
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/po/create-po`, newOrder);

            if (res.data.success) {
                toast.success("Purchase Order saved successfully!");
                setOrders((prev) => [res.data.data, ...prev]);
                setShowForm(false);
                resetForm();
            } else {
                toast.error("Failed to save Purchase Order.");
            }
        } catch (error) {
            toast.error("Error while submitting PO");
        } finally {
            setIsSubmitting(false);
            setSubmitting(false);
        }
    };

    const handleExportPDF = async () => {
        if (!selectedPO) {
            toast.warn("Please select a PO first");
            return;
        }

        const element = document.getElementById("po-pdf");

        // Wait for images to load (if any)
        const images = element.getElementsByTagName("img");
        const imageLoadPromises = Array.from(images).map((img) => {
            return new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = resolve;
                }
            });
        });

        await Promise.race([
            Promise.all(imageLoadPromises),
            new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);

        // Generate PDF with margins (header/footer spacing)
        await html2pdf()
            .from(element)
            .set({
                margin: [35, 10, 10, 10], // top=30mm, right=10mm, bottom=10mm, left=10mm
                filename: `${selectedPO.poNumber}.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            })
            .save();
    };

    const handleExportExcel = () => {
        if (orders.length === 0) {
            toast.warn("No purchase orders to export");
            return;
        }
        const data = orders.map(order => ({
            'PO No': order.poNumber,
            'Date': order.date,
            'Vendor': order.vendorName,
            'Total': order.total?.toFixed(2),
            'GST Type': order.gstType || (order.vendorGST?.startsWith('24') ? 'intra' : 'inter'),
            'Tax Slab': order.taxSlab ? `${order.taxSlab}%` : '18%' // ADDED: Tax slab in export
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "PurchaseOrders");
        XLSX.writeFile(workbook, "PurchaseOrders.xlsx");
        toast.success("Exported all purchase orders to Excel");
    };


    const handleUpdatePO = async (updatedPO) => {
        try {
            // Remove fields that shouldn't be sent to backend
            const { _id, createdAt, updatedAt, ...cleanPO } = updatedPO;

            cleanPO.date = updatedPO.date;

            // Recalculate totals before sending to backend
            const totals = calculateTotals(
                cleanPO.items || [],
                cleanPO.discount || 0,
                cleanPO.vendorGST,
                cleanPO.taxSlab || 18
            );

            // Include the recalculated totals in the update data
            const updateData = {
                ...cleanPO,
                ...totals,
                gstType: totals.isIntraState ? "intra" : "inter"
            };

            const res = await axios.put(
                `${import.meta.env.VITE_API_URL}/po/update-po/${updatedPO.poNumber}`,
                updateData
            );

            if (res.data.success) {
                setOrders(prev => prev.map(po =>
                    po.poNumber === updatedPO.poNumber ? res.data.data : po
                ));
                setSelectedPO(res.data.data);
                toast.success("Purchase Order updated successfully!");
                return true;
            } else {
                toast.error("Failed to update Purchase Order.");
                return false;
            }
        } catch (error) {
            console.error("Error while updating PO:", error);

            // Enhanced error handling to show specific item quantities
            if (error.response?.data?.message && error.response.data.items) {
                // Handle backend validation errors with specific quantities
                if (error.response.data.items.length === 1) {
                    const item = error.response.data.items[0];
                    toast.error(`Cannot reduce quantity for "${item.name}" below ${item.receivedQty} (already received). Requested: ${item.requestedQty}`);
                } else {
                    const errorDetails = error.response.data.items.map(item =>
                        `"${item.name}": Requested ${item.requestedQty}, Received ${item.receivedQty}`
                    ).join('; ');

                    toast.error(`Cannot reduce quantities below received amounts: ${errorDetails}`);
                }
            } else {
                toast.error(error.response?.data?.message || "Error while updating PO");
            }
            return false;
        }
    };

    // In the PurchaseOrder component, add this function
    const checkGRNForItems = async (poNumber, itemsToCheck = []) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/po/check-grn-for-items`, {
                params: {
                    poNumber,
                    itemNames: itemsToCheck.map(item => item.name)
                }
            });
            return res.data;
        } catch (error) {
            console.error("Error checking GRN for items:", error);
            return { hasGRN: false, itemsWithGRN: [] };
        }
    };

    const checkGRNForPO = async (poNumber) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/grn/check-grn-for-po/${poNumber}`);
            return res.data.hasGRN;
        } catch (error) {
            console.error("Error checking GRN for PO:", error);
            return false;
        }
    };

    const handleDeletePO = async (poNumber) => {
        try {
            const res = await axios.delete(
                `${import.meta.env.VITE_API_URL}/po/delete-po/${poNumber}`
            );

            if (res.data.success) {
                setOrders(prev => prev.filter(po => po.poNumber !== poNumber));
                setSelectedPO(null);
                toast.success("Purchase Order deleted successfully!");
                return true;
            } else {
                toast.error("Failed to delete Purchase Order.");
                return false;
            }
        } catch (error) {
            console.error("Error while deleting PO:", error);
            toast.error(error.response?.data?.message || "Error while deleting PO");
            return false;
        }
    };

    const POModal = ({ po, onClose, onExport, onUpdate, onDelete }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [editedPO, setEditedPO] = useState({});
        const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
        const [errors, setErrors] = useState({});
        const [grnCheckLoading, setGrnCheckLoading] = useState(false);
        const [receivedQuantities, setReceivedQuantities] = useState({});
        const [grnQuantities, setGrnQuantities] = useState({}); // Add this state



        useEffect(() => {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = 'auto';
            };
        }, []);

        useEffect(() => {
            if (po) {
                setEditedPO({ ...po });
                setErrors({});
                loadGRNQuantities(po.poNumber);
            }
        }, [po]);

        // Function to load GRN quantities
        const loadGRNQuantities = async (poNumber) => {
            try {
                // Get all GRN quantities for this PO
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/po/check-items-grn/${poNumber}`);
                setGrnQuantities(res.data.itemGRNQuantities || {});
            } catch (error) {
                console.error("Error loading GRN quantities:", error);
            }
        };


        const checkItemsForGRN = async (items) => {
            setGrnCheckLoading(true);
            try {
                // Filter out items that are clearly new (no name or no itemId)
                const validItems = items.filter(item =>
                    item && item.name && item.name.trim() !== "" &&
                    item.itemId && item.itemId.trim() !== ""
                );

                if (validItems.length === 0) {
                    return { itemsWithGRN: [], quantities: {} };
                }

                const itemNames = validItems.map(item => item.name).filter(name => name);

                const res = await axios.get(`${import.meta.env.VITE_API_URL}/po/check-items-grn/${po.poNumber}`, {
                    params: {
                        itemNames: itemNames.join(',')
                    }
                });

                return {
                    itemsWithGRN: res.data.itemsWithGRN || [],
                    quantities: res.data.itemGRNQuantities || {}
                };
            } catch (error) {
                console.error("Error checking GRN for items:", error);
                // Return empty arrays instead of throwing error
                return { itemsWithGRN: [], quantities: {} };
            } finally {
                setGrnCheckLoading(false);
            }
        };

        // Update the delete button click handler
        const handleDeleteClick = async () => {
            setGrnCheckLoading(true);
            try {
                const hasGRN = await checkGRNForPO(po.poNumber);

                if (hasGRN) {
                    toast.error("Cannot delete PO because GRN(s) have been created for it");
                    return; // Return early, don't show confirmation
                }

                // If no GRN exists, show the confirmation dialog
                setShowDeleteConfirm(true);
            } catch (error) {
                console.error("Error checking GRN:", error);
                toast.error("Error checking GRN status");
            } finally {
                setGrnCheckLoading(false);
            }
        };


        // Add new item function
        const handleAddItem = () => {
            setEditedPO(prev => ({
                ...prev,
                items: [...(prev.items || []), {
                    name: "",
                    description: "",
                    hsn: "",
                    qty: "",
                    rate: "",
                    unit: "",
                    itemId: "new" // Mark as new item
                }]
            }));
        };

        // Remove item function

        // Remove item function - Immediate check on icon click
        const handleRemoveItem = async (index) => {
            if (editedPO.items.length <= 1) {
                toast.warn("At least one item is required");
                return;
            }

            const itemToRemove = editedPO.items[index];

            // Check if this is a newly added item (no itemId or empty itemId)
            const isNewItem = !itemToRemove.itemId || itemToRemove.itemId === "" ||
                itemToRemove.itemId === "new" || !itemToRemove.name;

            if (isNewItem) {
                // New items can be removed without GRN check
                setEditedPO(prev => ({
                    ...prev,
                    items: prev.items.filter((_, i) => i !== index)
                }));
                return;
            }

            // For existing items, check if they have GRN created
            if (itemToRemove && itemToRemove.name) {
                setGrnCheckLoading(true);
                try {
                    const { itemsWithGRN } = await checkItemsForGRN([itemToRemove]);

                    // Check if this specific item has GRN
                    const hasGRN = itemsWithGRN.includes(itemToRemove.name);

                    if (hasGRN) {
                        toast.error(`Cannot remove "${itemToRemove.name}" because GRN has been created for this item`);
                        return;
                    }

                    // If no GRN, proceed with removal
                    setEditedPO(prev => ({
                        ...prev,
                        items: prev.items.filter((_, i) => i !== index)
                    }));

                    // Clear errors for removed item
                    setErrors(prev => {
                        const newErrors = { ...prev };
                        Object.keys(newErrors).forEach(key => {
                            if (key.startsWith(`items.${index}`)) {
                                delete newErrors[key];
                            }
                        });
                        return newErrors;
                    });

                } catch (error) {
                    console.error("Error checking GRN:", error);
                    // Don't show error for GRN check failures, just allow removal
                    // This prevents blocking removal due to network issues
                    setEditedPO(prev => ({
                        ...prev,
                        items: prev.items.filter((_, i) => i !== index)
                    }));
                } finally {
                    setGrnCheckLoading(false);
                }
            } else {
                // If item has issues, just remove it
                setEditedPO(prev => ({
                    ...prev,
                    items: prev.items.filter((_, i) => i !== index)
                }));
            }
        };


        const validateForm = (values) => {
            const newErrors = {};

            // Contact person validation
            if (values.shipName && /^[0-9]+$/.test(values.shipName)) {
                newErrors.shipName = "Contact person should not contain only numbers";
            }

            // Phone validation
            if (values.shipPhone) {
                if (!/^[0-9]+$/.test(values.shipPhone)) {
                    newErrors.shipPhone = "Phone must contain only digits";
                } else if (values.shipPhone.length < 10) {
                    newErrors.shipPhone = "Phone must be at least 10 digits";
                }
            }

            // Discount validation
            if (values.discount < 0 || values.discount > 100) {
                newErrors.discount = "Discount must be between 0 and 100%";
            }

            // Tax slab validation
            if (!values.taxSlab || values.taxSlab <= 0) {
                newErrors.taxSlab = "Please select a valid tax slab";
            }

            // Items validation
            if (values.items && values.items.length > 0) {
                values.items.forEach((item, index) => {
                    if (!item.name) {
                        newErrors[`items.${index}.name`] = "Item name is required";
                    }
                    if (!item.qty || item.qty <= 0) {
                        newErrors[`items.${index}.qty`] = "Quantity must be greater than 0";
                    }
                    if (!item.rate || item.rate <= 0) {
                        newErrors[`items.${index}.rate`] = "Rate must be greater than 0";
                    }
                });
            }

            return newErrors;
        };

        const handleInputChange = (e) => {
            const { name, value } = e.target;

            if (name === "shipName" && /^[0-9]+$/.test(value)) {
                setErrors(prev => ({ ...prev, [name]: "Contact person should not contain only numbers" }));
                return;
            }

            let processedValue = value;
            if (name === "discount" || name === "taxSlab") {
                processedValue = value === "" ? "" : Number(value);
            }

            setEditedPO(prev => ({ ...prev, [name]: processedValue }));

            const fieldErrors = validateForm({ ...editedPO, [name]: processedValue });
            setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }));
        };

        const handleItemChange = (index, field, value) => {
            const updatedItems = [...editedPO.items];

            if (field === 'qty' || field === 'rate') {
                updatedItems[index] = { ...updatedItems[index], [field]: parseFloat(value) || 0 };
            } else {
                updatedItems[index] = { ...updatedItems[index], [field]: value };
            }

            setEditedPO(prev => ({
                ...prev,
                items: updatedItems
            }));

            const fieldErrors = validateForm({ ...editedPO, items: updatedItems });
            setErrors(prev => ({
                ...prev,
                [`items.${index}.${field}`]: fieldErrors[`items.${index}.${field}`]
            }));
        };

        const handleVendorSelect = (selectedOption) => {
            if (selectedOption) {
                const selectedVendor = selectedOption.vendorData;
                setEditedPO(prev => ({
                    ...prev,
                    companyName: selectedVendor.companyName,
                    vendorName: selectedVendor.vendorName,
                    vendorGST: selectedVendor.gstNumber,
                    vendorAddress: selectedVendor.address,
                    vendorContact: selectedVendor.contactNumber,
                    vendorEmail: selectedVendor.email,
                    vendorId: selectedVendor.vendorId
                }));
            }
        };

        const handleItemSelect = (selectedOption, index) => {
            if (selectedOption) {
                const selectedItem = selectedOption.itemData;
                const updatedItems = [...editedPO.items];
                updatedItems[index] = {
                    ...updatedItems[index],
                    name: selectedItem.itemName,
                    description: selectedItem.description,
                    hsn: selectedItem.hsnCode,
                    unit: selectedItem.unit,
                    itemId: selectedItem.itemId, // Ensure itemId is properly set
                    rate: selectedItem.rate || updatedItems[index].rate
                };

                setEditedPO(prev => ({
                    ...prev,
                    items: updatedItems
                }));

                // Clear errors for this item
                setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[`items.${index}.name`];
                    return newErrors;
                });
            }
        };

        // In the POModal component, update the handleSave function
        const handleSave = async () => {
            // Check if any items were removed that have GRNs
            const originalItems = po.items || [];
            const updatedItems = editedPO.items || [];

            const removedItems = originalItems.filter(originalItem =>
                !updatedItems.some(updatedItem => updatedItem.name === originalItem.name)
            );

            if (removedItems.length > 0) {
                const { itemsWithGRN } = await checkItemsForGRN(removedItems);

                if (itemsWithGRN.length > 0) {
                    toast.error(`Cannot remove items with GRNs: ${itemsWithGRN.join(', ')}`);
                    return;
                }
            }

            // Check for quantity validation
            const itemsWithInsufficientQty = [];
            editedPO.items.forEach(item => {
                const receivedQty = grnQuantities[item.name] || 0;
                if (item.qty < receivedQty) {
                    itemsWithInsufficientQty.push({
                        name: item.name,
                        requested: item.qty,
                        received: receivedQty
                    });
                }
            });

            if (itemsWithInsufficientQty.length > 0) {
                // Enhanced error message with specific quantities
                if (itemsWithInsufficientQty.length === 1) {
                    const item = itemsWithInsufficientQty[0];
                    toast.error(`Cannot reduce quantity for "${item.name}" below ${item.received} (already received). Requested: ${item.requested}`);
                } else {
                    const errorMessage = itemsWithInsufficientQty.map(item =>
                        `"${item.name}": Requested ${item.requested}, Received ${item.received}`
                    ).join('; ');

                    toast.error(`Cannot reduce quantities below received amounts: ${errorMessage}`);
                }
                return;
            }

            const formErrors = validateForm(editedPO);
            if (Object.keys(formErrors).length > 0) {
                setErrors(formErrors);
                toast.error("Please fix the errors before saving");
                return;
            }

            try {
                const success = await onUpdate(editedPO);
                if (success) {
                    setIsEditing(false);
                    setErrors({});
                }
            } catch (error) {
                console.error("Error updating PO:", error);

                // Enhanced error handling for backend validation
                if (error.response?.data?.message && error.response.data.items) {
                    // Handle backend validation errors with specific quantities
                    if (error.response.data.items.length === 1) {
                        const item = error.response.data.items[0];
                        toast.error(`Cannot reduce quantity for "${item.name}" below ${item.receivedQty} (already received). Requested: ${item.requestedQty}`);
                    } else {
                        const errorDetails = error.response.data.items.map(item =>
                            `"${item.name}": Requested ${item.requestedQty}, Received ${item.receivedQty}`
                        ).join('; ');

                        toast.error(`Cannot reduce quantities below received amounts: ${errorDetails}`);
                    }
                } else {
                    toast.error(error.response?.data?.message || "Error while updating PO");
                }
            }
        };

        //  function to check GRN quantities
        const checkGRNQuantities = async (poNumber) => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/po/grn-quantities/${poNumber}`);
                return res.data.receivedQuantities || {};
            } catch (error) {
                console.error("Error checking GRN quantities:", error);
                return {};
            }
        };
        const calculateTotals = (items, discount = 0, vendorGST = "", taxSlab = 18) => {
            const validItems = (items || []).filter(item => item.qty && item.rate);
            const subtotal = validItems.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0);
            const discountAmount = +(subtotal * (discount / 100)).toFixed(2);
            const discountedSubtotal = +(subtotal - discountAmount).toFixed(2);

            const isIntraState = vendorGST && vendorGST.startsWith("24");
            let cgst = 0, sgst = 0, igst = 0;

            if (isIntraState) {
                cgst = +(discountedSubtotal * (taxSlab / 2 / 100)).toFixed(2);
                sgst = +(discountedSubtotal * (taxSlab / 2 / 100)).toFixed(2);
            } else {
                igst = +(discountedSubtotal * (taxSlab / 100)).toFixed(2);
            }

            const total = +(discountedSubtotal + cgst + sgst + igst).toFixed(2);
            return { subtotal, discountAmount, discountedSubtotal, cgst, sgst, igst, total, isIntraState };
        };

        {
            grnCheckLoading && (
                <div className="loading-overlay">
                    <div className="loading-spinner">Checking GRN status...</div>
                </div>
            )
        }

        if (!po) return null;

        const totals = calculateTotals(
            editedPO.items || [],
            editedPO.discount || 0,
            editedPO.vendorGST,
            editedPO.taxSlab || 18
        );

        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <div className="modal-title">
                            {isEditing ? "Edit Purchase Order" : `PO: ${po.poNumber}`}
                        </div>
                        <button className="modal-close" onClick={onClose}>
                            &times;
                        </button>
                    </div>

                    <div className="modal-body">
                        <div className="po-details-grid">
                            {/* PO Number and Date (non-editable) */}
                            <div className="detail-row">
                                <span className="detail-label">PO Number:</span>
                                <span className="detail-value">{po.poNumber}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Date:</span>
                                {isEditing ? (
                                    <div className="edit-field-container">
                                        <input
                                            type="date"
                                            name="date"
                                            value={editedPO.date || ''}
                                            onChange={handleInputChange}
                                            className="edit-input"
                                        />
                                    </div>
                                ) : (
                                    <span className="detail-value">{po.date}</span>
                                )}
                            </div>

                            {/* Vendor Details (non-editable) */}
                            <div className="section-header">Vendor Details</div>
                            <div className="detail-row">
                                <span className="detail-label">Company Name:</span>
                                {isEditing ? (
                                    <div className="edit-field-container">
                                        <Select
                                            className="react-select-container"
                                            classNamePrefix="react-select"
                                            options={vendors.map(vendor => ({
                                                value: vendor.companyName,
                                                label: vendor.companyName,
                                                vendorData: vendor
                                            }))}
                                            onChange={handleVendorSelect}
                                            value={{
                                                value: editedPO.companyName,
                                                label: editedPO.companyName
                                            }}
                                            placeholder="Select Company"
                                            isSearchable={true}
                                            noOptionsMessage={() => "No companies found"}
                                        />
                                    </div>
                                ) : (
                                    <span className="detail-value">{po.companyName || 'N/A'}</span>
                                )}
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">GSTIN:</span>
                                <span className="detail-value">{isEditing ? editedPO.vendorGST : po.vendorGST}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Address:</span>
                                <span className="detail-value">{isEditing ? editedPO.vendorAddress : po.vendorAddress}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Contact Person:</span>
                                <span className="detail-value">{isEditing ? editedPO.vendorName : po.vendorName}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Contact:</span>
                                <span className="detail-value">{isEditing ? editedPO.vendorContact : po.vendorContact}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Email:</span>
                                <span className="detail-value">{isEditing ? editedPO.vendorEmail : po.vendorEmail}</span>
                            </div>

                            {/* Shipping Details (editable) */}
                            <div className="section-header">Shipping Details</div>
                            <div className="detail-row">
                                <span className="detail-label">Company Name:</span>
                                <span className="detail-value">{po.shipCompany}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Contact Person</span>
                                {isEditing ? (
                                    <div className="edit-field-container">
                                        <input
                                            type="text"
                                            name="shipName"
                                            value={editedPO.shipName || ''}
                                            onChange={handleInputChange}
                                            className={`edit-input ${errors.shipName ? 'error' : ''}`}
                                            placeholder="Optional"
                                        />
                                        {errors.shipName && <div className="error-message">{errors.shipName}</div>}
                                    </div>
                                ) : (
                                    <span className="detail-value">{po.shipName || 'Not provided'}</span>
                                )}
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Phone</span>
                                {isEditing ? (
                                    <div className="edit-field-container">
                                        <input
                                            type="text"
                                            name="shipPhone"
                                            value={editedPO.shipPhone || ''}
                                            onChange={handleInputChange}
                                            className={`edit-input ${errors.shipPhone ? 'error' : ''}`}
                                            placeholder="Optional"
                                        />
                                        {errors.shipPhone && <div className="error-message">{errors.shipPhone}</div>}
                                    </div>
                                ) : (
                                    <span className="detail-value">{po.shipPhone || 'Not provided'}</span>
                                )}
                            </div>

                            {/* Address Details (non-editable) */}
                            <div className="section-header">Address Details</div>
                            <div className="detail-row">
                                <span className="detail-label">Consignee Address:</span>
                                <span className="detail-value">{po.consigneeAddress}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Delivery Address:</span>
                                <span className="detail-value">{po.deliveryAddress}</span>
                            </div>

                            {/* Tax and Discount Details (editable) */}
                            <div className="section-header">Tax & Discount</div>
                            <div className="detail-row">
                                <span className="detail-label">Tax Slab</span>
                                {isEditing ? (
                                    <div className="edit-field-container">
                                        <select
                                            name="taxSlab"
                                            value={editedPO.taxSlab || ''}
                                            onChange={handleInputChange}
                                            className={`edit-input ${errors.taxSlab ? 'error' : ''}`}
                                        >
                                            <option value="">Select Tax Slab</option>
                                            {TAX_SLABS.map(slab => (
                                                <option key={slab.value} value={slab.value}>
                                                    {slab.label}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.taxSlab && <div className="error-message">{errors.taxSlab}</div>}
                                    </div>
                                ) : (
                                    <span className="detail-value">{po.taxSlab ? `${po.taxSlab}%` : '18%'}</span>
                                )}
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Discount</span>
                                {isEditing ? (
                                    <div className="edit-field-container">
                                        <input
                                            type="number"
                                            name="discount"
                                            value={editedPO.discount || ''}
                                            onChange={handleInputChange}
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            className={`edit-input ${errors.discount ? 'error' : ''}`}
                                        />
                                        <span>%</span>
                                        {errors.discount && <div className="error-message">{errors.discount}</div>}
                                    </div>
                                ) : (
                                    <span className="detail-value">{po.discount || 0}%</span>
                                )}
                            </div>

                            {/* Items (editable quantities and rates) */}
                            <div className="section-header">
                                Items Ordered
                                {isEditing && (
                                    <button
                                        className="new-add-item-btn"
                                        onClick={handleAddItem}
                                        type="button"
                                    >
                                        <FaPlus /> Add Item
                                    </button>
                                )}
                            </div>

                            {(editedPO.items || []).map((item, index) => {
                                const receivedQty = grnQuantities[item.name] || 0; // Define receivedQty here

                                return (
                                    <div key={index} className="item-card">
                                        <div className="item-header">
                                            {isEditing ? (
                                                <div className="edit-field-container" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <Select
                                                        className="react-select-container"
                                                        classNamePrefix="react-select"
                                                        options={items
                                                            .filter(availableItem =>
                                                                !editedPO.items.some((selectedItem, selectedIndex) =>
                                                                    selectedIndex !== index &&
                                                                    selectedItem.name === availableItem.itemName
                                                                )
                                                            )
                                                            .map(item => ({
                                                                value: item.itemName,
                                                                label: item.itemName,
                                                                itemData: item
                                                            }))
                                                        }
                                                        onChange={(selectedOption) => handleItemSelect(selectedOption, index)}
                                                        value={item.name ? {
                                                            value: item.name,
                                                            label: item.name
                                                        } : null}
                                                        placeholder="Select Item"
                                                        isSearchable={true}
                                                        noOptionsMessage={() => "No items available"}
                                                    />
                                                    {editedPO.items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            className="remove-item-btn"
                                                            onClick={() => handleRemoveItem(index)}
                                                            title="Remove item"
                                                            disabled={grnCheckLoading}
                                                        >
                                                            {grnCheckLoading ? "..." : <FaTrash />}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="item-name">{item.name}</span>
                                            )}
                                            <span className="item-hsn">HSN: {item.hsn || 'N/A'}</span>

                                            {/* {receivedQty > 0 && (
                                                <span className="item-received">
                                                    Received: {receivedQty} {item.unit}
                                                </span>
                                            )} */}
                                        </div>

                                        <div className="item-description">
                                            {item.description || 'No description'}
                                        </div>

                                        <div className="item-details">
                                            <div>
                                                <span>Qty: </span>
                                                {isEditing ? (
                                                    <div className="edit-field-container">
                                                        <input
                                                            type="number"
                                                            min={receivedQty} // Set minimum to received quantity
                                                            step="0.01"
                                                            value={item.qty || ''}
                                                            onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                                                            className={`edit-input ${errors[`items.${index}.qty`] ? 'error' : ''}`}
                                                        />
                                                        <span>{item.unit}</span>
                                                        {errors[`items.${index}.qty`] && (
                                                            <div className="error-message">{errors[`items.${index}.qty`]}</div>
                                                        )}
                                                        {receivedQty > 0 && (
                                                            <div className="quantity-warning">
                                                                Minimum: {receivedQty} (already received)
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span>{item.qty} {item.unit}</span>
                                                )}
                                            </div>

                                            <div>
                                                <span>Rate: </span>
                                                {isEditing ? (
                                                    <div className="edit-field-container">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.rate || ''}
                                                            onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                                            className={`edit-input ${errors[`items.${index}.rate`] ? 'error' : ''}`}
                                                        />
                                                        {errors[`items.${index}.rate`] && (
                                                            <div className="error-message">{errors[`items.${index}.rate`]}</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span>₹{item.rate?.toFixed(2)}</span>
                                                )}
                                            </div>

                                            <span>Total: ₹{((item.qty || 0) * (item.rate || 0)).toFixed(2)}</span>
                                        </div>

                                        {errors[`items.${index}.name`] && (
                                            <div className="error-message">{errors[`items.${index}.name`]}</div>
                                        )}
                                    </div>
                                );
                            }
                            )}

                            {/* Extra Note (editable) */}
                            <div className="section-header">Additional Notes</div>
                            <div className="detail-row">
                                {isEditing ? (
                                    <div className="edit-field-container">
                                        <textarea
                                            name="extraNote"
                                            value={editedPO.extraNote || ''}
                                            onChange={handleInputChange}
                                            className="edit-textarea"
                                            rows="3"
                                            placeholder="Add any additional notes here..."
                                        />
                                    </div>
                                ) : (
                                    <span className="detail-value">{po.extraNote || 'No additional notes'}</span>
                                )}
                            </div>

                            {/* Order Summary (calculated automatically) */}
                            <div className="section-header">Order Summary</div>
                            <div className="totals-section">
                                <div className="total-row">
                                    <span>Subtotal:</span>
                                    <span>₹{totals.subtotal.toFixed(2)}</span>
                                </div>
                                {(editedPO.discount || 0) > 0 && (
                                    <>
                                        <div className="total-row">
                                            <span>Discount ({editedPO.discount}%):</span>
                                            <span>-₹{totals.discountAmount.toFixed(2)}</span>
                                        </div>
                                        <div className="total-row">
                                            <span>Discounted Subtotal:</span>
                                            <span>₹{totals.discountedSubtotal.toFixed(2)}</span>
                                        </div>
                                    </>
                                )}
                                {totals.isIntraState ? (
                                    <>
                                        <div className="total-row">
                                            <span>CGST ({(editedPO.taxSlab || 18) / 2}%):</span>
                                            <span>₹{totals.cgst.toFixed(2)}</span>
                                        </div>
                                        <div className="total-row">
                                            <span>SGST ({(editedPO.taxSlab || 18) / 2}%):</span>
                                            <span>₹{totals.sgst.toFixed(2)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="total-row">
                                        <span>IGST ({editedPO.taxSlab || 18}%):</span>
                                        <span>₹{totals.igst.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="total-row grand-total">
                                    <span>Total:</span>
                                    <span>₹{totals.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button className="export-btn" onClick={onExport}>
                            <FaFileExport /> Export as PDF
                        </button>
                        <button
                            className={`update-btn ${isEditing ? 'save-btn' : ''}`}
                            onClick={isEditing ? handleSave : () => setIsEditing(true)}
                        >
                            {isEditing ? <FaSave /> : <FaEdit />}
                            {isEditing ? "Save Changes" : "Update"}
                        </button>
                        <button
                            className="delete-btn"
                            onClick={handleDeleteClick} // Changed to the new handler
                            disabled={grnCheckLoading}
                        >
                            {grnCheckLoading ? "Checking..." : <><FaTrash /> Delete</>}
                        </button>
                    </div>
                </div>

                {/* Delete Confirmation Dialog */}
                {showDeleteConfirm && (
                    <div className="confirm-dialog-overlay">
                        <div className="confirm-dialog">
                            <h3>Confirm Deletion</h3>
                            <p>Are you sure you want to delete PO {po.poNumber}? This action cannot be undone.</p>
                            <div className="confirm-buttons">
                                <button
                                    className="confirm-cancel"
                                    onClick={() => setShowDeleteConfirm(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="confirm-delete"
                                    onClick={() => {
                                        onDelete(po.poNumber);
                                        setShowDeleteConfirm(false);
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Navbar>
            <ToastContainer position="top-center" autoClose={3000} />


            <input
                type="file"
                ref={fileInputRef}
                onChange={handleBulkUpload}
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
            />


            <div className="main">
                <div className="page-header">
                    <h2>Purchase Orders</h2>
                    <div className="right-section">
                        <div className="search-container">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search POs..."
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

                            <button className="export-all-btn" onClick={handleExportExcel}>
                                <FaFileExcel /> Export All
                            </button>
                            <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                                <FaPlus /> {showForm ? "Close PO" : "Create PO"}
                            </button>
                        </div>
                    </div>
                </div>

                {isLoading && <div className="loading">Loading data...</div>}

                {showForm && (
                    <div className="form-container premium">
                        <Formik
                            initialValues={initialValues}
                            validationSchema={validationSchema}
                            validateOnBlur={false}
                            validateOnChange={false}
                            onSubmit={handleSubmit}
                        >
                            {({ errors, values, setFieldValue, validateForm, submitCount }) => {
                                useEffect(() => {
                                    if (submitCount > 0 && Object.keys(errors).length > 0) {
                                        Object.entries(errors).forEach(([field, error]) => {
                                            if (typeof error === "string") {
                                                toast.error(`${field}: ${error}`);
                                            } else if (field === "items" && Array.isArray(error)) {
                                                error.forEach((itemError, index) => {
                                                    if (itemError) {
                                                        Object.entries(itemError).forEach(([key, val]) => {
                                                            toast.error(`Item ${index + 1} - ${key}: ${val}`);
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                }, [submitCount, errors]);

                                return (
                                    <>
                                        <div className="po-form-header">
                                            <h2>Create Purchase Order</h2>
                                            <div className="date-container">
                                                <span className="date-label">Date:</span>
                                                {/* Make the date field editable directly in the header */}
                                                <Field
                                                    name="date"
                                                    type="date"
                                                    className="po-date-editable"
                                                    onChange={(e) => {
                                                        setFieldValue("date", e.target.value);
                                                    }}
                                                />
                                                <ErrorMessage name="date" component="div" className="error-message" />
                                            </div>
                                        </div>
                                        <Form>
                                            <div className="form-group-row">
                                                {/* <div className="field-wrapper">
                                                    <Field name="date" readOnly type="hidden" />
                                                </div> */}
                                            </div>

                                            <h3>Vendor Details</h3>
                                            <div className="form-group-row">
                                                <div className="field-wrapper">
                                                    <label>Company Name</label>
                                                    <Select
                                                        className="react-select-container"
                                                        classNamePrefix="react-select"
                                                        options={vendors.map(vendor => ({
                                                            value: vendor.companyName,
                                                            label: vendor.companyName,
                                                            vendorData: vendor
                                                        }))}
                                                        onChange={(selectedOption) => {
                                                            if (selectedOption) {
                                                                handleVendorSelect(
                                                                    { target: { value: selectedOption.value } },
                                                                    setFieldValue
                                                                );
                                                            }
                                                        }}
                                                        placeholder="Select Company"
                                                        isSearchable={true}
                                                        noOptionsMessage={() => "No companies found"}
                                                    />
                                                </div>
                                                <div className="field-wrapper">
                                                    <label>GSTIN</label>
                                                    <Field name="vendorGST" readOnly />
                                                </div>
                                                <div className="field-wrapper">
                                                    <label>Address</label>
                                                    <Field name="vendorAddress" readOnly />
                                                </div>
                                                <div className="field-wrapper">
                                                    <label>Contact Person</label>
                                                    <Field name="vendorName" readOnly />
                                                </div>
                                                <div className="field-wrapper">
                                                    <label>Contact</label>
                                                    <Field name="vendorContact" readOnly />
                                                </div>
                                                <div className="field-wrapper">
                                                    <label>Email</label>
                                                    <Field name="vendorEmail" readOnly />
                                                </div>
                                            </div>

                                            <h3>Shipping Details</h3>
                                            <div className="form-group-row">
                                                <div className="field-wrapper">
                                                    <label>Company Name</label>
                                                    <Field name="shipCompany" readOnly value="Welcome" />
                                                </div>
                                                <div className="field-wrapper">
                                                    <label>Contact Person</label>
                                                    <Field name="shipName" placeholder="Enter Contact Person" />
                                                </div>
                                                <div className="field-wrapper">
                                                    <label>Phone</label>
                                                    <Field name="shipPhone" placeholder="Enter Phone Number" />
                                                </div>
                                            </div>

                                            <h3>Address Details</h3>
                                            <div className="form-group-row">
                                                <div className="field-wrapper">
                                                    <label>Consignee Address</label>
                                                    <Field name="consigneeAddress" as="textarea" rows="3" value={CONSIGNEE_ADDRESS} readOnly />
                                                </div>
                                                <div className="field-wrapper">
                                                    <label>Delivery Address</label>
                                                    <Field name="deliveryAddress" as="textarea" rows="3" value={DELIVERY_ADDRESS} readOnly />
                                                </div>
                                            </div>

                                            <h3>Item Details</h3>
                                            <FieldArray name="items">
                                                {({ remove, push }) => (
                                                    <div className="form-items">
                                                        {values.items.map((item, index) => (
                                                            <div className="item-row" key={index}>
                                                                <Select
                                                                    className="react-select-container"
                                                                    classNamePrefix="react-select"
                                                                    options={items
                                                                        .filter(availableItem =>
                                                                            // Only show items that haven't been selected in other rows
                                                                            !values.items.some((selectedItem, selectedIndex) =>
                                                                                selectedIndex !== index &&
                                                                                selectedItem.name === availableItem.itemName
                                                                            )
                                                                        )
                                                                        .map(item => ({
                                                                            value: item.itemName,
                                                                            label: item.itemName,
                                                                            itemData: item
                                                                        }))
                                                                    }
                                                                    onChange={(selectedOption) => {
                                                                        if (selectedOption) {
                                                                            handleItemSelect(
                                                                                { target: { value: selectedOption.value } },
                                                                                index,
                                                                                setFieldValue
                                                                            );
                                                                        }
                                                                    }}
                                                                    value={item.name ? {
                                                                        value: item.name,
                                                                        label: item.name
                                                                    } : null}
                                                                    placeholder="Item"
                                                                    isSearchable={true}
                                                                    noOptionsMessage={() => "No items available"}
                                                                />
                                                                <Field name={`items.${index}.description`} readOnly placeholder="Description" />
                                                                <Field name={`items.${index}.hsn`} readOnly placeholder="HSN" />
                                                                <Field
                                                                    name={`items.${index}.qty`}
                                                                    type="number"
                                                                    placeholder="Qty"
                                                                    min="0.01"
                                                                    step="0.01"
                                                                />
                                                                <Field name={`items.${index}.rate`} type="number" placeholder="Rate (₹)" min="0" step="0.01" />
                                                                <Field name={`items.${index}.unit`} readOnly placeholder="Unit" />
                                                                {values.items.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        className="remove-btn"
                                                                        onClick={() => remove(index)}
                                                                    >
                                                                        <FaTrash />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            className="add-btn"
                                                            onClick={() => push({ name: "", description: "", hsn: "", qty: 1, rate: 0, unit: "" })}
                                                        >
                                                            + Add Item
                                                        </button>
                                                    </div>
                                                )}
                                            </FieldArray>

                                            <h3>Tax Information</h3>
                                            <div className="form-group-row">
                                                <div className="field-wrapper">
                                                    <label>Tax Slab <span className="required">*</span></label>
                                                    <Field
                                                        as="select"
                                                        name="taxSlab"
                                                        onChange={(e) => setFieldValue("taxSlab", Number(e.target.value))}
                                                    >
                                                        <option value="">Select Tax Slab</option>
                                                        {TAX_SLABS.map((slab) => (
                                                            <option key={slab.value} value={slab.value}>
                                                                {slab.label}
                                                            </option>
                                                        ))}
                                                    </Field>
                                                    <ErrorMessage name="taxSlab" component="div" className="error-message" />
                                                </div>
                                            </div>

                                            <div className="field-wrapper">
                                                <label>Discount (%)</label>
                                                <Field
                                                    name="discount"
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.01"
                                                    placeholder="0-100%"
                                                    onInput={(e) => {
                                                        if (e.target.value > 100) e.target.value = 100;
                                                        if (e.target.value < 0) e.target.value = 0;
                                                    }}
                                                />
                                            </div>

                                            <div className="field-wrapper">
                                                <label>Extra Note (Optional)</label>
                                                <Field name="extraNote" as="textarea" rows="3" />
                                            </div>

                                            <div className="terms-checkbox">
                                                <label>
                                                    <Field type="checkbox" name="includeTerms" />
                                                    Terms and Conditions Apply
                                                </label>
                                            </div>

                                            <div className="totals">
                                                {(() => {
                                                    const totals = calculateTotals(values.items, values.discount, values.vendorGST, values.taxSlab);
                                                    return (
                                                        <>
                                                            <p>Subtotal: ₹{totals.subtotal.toFixed(2)}</p>
                                                            {values.discount > 0 && (
                                                                <>
                                                                    <p>Discount ({values.discount}%): -₹{totals.discountAmount.toFixed(2)}</p>
                                                                    <p>Discounted Subtotal: ₹{totals.discountedSubtotal.toFixed(2)}</p>
                                                                </>
                                                            )}
                                                            {totals.isIntraState ? (
                                                                <>
                                                                    <p>CGST ({values.taxSlab / 2}%): ₹{totals.cgst.toFixed(2)}</p>
                                                                    <p>SGST ({values.taxSlab / 2}%): ₹{totals.sgst.toFixed(2)}</p>
                                                                </>
                                                            ) : (
                                                                <p>IGST ({values.taxSlab}%): ₹{totals.igst.toFixed(2)}</p>
                                                            )}
                                                            <p>Total: ₹{totals.total.toFixed(2)}</p>
                                                        </>
                                                    );
                                                })()}
                                            </div>


                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className={isSubmitting ? "submitting" : ""}
                                            >
                                                {isSubmitting ? "Submitting..." : "Submit PO"}
                                            </button>
                                        </Form>
                                    </>
                                );
                            }}
                        </Formik>
                    </div>
                )}

                <div className="data-table">
                    <table>
                        <thead>
                            <tr>
                                <th>PO No</th>
                                <th>Date</th>
                                <th>Company</th>
                                <th>Vendor</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((po) => (
                                <tr
                                    key={po.poNumber}
                                    onClick={() => setSelectedPO(po)}
                                    className={selectedPO?.poNumber === po.poNumber ? "selected" : ""}
                                >
                                    <td>{po.poNumber}</td>
                                    <td>{po.date}</td>
                                    <td>{po.companyName}</td>
                                    <td>{po.vendorName}</td>
                                    <td>₹{(po.total || 0).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: "none" }}>
                    {selectedPO && <PurchaseOrderPrint po={selectedPO} />}
                </div>

                {selectedPO && (
                    <POModal
                        po={selectedPO}
                        onClose={() => setSelectedPO(null)}
                        onExport={handleExportPDF}
                        onUpdate={handleUpdatePO}
                        onDelete={handleDeletePO}
                    />
                )}
            </div>
        </Navbar>
    );
};

export default PurchaseOrder;