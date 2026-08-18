import React, { useState, useEffect, useRef, useMemo } from "react";
import { Formik, Form, Field, FieldArray } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { FaPlus, FaFileExport, FaFileExcel, FaSearch, FaTrash, FaEdit, FaSave, FaUpload } from "react-icons/fa";
import Navbar from "../../Components/Sidebar/Navbar";
import html2pdf from "html2pdf.js";
import BOMPrint from "./BOMPrint";
import "react-toastify/dist/ReactToastify.css";
import "./Bom.scss";
import axios from "axios";
import * as XLSX from "xlsx";
import Select from 'react-select';

const Bom = () => {
  const [boms, setBoms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState(null);
  const [isEditingBOM, setIsEditingBOM] = useState(false);
  const [editedBOM, setEditedBOM] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showLoader, setShowLoader] = useState(false);
  const loaderTimeoutRef = useRef(null);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);


  // Bulk Upload Functions
  const handleBulkUploadClick = () => {
    setShowBulkUpload(true);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid Excel file (.xlsx, .xls, .csv)');
      return;
    }

    processExcelFile(file);
  };

  const processExcelFile = (file) => {
    setIsUploading(true);
    setUploadProgress(0);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        processBOMData(jsonData);
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error('Error processing Excel file');
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      toast.error('Error reading file');
      setIsUploading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const processBOMData = async (excelData) => {
    try {
      const bomsToCreate = [];
      const bomMap = new Map();

      excelData.forEach((row, index) => {
        const bomId = row['BOM ID'];
        if (!bomId) {
          toast.warning(`Row ${index + 1}: Skipped - No BOM ID found`);
          return;
        }

        if (!bomMap.has(bomId)) {
          bomMap.set(bomId, {
            bomId: bomId,
            productName: row['Product Name'] || 'No Product Name',
            description: row['Description'] || '',
            hsnCode: row['HSN Code'] || '',
            items: []
          });
        }

        // Extract items
        const bom = bomMap.get(bomId);
        let itemIndex = 1;
        let itemsAdded = 0;

        while (row[`Item ${itemIndex} - Name`]) {
          const itemName = row[`Item ${itemIndex} - Name`];
          const itemId = row[`Item ${itemIndex} - ID`];
          const requiredQty = parseFloat(row[`Item ${itemIndex} - Required Qty`]) || 0;

          if (itemName && itemId) {
            bom.items.push({
              itemId: itemId,
              itemName: itemName,
              itemDescription: row[`Item ${itemIndex} - Description`] || '',
              requiredQty: requiredQty
            });
            itemsAdded++;
          }
          itemIndex++;
        }

        if (itemsAdded === 0) {
          toast.warning(`BOM ${bomId}: No valid items found`);
        }

        // Update progress
        const processingProgress = Math.round(((index + 1) / excelData.length) * 50); // 50% for processing
        setUploadProgress(processingProgress);
      });

      // Convert map to array
      bomsToCreate.push(...bomMap.values());

      if (bomsToCreate.length === 0) {
        toast.error('No valid BOM data found in the file');
        setIsUploading(false);
        return;
      }

      toast.info(`📊 Found ${bomsToCreate.length} BOMs to upload`);

      // Upload BOMs to backend
      await uploadBOMsToDatabase(bomsToCreate);

    } catch (error) {
      console.error('Error processing BOM data:', error);
      toast.error('❌ Error processing Excel file data');
      setIsUploading(false);
    }
  };

  const uploadBOMsToDatabase = async (bomsToCreate) => {
    try {
      setIsUploading(true);
      setUploadProgress(10); // Start progress

      // Use the BULK CREATE endpoint
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/bom/bulk-create-boms`,
        { boms: bomsToCreate }
      );

      setUploadProgress(80); // Almost done

      if (response.data.success) {
        // Refresh BOMs list
        const bomResponse = await axios.get(`${import.meta.env.VITE_API_URL}/bom/get-boms`);
        const sortedBOMs = bomResponse.data.data.sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setBoms(sortedBOMs);

        setUploadProgress(100);

        const successCount = response.data.data.successful?.length || 0;
        const errorCount = response.data.data.failed?.length || 0;

        // Show detailed success message
        if (successCount > 0 && errorCount === 0) {
          toast.success(`✅ All ${successCount} BOMs uploaded successfully!`);
        } else if (successCount > 0 && errorCount > 0) {
          toast.warning(`⚠️ ${successCount} BOMs successful, ${errorCount} failed`);

          // Show failed BOM details
          if (response.data.data.failed && response.data.data.failed.length > 0) {
            response.data.data.failed.forEach((failedBom, index) => {
              if (index < 3) { // Show first 3 errors to avoid spam
                toast.error(`Failed: ${failedBom.bomId} - ${failedBom.error}`);
              }
            });
            if (response.data.data.failed.length > 3) {
              toast.error(`... and ${response.data.data.failed.length - 3} more failures`);
            }
          }
        } else {
          toast.error('❌ All BOMs failed to upload');

          // Show all errors
          if (response.data.data.failed && response.data.data.failed.length > 0) {
            response.data.data.failed.forEach((failedBom, index) => {
              if (index < 5) { // Show first 5 errors
                toast.error(`Failed: ${failedBom.bomId} - ${failedBom.error}`);
              }
            });
          }
        }

      } else {
        toast.error(`❌ Bulk upload failed: ${response.data.message}`);
      }

    } catch (error) {
      console.error('Error uploading BOMs:', error);

      if (error.response) {
        // Server responded with error status
        toast.error(`❌ Server Error: ${error.response.data.message || error.response.statusText}`);
      } else if (error.request) {
        // Network error
        toast.error('❌ Network Error: Cannot connect to server');
      } else {
        // Other errors
        toast.error(`❌ Upload Failed: ${error.message}`);
      }
    } finally {
      setIsUploading(false);
      setShowBulkUpload(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = () => {
    const templateData = [{
      'BOM ID': 'BOM0001',
      'Product Name': 'Sample Product',
      'Description': 'Sample product description',
      'HSN Code': '123456',
      'Total Items': '2',
      'Item 1 - Name': 'Item One',
      'Item 1 - ID': 'ITEM001',
      'Item 1 - Description': 'First component',
      'Item 1 - Required Qty': '5',
      'Item 2 - Name': 'Item Two',
      'Item 2 - ID': 'ITEM002',
      'Item 2 - Description': 'Second component',
      'Item 2 - Required Qty': '3.5'
    }];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM Template');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 10 },
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 12 },
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 12 }
    ];

    XLSX.writeFile(workbook, 'BOM_Bulk_Upload_Template.xlsx');
    toast.info('Downloaded bulk upload template');
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  // Fetch Items
  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/items/get-items`);
        const sortedItems = response.data.sort(
          (a, b) =>
            new Date(b.createdAt || b.date || Date.now()) -
            new Date(a.createdAt || a.date || Date.now())
        );
        setItems(sortedItems);
      } catch (error) {
        toast.error("Failed to fetch items");
        console.error("Error fetching items:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, []);

  // Fetch BOMs
  useEffect(() => {
    const fetchBOMs = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/bom/get-boms`);
        // Sort by createdAt date (newest first)
        const sortedBOMs = response.data.data.sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setBoms(sortedBOMs);
      } catch (error) {
        toast.error("Failed to fetch BOMs");
        console.error("Error fetching BOMs:", error);
      }
    };
    fetchBOMs();
  }, []);

  // Initial values
  const initialValues = {
    productName: "",
    description: "",
    hsnCode: "",
    items: [
      {
        itemId: "",
        itemName: "",
        itemDescription: "",
        requiredQty: 0,
      },
    ],
  };

  // Validation schema
  // Validation schema
  const validationSchema = Yup.object({
    productName: Yup.string()
      .required("Product Name is required")
      .matches(/^(?=.*[a-zA-Z])[a-zA-Z0-9\s]+$/, "Product Name must contain at least one letter and can include numbers"),
    description: Yup.string().required("Description is required"),
    hsnCode: Yup.string()
      .required("HSN Code is required")
      .matches(/^\d+$/, "HSN Code must contain only numbers"),
    items: Yup.array()
      .of(
        Yup.object({
          itemId: Yup.string().required("Item selection is required"),
          itemName: Yup.string().required("Item name is required"),
          requiredQty: Yup.number()
            .required("Required quantity is required")
            .moreThan(0, "Required quantity must be more than 0")
            .typeError("Required quantity must be a number")
            .test(
              'is-decimal',
              'Required quantity can have up to 2 decimal places',
              value => value === undefined || /^\d+(\.\d{1,2})?$/.test(value)
            ),
        })
      )
      .min(1, "At least one item is required"),
  });

  // Filter BOMs
  const filteredBOMs = useMemo(() => {
    if (!debouncedSearch) return boms;

    return boms.filter(bom => {
      // Check BOM fields
      if (bom.productName?.toLowerCase().includes(debouncedSearch)) return true;
      if (bom.description?.toLowerCase().includes(debouncedSearch)) return true;
      if (bom.hsnCode?.toLowerCase().includes(debouncedSearch)) return true;

      // Check items
      if (bom.items?.some(item =>
        item.itemName?.toLowerCase().includes(debouncedSearch) ||
        item.itemDescription?.toLowerCase().includes(debouncedSearch)
      )) return true;

      return false;
    });
  }, [debouncedSearch, boms]);

  // Get available items for selection (excluding already selected items)
  const getAvailableItems = (currentItems, currentIndex) => {
    return items
      .filter(item => {
        // Check if item is not already selected in other fields
        return !currentItems.some((selectedItem, idx) =>
          idx !== currentIndex && selectedItem.itemId === item.itemId
        );
      })
      .map(item => ({
        value: item.itemId,
        label: item.itemName,
        itemData: item
      }));
  };

  // Item select handler
  const handleItemSelect = (selectedOption, index, values, setFieldValue) => {
    if (selectedOption) {
      setFieldValue(`items.${index}.itemId`, selectedOption.value);
      setFieldValue(`items.${index}.itemName`, selectedOption.label);
      setFieldValue(`items.${index}.itemDescription`, selectedOption.itemData.description);
    } else {
      // Clear the field if no option is selected
      setFieldValue(`items.${index}.itemId`, "");
      setFieldValue(`items.${index}.itemName`, "");
      setFieldValue(`items.${index}.itemDescription`, "");
    }
  };

  // Submit handler
  const handleSubmit = async (values, { resetForm, setSubmitting }) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/bom/create-bom`,
        values
      );
      toast.success("BOM created successfully!");
      setBoms((prev) => [...prev, response.data.data]);
      setShowForm(false);
      resetForm();
    } catch (error) {
      console.error("Error saving BOM:", error);
      toast.error("Failed to save BOM");
    } finally {
      setSubmitting(false);
    }
  };

  // Export PDF
  const handleExportPDF = () => {
    if (!selectedBOM) return toast.warn("Select a BOM to export");
    const element = document.getElementById("bom-pdf");
    html2pdf().from(element).set({ filename: `${selectedBOM.productName}.pdf` }).save();
  };

  // Export Excel
  const handleExportExcel = () => {
    if (boms.length === 0) {
      toast.warn("No BOMs to export");
      return;
    }

    const data = boms.map((bom) => ({
      "Product Name": bom.productName,
      Description: bom.description,
      "HSN Code": bom.hsnCode,
      "Items Count": bom.items?.length || 0,
      Components:
        bom.items?.map((item) => `${item.itemName} (${item.requiredQty})`).join(", ") ||
        "None",
      "Created At": new Date(bom.createdAt).toLocaleDateString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BOMs");

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
      { wch: 12 },
      { wch: 40 },
      { wch: 15 },
    ];

    XLSX.writeFile(workbook, "BOMs.xlsx");
    toast.success("Exported all BOMs to Excel");
  };

  // Add update and delete functions
  const handleUpdateBOM = async (updatedBOM) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/bom/update-bom/${updatedBOM.bomId}`,
        updatedBOM
      );

      setBoms(prev =>
        prev.map(bom =>
          bom.bomId === updatedBOM.bomId ? response.data.data : bom
        )
      );
      setSelectedBOM(response.data.data); // Update the selected BOM with the new data
      toast.success("BOM updated successfully!");
      return response.data.data;
    } catch (error) {
      console.error("Error updating BOM:", error);
      toast.error(error.response?.data?.message || "Error updating BOM");
      throw error;
    }
  };

  const handleDeleteBOM = async (bomId) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/bom/delete-bom/${bomId}`
      );

      setBoms(prev => prev.filter(bom => bom.bomId !== bomId));
      setSelectedBOM(null);
      toast.success("BOM deleted successfully!");
    } catch (error) {
      console.error("Error deleting BOM:", error);
      toast.error(error.response?.data?.message || "Error deleting BOM");
    }
  };

  // Update BOMModal to include editing functionality
  const BOMModal = ({ bom, onClose, onExport, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedBOM, setEditedBOM] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    useEffect(() => {
      if (bom) {
        setEditedBOM({ ...bom });
        setErrors({});
      }
    }, [bom]);

    const validateField = (name, value) => {
      let error = "";

      if (name === "productName") {
        if (!value) {
          error = "Product Name is required";
        } else if (!/^(?=.*[a-zA-Z])[a-zA-Z0-9\s]+$/.test(value)) {
          error = "Product Name must contain at least one letter and can include numbers";
        }
      } else if (name === "description" && !value) {
        error = "Description is required";
      } else if (name === "hsnCode") {
        if (!value) {
          error = "HSN Code is required";
        } else if (!/^\d+$/.test(value)) {
          error = "HSN Code must contain only numbers";
        }

      } else if (name.startsWith("items.") && name.endsWith(".requiredQty")) {
        const index = parseInt(name.split(".")[1]);
        if (!value || isNaN(value) || value <= 0) {
          error = "Required quantity must be more than 0";
        }
      }

      return error;
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      const error = validateField(name, value);

      setEditedBOM(prev => ({ ...prev, [name]: value }));
      setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleItemQtyChange = (index, value) => {
      const name = `items.${index}.requiredQty`;
      const error = validateField(name, value);

      setEditedBOM(prev => {
        const newItems = [...prev.items];
        newItems[index] = { ...newItems[index], requiredQty: Number(value) };
        return { ...prev, items: newItems };
      });

      setErrors(prev => ({ ...prev, [name]: error }));
    };

    const validateForm = () => {
      const newErrors = {};

      // Validate productName
      if (!editedBOM.productName) {
        newErrors.productName = "Product Name is required";
      } else if (!/^(?=.*[a-zA-Z])[a-zA-Z0-9\s]+$/.test(editedBOM.productName)) {
        newErrors.productName = "Product Name must contain at least one letter and can include numbers";
      }

      // Validate hsnCode
      if (!editedBOM.description) {
        newErrors.description = "Description is required";
      }
      if (!editedBOM.hsnCode) {
        newErrors.hsnCode = "HSN Code is required";
      } else if (!/^\d+$/.test(editedBOM.hsnCode)) {
        newErrors.hsnCode = "HSN Code must contain only numbers";
      }

      // Validate items
      if (!editedBOM.items || editedBOM.items.length === 0) {
        newErrors.items = "At least one item is required";
      } else {
        editedBOM.items.forEach((item, index) => {
          if (!item.requiredQty || item.requiredQty <= 0) {
            newErrors[`items.${index}.requiredQty`] = "Required quantity must be more than 0";
          }
        });
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
      if (!validateForm()) {
        toast.error("Please fix the validation errors before saving");
        return;
      }

      try {
        const updatedBOM = await onUpdate(editedBOM);
        setEditedBOM(updatedBOM);
        setIsEditing(false);
        setErrors({});
      } catch (error) {
        console.error("Error updating BOM:", error);
      }
    };

    if (!bom) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit BOM" : `BOM: ${bom.productName}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              {/* BOM Details - Editable fields */}
              <div className="detail-row">
                <span className="detail-label">Product Name:</span>
                {isEditing ? (
                  <div className="field-wrapper">
                    <input
                      type="text"
                      name="productName"
                      value={editedBOM.productName || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.productName ? 'error' : ''}`}
                    />
                    {errors.productName && <div className="error-message">{errors.productName}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{bom.productName}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Description:</span>
                {isEditing ? (
                  <div className="field-wrapper">
                    <input
                      type="text"
                      name="description"
                      value={editedBOM.description || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.description ? 'error' : ''}`}
                    />
                    {errors.description && <div className="error-message">{errors.description}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{bom.description || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">HSN Code:</span>
                {isEditing ? (
                  <div className="field-wrapper">
                    <input
                      type="text"
                      name="hsnCode"
                      value={editedBOM.hsnCode || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.hsnCode ? 'error' : ''}`}
                    />
                    {errors.hsnCode && <div className="error-message">{errors.hsnCode}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{bom.hsnCode || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">BOM ID:</span>
                <span className="detail-value">{bom.bomId}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Created At:</span>
                <span className="detail-value">
                  {new Date(bom.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Items Section - Only Required Qty is editable */}
              <div className="section-header">Components</div>
              <div className="items-grid">
                {bom.items?.map((item, index) => (
                  <div key={index} className="item-card">
                    <div className="item-header">
                      <span className="item-name">{item.itemName}</span>
                    </div>
                    <div className="item-details">
                      <span>Description: {item.itemDescription || 'N/A'}</span>
                      <div className="quantity-control">
                        <span>Required Qty: </span>
                        {isEditing ? (
                          <div className="field-wrapper">
                            <input
                              type="number"
                              min="0"
                              step="0.01" // Allow decimal values
                              value={editedBOM.items?.[index]?.requiredQty || item.requiredQty}
                              onChange={(e) => handleItemQtyChange(index, e.target.value)}
                              className={`qty-input ${errors[`items.${index}.requiredQty`] ? 'error' : ''}`}
                            />
                            {errors[`items.${index}.requiredQty`] && (
                              <div className="error-message">{errors[`items.${index}.requiredQty`]}</div>
                            )}
                          </div>
                        ) : (
                          <span>{item.requiredQty}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
              <p>Are you sure you want to delete BOM {bom.productName}? This action cannot be undone.</p>
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
                    onDelete(bom.bomId);
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

  // Bulk Upload Modal Component
  const BulkUploadModal = () => {
    const handleDrop = (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect({ target: { files } });
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
    };

    return (
      <div className="modal-overlay" onClick={() => !isUploading && setShowBulkUpload(false)}>
        <div className="modal-content bulk-upload-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Bulk Upload BOMs</div>
            <button
              className="modal-close"
              onClick={() => !isUploading && setShowBulkUpload(false)}
              disabled={isUploading}
            >
              &times;
            </button>
          </div>

          <div className="modal-body">
            {isUploading ? (
              <div className="upload-progress">
                <h3>Uploading BOMs...</h3>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p>{uploadProgress}% Complete</p>
              </div>
            ) : (
              <>
                <div className="upload-instructions">
                  <h4>Instructions:</h4>
                  <ul>
                    <li>Download the template file below</li>
                    <li>Fill in your BOM data following the template format</li>
                    <li>Upload the completed Excel file</li>
                    <li>BOM IDs must be unique</li>
                    <li>Items will be grouped by BOM ID</li>
                  </ul>
                </div>

                <div
                  className="upload-area"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FaUpload size={48} />
                  <p>Click to select or drag & drop Excel file</p>
                  <p className="file-types">Supported: .xlsx, .xls, .csv</p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="template-section">
                  <button className="download-template-btn" onClick={downloadTemplate}>
                    <FaFileExcel /> Download Template
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Navbar>
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="main">
        <div className="page-header">
          <h2>Bill of Material (BOM)</h2>
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search BOMs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>


            <div className="page-actions">

              {/* <button className="bulk-upload-btn" onClick={handleBulkUploadClick}>
                <FaUpload /> Bulk Upload
              </button> */}
              <button className="export-all-btn" onClick={handleExportExcel}>
                <FaFileExcel /> Export All
              </button>
              <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                <FaPlus /> {showForm ? "Close BOM" : "Create BOM"}
              </button>
            </div>
          </div>
        </div>

        {isLoading && <div className="loading">Loading items...</div>}

        {showForm && (
          <div className="form-container premium">
            <h2>Create BOM</h2>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              validateOnBlur={false}
              validateOnChange={false}
              onSubmit={handleSubmit}
            >
              {({ values, setFieldValue, errors, touched, submitCount }) => {
                // Show toast errors when submit is attempted
                useEffect(() => {
                  if (submitCount > 0 && Object.keys(errors).length > 0) {
                    // Show general errors first
                    if (errors.productName) toast.error(errors.productName);
                    if (errors.description) toast.error(errors.description); // Add this line
                    if (errors.hsnCode) toast.error(errors.hsnCode);

                    // Show items array validation error (like min 1 item)
                    if (typeof errors.items === 'string') {
                      toast.error(errors.items);
                    }

                    if (Array.isArray(errors.items)) {
                      errors.items.forEach((itemError, index) => {
                        if (itemError?.itemName)
                          toast.error(`Item ${index + 1}: ${itemError.itemName}`);
                        if (itemError?.requiredQty)
                          toast.error(`Item ${index + 1}: ${itemError.requiredQty}`);
                      });
                    }
                  }
                }, [submitCount, errors]);

                return (
                  <Form>
                    <div className="form-group-row">
                      <div className="grn-field-wrapper">
                        <label>Product Name *</label>
                        <Field
                          name="productName"
                          className={errors.productName && touched.productName ? 'error' : ''}
                        />
                        {errors.productName && touched.productName && (
                          <div className="error-message">{errors.productName}</div>
                        )}
                      </div>
                      <div className="grn-field-wrapper">
                        <label>Description *</label>
                        <Field name="description"
                          className={errors.description && touched.description ? 'error' : ''}
                        />
                        {errors.description && touched.description && (
                          <div className="error-message">{errors.description}</div>
                        )}
                      </div>
                      <div className="grn-field-wrapper">
                        <label>HSN/SAC Code *</label>
                        <Field
                          name="hsnCode"
                          className={errors.hsnCode && touched.hsnCode ? 'error' : ''}
                        />
                        {errors.hsnCode && touched.hsnCode && (
                          <div className="error-message">{errors.hsnCode}</div>
                        )}
                      </div>
                    </div>

                    <FieldArray name="items">
                      {({ remove, push }) => (
                        <div className="form-items">
                          {values.items.map((item, index) => {
                            const itemError = errors.items && errors.items[index];
                            const itemTouched = touched.items && touched.items[index];

                            return (
                              <div className="item-row" key={index}>
                                <div className="field-wrapper">
                                  <label>Item Name</label>
                                  <Select
                                    className={`react-select-container ${itemError?.itemId ? 'error' : ''}`}
                                    classNamePrefix="react-select"
                                    options={getAvailableItems(values.items, index)}
                                    onChange={(selectedOption) => handleItemSelect(selectedOption, index, values, setFieldValue)}
                                    value={items.find(i => i.itemId === item.itemId) ? {
                                      value: item.itemId,
                                      label: item.itemName,
                                      itemData: items.find(i => i.itemId === item.itemId)
                                    } : null}
                                    placeholder="Items"
                                    isSearchable={true}
                                    noOptionsMessage={() => "No items found"}
                                  />
                                  {itemError?.itemId && itemTouched?.itemId && (
                                    <div className="error-message">{itemError.itemId}</div>
                                  )}
                                </div>

                                <div className="field-wrapper">
                                  <label>Description</label>
                                  <Field
                                    name={`items.${index}.itemDescription`}
                                    placeholder="Description"
                                  />
                                </div>
                                <div className="field-wrapper">
                                  <label>Required Qty</label>
                                  <Field
                                    name={`items.${index}.requiredQty`}
                                    type="number"
                                    step="0.01" // Allow decimal values
                                    placeholder="Required Qty"
                                    className={itemError?.requiredQty && itemTouched?.requiredQty ? 'error' : ''}
                                  />
                                  {itemError?.requiredQty && itemTouched?.requiredQty && (
                                    <div className="error-message">{itemError.requiredQty}</div>
                                  )}
                                </div>
                                <div>
                                  <label style={{ opacity: 0 }}>Delete</label>
                                  {/* Only show delete button if there's more than 1 item */}
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
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            className="add-btn"
                            onClick={() =>
                              push({
                                itemId: "",
                                itemName: "",
                                itemDescription: "",
                                requiredQty: 0,
                              })
                            }
                          >
                            + Add Item
                          </button>
                        </div>
                      )}
                    </FieldArray>

                    <button type="submit">Submit BOM</button>
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
                <th>Product</th>
                <th>Description</th>
                <th>Items Count</th>
              </tr>
            </thead>
            <tbody>
              {showLoader ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="table-loader"></div>
                  </td>
                </tr>
              ) : (
                filteredBOMs.map((bom) => (
                  <tr
                    key={bom.bomId}
                    onClick={() => setSelectedBOM(bom)}
                    className={selectedBOM?.bomId === bom.bomId ? "selected" : ""}
                  >
                    <td>{bom.productName}</td>
                    <td>{bom.description}</td>
                    <td>{bom.items?.length || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "none" }}>
          {selectedBOM && <BOMPrint bom={selectedBOM} />}
        </div>

        {selectedBOM && (
          <BOMModal
            bom={selectedBOM}
            onClose={() => setSelectedBOM(null)}
            onExport={handleExportPDF}
            onUpdate={handleUpdateBOM}
            onDelete={handleDeleteBOM}
          />
        )}

        {showBulkUpload && <BulkUploadModal />}
      </div>
    </Navbar>
  );
};

export default Bom;