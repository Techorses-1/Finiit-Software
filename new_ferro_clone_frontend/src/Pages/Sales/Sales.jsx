import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Formik, Form, Field, FieldArray, ErrorMessage } from "formik";
import * as Yup from "yup";
import html2pdf from "html2pdf.js";
import { toast, ToastContainer } from "react-toastify";
import { FaPlus, FaFileExport, FaFileExcel, FaSearch, FaFileCode, FaUpload, FaSpinner, FaTrash, FaSave, FaEdit } from "react-icons/fa";
import Navbar from "../../Components/Sidebar/Navbar";
import SalesPrint from "./SalesPrint";
import "react-toastify/dist/ReactToastify.css";
import "./Sales.scss";
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

const TERMS_CONDITIONS = `
All orders are subject to acceptance by the seller.
Prices are subject to change without notice.
`;

const SUPPLY_TYPES = [
  { label: "Outward", value: "O" },
  { label: "Inward", value: "I" }
];

const SUB_SUPPLY_TYPES = [
  { label: "Supply", value: 1 },
  { label: "Export", value: 3 },
  { label: "Job Work", value: 4 }
];

const TRANS_TYPES = [
  { label: "Regular", value: 1 },
  { label: "Bill To - Ship To", value: 2 },
  { label: "Bill From - Dispatch From", value: 3 },
  { label: "Combination of 2 & 3", value: 4 }
];

const Sales = () => {
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [gstType, setGstType] = useState("intra");
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeUrl, setQRCodeUrl] = useState("");
  const [workOrders, setWorkOrders] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showLoader, setShowLoader] = useState(false);
  const loaderTimeoutRef = useRef(null);

  const [uploadingFiles, setUploadingFiles] = useState({});

  const fileInputRefs = useRef({});


  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);


  const [showUploadModal, setShowUploadModal] = useState(null);

  // Add this function to trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

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
        `${import.meta.env.VITE_API_URL}/sales/bulk-upload`,
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
          `✅ ${data.insertedCount} Sales Invoices uploaded successfully\n❌ ${errorCount} errors found`,
          {
            autoClose: 8000,
            closeOnClick: false,
          }
        );

        // Log all errors to console for debugging
        console.log('📋 Sales Bulk Upload Results:');
        console.log(`✅ Successfully uploaded: ${data.insertedCount}`);
        console.log(`📊 Total Invoices processed: ${data.totalInvoices}`);
        console.log(`📝 Total rows: ${data.totalRows}`);
        console.log('🎯 Successful Invoices:', data.invoiceNumbers);
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
        toast.success(`🎉 All ${data.insertedCount} sales invoices uploaded successfully!`);
      }

      // Refresh Sales data
      await fetchSalesData();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading sales invoices:', error);

      if (error.response?.data?.errors) {
        const errorData = error.response.data;
        toast.error(
          `Upload completed with issues. ${errorData.insertedCount || 0} Invoices uploaded, ${errorData.errors.length} errors. Check console for details.`,
          { autoClose: 8000 }
        );
        console.log('Upload errors:', errorData.errors);
      } else {
        toast.error(error.response?.data?.message || 'Error uploading sales invoices');
      }
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Add debounce effect
  useEffect(() => {
    if (loaderTimeoutRef.current) {
      clearTimeout(loaderTimeoutRef.current);
    }

    if (searchTerm.trim()) {
      loaderTimeoutRef.current = setTimeout(() => {
        setShowLoader(true);
      }, 300);

      const searchTimeout = setTimeout(() => {
        if (loaderTimeoutRef.current) {
          clearTimeout(loaderTimeoutRef.current);
        }
        setDebouncedSearch(searchTerm.trim().toLowerCase());
        setShowLoader(false);
      }, 300);

      return () => {
        clearTimeout(searchTimeout);
        if (loaderTimeoutRef.current) {
          clearTimeout(loaderTimeoutRef.current);
        }
        setShowLoader(false);
      };
    } else {
      setDebouncedSearch("");
      setShowLoader(false);
    }
  }, [searchTerm]);

  const filteredInvoices = useMemo(() => {
    if (!debouncedSearch) return invoices;

    return invoices.filter(invoice => {
      // Check invoice fields
      if (invoice.invoiceNumber?.toLowerCase().includes(debouncedSearch)) return true;
      if (invoice.invoiceDate?.toLowerCase().includes(debouncedSearch)) return true;
      if (invoice.workOrderNumber?.toLowerCase().includes(debouncedSearch)) return true;

      // Check receiver fields
      if (invoice.receiver?.name?.toLowerCase().includes(debouncedSearch)) return true;
      if (invoice.receiver?.gstin?.toLowerCase().includes(debouncedSearch)) return true;
      if (invoice.receiver?.address?.toLowerCase().includes(debouncedSearch)) return true;
      if (invoice.receiver?.contact?.toLowerCase().includes(debouncedSearch)) return true;
      if (invoice.receiver?.email?.toLowerCase().includes(debouncedSearch)) return true;

      // Check items
      if (invoice.items?.some(item =>
        item.name?.toLowerCase().includes(debouncedSearch) ||
        item.description?.toLowerCase().includes(debouncedSearch) ||
        item.hsn?.toLowerCase().includes(debouncedSearch)
      )) return true;

      // Check transport details
      if (invoice.lrNumber?.toLowerCase().includes(debouncedSearch)) return true;

      // Check bank details
      if (invoice.bank?.name?.toLowerCase().includes(debouncedSearch)) return true;
      if (invoice.bank?.account?.toLowerCase().includes(debouncedSearch)) return true;
      if (invoice.bank?.branch?.toLowerCase().includes(debouncedSearch)) return true;
      if (invoice.bank?.ifsc?.toLowerCase().includes(debouncedSearch)) return true;

      return false;
    });
  }, [debouncedSearch, invoices]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchSalesData(),
          axios.get(`${import.meta.env.VITE_API_URL}/customer/get-customers`).then(res =>
            setCustomers(res.data || [])
          ),
          axios.get(`${import.meta.env.VITE_API_URL}/workorder/get-workorders`).then(res => {
            const sortedWorkOrders = (res.data.data || []).sort((a, b) =>
              new Date(b.createdAt || b.workOrderDate || Date.now()) - new Date(a.createdAt || a.workOrderDate || Date.now())
            );
            setWorkOrders(sortedWorkOrders);
          })
        ]);
      } catch (error) {
        toast.error("Failed to fetch data");
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const fetchSalesData = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/sales/get-sales`);
      const sortedInvoices = (response.data.data || []).sort((a, b) => {
        const dateDiff = new Date(b.invoiceDate) - new Date(a.invoiceDate);
        if (dateDiff !== 0) return dateDiff;
        return b.invoiceNumber.localeCompare(a.invoiceNumber);
      });
      setInvoices(sortedInvoices);
    } catch (error) {
      console.error("Error fetching sales:", error);
      toast.error("Failed to load invoices from database");
    }
  };

  const initialValues = {
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    workOrderNumber: "",
    poNumber: "",
    poDate: "",
    vehicleNumber: "",
    isServc: "N",
    receiver: {
      companyName: "",
      name: "",
      gstin: "",
      address: "",
      address2: "",
      city: "",
      pincode: "",
      contact: "",
      email: "",
      customerId: ""
    },
    consignee: {
      name: "",
      gstin: "",
      address: "",
      address2: "",
      city: "",
      pincode: "",
      contact: "",
      email: ""
    },
    // items: [],
    items: [
      {
        name: "",           // ← Users see this
        description: "",
        hsn: "",
        quantity: "",
        unitPrice: "",
        units: "",
        bomId: ""           // ← Hidden from users but stored in DB
      }
    ],
    lrNumber: "",
    lrDate: "",
    transporter: "",
    transportMobile: "",
    bank: {
      name: "",
      account: "",
      branch: "",
      ifsc: ""
    },
    // otherCharges: 0, // Commented out as requested
    extraNote: "",
    taxSlab: "",
    includeTerms: false,
    selectedCustomer: null,
    packetForwardingPercent: 0,
    freightPercent: 0,
    inspectionPercent: 0,
    tcsPercent: 0, // Added TCS charge

    ewayBill: {
      supplyType: "O",
      subSupplyType: 1,
      transType: 1,
      transDistance: 0,
    }
  };

  const validationSchema = Yup.object().shape({
    invoiceNumber: Yup.string()
      .required("Invoice Number is required")
      .matches(/^[a-zA-Z0-9]{1,7}$/, "Invoice Number must be 1-7 alphanumeric characters"),
    invoiceDate: Yup.string().required("Invoice Date is required"),
    workOrderNumber: Yup.string().required("Work Order is required"),
    lrNumber: Yup.string().required("LR Number is required"),
    lrDate: Yup.string().required("LR Date is required"),
    vehicleNumber: Yup.string().required("Vehicle Number is required"),
    transporter: Yup.string().required("Transporter Name is required"),
    transportMobile: Yup.string().required("Transporter Mobile is required").matches(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number"),

    receiver: Yup.object({
      companyName: Yup.string().required("Company name required"),
      name: Yup.string().required("Receiver name required"),
      gstin: Yup.string().required("GSTIN required"),
      address: Yup.string().required("Address required"),
      city: Yup.string(),
      pincode: Yup.string(),
      contact: Yup.string().required("Contact required"),
      email: Yup.string().email("Invalid email").required("Email required")
    }),
    consignee: Yup.object({
      name: Yup.string().required("Consignee name required"),
      gstin: Yup.string().required("GSTIN required"),
      address: Yup.string().required("Address required"),
      city: Yup.string(),
      pincode: Yup.string(),
      contact: Yup.string().required("Contact required"),
      email: Yup.string().email("Invalid email").required("Email required")
    }),
    taxSlab: Yup.number()
      .required("Tax slab is required")
      .oneOf(TAX_SLABS.map(slab => slab.value), "Please select a valid tax slab"),
    items: Yup.array().of(
      Yup.object({
        name: Yup.string().required("Item name required"),
        quantity: Yup.number()
          .required("Quantity required")
          .moreThan(0, "Quantity must be greater than 0") // This ensures minimum is > 0
          .typeError("Quantity must be a number")
          .test(
            'is-decimal',
            'Quantity can have up to 2 decimal places',
            value => value === undefined || /^\d+(\.\d{1,2})?$/.test(value)
          )
          .test(
            'max-quantity',
            'Quantity exceeds available stock',
            function (value) {
              const { _remainingQty } = this.parent;
              if (_remainingQty === undefined) return true; // No restriction
              return value <= _remainingQty;
            }
          ),
        unitPrice: Yup.number().required("Unit price required").moreThan(0),
        units: Yup.string().required("Unit is required")
      })
    )
  });

  const handleWorkOrderSelect = async (e, setFieldValue) => {
    const selectedWONumber = e.target.value;
    if (!selectedWONumber) return;

    try {
      // 1. Fetch all existing sales for this work order
      const salesResponse = await axios.get(`${import.meta.env.VITE_API_URL}/sales/get-sales-by-wo`, {
        params: { workOrderNumber: selectedWONumber }
      });

      // 2. Find the selected work order
      const selectedWO = workOrders.find(wo => wo.workOrderNumber === selectedWONumber);
      if (!selectedWO) {
        toast.error("Selected work order not found");
        return;
      }

      // 3. Calculate remaining quantities
      const itemsWithRemainingQty = selectedWO.items.map(woItem => {
        const soldQty = salesResponse.data.data.reduce((total, sale) => {
          const saleItem = sale.items.find(i =>
            i.name && woItem.name &&
            i.name.trim().toLowerCase() === woItem.name.trim().toLowerCase()
          );
          return total + (Number(saleItem?.quantity) || 0);
        }, 0);

        const remainingQty = Math.max(0, woItem.quantity - soldQty);

        console.log(`Item: ${woItem.name}, Original: ${woItem.quantity}, Sold: ${soldQty}, Remaining: ${remainingQty}`);

        return {
          ...woItem,
          quantity: remainingQty,
          _originalQty: woItem.quantity,
          _soldQty: soldQty,
          _remainingQty: remainingQty
        };
      }).filter(item => item._remainingQty > 0);

      console.log('All items with remaining quantities:', itemsWithRemainingQty);

      if (itemsWithRemainingQty.length === 0) {
        toast.warn("All items in this work order have been fully sold");
        return;
      }

      // 4. Update only the fields that exist in the work order
      setFieldValue("workOrderNumber", selectedWO.workOrderNumber);
      setFieldValue("poNumber", selectedWO.poNumber || "");
      setFieldValue("poDate", selectedWO.poDate || "");

      const itemsWithBomIds = itemsWithRemainingQty.map(item => ({
        name: item.name,           // ← Users see this
        description: item.description,
        hsn: item.hsn,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        units: item.units,
        bomId: item.bomId,
        _originalQty: item._originalQty,
        _soldQty: item._soldQty,
        _remainingQty: item._remainingQty      // ← Hidden BOM ID stored in DB
      }));

      setFieldValue("items", itemsWithBomIds);

      if (selectedWO.receiver) {
        // Set receiver details including companyName and address2
        setFieldValue("receiver.companyName", selectedWO.receiver.companyName || "");
        setFieldValue("receiver.name", selectedWO.receiver.name || "");
        setFieldValue("receiver.gstin", selectedWO.receiver.gstin || "");
        setFieldValue("receiver.address", selectedWO.receiver.address || ""); // address1
        setFieldValue("receiver.address2", selectedWO.receiver.address2 || ""); // NEW: address2
        setFieldValue("receiver.city", selectedWO.receiver.city || "");
        setFieldValue("receiver.pincode", selectedWO.receiver.pincode || "");
        setFieldValue("receiver.contact", selectedWO.receiver.contact || "");
        setFieldValue("receiver.email", selectedWO.receiver.email || "");
        setFieldValue("receiver.customerId", selectedWO.receiver.customerId || "");

        // Also set consignee details to be same as receiver by default
        setFieldValue("consignee.name", selectedWO.receiver.name || "");
        setFieldValue("consignee.gstin", selectedWO.receiver.gstin || "");
        setFieldValue("consignee.address", selectedWO.receiver.address || ""); // address1
        setFieldValue("consignee.address2", selectedWO.receiver.address2 || ""); // NEW: address2
        setFieldValue("consignee.city", selectedWO.receiver.city || "");
        setFieldValue("consignee.pincode", selectedWO.receiver.pincode || "");
        setFieldValue("consignee.contact", selectedWO.receiver.contact || "");
        setFieldValue("consignee.email", selectedWO.receiver.email || "");

        // Update GST type based on receiver's GSTIN
        const isIntraState = selectedWO.receiver.gstin && selectedWO.receiver.gstin.startsWith("24");
        setGstType(isIntraState ? "intra" : "inter");
      }
    } catch (error) {
      console.error("Work order selection error:", error);
      toast.error("Failed to load work order details");
    }
  };

  const calculateTotals = (items, receiverGST = "", percentages = {}, taxSlab = 18) => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const isIntraState = typeof receiverGST === 'string' && receiverGST.startsWith("24");

    // Calculate GST based on selected tax slab
    const taxRate = taxSlab;
    const cgst = isIntraState ? +(subtotal * (taxRate / 2 / 100)).toFixed(2) : 0;
    const sgst = isIntraState ? +(subtotal * (taxRate / 2 / 100)).toFixed(2) : 0;
    const igst = !isIntraState ? +(subtotal * (taxRate / 100)).toFixed(2) : 0;

    // Calculate total before TCS (subtotal + GST)
    const totalBeforeTCS = +(subtotal + cgst + sgst + igst).toFixed(2);

    // Calculate TCS on the total amount including GST
    const tcs = percentages.tcsPercent ? +(totalBeforeTCS * percentages.tcsPercent / 100).toFixed(2) : 0;

    // Final total including TCS
    const total = +(totalBeforeTCS + tcs).toFixed(2);

    return {
      subtotal,
      tcs,
      taxableAmount: subtotal,
      cgst,
      sgst,
      igst,
      total,
      tcsPercent: percentages.tcsPercent,
      isIntraState,
      taxSlab: taxRate
    };
  };

  const generateEInvoiceJSON = (invoice) => {
    // Helper: format date DD/MM/YYYY
    const formatDate = (dateString) => {
      if (!dateString) return "";
      const [year, month, day] = dateString.split("-");
      return `${day}/${month}/${year}`;
    };

    // Helper: format number to 2 decimal places
    const formatToTwoDecimals = (num) => {
      if (num === undefined || num === null) return 0;
      return Math.round(Number(num) * 100) / 100;
    };

    // 1. Subtotal (items only)
    const subtotal = formatToTwoDecimals(
      invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    );

    // 2. GST calculation (on subtotal only)
    const isIntraState = invoice.receiver.gstin && invoice.receiver.gstin.startsWith("24");
    const taxRate = invoice.taxSlab;

    const cgst = formatToTwoDecimals(isIntraState ? subtotal * (taxRate / 2 / 100) : 0);
    const sgst = formatToTwoDecimals(isIntraState ? subtotal * (taxRate / 2 / 100) : 0);
    const igst = formatToTwoDecimals(!isIntraState ? subtotal * (taxRate / 100) : 0);

    // 3. TCS (on subtotal + GST)
    const baseWithGST = subtotal + cgst + sgst + igst;
    const tcs = formatToTwoDecimals(invoice.tcsPercent ? baseWithGST * invoice.tcsPercent / 100 : 0);

    // 4. Other charges = TCS only
    const othChrg = formatToTwoDecimals(tcs);

    // 5. Final total
    const total = formatToTwoDecimals(subtotal + cgst + sgst + igst + othChrg);

    // 6. Build address objects conditionally
    const sellerDetails = {
      "Gstin": "24AAAFF2996A1ZS",
      "LglNm": "FERRO TUBE AND FORGE INDUSTRIES",
      "TrdNm": "FERRO TUBE AND FORGE INDUSTRIES",
      "Addr1": "123 MAIN STREET",
      "Loc": "VADODARA",
      "Pin": 391760,
      "Stcd": "24"
    };

    // 7. Build buyer details with conditional Addr2
    const buyerDetails = {
      "Gstin": invoice.receiver.gstin,
      "LglNm": invoice.receiver.companyName || invoice.receiver.name,
      "TrdNm": invoice.receiver.name,
      "Pos": invoice.receiver.gstin.substring(0, 2),
      "Addr1": invoice.receiver.address || "",
      "Loc": invoice.receiver.city || "VADODARA",
      "Pin": parseInt(invoice.receiver.pincode) || 391760,
      "Stcd": invoice.receiver.gstin.substring(0, 2),
      "Ph": invoice.receiver.contact,
      "Em": invoice.receiver.email
    };



    // CRITICAL FIX: Only add Addr2 if it has content
    // Remove the duplicate check for now to test
    const hasAddr2 = invoice.receiver.address2 && invoice.receiver.address2.trim() !== "";

    console.log("Addr2 will be included:", hasAddr2);

    if (hasAddr2) {
      buyerDetails.Addr2 = invoice.receiver.address2.trim();
      // console.log("✅ Addr2 ADDED to JSON:", buyerDetails.Addr2);
    } else {
      // console.log("❌ Addr2 NOT added to JSON");
    }

    // 8. Item list (AssAmt = TotAmt - Discount)
    const itemList = invoice.items.map((item, index) => {
      const itemTotal = formatToTwoDecimals(item.quantity * item.unitPrice);
      const itemAssAmt = formatToTwoDecimals(itemTotal);

      const itemCgst = formatToTwoDecimals(isIntraState ? itemAssAmt * (taxRate / 2 / 100) : 0);
      const itemSgst = formatToTwoDecimals(isIntraState ? itemAssAmt * (taxRate / 2 / 100) : 0);
      const itemIgst = formatToTwoDecimals(!isIntraState ? itemAssAmt * (taxRate / 100) : 0);

      const itemOthChrg = 0;
      const totItemVal = formatToTwoDecimals(itemAssAmt + itemIgst + itemCgst + itemSgst + itemOthChrg);

      return {
        "SlNo": (index + 1).toString(),
        "PrdDesc": item.description || item.name,
        "IsServc": invoice.isServc || "N",
        "HsnCd": item.hsn || "",
        "Qty": formatToTwoDecimals(item.quantity),
        "Unit": item.units || "NOS",
        "UnitPrice": formatToTwoDecimals(item.unitPrice),
        "TotAmt": itemTotal,
        "Discount": 0,
        "PreTaxVal": 0,
        "AssAmt": itemAssAmt,
        "GstRt": taxRate,
        "IgstAmt": itemIgst,
        "CgstAmt": itemCgst,
        "SgstAmt": itemSgst,
        "OthChrg": itemOthChrg,
        "TotItemVal": totItemVal
      };
    });

    // 9. Invoice totals
    const valDtls = {
      "AssVal": formatToTwoDecimals(subtotal),
      "IgstVal": igst,
      "CgstVal": cgst,
      "SgstVal": sgst,
      "Discount": 0,
      "OthChrg": othChrg,
      "TotInvVal": total
    };

    // 10. Return final JSON
    const result = [
      {
        "Version": "1.1",
        "TranDtls": {
          "TaxSch": "GST",
          "SupTyp": "B2B",
          "IgstOnIntra": "N"
        },
        "DocDtls": {
          "Typ": "INV",
          "No": invoice.invoiceNumber,
          "Dt": formatDate(invoice.invoiceDate)
        },
        "SellerDtls": sellerDetails,
        "BuyerDtls": buyerDetails,
        "ValDtls": valDtls,
        "ItemList": itemList
      }
    ];

    // console.log("🎯 FINAL JSON RESULT:");
    // console.log("Buyer Address Fields:", Object.keys(buyerDetails));
    // console.log("Buyer Addr1:", buyerDetails.Addr1);
    // console.log("Buyer Addr2:", buyerDetails.Addr2 || "FIELD OMITTED");
    // console.log("Final JSON:", JSON.stringify(result, null, 2));

    return result;
  };



  const handleSubmit = async (values, { resetForm }) => {
    if (isSubmitting) return;
    setIsSubmitting(true);


    const existingInvoice = invoices.find(inv =>
      inv.invoiceNumber === values.invoiceNumber
    );

    if (existingInvoice) {
      toast.error("Invoice number already exists. Please use a unique number.");
      setIsSubmitting(false);
      return;
    }

    // DEBUG: Log all items with their quantities and limits
    console.log('SUBMISSION VALIDATION - ALL ITEMS:', values.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      maxAllowed: item._remainingQty,
      isValid: item._remainingQty === undefined || parseFloat(item.quantity) <= item._remainingQty,
      type: typeof item.quantity,
      remainingType: typeof item._remainingQty
    })));

    // Final quantity validation
    const invalidItems = values.items.filter(item => {
      const isValid = item._remainingQty === undefined || parseFloat(item.quantity) <= item._remainingQty;
      console.log('VALIDATING ITEM:', item.name, 'Qty:', item.quantity, 'Max:', item._remainingQty, 'Valid:', isValid);
      return !isValid;
    });

    console.log('INVALID ITEMS FOUND:', invalidItems);

    if (invalidItems.length > 0) {
      invalidItems.forEach(item => {
        toast.error(`Quantity for ${item.name} exceeds remaining work order quantity (Max: ${item._remainingQty})`);
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Commented out other charges as requested
      // const numericOtherCharges = Number(values.otherCharges || 0);
      const totals = calculateTotals(
        values.items,
        values.receiver.gstin || "",
        {
          tcsPercent: values.tcsPercent
        },
        values.taxSlab
      );

      // FIX: Only include TCS in other charges since other charges are removed
      const totalOtherCharges = totals.tcs || 0; // ✅ Only TCS remains

      const mainHsnItem = values.items.reduce((maxItem, currentItem) =>
        (currentItem.quantity * currentItem.unitPrice) > (maxItem.quantity * maxItem.unitPrice) ? currentItem : maxItem
      );

      const isIntraState = values.receiver.gstin.startsWith("24");

      const ewayBillData = {
        // Static sender info
        fromGstin: "24AAAFF2996A1ZS",
        fromTrdName: "FERRO TUBE AND FORGE INDUSTRIES",
        fromAddr1: "123 Main Street",
        fromAddr2: "",
        fromPlace: "Vadodara",
        fromPincode: "391760",
        fromStateCode: 24,
        actualFromStateCode: 24,

        // User provided
        supplyType: values.ewayBill.supplyType,
        subSupplyType: values.ewayBill.subSupplyType,
        transType: values.ewayBill.transType,
        vehicleType: "R",
        transMode: 1,
        transDistance: values.ewayBill.transDistance,

        // From receiver
        toGstin: values.receiver.gstin,
        toTrdName: values.receiver.name,
        toAddr1: values.receiver.address,
        toAddr2: "",
        toPlace: values.receiver.city,
        toPincode: values.receiver.pincode,
        toStateCode: parseInt(values.receiver.gstin.substring(0, 2)),
        actualToStateCode: parseInt(values.receiver.gstin.substring(0, 2)),

        // From invoice
        docType: "INV",
        docNo: values.invoiceNumber,
        docDate: values.invoiceDate,

        // From transport
        transporterName: values.transporter,
        transDocNo: values.lrNumber,
        transDocDate: values.lrDate,
        vehicleNo: values.vehicleNumber,

        // From items
        itemList: values.items.map((item, index) => ({
          itemNo: index + 1,
          productName: item.name,
          productDesc: item.description,
          hsnCode: item.hsn,
          quantity: item.quantity,
          qtyUnit: item.units,
          taxableAmount: item.quantity * item.unitPrice,
          sgstRate: isIntraState ? values.taxSlab / 2 : 0, // Use actual tax rates
          cgstRate: isIntraState ? values.taxSlab / 2 : 0,
          igstRate: isIntraState ? 0 : values.taxSlab, // ✅ Use the actual tax slab value
          cessRate: 0,
          cessNonAdvol: 0
        })),

        // From totals
        totalValue: totals.subtotal,
        cgstValue: totals.cgst,
        sgstValue: totals.sgst,
        igstValue: totals.igst,
        totInvValue: totals.total,
        OthValue: totalOtherCharges, // ✅ Now this will be a number (not null)
        TotNonAdvolVal: 0,
        mainHsnCode: mainHsnItem.hsn
      };

      const newInvoice = {
        ...values,
        ...totals,
        terms: values.includeTerms ? TERMS_CONDITIONS : "",
        extraNote: values.extraNote,
        ewayBill: ewayBillData,
        tcs: totals.tcs // Only TCS remains
      };

      const response = await axios.post(`${import.meta.env.VITE_API_URL}/sales/create-sale`, newInvoice);
      setInvoices(prev => [response.data.data, ...prev]);
      toast.success("Invoice saved successfully!");
      setShowForm(false);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedInvoice) {
      toast.warn("Select an invoice to export");
      return;
    }

    if (isExporting) return;
    setIsExporting(true);

    try {
      const element = document.getElementById("sales-pdf");

      console.log("Starting PDF export...");
      console.log("Selected invoice image URL:", selectedInvoice.imageUrl);

      // Wait for all images inside element
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
          margin: [35, 10, 5, 10],
          // top=40mm, right=10mm, bottom=25mm, left=10mm
          // -> leaves blank space at top & bottom on EVERY PAGE

          filename: `${selectedInvoice.invoiceNumber}_${selectedInvoice.receiver.name.replace(
            /\s+/g,
            "_"
          )}.pdf`,

          image: { type: "jpeg", quality: 0.98 },

          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
          },

          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .save();
    } catch (error) {
      toast.error("Failed to export PDF");
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };




  const handleExportExcel = () => {
    if (invoices.length === 0) {
      toast.warn("No invoices to export");
      return;
    }

    const data = invoices.map(invoice => ({
      'Invoice No': invoice.invoiceNumber,
      'Date': invoice.invoiceDate,
      'Receiver': invoice.receiver.name,
      'Total': invoice.total?.toFixed(2),
      'PO Number': invoice.poNumber,
      'Consignee': invoice.consignee.name,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
    XLSX.writeFile(workbook, "Invoices.xlsx");
    toast.success("Exported all invoices to Excel");
  };


  const handleFileUpload = async (invoice, event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [invoice.invoiceNumber]: true }));

    try {
      // 1. Get presigned URL from backend
      const presignedResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/s3/sales-presigned-url`,
        {
          invoiceNumber: invoice.invoiceNumber,
          fileType: file.type
        }
      );

      const { uploadUrl, fileUrl } = presignedResponse.data;

      // 2. Upload file to S3 with proper headers
      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": file.type
        }
      });

      // 3. Save image URL to database
      await axios.put(
        `${import.meta.env.VITE_API_URL}/sales/update-sale-image/${invoice.invoiceNumber}`,
        { imageUrl: fileUrl }
      );

      // 4. Update local state
      setInvoices(prev => prev.map(inv =>
        inv.invoiceNumber === invoice.invoiceNumber
          ? { ...inv, imageUrl: fileUrl }
          : inv
      ));

      if (selectedInvoice?.invoiceNumber === invoice.invoiceNumber) {
        setSelectedInvoice(prev => ({ ...prev, imageUrl: fileUrl }));
      }

      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingFiles(prev => ({ ...prev, [invoice.invoiceNumber]: false }));
      // Reset file input
      if (fileInputRefs.current[invoice.invoiceNumber]) {
        fileInputRefs.current[invoice.invoiceNumber].value = '';
      }
    }
  };

  // Add these functions to your Sales component
  // FIXED: handleUpdateInvoice function
  const handleUpdateInvoice = async (updatedInvoice) => {
    try {
      // Remove timestamp fields but keep invoiceNumber for the update
      const { createdAt, updatedAt, ...updateData } = updatedInvoice;

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/sales/update-sale/${updatedInvoice.invoiceNumber}`,
        updateData
      );

      if (response.data.success) {
        // FIX: Update the invoices state with the returned data
        setInvoices(prev =>
          prev.map(inv =>
            inv.invoiceNumber === updatedInvoice.invoiceNumber ? response.data.data : inv
          )
        );

        // FIX: Also update the selectedInvoice if it's the one being edited
        if (selectedInvoice && selectedInvoice.invoiceNumber === updatedInvoice.invoiceNumber) {
          setSelectedInvoice(response.data.data);
        }

        toast.success("Invoice updated successfully!");
        return true;
      } else {
        toast.error("Failed to update invoice");
        return false;
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error(error.response?.data?.message || "Error updating invoice");
      return false;
    }
  };

  const handleDeleteInvoice = async (invoiceNumber) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/sales/delete-sale/${invoiceNumber}`
      );

      setInvoices(prev =>
        prev.filter(inv => inv.invoiceNumber !== invoiceNumber)
      );
      setSelectedInvoice(null);
      toast.success("Invoice deleted successfully!");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error(error.response?.data?.message || "Error deleting invoice");
    }
  };



  const InvoiceModal = ({ invoice, onClose, onExport, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedInvoice, setEditedInvoice] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    useEffect(() => {
      if (invoice) {
        setEditedInvoice({ ...invoice });
        setErrors({});
      }
    }, [invoice]);

    // Validation function - only validate editable fields
    const validateForm = (values) => {
      const newErrors = {};

      // Validate transport details
      if (!values.lrNumber) newErrors.lrNumber = "LR Number is required";
      if (!values.lrDate) newErrors.lrDate = "LR Date is required";
      if (!values.vehicleNumber) newErrors.vehicleNumber = "Vehicle Number is required";
      if (!values.transporter) newErrors.transporter = "Transporter is required";
      if (!values.transportMobile) {
        newErrors.transportMobile = "Transporter Mobile is required";
      } else if (!/^[6-9]\d{9}$/.test(values.transportMobile)) {
        newErrors.transportMobile = "Please enter a valid 10-digit mobile number";
      }
      // Validate tax slab
      if (!values.taxSlab) newErrors.taxSlab = "Tax slab is required";

      return newErrors;
    };

    const handleInputChange = (e) => {
      const { name, value, type } = e.target;  // ← ADDED "type" here

      // Convert numeric fields to numbers
      let processedValue = value;

      // Handle radio buttons
      if (type === 'radio') {
        processedValue = value; // "Y" or "N"
      }
      else if (name === "taxSlab" || name === "tcsPercent") {
        processedValue = value === "" ? "" : Number(value);
      }

      // Update the invoice data
      const updatedInvoice = { ...editedInvoice, [name]: processedValue };
      setEditedInvoice(updatedInvoice);

      // Recalculate totals if tax-related fields change
      if (name === "taxSlab" || name === "tcsPercent") {
        const newTotals = recalculateTotals(updatedInvoice);
        setEditedInvoice(prev => ({
          ...prev,
          ...newTotals
        }));
      }

      // Validate the field in real-time
      const fieldErrors = validateForm(updatedInvoice);
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }));
    };

    const handleCheckboxChange = (e) => {
      const { name, checked } = e.target;
      setEditedInvoice(prev => ({
        ...prev,
        [name]: checked,
        terms: checked ? TERMS_CONDITIONS : ""
      }));
    };

    // Add this function inside your InvoiceModal component
    // FIXED: recalculateTotals function in InvoiceModal
    // FIXED: recalculateTotals function in InvoiceModal
    const recalculateTotals = (invoiceData) => {
      const items = invoiceData.items || [];
      const receiverGST = invoiceData.receiver?.gstin || "";
      const taxSlab = invoiceData.taxSlab || 18;
      const tcsPercent = invoiceData.tcsPercent || 0;

      const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

      // FIX: Properly check if GSTIN starts with "24" for intra-state
      const isIntraState = receiverGST && receiverGST.startsWith("24");

      // Calculate GST
      const taxRate = taxSlab;
      const cgst = isIntraState ? +(subtotal * (taxRate / 2 / 100)).toFixed(2) : 0;
      const sgst = isIntraState ? +(subtotal * (taxRate / 2 / 100)).toFixed(2) : 0;
      const igst = !isIntraState ? +(subtotal * (taxRate / 100)).toFixed(2) : 0;

      // Calculate total before TCS
      const totalBeforeTCS = +(subtotal + cgst + sgst + igst).toFixed(2);

      // Calculate TCS
      const tcs = tcsPercent ? +(totalBeforeTCS * tcsPercent / 100).toFixed(2) : 0;

      // Final total
      const total = +(totalBeforeTCS + tcs).toFixed(2);

      return {
        subtotal,
        cgst,
        sgst,
        igst,
        tcs,
        total,
        isIntraState, // Make sure to return this flag
        taxSlab: taxRate // Also return taxSlab for consistency
      };
    };

    const handleSave = async () => {
      const formErrors = validateForm(editedInvoice);
      if (Object.keys(formErrors).length > 0) {
        setErrors(formErrors);
        toast.error("Please fix the errors before saving");
        return;
      }

      try {
        const success = await onUpdate(editedInvoice);
        if (success) {
          setIsEditing(false);
          setErrors({});
        }
      } catch (error) {
        console.error("Error updating invoice:", error);
      }
    };

    const handleExportJSON = () => {
      if (!invoice) return;

      const eInvoiceData = generateEInvoiceJSON(invoice);

      // Create and trigger download
      const blob = new Blob([JSON.stringify(eInvoiceData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eInvoice_${invoice.invoiceNumber}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const formatDate = (dateString) => {
      if (!dateString) return "";
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    };

    if (!invoice) return null;

    const totals = {
      subtotal: invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
      cgst: invoice.cgst || 0,
      sgst: invoice.sgst || 0,
      igst: invoice.igst || 0,
      total: invoice.total || 0,
      tcs: invoice.tcsPercent ?
        ((invoice.subtotal + (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0)) * invoice.tcsPercent / 100) : 0
    };

    const isIntraState = invoice.receiver.gstin?.startsWith("24");

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit Invoice" : `Tax Invoice: ${invoice.invoiceNumber}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              {/* Basic Invoice Details */}
              <div className="detail-row">
                <span className="detail-label">Invoice No:</span>
                <span className="detail-value">{invoice.invoiceNumber}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Invoice Date:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="date"
                      value={editedInvoice.invoiceDate || ''}
                      onChange={(e) => handleInputChange(e)}
                      name="invoiceDate"
                      className={`edit-input ${errors.invoiceDate ? 'error' : ''}`}
                    />
                    {errors.invoiceDate && <div className="error-message">{errors.invoiceDate}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{invoice.invoiceDate}</span>
                )}
              </div>
              {invoice.workOrderNumber && (
                <div className="detail-row">
                  <span className="detail-label">Work Order:</span>
                  <span className="detail-value">{invoice.workOrderNumber}</span>
                </div>
              )}

              {/* New PO Number and Date Fields */}
              {invoice.poNumber && (
                <div className="detail-row">
                  <span className="detail-label">PO Number:</span>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <input
                        type="text"
                        value={editedInvoice.poNumber || ''}
                        onChange={(e) => handleInputChange(e)}
                        name="poNumber"
                        className="edit-input"
                      />
                    </div>
                  ) : (
                    <span className="detail-value">{invoice.poNumber}</span>
                  )}
                </div>
              )}

              {invoice.poDate && (
                <div className="detail-row">
                  <span className="detail-label">PO Date:</span>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <input
                        type="date"
                        value={editedInvoice.poDate || ''}
                        onChange={(e) => handleInputChange(e)}
                        name="poDate"
                        className="edit-input"
                      />
                    </div>
                  ) : (
                    <span className="detail-value">{invoice.poDate}</span>
                  )}
                </div>
              )}

              {/* Receiver Details */}
              <div className="section-header">Receiver Details (Billed To)</div>
              <div className="detail-row">
                <span className="detail-label">Company Name:</span>
                <span className="detail-value">{invoice.receiver.companyName}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{invoice.receiver.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">GSTIN:</span>
                <span className="detail-value">{invoice.receiver.gstin}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Address:</span>
                <span className="detail-value">{invoice.receiver.address}</span>
              </div>
              <div className="address-details-row">
                <div className="detail-row">
                  <span className="detail-label">City:</span>
                  <span className="detail-value">{invoice.receiver.city || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Pincode:</span>
                  <span className="detail-value">{invoice.receiver.pincode || 'N/A'}</span>
                </div>
              </div>
              <div className="detail-row">
                <span className="detail-label">Contact:</span>
                <span className="detail-value">{invoice.receiver.contact}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{invoice.receiver.email}</span>
              </div>

              {/* Consignee Details */}
              <div className="section-header">Consignee Details (Shipped To)</div>
              <div className="detail-row">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{invoice.consignee.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">GSTIN:</span>
                <span className="detail-value">{invoice.consignee.gstin}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Address:</span>
                <span className="detail-value">{invoice.consignee.address}</span>
              </div>
              <div className="address-details-row">
                <div className="detail-row">
                  <span className="detail-label">City:</span>
                  <span className="detail-value">{invoice.consignee.city || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Pincode:</span>
                  <span className="detail-value">{invoice.consignee.pincode || 'N/A'}</span>
                </div>
              </div>
              <div className="detail-row">
                <span className="detail-label">Contact:</span>
                <span className="detail-value">{invoice.consignee.contact}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{invoice.consignee.email}</span>
              </div>

              {/* Items Section */}
              <div className="section-header">Products</div>
              <div className="items-grid">
                {invoice.items.map((item, index) => (
                  <div key={index} className="item-card">
                    <div className="item-header">
                      <span className="item-name">{item.name}</span>
                      <span className="item-hsn">HSN: {item.hsn || 'N/A'}</span>
                    </div>
                    <div className="item-details">
                      <span>Qty: {item.quantity} {item.units}</span>
                      <span>Rate: ₹{item.unitPrice.toFixed(2)}</span>
                      <span>Total: ₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Transport Details - EDITABLE FIELDS */}
              <div className="section-header">Transport Details</div>
              <div className="detail-row">
                <span className="detail-label">LR Number:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editedInvoice.lrNumber || ''}
                      onChange={(e) => handleInputChange(e)}
                      name="lrNumber"
                      className={`edit-input ${errors.lrNumber ? 'error' : ''}`}
                    />
                    {errors.lrNumber && <div className="error-message">{errors.lrNumber}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{invoice.lrNumber || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">LR Date:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="date"
                      value={editedInvoice.lrDate || ''}
                      onChange={(e) => handleInputChange(e)}
                      name="lrDate"
                      className={`edit-input ${errors.lrDate ? 'error' : ''}`}
                    />
                    {errors.lrDate && <div className="error-message">{errors.lrDate}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{invoice.lrDate || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Vehicle Number:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editedInvoice.vehicleNumber || ''}
                      onChange={(e) => handleInputChange(e)}
                      name="vehicleNumber"
                      className={`edit-input ${errors.vehicleNumber ? 'error' : ''}`}
                    />
                    {errors.vehicleNumber && <div className="error-message">{errors.vehicleNumber}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{invoice.vehicleNumber || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Transporter:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editedInvoice.transporter || ''}
                      onChange={(e) => handleInputChange(e)}
                      name="transporter"
                      className={`edit-input ${errors.transporter ? 'error' : ''}`}
                    />
                    {errors.transporter && <div className="error-message">{errors.transporter}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{invoice.transporter || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Mobile:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editedInvoice.transportMobile || ''}
                      onChange={(e) => handleInputChange(e)}
                      name="transportMobile"
                      className={`edit-input ${errors.transportMobile ? 'error' : ''}`}
                    />
                    {errors.transportMobile && <div className="error-message">{errors.transportMobile}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{invoice.transportMobile || 'N/A'}</span>
                )}
              </div>

              {invoice.extraNote && (
                <>
                  <div className="section-header">Additional Notes</div>
                  <div className="detail-row">
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea
                          value={editedInvoice.extraNote || ''}
                          onChange={(e) => handleInputChange(e)}
                          name="extraNote"
                          rows="3"
                          className="edit-textarea"
                        />
                      </div>
                    ) : (
                      <span className="detail-value">{invoice.extraNote}</span>
                    )}
                  </div>
                </>
              )}

              {invoice.terms && (
                <>
                  <div className="section-header">Terms & Conditions</div>
                  <div className="detail-row">
                    <pre className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{invoice.terms}</pre>
                  </div>
                </>
              )}

              {invoice.imageUrl && (
                <>
                  <div className="section-header">Uploaded Image</div>
                  <div className="detail-row">
                    <img
                      src={invoice.imageUrl}
                      alt="Invoice attachment"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '300px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </>
              )}

              {/* Tax Information - EDITABLE FIELD */}
              <div className="section-header">Tax Information</div>
              <div className="detail-row">
                <span className="detail-label">Tax Slab:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <select
                      value={editedInvoice.taxSlab || ''}
                      onChange={(e) => handleInputChange(e)}
                      name="taxSlab"
                      className={`edit-input ${errors.taxSlab ? 'error' : ''}`}
                    >
                      <option value="">Select Tax Slab</option>
                      {TAX_SLABS.map((slab) => (
                        <option key={slab.value} value={slab.value}>
                          {slab.label}
                        </option>
                      ))}
                    </select>
                    {errors.taxSlab && <div className="error-message">{errors.taxSlab}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{invoice.taxSlab}%</span>
                )}
              </div>

              {/* TCS Percentage - EDITABLE FIELD */}
              <div className="detail-row">
                <span className="detail-label">TCS %:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="number"
                      value={editedInvoice.tcsPercent || 0}
                      onChange={(e) => handleInputChange(e)}
                      name="tcsPercent"
                      min="0"
                      max="100"
                      step="0.01"
                      className={`edit-input ${errors.tcsPercent ? 'error' : ''}`}
                    />
                    {errors.tcsPercent && <div className="error-message">{errors.tcsPercent}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{invoice.tcsPercent || 0}%</span>
                )}
              </div>

              {/* Invoice Type & Terms Section */}
              <div className="section-header">Invoice Details</div>
              <div className="invoice-details-row">
                {/* Invoice Type */}
                <div className="detail-field">
                  <span className="detail-label">Invoice Type:</span>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <div className="radio-group horizontal">
                        <label className="radio-option">
                          <input
                            type="radio"
                            name="isServc"
                            value="N"
                            checked={editedInvoice.isServc === "N" || editedInvoice.isServc === undefined}
                            onChange={handleInputChange}
                          />
                          <span className="radio-label">Goods</span>
                        </label>
                        <label className="radio-option">
                          <input
                            type="radio"
                            name="isServc"
                            value="Y"
                            checked={editedInvoice.isServc === "Y"}
                            onChange={handleInputChange}
                          />
                          <span className="radio-label">Service</span>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <span className="detail-value">
                      {invoice.isServc === "Y" ? "Service" : (invoice.isServc === "N" ? "Goods" : "Not Set")}
                    </span>
                  )}
                </div>

                {/* Include Terms */}
                <div className="detail-field">
                  <span className="detail-label">Include Terms:</span>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <label className="checkbox-option">
                        <input
                          type="checkbox"
                          checked={editedInvoice.includeTerms || false}
                          onChange={handleCheckboxChange}
                          name="includeTerms"
                        />
                        <span className="checkbox-label">Include Terms</span>
                      </label>
                    </div>
                  ) : (
                    <span className="detail-value">{invoice.includeTerms ? 'Yes' : 'No'}</span>
                  )}
                </div>
              </div>

              {/* Totals Section */}
              <div className="section-header">Invoice Summary</div>
              {/* Totals Section */}
              {/* FIXED: Totals Section in InvoiceModal */}
              <div className="totals-section">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>₹{(isEditing ? editedInvoice.subtotal : invoice.subtotal || 0).toFixed(2)}</span>
                </div>

                {/* In edit mode, use the calculated values from editedInvoice */}
                {isEditing ? (
                  <>
                    {editedInvoice.cgst > 0 && (
                      <div className="total-row">
                        <span>CGST ({editedInvoice.taxSlab / 2}%):</span>
                        <span>₹{(editedInvoice.cgst || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {editedInvoice.sgst > 0 && (
                      <div className="total-row">
                        <span>SGST ({editedInvoice.taxSlab / 2}%):</span>
                        <span>₹{(editedInvoice.sgst || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {editedInvoice.igst > 0 && (
                      <div className="total-row">
                        <span>IGST ({editedInvoice.taxSlab}%):</span>
                        <span>₹{(editedInvoice.igst || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* In view mode, use the values from the original invoice */
                  <>
                    {invoice.cgst > 0 && (
                      <div className="total-row">
                        <span>CGST ({invoice.taxSlab / 2}%):</span>
                        <span>₹{(invoice.cgst || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {invoice.sgst > 0 && (
                      <div className="total-row">
                        <span>SGST ({invoice.taxSlab / 2}%):</span>
                        <span>₹{(invoice.sgst || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {invoice.igst > 0 && (
                      <div className="total-row">
                        <span>IGST ({invoice.taxSlab}%):</span>
                        <span>₹{(invoice.igst || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}

                {(isEditing ? editedInvoice.tcs : invoice.tcs || 0) > 0 && (
                  <div className="total-row">
                    <span>TCS ({isEditing ? editedInvoice.tcsPercent : invoice.tcsPercent}%):</span>
                    <span>₹{(isEditing ? editedInvoice.tcs : invoice.tcs || 0).toFixed(2)}</span>
                  </div>
                )}

                <div className="total-row grand-total">
                  <span>Total:</span>
                  <span>₹{(isEditing ? editedInvoice.total : invoice.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              className="export-btn"
              onClick={onExport}
              disabled={isExporting || !invoice}
            >
              {isExporting ? (
                <span>Exporting...</span>
              ) : (
                <>
                  <FaFileExport /> Export PDF
                </>
              )}
            </button>
            <button
              className="export-btn"
              onClick={handleExportJSON}
            >
              <FaFileCode /> Export JSON
            </button>
            <button
              className={`update-btn ${isEditing ? 'save-btn' : ''}`}
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
            >
              {isEditing ? "Save Changes" : "Update"}
            </button>
            <button
              className="delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <FaTrash /> Delete
            </button>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Are you sure you want to delete invoice {invoice.invoiceNumber}? This action cannot be undone.</p>
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
                    onDelete(invoice.invoiceNumber);
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

  // Upload Modal Component - OPTIMIZED VERSION
  const UploadModal = React.memo(({ invoice, onClose, onUploadComplete }) => {
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingExcel, setUploadingExcel] = useState(false);
    const [uploadStatus, setUploadStatus] = useState({
      image: invoice.imageUrl ? '✅ Image already uploaded' : '',
      excel: ''
    });

    const imageInputRef = useRef(null);
    const excelInputRef = useRef(null);

    // Memoize handlers to prevent unnecessary re-renders
    const handleImageUpload = useCallback(async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      setUploadingImage(true);
      setUploadStatus(prev => ({ ...prev, image: '📤 Uploading image...' }));

      try {
        // Get presigned URL from backend
        const presignedResponse = await axios.post(
          `${import.meta.env.VITE_API_URL}/s3/sales-presigned-url`,
          {
            invoiceNumber: invoice.invoiceNumber,
            fileType: file.type
          }
        );

        const { uploadUrl, fileUrl } = presignedResponse.data;

        // Upload file to S3
        await axios.put(uploadUrl, file, {
          headers: {
            "Content-Type": file.type
          }
        });

        // Save image URL to database
        await axios.put(
          `${import.meta.env.VITE_API_URL}/sales/update-sale-image/${invoice.invoiceNumber}`,
          { imageUrl: fileUrl }
        );

        setUploadStatus(prev => ({ ...prev, image: '✅ Image uploaded successfully!' }));
        onUploadComplete('image', fileUrl);
        toast.success('🎉 Image uploaded successfully!');

      } catch (error) {
        console.error('Error uploading image:', error);
        setUploadStatus(prev => ({ ...prev, image: '❌ Image upload failed' }));
        toast.error('Failed to upload image');
      } finally {
        setUploadingImage(false);
      }
    }, [invoice.invoiceNumber, onUploadComplete]);

    const handleExcelUpload = useCallback(async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.name.match(/\.(xlsx|xls)$/)) {
        toast.error('Please select an Excel file (.xlsx or .xls)');
        return;
      }

      setUploadingExcel(true);
      setUploadStatus(prev => ({ ...prev, excel: '📤 Processing Excel file...' }));

      try {
        const formData = new FormData();
        formData.append('excelFile', file);

        const response = await axios.put(
          `${import.meta.env.VITE_API_URL}/sales/update-einvoice-details/${invoice.invoiceNumber}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        const { ackDate, ackNo, irn } = response.data.data;
        setUploadStatus(prev => ({
          ...prev,
          excel: '✅ E-invoice details updated successfully!'
        }));

        onUploadComplete('excel', { ackDate, ackNo, irn });
        toast.success('📊 E-invoice details updated successfully!');

      } catch (error) {
        console.error('Error uploading Excel:', error);
        setUploadStatus(prev => ({ ...prev, excel: '❌ Excel upload failed' }));
        toast.error(error.response?.data?.message || 'Failed to process Excel file');
      } finally {
        setUploadingExcel(false);
      }
    }, [invoice.invoiceNumber, onUploadComplete]);

    const triggerImageInput = useCallback(() => {
      imageInputRef.current?.click();
    }, []);

    const triggerExcelInput = useCallback(() => {
      excelInputRef.current?.click();
    }, []);

    // Memoize expensive computations
    const hasEInvoiceDetails = useMemo(() =>
      invoice.irn || invoice.ackNo || invoice.ackDate,
      [invoice.irn, invoice.ackNo, invoice.ackDate]
    );

    return (
      <div className="upload-modal-overlay" onClick={onClose}>
        <div className="upload-modal-content" onClick={e => e.stopPropagation()}>
          <div className="upload-modal-header">
            <h3>Upload Files for Invoice: {invoice.invoiceNumber}</h3>
            <button className="upload-modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="upload-modal-body">
            {/* Show uploaded image preview if exists */}
            {invoice.imageUrl && (
              <div className="uploaded-image-preview">
                <h4>📷 Currently Uploaded Image</h4>
                <img
                  src={invoice.imageUrl}
                  alt="Uploaded invoice"
                  className="preview-image"
                  loading="lazy" // Lazy load image for better performance
                />
                <p className="preview-note">You can upload a new image to replace this one</p>
              </div>
            )}

            {/* Image Upload Section */}
            <div className="upload-section">
              <h4>
                {invoice.imageUrl ? '🔄 Update Invoice Image' : '📷 Upload Invoice Image'}
              </h4>
              <p>
                {invoice.imageUrl
                  ? 'Upload a new scanned copy or photo to replace current image'
                  : 'Upload scanned copy or photo of the invoice'
                }
              </p>
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <button
                className="upload-btn image-upload-btn"
                onClick={triggerImageInput}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <>
                    <FaSpinner className="spinner" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FaUpload />
                    {invoice.imageUrl ? 'Choose New Image' : 'Choose Image'}
                  </>
                )}
              </button>
              {uploadStatus.image && (
                <div className={`upload-status ${uploadStatus.image.includes('✅') ? 'success' : uploadStatus.image.includes('❌') ? 'error' : 'info'}`}>
                  {uploadStatus.image}
                </div>
              )}
            </div>

            <div className="upload-divider">
              <span>AND / OR</span>
            </div>

            {/* Excel Upload Section */}
            <div className="upload-section">
              <h4>📊 Upload E-Invoice Excel</h4>
              <p>Upload Excel file with IRN, Ack No, and Ack Date details</p>
              <input
                type="file"
                ref={excelInputRef}
                onChange={handleExcelUpload}
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
              />
              <button
                className="upload-btn excel-upload-btn"
                onClick={triggerExcelInput}
                disabled={uploadingExcel}
              >
                {uploadingExcel ? (
                  <>
                    <FaSpinner className="spinner" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FaFileExcel />
                    Choose Excel File
                  </>
                )}
              </button>
              {uploadStatus.excel && (
                <div className={`upload-status ${uploadStatus.excel.includes('✅') ? 'success' : uploadStatus.excel.includes('❌') ? 'error' : 'info'}`}>
                  {uploadStatus.excel}
                </div>
              )}
            </div>

            {/* Show e-invoice details if already uploaded */}
            {hasEInvoiceDetails && (
              <div className="existing-einvoice-details">
                <h4>📋 Current E-Invoice Details</h4>
                <div className="einvoice-details-grid">
                  {invoice.irn && (
                    <div className="detail-item">
                      <span className="label">IRN:</span>
                      <span className="value">{invoice.irn}</span>
                    </div>
                  )}
                  {invoice.ackNo && (
                    <div className="detail-item">
                      <span className="label">Ack No:</span>
                      <span className="value">{invoice.ackNo}</span>
                    </div>
                  )}
                  {invoice.ackDate && (
                    <div className="detail-item">
                      <span className="label">Ack Date:</span>
                      <span className="value">{invoice.ackDate}</span>
                    </div>
                  )}
                </div>
                <p className="preview-note">Upload new Excel file to update these details</p>
              </div>
            )}
          </div>

          <div className="upload-modal-footer">
            <button className="close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  });

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
          <h2>Tax Invoices</h2>
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Invoices..."
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
                <FaPlus /> {showForm ? "Close Form" : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>

        {isLoading && <div className="loading">Loading data...</div>}

        {showForm && (
          <div className="form-container premium">
            <h2>Create Tax Invoice.</h2>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ values, errors, submitCount, setFieldValue }) => {

                // console.log('Current form values:', values.items); 

                const totals = calculateTotals(
                  values.items,
                  values.receiver.gstin || "", // ✅ Correct parameter for receiverGST
                  {
                    tcsPercent: values.tcsPercent // ✅ Only TCS remains
                  },
                  values.taxSlab
                );

                useEffect(() => {
                  if (submitCount > 0 && Object.keys(errors).length > 0) {
                    Object.entries(errors).slice(0, 3).forEach(([field, error]) => {
                      if (field === "items" && Array.isArray(error)) {
                        error.forEach((itemError, index) => {
                          if (itemError && typeof itemError === "object") {
                            Object.entries(itemError).forEach(([key, val]) => {
                              toast.error(`Item ${index + 1} - ${key}: ${val}`);
                            });
                          }
                        });
                      } else if (typeof error === 'string') {
                        toast.error(`${field}: ${error}`);
                      }
                    });
                  }
                }, [submitCount, errors]);

                return (
                  <Form>
                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Invoice Number <span className="required">*</span></label>
                        <Field
                          name="invoiceNumber"
                          placeholder="Enter Invoice Number"
                          maxLength="7"
                        />
                        <ErrorMessage name="invoiceNumber" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>Invoice Date</label>
                        <Field name="invoiceDate" type="date" />
                      </div>
                      <div className="field-wrapper">
                        <label>Work Order</label>
                        <Select
                          className="react-select-container"
                          classNamePrefix="react-select"
                          options={workOrders.map(wo => ({
                            value: wo.workOrderNumber,
                            label: `${wo.workOrderNumber} - ${wo.receiver?.name}`,
                            woData: wo // Keep full work order data
                          }))}
                          onChange={(selectedOption) => {
                            if (selectedOption) {
                              handleWorkOrderSelect(
                                { target: { value: selectedOption.value } },
                                setFieldValue
                              );
                            }
                          }}
                          placeholder="Select Work Order"
                          isSearchable={true}
                          noOptionsMessage={() => "No work orders found"}
                        />
                      </div>

                      <div className="field-wrapper">
                        <label>PO Number</label>
                        <Field name="poNumber" placeholder="PO Number" />
                      </div>

                      {/* New PO Date field */}
                      <div className="field-wrapper">
                        <label>PO Date</label>
                        <Field name="poDate" type="date" />
                      </div>
                    </div>

                    <h3>Receiver (Billed To)</h3>
                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Company Name</label>
                        <Field name="receiver.companyName" placeholder="Company Name" />
                      </div>
                      <div className="field-wrapper">
                        <label>Contact Person</label>
                        <Field name="receiver.name" placeholder="Contact Person Name" />
                      </div>

                      <div className="field-wrapper" >
                        <label>GSTIN</label>
                        <Field name="receiver.gstin" readOnly />
                      </div>
                      <div className="field-wrapper">
                        <label>Contact</label>
                        <Field name="receiver.contact" readOnly />
                      </div>
                      <div className="field-wrapper">
                        <label>Email</label>
                        <Field name="receiver.email" type="email" readOnly />
                      </div>
                    </div>
                    <div className="form-group">
                      <Field name="receiver.address" as="textarea" placeholder="Receiver Address" readOnly />
                      <div className="address-details-row">
                        <Field name="receiver.city" placeholder="City" readOnly />
                        <Field name="receiver.pincode" placeholder="Pincode" readOnly />
                      </div>
                    </div>

                    <h3>Consignee (Shipped To)</h3>
                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Name</label>
                        <Field name="consignee.name" />
                      </div>
                      <div className="field-wrapper">
                        <label>GSTIN</label>
                        <Field name="consignee.gstin" />
                      </div>
                      <div className="field-wrapper">
                        <label>Contact</label>
                        <Field name="consignee.contact" />
                      </div>
                      <div className="field-wrapper">
                        <label>Email</label>
                        <Field name="consignee.email" type="email" />
                      </div>
                    </div>
                    <div className="form-group">
                      <Field name="consignee.address" as="textarea" placeholder="Consignee Address" />
                      <div className="address-details-row">
                        <Field name="consignee.city" placeholder="City" />
                        <Field name="consignee.pincode" placeholder="Pincode" />
                      </div>
                    </div>

                    <h3>Products Details</h3>
                    <FieldArray name="items">
                      {({ push, remove }) => (
                        <div className="form-items">
                          {values.items.map((item, index) => (
                            <div className="item-row" key={index}>
                              <Field name={`items.${index}.name`} placeholder="Item Name" readOnly />
                              <Field name={`items.${index}.description`} placeholder="Description" readOnly />
                              <Field name={`items.${index}.hsn`} placeholder="HSN Code" readOnly />
                              <div className="quantity-field sales-quantity">
                                <Field
                                  name={`items.${index}.quantity`}
                                  type="number"
                                  step="0.01"
                                  placeholder="Qty"
                                  min="0.01"
                                  onBlur={(e) => {
                                    const maxQty = item._remainingQty;
                                    const enteredValue = parseFloat(e.target.value);

                                    console.log('BLUR VALIDATION:', {
                                      item: item.name,
                                      entered: enteredValue,
                                      maxAllowed: maxQty,
                                      isValid: !isNaN(enteredValue) && enteredValue <= maxQty
                                    });

                                    if (isNaN(enteredValue)) return;

                                    // Validate minimum
                                    if (enteredValue < 0.01) {
                                      setFieldValue(`items.${index}.quantity`, 0.01);
                                      toast.warn("Minimum quantity is 0.01");
                                      return;
                                    }

                                    // Validate maximum - PREVENT values above max
                                    if (maxQty !== undefined && enteredValue > maxQty) {
                                      setFieldValue(`items.${index}.quantity`, maxQty);
                                      toast.warn(`Maximum quantity is ${maxQty}`);
                                      return;
                                    }
                                  }}
                                />
                                {item._remainingQty !== undefined && (
                                  <div className="quantity-hint">(max: {item._remainingQty})</div>
                                )}
                                <ErrorMessage
                                  name={`items.${index}.quantity`}
                                  component="div"
                                  className="error-message"
                                />
                              </div>
                              <Field className="sales-price" name={`items.${index}.unitPrice`} type="number" placeholder="Unit Price" />
                              <Field name={`items.${index}.units`} placeholder="Units" readOnly />
                              <button type="button" className="remove-btn" onClick={() => remove(index)}>
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </FieldArray>

                    <h3>Transport Details</h3>
                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>LR Number <span className="required">*</span></label>
                        <Field name="lrNumber" />
                        <ErrorMessage name="lrNumber" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>LR Date <span className="required">*</span></label>
                        <Field name="lrDate" type="date" />
                        <ErrorMessage name="lrDate" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>Vehicle Number <span className="required">*</span></label>
                        <Field name="vehicleNumber" placeholder="Vehicle Number" />
                        <ErrorMessage name="vehicleNumber" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>Transporter <span className="required">*</span></label>
                        <Field name="transporter" />
                        <ErrorMessage name="transporter" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>Mobile <span className="required">*</span></label>
                        <Field name="transportMobile" />
                        <ErrorMessage name="transportMobile" component="div" className="error-message" />
                      </div>
                    </div>

                    {/* Commented out other charges as requested */}
                    {/* <div className="field-wrapper other-charge">
                      <label>Other Charges</label>
                      <Field name="otherCharges" type="number" />
                    </div> */}

                    {/* Add this section before the totals */}
                    <h3>Additional Information</h3>
                    <div className="form-group">
                      <Field name="extraNote" as="textarea" rows="3" placeholder="Any additional notes or instructions" />
                    </div>

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

                    <h3>Service / Goods Type</h3>
                    <div className="form-group-row radio-section">
                      <div className="radio-group horizontal">
                        <label className="radio-option">
                          <Field type="radio" name="isServc" value="N" />
                          <span className="radio-label">Goods</span>
                        </label>
                        <label className="radio-option">
                          <Field type="radio" name="isServc" value="Y" />
                          <span className="radio-label">Service</span>
                        </label>
                      </div>
                    </div>

                    <h3>Additional Charges</h3>
                    <div className="form-group-row">

                      <div className="field-wrapper">
                        <label>TCS %</label> {/* Added TCS */}
                        <Field
                          name="tcsPercent"
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0-100%"
                          onInput={(e) => {
                            const value = parseInt(e.target.value);
                            if (isNaN(value)) return;
                            if (value > 100) {
                              e.target.value = 100;
                              setFieldValue("tcsPercent", 100);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="terms-checkbox">
                      <label>
                        <Field type="checkbox" name="includeTerms" />
                        Include Standard Terms & Conditions
                      </label>
                    </div>



                    <div className="totals">
                      <p>Subtotal: ₹{totals.subtotal.toFixed(2)}</p>

                      {/* GST calculations */}
                      {gstType === "intra" ? (
                        <>
                          <p>CGST ({values.taxSlab / 2}%): ₹{totals.cgst.toFixed(2)}</p>
                          <p>SGST ({values.taxSlab / 2}%): ₹{totals.sgst.toFixed(2)}</p>
                        </>
                      ) : (
                        <p>IGST ({values.taxSlab}%): ₹{totals.igst.toFixed(2)}</p>
                      )}

                      {/* Only show TCS if it has a value */}
                      {values.tcsPercent > 0 && (
                        <p>TCS: {values.tcsPercent}% - ₹{totals.tcs.toFixed(2)}</p>
                      )}

                      <p>Total: ₹{totals.total.toFixed(2)}</p>
                    </div>

                    <div className="submit-btn-container">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={isSubmitting ? "submitting" : "submit-btn"}
                      >
                        {isSubmitting ? "Submitting..." : "Submit Invoice"}
                      </button>
                    </div>
                  </Form>
                );
              }}
            </Formik>
          </div>
        )}

        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Company Name</th>
                <th>Receiver</th>
                <th>Total</th>
                <th>Upload</th> {/* New column for uploads */}
              </tr>
            </thead>
            <tbody>
              {showLoader ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="table-loader"></div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.invoiceNumber}
                    onClick={() => setSelectedInvoice(invoice)}
                    className={selectedInvoice?.invoiceNumber === invoice.invoiceNumber ? "selected" : ""}
                  >
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.invoiceDate}</td>
                    <td>{invoice.receiver.companyName}</td>
                    <td>{invoice.receiver.name}</td>
                    <td>₹{invoice.total.toFixed(2)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="upload-cell">
                        <button
                          className={`upload-files-btn ${invoice.imageUrl ? 'has-image' : ''}`}
                          onClick={() => setShowUploadModal(invoice)}
                        >
                          <FaUpload />
                          {invoice.imageUrl ? 'Uploaded' : 'Upload Files'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "none" }}>
          {selectedInvoice && <SalesPrint invoice={selectedInvoice} qrCodeUrl={qrCodeUrl || selectedInvoice.pdfUrl} taxSlab={selectedInvoice.taxSlab} />}        </div>

        {selectedInvoice && (
          <InvoiceModal
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            onExport={handleExportPDF}
            onUpdate={handleUpdateInvoice}
            onDelete={handleDeleteInvoice}
          />
        )}


        {showUploadModal && (
          <UploadModal
            invoice={showUploadModal}
            onClose={() => setShowUploadModal(null)}
            onUploadComplete={(type, data) => {
              // Refresh data or update state as needed
              if (type === 'image') {
                // Update image URL in state
                setInvoices(prev => prev.map(inv =>
                  inv.invoiceNumber === showUploadModal.invoiceNumber
                    ? { ...inv, imageUrl: data }
                    : inv
                ));
              } else if (type === 'excel') {
                // Update e-invoice details in state
                setInvoices(prev => prev.map(inv =>
                  inv.invoiceNumber === showUploadModal.invoiceNumber
                    ? { ...inv, ...data }
                    : inv
                ));
              }
            }}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Sales;