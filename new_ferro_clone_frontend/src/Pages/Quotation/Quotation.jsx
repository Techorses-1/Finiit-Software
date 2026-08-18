import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Formik, Form, Field, FieldArray, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import {
  FaPlus, FaFileExport, FaFileExcel, FaSearch, FaFileCode,
  FaSpinner, FaTrash, FaSave, FaEdit, FaFileAlt, FaCalendarAlt
} from "react-icons/fa";
import Navbar from "../../Components/Sidebar/Navbar";
import Select from 'react-select';
import axios from "axios";
import * as XLSX from 'xlsx';
import "react-toastify/dist/ReactToastify.css";
import "./Quotation.scss";
import html2pdf from "html2pdf.js";
import QuotationPrint from "./QuotationPrint";

const TAX_SLABS = [
  { label: '0.1%', value: 0.1 },
  { label: '5%', value: 5 },
  { label: '12%', value: 12 },
  { label: '18%', value: 18 },
  { label: '28%', value: 28 },
];

const TERMS_CONDITIONS = `
All quotations are valid for 30 days from the date of issue.
Prices are subject to change without notice.
Delivery is subject to availability of stock.
`;

const Quotation = () => {
  const [quotations, setQuotations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]); // CHANGED: from products to items
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showLoader, setShowLoader] = useState(false);
  const loaderTimeoutRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!selectedQuotation) {
      toast.warn("Select a quotation to export");
      return;
    }

    if (isExporting) return;
    setIsExporting(true);

    try {
      const element = document.getElementById("quotation-pdf");

      console.log("Starting PDF export...");

      // Generate PDF with margins
      await html2pdf()
        .from(element)
        .set({
          margin: [35, 10, 5, 10], // top=35mm, right=10mm, bottom=5mm, left=10mm
          filename: `${selectedQuotation.quotationNumber}_${selectedQuotation.party.name.replace(
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

      toast.success("PDF exported successfully!");
    } catch (error) {
      toast.error("Failed to export PDF");
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Get available items (not already selected)
  const getAvailableItems = useCallback((selectedItemIds) => {
    return items
      .filter(item => !selectedItemIds.includes(item.itemId))
      .map(item => ({
        value: item.itemId,
        label: `${item.itemName}`, // CHANGED: Simplified label
        itemData: item
      }));
  }, [items]);

  // Add debounce effect for search
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

  // Filter quotations based on search
  const filteredQuotations = useMemo(() => {
    if (!debouncedSearch) return quotations;

    return quotations.filter(quotation => {
      // Check quotation fields
      if (quotation.quotationId?.toLowerCase().includes(debouncedSearch)) return true;
      if (quotation.quotationNumber?.toLowerCase().includes(debouncedSearch)) return true;
      if (quotation.quotationDate?.toLowerCase().includes(debouncedSearch)) return true;
      if (quotation.internalDate?.toLowerCase().includes(debouncedSearch)) return true;
      if (quotation.refNo?.toLowerCase().includes(debouncedSearch)) return true;

      // Check party fields
      if (quotation.party?.companyName?.toLowerCase().includes(debouncedSearch)) return true;
      if (quotation.party?.name?.toLowerCase().includes(debouncedSearch)) return true;
      if (quotation.party?.gstin?.toLowerCase().includes(debouncedSearch)) return true;
      if (quotation.party?.address?.toLowerCase().includes(debouncedSearch)) return true;
      if (quotation.party?.contactNumber?.toLowerCase().includes(debouncedSearch)) return true;
      if (quotation.party?.email?.toLowerCase().includes(debouncedSearch)) return true;

      // Check items
      if (quotation.items?.some(item =>
        item.name?.toLowerCase().includes(debouncedSearch) ||
        item.description?.toLowerCase().includes(debouncedSearch) ||
        item.hsn?.toLowerCase().includes(debouncedSearch)
      )) return true;

      return false;
    });
  }, [debouncedSearch, quotations]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchQuotationsData(),
          axios.get(`${import.meta.env.VITE_API_URL}/customer/get-customers`).then(res =>
            setCustomers(res.data || [])
          ),
          // CHANGED: Fetch items instead of BOMs
          axios.get(`${import.meta.env.VITE_API_URL}/items/get-items`).then(res =>
            setItems(res.data || []) // CHANGED: Direct array, no res.data.data
          )
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

  // Fetch quotations
  const fetchQuotationsData = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/quotation/get-quotations`);
      const sortedQuotations = (response.data.data || []).sort((a, b) => {
        const dateDiff = new Date(b.createdAt) - new Date(a.createdAt);
        if (dateDiff !== 0) return dateDiff;
        return b.quotationNumber.localeCompare(a.quotationNumber);
      });
      setQuotations(sortedQuotations);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      toast.error("Failed to load quotations from database");
    }
  };

  // Initial form values
  const initialValues = {
    quotationId: "",
    quotationDate: new Date().toISOString().split("T")[0],
    internalDate: new Date().toISOString().split("T")[0],
    refNo: "",
    party: {
      name: "",
      companyName: "",
      gstin: "",
      address: "",
      address2: "",
      city: "",
      pincode: "",
      contactNumber: "",
      email: "",
      customerId: ""
    },
    items: [
      {
        itemId: "", // CHANGED: from bomId to itemId
        name: "",
        description: "",
        hsn: "",
        quantity: 1,
        unitPrice: "",
        units: ""
      }
    ],
    remarks: "",
    taxSlab: 18,
    tcsPercent: 0,
    includeTerms: false
  };

  // Validation schema
  const validationSchema = Yup.object().shape({
    quotationId: Yup.string()
      .required("Quotation ID is required")
      .matches(/^[a-zA-Z0-9]{1,7}$/, "Quotation ID must be 1-7 alphanumeric characters"),
    quotationDate: Yup.string().required("Quotation Date is required"),
    internalDate: Yup.string().required("Internal Date is required"),
    refNo: Yup.string(),
    party: Yup.object({
      name: Yup.string().required("Customer name required"),
      companyName: Yup.string().required("Company name required"),
      gstin: Yup.string().required("GSTIN required"),
      address: Yup.string().required("Address required"),
      city: Yup.string(),
      pincode: Yup.string(),
      contactNumber: Yup.string().required("Contact number required"),
      email: Yup.string().email("Invalid email").required("Email required")
    }),
    taxSlab: Yup.number()
      .required("Tax slab is required")
      .oneOf(TAX_SLABS.map(slab => slab.value), "Please select a valid tax slab"),
    items: Yup.array().of(
      Yup.object({
        name: Yup.string().required("Product name required"),
        quantity: Yup.number()
          .required("Quantity required")
          .moreThan(0, "Quantity must be greater than 0")
          .typeError("Quantity must be a number"),
        unitPrice: Yup.number().required("Unit price required").moreThan(0),
        units: Yup.string().required("Unit is required")
      })
    )
  });

  // Calculate totals (REMAINS SAME)
  const calculateTotals = (items, partyGST = "", taxSlab = 18, tcsPercent = 0) => {
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

  // Handle item selection - PREVENT DUPLICATES (CHANGED: from handleProductSelect)
  const handleItemSelect = (index, selectedOption, setFieldValue, values) => {
    if (selectedOption && selectedOption.value) {
      const item = items.find(i => i.itemId === selectedOption.value);
      if (item) {
        // Check if item is already selected in other items
        const isAlreadySelected = values.items.some((it, i) =>
          i !== index && it.itemId === selectedOption.value
        );

        if (isAlreadySelected) {
          toast.error("This item is already selected. Please choose a different item.");
          return;
        }

        setFieldValue(`items.${index}.itemId`, item.itemId); // CHANGED: itemId
        setFieldValue(`items.${index}.name`, item.itemName); // CHANGED: itemName
        setFieldValue(`items.${index}.description`, item.description);
        setFieldValue(`items.${index}.hsn`, item.hsnCode); // CHANGED: hsnCode
        setFieldValue(`items.${index}.units`, item.unit || "NOS"); // CHANGED: unit
      }
    }
  };

  // Handle customer selection (REMAINS SAME)
  const handleCustomerSelect = (selectedOption, setFieldValue) => {
    if (selectedOption && selectedOption.customerData) {
      const customer = selectedOption.customerData;

      // Set all customer fields properly
      setFieldValue("party.name", customer.customerName || "");
      setFieldValue("party.companyName", customer.companyName || "");
      setFieldValue("party.gstin", customer.gstNumber || "");
      setFieldValue("party.address", customer.address || "");
      setFieldValue("party.address2", customer.address2 || "");
      setFieldValue("party.city", customer.city || "");
      setFieldValue("party.pincode", customer.pincode || "");
      setFieldValue("party.contactNumber", customer.contactNumber || "");
      setFieldValue("party.email", customer.email || "");
      setFieldValue("party.customerId", customer.customerId || "");
    }
  };

  // Handle form submission (REMAINS SAME)
  const handleSubmit = async (values, { resetForm }) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Check if quotation ID already exists
    const existingQuotation = quotations.find(q => q.quotationId === values.quotationId);
    if (existingQuotation) {
      toast.error("Quotation ID already exists. Please use a unique ID.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/quotation/create-quotation`,
        values
      );

      setQuotations(prev => [response.data.data, ...prev]);
      toast.success("Quotation created successfully!");
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error("Error creating quotation:", err);
      toast.error(err.response?.data?.message || "Failed to save quotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle export to Excel (REMAINS SAME)
  const handleExportExcel = () => {
    if (quotations.length === 0) {
      toast.warn("No quotations to export");
      return;
    }

    const data = quotations.map(quotation => ({
      'Quotation No': quotation.quotationNumber,
      'Quotation ID': quotation.quotationId,
      'Date': quotation.quotationDate,
      'Ref No': quotation.refNo || '',
      'Customer': quotation.party.name,
      'Company': quotation.party.companyName,
      'Subtotal': quotation.subtotal?.toFixed(2),
      'Tax': (quotation.cgst + quotation.sgst + quotation.igst)?.toFixed(2),
      'TCS': quotation.tcs?.toFixed(2),
      'Total': quotation.total?.toFixed(2),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Quotations");
    XLSX.writeFile(workbook, "Quotations.xlsx");
    toast.success("Exported all quotations to Excel");
  };

  // Handle update quotation (REMAINS SAME)
  const handleUpdateQuotation = async (updatedQuotation) => {
    try {
      const { createdAt, updatedAt, quotationNumber, ...updateData } = updatedQuotation;

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/quotation/update-quotation/${updatedQuotation.quotationId}`,
        updateData
      );

      if (response.data.success) {
        setQuotations(prev =>
          prev.map(q =>
            q.quotationId === updatedQuotation.quotationId ? response.data.data : q
          )
        );

        if (selectedQuotation && selectedQuotation.quotationId === updatedQuotation.quotationId) {
          setSelectedQuotation(response.data.data);
        }

        toast.success("Quotation updated successfully!");
        return true;
      } else {
        toast.error("Failed to update quotation");
        return false;
      }
    } catch (error) {
      console.error("Error updating quotation:", error);
      toast.error(error.response?.data?.message || "Error updating quotation");
      return false;
    }
  };

  // Handle delete quotation (REMAINS SAME)
  const handleDeleteQuotation = async (quotationId) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/quotation/delete-quotation/${quotationId}`
      );

      setQuotations(prev =>
        prev.filter(q => q.quotationId !== quotationId)
      );
      setSelectedQuotation(null);
      toast.success("Quotation deleted successfully!");
    } catch (error) {
      console.error("Error deleting quotation:", error);
      toast.error(error.response?.data?.message || "Error deleting quotation");
    }
  };

  // Quotation Modal Component (REMAINS SAME - works with itemId)
  const QuotationModal = ({ quotation, onClose, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedQuotation, setEditedQuotation] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    useEffect(() => {
      if (quotation) {
        setEditedQuotation({ ...quotation });
        setErrors({});
      }
    }, [quotation]);

    // Validation function (REMAINS SAME)
    const validateForm = (values) => {
      const newErrors = {};

      if (!values.quotationDate) newErrors.quotationDate = "Quotation Date is required";
      if (!values.internalDate) newErrors.internalDate = "Internal Date is required";
      if (!values.taxSlab) newErrors.taxSlab = "Tax slab is required";

      return newErrors;
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;

      let processedValue = value;
      if (name === "taxSlab" || name === "tcsPercent") {
        processedValue = value === "" ? "" : Number(value);
      }

      const updatedQuotation = { ...editedQuotation, [name]: processedValue };
      setEditedQuotation(updatedQuotation);

      // Recalculate totals if tax-related fields change
      if (name === "taxSlab" || name === "tcsPercent") {
        const newTotals = recalculateTotals(updatedQuotation);
        setEditedQuotation(prev => ({
          ...prev,
          ...newTotals
        }));
      }

      const fieldErrors = validateForm(updatedQuotation);
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }));
    };

    const handlePartyChange = (e) => {
      const { name, value } = e.target;
      const fieldName = name.replace('party.', '');

      setEditedQuotation(prev => ({
        ...prev,
        party: {
          ...prev.party,
          [fieldName]: value
        }
      }));
    };

    const handleCheckboxChange = (e) => {
      const { name, checked } = e.target;
      setEditedQuotation(prev => ({
        ...prev,
        [name]: checked,
        terms: checked ? TERMS_CONDITIONS : ""
      }));
    };

    const recalculateTotals = (quotationData) => {
      const items = quotationData.items || [];
      const partyGST = quotationData.party?.gstin || "";
      const taxSlab = quotationData.taxSlab || 18;
      const tcsPercent = quotationData.tcsPercent || 0;

      const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
      const isIntraState = partyGST && partyGST.startsWith("24");

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

    const handleSave = async () => {
      const formErrors = validateForm(editedQuotation);
      if (Object.keys(formErrors).length > 0) {
        setErrors(formErrors);
        toast.error("Please fix the errors before saving");
        return;
      }

      try {
        const success = await onUpdate(editedQuotation);
        if (success) {
          setIsEditing(false);
          setErrors({});
        }
      } catch (error) {
        console.error("Error updating quotation:", error);
      }
    };

    if (!quotation) return null;

    const totals = {
      subtotal: quotation.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
      cgst: quotation.cgst || 0,
      sgst: quotation.sgst || 0,
      igst: quotation.igst || 0,
      total: quotation.total || 0,
      tcs: quotation.tcs || 0
    };

    const isIntraState = quotation.party.gstin?.startsWith("24");

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit Quotation" : `Quotation: ${quotation.quotationNumber}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="quotation-details-grid">
              {/* Basic Quotation Details */}
              <div className="detail-row">
                <span className="detail-label">Quotation ID:</span>
                <span className="detail-value">{quotation.quotationId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Quotation No:</span>
                <span className="detail-value">{quotation.quotationNumber}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Quotation Date:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="date"
                      value={editedQuotation.quotationDate || ''}
                      onChange={handleInputChange}
                      name="quotationDate"
                      className={`edit-input ${errors.quotationDate ? 'error' : ''}`}
                    />
                    {errors.quotationDate && <div className="error-message">{errors.quotationDate}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{quotation.quotationDate}</span>
                )}
              </div>

              {/* Ref No field */}
              <div className="detail-row">
                <span className="detail-label">Ref No:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editedQuotation.refNo || ''}
                      onChange={handleInputChange}
                      name="refNo"
                      placeholder="Optional reference number"
                      className="edit-input"
                    />
                  </div>
                ) : (
                  <span className="detail-value">{quotation.refNo || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Date:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="date"
                      value={editedQuotation.internalDate || ''}
                      onChange={handleInputChange}
                      name="internalDate"
                      className={`edit-input ${errors.internalDate ? 'error' : ''}`}
                    />
                    {errors.internalDate && <div className="error-message">{errors.internalDate}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{quotation.internalDate}</span>
                )}
              </div>

              {/* Customer Details Section */}
              <div className="section-header">
                Customer Details
                {isEditing && (
                  <span className="edit-note">(Editable in edit mode)</span>
                )}
              </div>

              {isEditing ? (
                // EDIT MODE
                <>
                  <div className="detail-row">
                    <span className="detail-label">Customer Name:</span>
                    <div className="edit-field-container">
                      <input
                        type="text"
                        value={editedQuotation.party?.name || ''}
                        onChange={handlePartyChange}
                        name="party.name"
                        placeholder="Customer Name"
                        className="edit-input"
                      />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Company Name:</span>
                    <div className="edit-field-container">
                      <input
                        type="text"
                        value={editedQuotation.party?.companyName || ''}
                        onChange={handlePartyChange}
                        name="party.companyName"
                        placeholder="Company Name"
                        className="edit-input"
                      />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">GSTIN:</span>
                    <div className="edit-field-container">
                      <input
                        type="text"
                        value={editedQuotation.party?.gstin || ''}
                        onChange={handlePartyChange}
                        name="party.gstin"
                        placeholder="GSTIN"
                        className="edit-input"
                      />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Address:</span>
                    <div className="edit-field-container">
                      <textarea
                        value={editedQuotation.party?.address || ''}
                        onChange={handlePartyChange}
                        name="party.address"
                        placeholder="Address"
                        rows="2"
                        className="edit-textarea"
                      />
                    </div>
                  </div>
                  <div className="address-details-row">
                    <div className="detail-row">
                      <span className="detail-label">City:</span>
                      <div className="edit-field-container">
                        <input
                          type="text"
                          value={editedQuotation.party?.city || ''}
                          onChange={handlePartyChange}
                          name="party.city"
                          placeholder="City"
                          className="edit-input"
                        />
                      </div>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Pincode:</span>
                      <div className="edit-field-container">
                        <input
                          type="text"
                          value={editedQuotation.party?.pincode || ''}
                          onChange={handlePartyChange}
                          name="party.pincode"
                          placeholder="Pincode"
                          className="edit-input"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Contact:</span>
                    <div className="edit-field-container">
                      <input
                        type="text"
                        value={editedQuotation.party?.contactNumber || ''}
                        onChange={handlePartyChange}
                        name="party.contactNumber"
                        placeholder="Contact Number"
                        className="edit-input"
                      />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Email:</span>
                    <div className="edit-field-container">
                      <input
                        type="email"
                        value={editedQuotation.party?.email || ''}
                        onChange={handlePartyChange}
                        name="party.email"
                        placeholder="Email"
                        className="edit-input"
                      />
                    </div>
                  </div>
                </>
              ) : (
                // VIEW MODE
                <>
                  <div className="detail-row">
                    <span className="detail-label">Customer Name:</span>
                    <span className="detail-value">{quotation.party.name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Company Name:</span>
                    <span className="detail-value">{quotation.party.companyName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">GSTIN:</span>
                    <span className="detail-value">{quotation.party.gstin}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Address:</span>
                    <span className="detail-value">{quotation.party.address}</span>
                  </div>
                  <div className="address-details-row">
                    <div className="detail-row">
                      <span className="detail-label">City:</span>
                      <span className="detail-value">{quotation.party.city || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Pincode:</span>
                      <span className="detail-value">{quotation.party.pincode || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Contact:</span>
                    <span className="detail-value">{quotation.party.contactNumber}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{quotation.party.email}</span>
                  </div>
                </>
              )}

              {/* Items Section */}
              <div className="section-header">Items</div>
              <div className="items-grid">
                {quotation.items.map((item, index) => (
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

              {/* Remarks */}
              {quotation.remarks && (
                <>
                  <div className="section-header">Remarks</div>
                  <div className="detail-row">
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea
                          value={editedQuotation.remarks || ''}
                          onChange={handleInputChange}
                          name="remarks"
                          rows="3"
                          className="edit-textarea"
                        />
                      </div>
                    ) : (
                      <span className="detail-value">{quotation.remarks}</span>
                    )}
                  </div>
                </>
              )}

              {/* Tax Information */}
              <div className="section-header">Tax Information</div>
              <div className="detail-row">
                <span className="detail-label">Tax Slab:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <select
                      value={editedQuotation.taxSlab || ''}
                      onChange={handleInputChange}
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
                  <span className="detail-value">{quotation.taxSlab}%</span>
                )}
              </div>

              {/* TCS Percentage */}
              <div className="detail-row">
                <span className="detail-label">TCS %:</span>
                {isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="number"
                      value={editedQuotation.tcsPercent || 0}
                      onChange={handleInputChange}
                      name="tcsPercent"
                      min="0"
                      max="100"
                      step="0.01"
                      className={`edit-input ${errors.tcsPercent ? 'error' : ''}`}
                    />
                  </div>
                ) : (
                  <span className="detail-value">{quotation.tcsPercent || 0}%</span>
                )}
              </div>

              {/* Terms & Conditions */}
              {quotation.terms && (
                <>
                  <div className="section-header">Terms & Conditions</div>
                  <div className="detail-row">
                    <pre className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>
                      {quotation.terms}
                    </pre>
                  </div>
                </>
              )}

              {/* Totals Section */}
              <div className="section-header">Quotation Summary</div>
              <div className="totals-section">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>₹{(isEditing ? editedQuotation.subtotal : quotation.subtotal || 0).toFixed(2)}</span>
                </div>

                {isEditing ? (
                  <>
                    {editedQuotation.cgst > 0 && (
                      <div className="total-row">
                        <span>CGST ({editedQuotation.taxSlab / 2}%):</span>
                        <span>₹{(editedQuotation.cgst || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {editedQuotation.sgst > 0 && (
                      <div className="total-row">
                        <span>SGST ({editedQuotation.taxSlab / 2}%):</span>
                        <span>₹{(editedQuotation.sgst || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {editedQuotation.igst > 0 && (
                      <div className="total-row">
                        <span>IGST ({editedQuotation.taxSlab}%):</span>
                        <span>₹{(editedQuotation.igst || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {quotation.cgst > 0 && (
                      <div className="total-row">
                        <span>CGST ({quotation.taxSlab / 2}%):</span>
                        <span>₹{(quotation.cgst || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {quotation.sgst > 0 && (
                      <div className="total-row">
                        <span>SGST ({quotation.taxSlab / 2}%):</span>
                        <span>₹{(quotation.sgst || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {quotation.igst > 0 && (
                      <div className="total-row">
                        <span>IGST ({quotation.taxSlab}%):</span>
                        <span>₹{(quotation.igst || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}

                {(isEditing ? editedQuotation.tcs : quotation.tcs || 0) > 0 && (
                  <div className="total-row">
                    <span>TCS ({isEditing ? editedQuotation.tcsPercent : quotation.tcsPercent}%):</span>
                    <span>₹{(isEditing ? editedQuotation.tcs : quotation.tcs || 0).toFixed(2)}</span>
                  </div>
                )}

                <div className="total-row grand-total">
                  <span>Total:</span>
                  <span>₹{(isEditing ? editedQuotation.total : quotation.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              className="export-btn"
              onClick={handleExportPDF}
              disabled={isExporting || !quotation}
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
              className={`update-btn ${isEditing ? 'save-btn' : ''}`}
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
            >
              {isEditing ? <FaSave /> : <FaEdit />}
              {isEditing ? "Save Changes" : "Edit"}
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
              <p>Are you sure you want to delete quotation {quotation.quotationNumber}? This action cannot be undone.</p>
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
                    onDelete(quotation.quotationId);
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

      <div className="main">
        <div className="page-header">
          <h2>Quotations</h2>
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Quotations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="page-actions">
              <button className="export-btn" onClick={handleExportExcel}>
                <FaFileExcel /> Export All
              </button>
              <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                <FaPlus /> {showForm ? "Close Form" : "Create Quotation"}
              </button>
            </div>
          </div>
        </div>

        {isLoading && <div className="loading">Loading data...</div>}

        {showForm && (
          <div className="form-container premium">
            <div className="form-header-with-date">
              <h2>Create Quotation</h2>
            </div>

            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ values, errors, submitCount, setFieldValue }) => {
                const totals = calculateTotals(
                  values.items,
                  values.party.gstin || "",
                  values.taxSlab,
                  values.tcsPercent
                );

                // Get selected item IDs for filtering
                const selectedItemIds = values.items.map(item => item.itemId).filter(id => id);

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
                        <label>Quotation ID <span className="required">*</span></label>
                        <Field
                          name="quotationId"
                          placeholder="Enter Quotation ID (1-7 chars)"
                          maxLength="7"
                        />
                        <ErrorMessage name="quotationId" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>Quotation Date <span className="required">*</span></label>
                        <Field name="quotationDate" type="date" />
                        <ErrorMessage name="quotationDate" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>Ref No (Optional)</label>
                        <Field
                          name="refNo"
                          placeholder="Enter reference number"
                        />
                      </div>
                      <div className="field-wrapper">
                        <label>Date <span className="required">*</span></label>
                        <Field name="internalDate" type="date" />
                        <ErrorMessage name="internalDate" component="div" className="error-message" />
                      </div>
                    </div>

                    <h3>Customer Details</h3>
                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Select Customer</label>
                        <Select
                          className="react-select-container"
                          classNamePrefix="react-select"
                          options={customers.map(customer => ({
                            value: customer.customerId,
                            label: `${customer.companyName} - ${customer.customerName}`,
                            customerData: customer
                          }))}
                          onChange={(selectedOption) => handleCustomerSelect(selectedOption, setFieldValue)}
                          placeholder="Search and select customer"
                          isSearchable={true}
                          noOptionsMessage={() => "No customers found"}
                        />
                      </div>
                    </div>

                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Customer Name <span className="required">*</span></label>
                        <Field name="party.name" placeholder="Customer Name" />
                        <ErrorMessage name="party.name" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>Company Name <span className="required">*</span></label>
                        <Field name="party.companyName" placeholder="Company Name" />
                        <ErrorMessage name="party.companyName" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>GSTIN <span className="required">*</span></label>
                        <Field name="party.gstin" placeholder="GSTIN" />
                        <ErrorMessage name="party.gstin" component="div" className="error-message" />
                      </div>
                    </div>

                    <div className="form-group">
                      <Field name="party.address" as="textarea" placeholder="Customer Address" />
                      <div className="address-details-row">
                        <Field name="party.city" placeholder="City" />
                        <Field name="party.pincode" placeholder="Pincode" />
                      </div>
                    </div>

                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Contact Number <span className="required">*</span></label>
                        <Field name="party.contactNumber" placeholder="Contact Number" />
                        <ErrorMessage name="party.contactNumber" component="div" className="error-message" />
                      </div>
                      <div className="field-wrapper">
                        <label>Email <span className="required">*</span></label>
                        <Field name="party.email" type="email" placeholder="Email" />
                        <ErrorMessage name="party.email" component="div" className="error-message" />
                      </div>
                    </div>

                    <h3>Items</h3> {/* CHANGED: from Products to Items */}
                    <FieldArray name="items">
                      {({ push, remove }) => (
                        <div className="form-items">
                          {values.items.map((item, index) => (
                            <div className="item-row" key={index}>
                              <div className="field-wrapper">
                                <Select
                                  className="react-select-container"
                                  classNamePrefix="react-select"
                                  options={getAvailableItems(selectedItemIds)}
                                  value={item.itemId ? {
                                    value: item.itemId,
                                    label: item.name
                                  } : null}
                                  onChange={(selectedOption) =>
                                    handleItemSelect(index, selectedOption, setFieldValue, values)
                                  }
                                  placeholder="Items" 
                                  isSearchable={true}
                                  noOptionsMessage={() => "No items available"} 
                                />
                              </div>
                              <Field name={`items.${index}.name`} placeholder="Item Name" readOnly /> {/* CHANGED: from Product Name to Item Name */}
                              <Field name={`items.${index}.description`} placeholder="Description" readOnly />
                              <Field name={`items.${index}.hsn`} placeholder="HSN Code" readOnly />
                              <div className="quantity-field quatation-quantity-field">
                                <Field
                                  name={`items.${index}.quantity`}
                                  type="number"
                                  step="1"
                                  placeholder="Qty"
                                  min="1"
                                />
                                <ErrorMessage
                                  name={`items.${index}.quantity`}
                                  component="div"
                                  className="error-message"
                                />
                              </div>
                              <Field
                                name={`items.${index}.unitPrice`}
                                type="number"
                                placeholder="Unit Price"
                                min="0.01"
                                step="0.01"
                              />
                              <Field name={`items.${index}.units`} placeholder="Units" readOnly />
                              {values.items.length > 1 && (
                                <button type="button" className="remove-btn" onClick={() => remove(index)}>
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                          {getAvailableItems(selectedItemIds).length > 0 && (
                            <button
                              type="button"
                              className="add-btn"
                              onClick={() => push({
                                itemId: "", // CHANGED: from bomId to itemId
                                name: "",
                                description: "",
                                hsn: "",
                                quantity: 1,
                                unitPrice: "",
                                units: ""
                              })}
                            >
                              <FaPlus /> Add Item {/* CHANGED: from Add Product to Add Item */}
                            </button>
                          )}
                        </div>
                      )}
                    </FieldArray>

                    <h3>Additional Information</h3>
                    <div className="form-group">
                      <Field
                        name="remarks"
                        as="textarea"
                        rows="3"
                        placeholder="Remarks (optional)"
                      />
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
                      <div className="field-wrapper">
                        <label>TCS %</label>
                        <Field
                          name="tcsPercent"
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0-100%"
                          step="0.01"
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
                      {totals.isIntraState ? (
                        <>
                          <p>CGST ({values.taxSlab / 2}%): ₹{totals.cgst.toFixed(2)}</p>
                          <p>SGST ({values.taxSlab / 2}%): ₹{totals.sgst.toFixed(2)}</p>
                        </>
                      ) : (
                        <p>IGST ({values.taxSlab}%): ₹{totals.igst.toFixed(2)}</p>
                      )}
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
                        {isSubmitting ? (
                          <>
                            <FaSpinner className="spinner" /> Submitting...
                          </>
                        ) : "Create Quotation"}
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
                <th>Quotation No</th>
                <th>Quotation ID</th>
                <th>Date</th>
                <th>Ref No</th>
                <th>Customer</th>
                <th>Company</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {showLoader ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="table-loader"></div>
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quotation) => (
                  <tr
                    key={quotation.quotationId}
                    onClick={() => setSelectedQuotation(quotation)}
                    className={selectedQuotation?.quotationId === quotation.quotationId ? "selected" : ""}
                  >
                    <td>{quotation.quotationNumber}</td>
                    <td>{quotation.quotationId}</td>
                    <td>{quotation.quotationDate}</td>
                    <td>{quotation.refNo || '-'}</td>
                    <td>{quotation.party.name}</td>
                    <td>{quotation.party.companyName}</td>
                    <td>₹{quotation.total.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedQuotation && (
          <QuotationModal
            quotation={selectedQuotation}
            onClose={() => setSelectedQuotation(null)}
            onUpdate={handleUpdateQuotation}
            onDelete={handleDeleteQuotation}
          />
        )}

        <div style={{ display: "none" }}>
          {selectedQuotation && <QuotationPrint quotation={selectedQuotation} />}
        </div>

      </div>
    </Navbar>
  );
};

export default Quotation;