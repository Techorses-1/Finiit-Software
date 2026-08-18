import { React, useEffect, useState } from "react";
import "./Salesprint.scss";
import { QRCodeCanvas as QRCode } from "qrcode.react";

const SalesPrint = ({ invoice, qrCodeUrl, taxSlab }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Reset image state when invoice changes
    setImageLoaded(false);
    setImageError(false);

    if (invoice?.imageUrl) {
      console.log('Image URL:', invoice.imageUrl);

      // Preload image to check if it's accessible
      const img = new Image();
      img.onload = () => {
        console.log('Image loaded successfully');
        setImageLoaded(true);
      };
      img.onerror = (e) => {
        console.error('Image failed to load:', e);
        console.error('Image URL that failed:', invoice.imageUrl);
        setImageError(true);
      };
      img.src = invoice.imageUrl;
    }
  }, [invoice]);

  if (!invoice) return null;

  const {
    invoiceNumber,
    invoiceDate,
    poNumber,
    poDate,
    receiver,
    consignee,
    items,
    subtotal,
    cgst,
    sgst,
    igst,
    total,
    lrNumber,
    lrDate,
    transporter,
    transportMobile,
    vehicleNumber,
    terms,
    extraNote,
    packetForwardingPercent,
    freightPercent,
    inspectionPercent,
    tcsPercent,
    additionalCharges,
    imageUrl,
    // NEW FIELDS
    irn,
    ackNo,
    ackDate
  } = invoice;

  // Use the passed taxSlab or fallback to invoice.taxSlab
  const actualTaxSlab = taxSlab || invoice.taxSlab || 18;
  const isIntraState = receiver?.gstin?.startsWith("24");

  // Calculate charges if not already in invoice
  const calculatedCharges = additionalCharges || {
    packetForwarding: packetForwardingPercent ? (subtotal * packetForwardingPercent) / 100 : 0,
    freight: freightPercent ? (subtotal * freightPercent) / 100 : 0,
    inspection: inspectionPercent ? (subtotal * inspectionPercent) / 100 : 0,
    // ✅ CORRECT: Calculate TCS on (subtotal + GST)
    tcs: tcsPercent ? ((subtotal + (cgst || 0) + (sgst || 0) + (igst || 0)) * tcsPercent / 100) : 0
  };

  // Check if e-invoice details exist
  const hasEInvoiceDetails = irn || ackNo || ackDate;

  return (
    <div id="sales-pdf">


      {/* Main content container with page break controls */}
      <div className="main-content">
        {/* Company GST and LUT details */}
        <div className="company-details">
          <div className="left-details">
            <p><strong>GSTIN :</strong> 24AAAFF299.....</p>
            <p><strong>State :</strong> Gujarat, Code: 24</p>
            <p><strong>PAN No :</strong> AAAFF......</p>
          </div>
          <div className="middle-details">
            <p><strong>MICRO UNIT AS PER MSME RULES</strong></p>
            <p><strong>UDYAM No:</strong> UDYAM-GJ-24-.......</p>
          </div>
          <div className="right-details">
            <p><strong>LUT ARN No :</strong> AD24032303.....&nbsp;&nbsp;&nbsp;</p>
            <p><strong>From:</strong> 01/04/2025 <strong>To:</strong> 31/03/2026</p>
          </div>
        </div>

        {/* Invoice and PO details side by side - Fixed layout */}
        <div className="invoice-po-section">
          <div className="invoice-details">
            <p><strong>Invoice No :</strong> {invoiceNumber}</p>
            <p><strong>Invoice Date :</strong> {invoiceDate}</p>
          </div>
          <div className="invoice-title">
            <h3>TAX INVOICE CUM CHALLAN</h3>
          </div>
          <div className="po-details">
            {poNumber && <p><strong>PO Number :</strong> {poNumber}</p>}
            {poDate && <p><strong>PO Date :</strong> {poDate}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p>}
          </div>
        </div>

        <div className="party-section">
          <div className="party-card">
            <h3>Billed To:</h3>
            <p><strong>{receiver?.name}</strong></p>
            <p>{receiver?.address}</p>
            <p>GSTIN: {receiver?.gstin}</p>
            <p>Contact: {receiver?.contact}</p>
            <p>Email: {receiver?.email}</p>
          </div>
          <div className="party-card">
            <h3>Shipped To:</h3>
            <p><strong>{consignee?.name}</strong></p>
            <p>{consignee?.address}</p>
            <p>GSTIN: {consignee?.gstin}</p>
            <p>Contact: {consignee?.contact}</p>
            <p>Email: {consignee?.email}</p>
          </div>
        </div>

        <div className="items-container">
          <table className="items-table">
            {/* Lock column widths so SR No is narrow and description ellipsis works */}
            <colgroup>
              <col style={{ width: "4%" }} />   {/* # */}
              <col style={{ width: "18%" }} />  {/* Name */}
              <col style={{ width: "30%" }} />  {/* Description */}
              <col style={{ width: "10%" }} />  {/* HSN */}
              <col style={{ width: "8%" }} />   {/* Qty */}
              <col style={{ width: "15%" }} />  {/* Rate */}
              <col style={{ width: "15%" }} />  {/* Amount */}
            </colgroup>

            <thead>
              <tr>
                <th className="sr-no">#</th>
                <th>Name</th>
                <th>Description</th>
                <th>HSN</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="sr-no">{index + 1}</td>
                  <td>{item.name}</td>
                  <td className="description-cell">{item.description || '-'}</td>
                  <td>{item.hsn || '-'}</td>
                  <td>{item.quantity} {item.units}</td>
                  <td>₹{item.unitPrice.toFixed(2)}</td>
                  <td>₹{(item.quantity * item.unitPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="summary-section">
          <div className="transport-bank-details">
            <div className="transport-details">
              <div className="lr-details">
                <p><strong>LR No:</strong> {lrNumber || 'N/A'}</p>
                <p><strong>LR Date:</strong> {lrDate || 'N/A'}</p>
              </div>
              <p><strong>Transporter:</strong> {transporter || 'N/A'}</p>
              {vehicleNumber && <p><strong>Vehicle No:</strong> {vehicleNumber}</p>}
              <p><strong>Contact:</strong> {transportMobile || 'N/A'}</p>
            </div>
            <div className="bank-details">
              <p><strong>Bank Name:</strong> BANK</p>
              <p><strong>Account No:</strong> ............</p>
              <p><strong>Branch:</strong>BRANCH</p>
              <p><strong>IFSC:</strong> IFSC</p>
            </div>
          </div>
          <div className="amount-details">
            <table>
              <tbody>
                <tr><td>Subtotal:</td><td>₹{subtotal?.toFixed(2)}</td></tr>

                {packetForwardingPercent > 0 && (
                  <tr><td>Packet Forwarding ({packetForwardingPercent}%):</td><td>₹{calculatedCharges.packetForwarding.toFixed(2)}</td></tr>
                )}
                {freightPercent > 0 && (
                  <tr><td>Freight ({freightPercent}%):</td><td>₹{calculatedCharges.freight.toFixed(2)}</td></tr>
                )}
                {inspectionPercent > 0 && (
                  <tr><td>Inspection ({inspectionPercent}%):</td><td>₹{calculatedCharges.inspection.toFixed(2)}</td></tr>
                )}
                {tcsPercent > 0 && (
                  <tr><td>TCS ({tcsPercent}%):</td><td>₹{calculatedCharges.tcs.toFixed(2)}</td></tr>
                )}

                {cgst > 0 && (
                  <tr>
                    <td>CGST ({isIntraState ? actualTaxSlab / 2 : 0}%):</td>
                    <td>₹{cgst?.toFixed(2)}</td>
                  </tr>
                )}
                {sgst > 0 && (
                  <tr>
                    <td>SGST ({isIntraState ? actualTaxSlab / 2 : 0}%):</td>
                    <td>₹{sgst?.toFixed(2)}</td>
                  </tr>
                )}
                {igst > 0 && (
                  <tr>
                    <td>IGST ({!isIntraState ? actualTaxSlab : 0}%):</td>
                    <td>₹{igst?.toFixed(2)}</td>
                  </tr>
                )}

                <tr className="total-row">
                  <td><strong>Total:</strong></td>
                  <td><strong>₹{total?.toFixed(2)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="notes-qr-section">
          {(terms || extraNote) && (
            <div className="notes-section">
              {extraNote && (
                <div className="extra-notes">
                  <h4>Terms & Conditions</h4>
                  <p>{extraNote}</p>
                </div>
              )}
              {terms && (
                <div className="terms-section">
                  <pre>{terms}</pre>
                </div>
              )}
            </div>
          )}

          <div className="qr-image-section">
            {/* E-INVOICE DETAILS ABOVE IMAGE - SIMPLE FORMAT */}
            {hasEInvoiceDetails && (
              <div className="einvoice-details-simple">
                <div className="einvoice-lines">
                  {irn && (
                    <div className="detail-line">
                      <span className="label"><b>IRN: </b>{irn}</span>
                      {/* <span className="value">{irn}</span> */}
                    </div>
                  )}
                  {ackDate && (
                    <div className="detail-line">
                      <span className="label"><b>Ack Date: </b>{ackDate}</span>
                      {/* <span className="value">{ackDate}</span> */}
                    </div>
                  )}
                  {ackNo && (
                    <div className="detail-line">
                      <span className="label"><b>Ack No: </b>{ackNo}</span>
                      {/* <span className="value">{ackNo}</span>  */}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* IMAGE/QR CODE */}
            {imageUrl ? (
              <div className="qr-code" style={{ position: 'relative', minHeight: '120px' }}>
                <img
                  src={imageUrl}
                  alt="QR Code"
                  style={{
                    width: '100px',
                    height: '100px',
                    border: '1px solid #ccc',
                    display: 'block',
                    opacity: imageLoaded ? 1 : 0.3
                  }}
                  onLoad={() => {
                    console.log('Image onLoad event fired');
                    setImageLoaded(true);
                  }}
                  onError={(e) => {
                    console.error('Image onError event fired:', e);
                    setImageError(true);
                  }}
                  crossOrigin="anonymous"
                />

                {!imageLoaded && !imageError && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    fontSize: '10px',
                    color: '#666'
                  }}>
                    Loading image...
                  </div>
                )}

                {imageError && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    fontSize: '10px',
                    color: 'red',
                    background: '#ffeeee',
                    padding: '5px',
                    borderRadius: '3px'
                  }}>
                    Image not available
                  </div>
                )}
              </div>
            ) : qrCodeUrl ? (
              <div className="qr-code">
                <QRCode value={qrCodeUrl} size={100} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="certification-section">
          <div className="certification-text">
            <p>Certified that particulars given above are true and correct and the amount indicated represents the price actually charged and that there is no flow of additional consideration directly or indirectly from the buyer</p>
          </div>
          <div className="signature-box">
            <p>Welcome</p>
            <div className="signature-line"></div>
            <p>Authorized Signatory</p>
          </div>
        </div>

        <div className="jurisdiction-note">
          <p>Subject to Vadodara Jurisdiction</p>
        </div>
      </div>

    </div>
  );
};

export default SalesPrint;