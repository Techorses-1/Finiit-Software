import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FaCubes,
  FaHashtag,
  FaBalanceScale,
  FaStickyNote,
  FaIdCard,
  FaPlus,
  FaFileExport,
  FaFileExcel,
  FaPercent,
  FaSearch,
  FaEdit, FaSave, FaTrash, FaUpload
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import "../Form/Form.scss";
import "./Items.scss";
import "react-toastify/dist/ReactToastify.css";
import { TAX_SLABS } from "../../Components/TaxSlab/Taxslab";

const Items = () => {
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);


  // Bulk Upload Functionality
  // Bulk Upload Functionality
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
        `${import.meta.env.VITE_API_URL}/items/bulk-upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const data = response.data;

      // Show success message with error details if any
      if (data.errors && data.errors.length > 0) {
        // Create error message with first few errors
        const errorCount = data.errors.length;
        const errorPreview = data.errors.slice(0, 5).join('\n');
        const moreErrors = errorCount > 5 ? `\n...and ${errorCount - 5} more errors` : '';

        toast.success(
          `Uploaded ${data.insertedCount} out of ${data.total} items. ${errorCount} errors found.`,
          {
            autoClose: 8000, // Show for 8 seconds
            closeOnClick: false,
          }
        );

        // Show detailed errors in console
        console.warn('Bulk upload errors:', data.errors);

        // Optionally show alert with all errors
        if (errorCount > 0) {
          setTimeout(() => {
            if (window.confirm(
              `Upload completed with ${errorCount} errors.\n\n` +
              `First few errors:\n${errorPreview}${moreErrors}\n\n` +
              `Check browser console for full error list.\n\n` +
              `Do you want to see all errors in a new window?`
            )) {
              const errorWindow = window.open('', '_blank');
              errorWindow.document.write(`
              <html>
                <head><title>Bulk Upload Errors</title></head>
                <body>
                  <h2>Bulk Upload Errors (${errorCount} errors)</h2>
                  <pre style="white-space: pre-wrap; font-family: monospace;">${data.errors.join('\n')}</pre>
                </body>
              </html>
            `);
            }
          }, 1000);
        }
      } else {
        toast.success(`Successfully uploaded all ${data.insertedCount} items!`);
      }

      // Refresh items list
      const fetchResponse = await axios.get(`${import.meta.env.VITE_API_URL}/items/get-items`);
      const itemsData = fetchResponse.data;
      setItems(itemsData);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading items:', error);

      // Handle axios error response
      if (error.response && error.response.data && error.response.data.errors) {
        const errorData = error.response.data;
        const errorCount = errorData.errors.length;
        const errorPreview = errorData.errors.slice(0, 5).join('\n');

        toast.error(
          `Upload completed with ${errorCount} errors. ${errorData.insertedCount || 0} items uploaded successfully.`,
          { autoClose: 8000 }
        );

        console.warn('Bulk upload errors:', errorData.errors);
      } else {
        toast.error(error.response?.data?.message || 'Error uploading items');
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



  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const initialValues = {
    itemName: "",
    minimumQty: "",
    hsnCode: "",
    unit: "",
    description: "",
    taxSlab: "",
  };

  const validationSchema = Yup.object({
    itemName: Yup.string().required("Item Name is required"),
    minimumQty: Yup.number()
      .required("Minimum Qty is required")
      .min(1, "Minimum Qty must be greater than 0"),
    hsnCode: Yup.string().required("HSN is required"),
    unit: Yup.string().required("Unit is required"),
    description: Yup.string().required("Description is required"),
    taxSlab: Yup.string().required("Tax Slab is required"),
  });

  // Fetch items
  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/items/get-items`)
      .then((res) => {
        const sortedData = res.data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt)
            : (a._id?.getTimestamp ? new Date(a._id.getTimestamp()) : new Date(0));
          const dateB = b.createdAt ? new Date(b.createdAt)
            : (b._id?.getTimestamp ? new Date(b._id.getTimestamp()) : new Date(0));
          return dateB - dateA;
        });
        setItems(sortedData);
      })
      .catch((err) => {
        console.error("Error fetching items:", err);
        toast.error("Failed to load items.");
      });
  }, []);

  // Filter items by itemName, hsnCode, description
  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    return items.filter((item) =>
      item.itemName?.toLowerCase().includes(debouncedSearch) ||
      item.hsnCode?.toLowerCase().includes(debouncedSearch) ||
      item.description?.toLowerCase().includes(debouncedSearch)
    );
  }, [debouncedSearch, items]);

  const handleSubmit = async (values, { resetForm, setFieldError }) => {
    try {
      const payload = {
        ...values,
        taxSlab: Number(values.taxSlab),
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/items/create-item`,
        payload
      );

      setItems((prev) => [response.data, ...prev]);
      toast.success("Item submitted successfully!");
      resetForm();
      setShowForm(false);
    } catch (error) {
      if (error.response && error.response.data.field === "itemName") {
        const errorMessage = "Item with this name already exists";
        setFieldError("itemName", errorMessage);
        toast.error(errorMessage);
      } else {
        console.error("Error saving item:", error);
        toast.error(error.response?.data?.message || "Failed to submit item.");
      }
    }
  };


  const selectItem = (itemId) => {
    setSelectedItem(prev => prev === itemId ? null : itemId);
  };

  const exportSelectedAsPDF = () => {
    if (!selectedItem) {
      toast.warning("Please select an item to export");
      return;
    }

    const item = items.find(i => i.itemId === selectedItem);

    const content = `
    <div style="font-family: 'Arial', sans-serif; padding: 30px; background: #fff;">
      <h1 style="color: #3f3f91; text-align: center; margin-bottom: 20px; font-size: 24px;">
        Item Details
      </h1>

      <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
        <h2 style="color: #3f3f91; margin-bottom: 15px; font-size: 20px;">
         <strong>Item Name:</strong> ${item.itemName}
        </h2>
        <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 15px;" />

        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Minimum Quantity:</strong> ${item.minimumQty}
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>HSN Code:</strong> ${item.hsnCode || 'N/A'}
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Unit:</strong> ${item.unit || 'N/A'}
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Tax Slab:</strong> ${item.taxSlab}%
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Description:</strong> ${item.description || 'N/A'}
        </p>
      </div>
    </div>
  `;

    const opt = {
      margin: 10,
      filename: `${item.itemName}_details.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(content).set(opt).save();
  };

  const exportAllAsExcel = () => {
    if (items.length === 0) {
      toast.warning("No items to export");
      return;
    }

    const data = items.map(item => ({
      "Item Name": item.itemName,
      "Minimum Qty": item.minimumQty,
      "HSN Code": item.hsnCode,
      "Unit": item.unit,
      "Tax Slab": `${item.taxSlab}%`,
      "Description": item.description
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
    XLSX.writeFile(workbook, "all_items.xlsx");
  };

  const handleUpdateItem = async (updatedItem) => {
    try {
      // Remove problematic fields before sending
      const { itemId, _id, createdAt, updatedAt, ...itemData } = updatedItem;

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/items/update-item/${updatedItem.itemId}`,
        itemData
      );

      setItems(prev =>
        prev.map(item =>
          item.itemId === updatedItem.itemId ? response.data.item : item
        )
      );
      toast.success("Item updated successfully!");
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error(error.response?.data?.message || "Error updating item");
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/items/delete-item/${itemId}`
      );

      setItems(prev =>
        prev.filter(item => item.itemId !== itemId)
      );
      setSelectedItem(null);
      toast.success("Item deleted successfully!");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error(error.response?.data?.message || "Error deleting item");
    }
  };


  const ItemModal = ({ item, onClose, onExport, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    useEffect(() => {
      if (item) {
        setEditedItem({ ...item });
      }
    }, [item]);

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setEditedItem(prev => ({ ...prev, [name]: value }));
    };


    const handleSave = async () => {
      // Validate minimumQty
      if (!editedItem.minimumQty || editedItem.minimumQty <= 0) {
        toast.error("Minimum Quantity must be greater than 0");
        return;
      }

      // Validate other required fields
      if (!editedItem.itemName || !editedItem.hsnCode || !editedItem.unit ||
        !editedItem.taxSlab || !editedItem.description) {
        toast.error("All fields are required");
        return;
      }

      try {
        await onUpdate(editedItem);
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating item:", error);
      }
    };

    if (!item) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit Item" : `Item Details: ${item.itemName}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              {/* Item Name */}
              <div className="detail-row">
                <span className="detail-label">Item Name:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="itemName"
                    value={editedItem.itemName || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{item.itemName}</span>
                )}
              </div>

              {/* Minimum Quantity */}
              <div className="detail-row">
                <span className="detail-label">Minimum Quantity:</span>
                {isEditing ? (
                  <input
                    type="number"
                    name="minimumQty"
                    value={editedItem.minimumQty || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                    min="1"
                  />
                ) : (
                  <span className="detail-value">{item.minimumQty}</span>
                )}
              </div>

              {/* HSN Code */}
              <div className="detail-row">
                <span className="detail-label">HSN Code:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="hsnCode"
                    value={editedItem.hsnCode || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{item.hsnCode || 'N/A'}</span>
                )}
              </div>

              {/* Unit */}
              <div className="detail-row">
                <span className="detail-label">Unit:</span>
                {isEditing ? (
                  <select
                    name="unit"
                    value={editedItem.unit || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  >
                    <option value="">Select Unit</option>
                    <option value="Meter (Mtr.)">Meter (Mtr.)</option>
                    <option value="Numbers (No.)">Numbers (No.)</option>
                    <option value="Kilogram (Kg.)">Kilogram (Kg.)</option>
                    <option value="Litre (L.)">Litre (L.)</option>
                  </select>
                ) : (
                  <span className="detail-value">{item.unit || 'N/A'}</span>
                )}
              </div>

              {/* Tax Slab */}
              <div className="detail-row">
                <span className="detail-label">Tax Slab:</span>
                {isEditing ? (
                  <select
                    name="taxSlab"
                    value={editedItem.taxSlab || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  >
                    <option value="">Select Tax Slab</option>
                    {TAX_SLABS.map((slab, index) => (
                      <option key={index} value={slab.value}>
                        {slab.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="detail-value">{item.taxSlab}%</span>
                )}
              </div>

              {/* Description */}
              <div className="detail-row">
                <span className="detail-label">Description:</span>
                {isEditing ? (
                  <textarea
                    name="description"
                    value={editedItem.description || ''}
                    onChange={handleInputChange}
                    className="edit-textarea"
                    rows="3"
                  />
                ) : (
                  <span className="detail-value">{item.description || 'N/A'}</span>
                )}
              </div>

              {/* Created At */}
              <div className="detail-row">
                <span className="detail-label">Created At:</span>
                <span className="detail-value">
                  {new Date(item.createdAt || item._id?.getTimestamp()).toLocaleDateString()}
                </span>
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
              <p>Are you sure you want to delete {item.itemName}? This action cannot be undone.</p>
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
                    onDelete(item.itemId);
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
          <h2>Item List</h2>
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Items..."
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
              {/* <button className="export-btn" onClick={exportSelectedAsPDF}>
                <FaFileExport /> Export
              </button> */}
              <button className="export-all-btn" onClick={exportAllAsExcel}>
                <FaFileExcel /> Export All
              </button>
              <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                <FaPlus /> {showForm ? "Close" : "Add Item"}
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="form-container premium">
            <h2>Add Item</h2>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              <Form>
                <div className="form-row">
                  <div className="form-field">
                    <label><FaCubes /> Item Name *</label>
                    <Field name="itemName" type="text" />
                    <ErrorMessage name="itemName" component="div" className="error" />
                  </div>
                  <div className="form-field">
                    <label><FaHashtag /> Minimum Qty *</label>
                    <Field name="minimumQty" type="number" />
                    <ErrorMessage name="minimumQty" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaIdCard /> HSN/SAC Code *</label>
                    <Field name="hsnCode" type="text" />
                    <ErrorMessage name="hsnCode" component="div" className="error" />
                  </div>
                  <div className="form-field">
                    <label><FaBalanceScale /> Unit *</label>
                    <Field as="select" name="unit" className="select-field">
                      <option value="">Select Unit</option>
                      <option value="Meter (Mtr.)">Meter (Mtr.)</option>
                      <option value="Numbers (No.)">Numbers (No.)</option>
                      <option value="Kilogram (Kg.)">Kilogram (Kg.)</option>
                      <option value="Litre (L.)">Litre (L.)</option>
                    </Field>
                    <ErrorMessage name="unit" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaPercent /> Tax Slab *</label>
                    <Field as="select" name="taxSlab" className="select-field">
                      <option value="">Select Tax Slab</option>
                      {TAX_SLABS.map((slab, index) => (
                        <option key={index} value={slab.value}>
                          {slab.label}
                        </option>
                      ))}
                    </Field>
                    <ErrorMessage name="taxSlab" component="div" className="error" />
                  </div>
                  <div className="form-field">
                    <label><FaStickyNote /> Description *</label>
                    <Field name="description" as="textarea" rows="3" />
                    <ErrorMessage name="description" component="div" className="error" />
                  </div>
                </div>

                <button type="submit">Submit</button>
              </Form>
            </Formik>
          </div>
        )}

        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Min Qty</th>
                <th>HSN Code</th>
                <th>Unit</th>
                <th>Tax Slab</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => (
                <tr
                  key={item.itemId || index}
                  className={selectedItem === item.itemId ? 'selected' : ''}
                  onClick={() => selectItem(item.itemId)}
                >
                  <td>{item.itemName}</td>
                  <td>{item.minimumQty}</td>
                  <td>{item.hsnCode}</td>
                  <td>{item.unit}</td>
                  <td>{item.taxSlab}%</td>
                  <td>{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>


        {selectedItem && (
          <ItemModal
            item={items.find(i => i.itemId === selectedItem)}
            onClose={() => setSelectedItem(null)}
            onExport={exportSelectedAsPDF}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Items;
