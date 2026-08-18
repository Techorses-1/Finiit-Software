import { React, useEffect, useState } from "react";
import "./QuotationPrint.scss";

const QuotationPrint = ({ quotation }) => {
  if (!quotation) return null;

  const {
    quotationId,
    quotationNumber,
    quotationDate,
    refNo,
    internalDate,
    party,
    items,
    subtotal,
    cgst,
    sgst,
    igst,
    tcs,
    total,
    remarks,
    terms,
    includeTerms,
    taxSlab,
    tcsPercent
  } = quotation;

  const isIntraState = party?.gstin?.startsWith("24");


  const TERMS_CONDITIONS = `
All quotations are valid for 30 days from the date of issue.
Prices are subject to change without notice.
Delivery is subject to availability of stock.
  `;

  return (
    <div id="quotation-pdf">
      <div className="main-content">
        {/* Company GST and LUT details - SAME AS SALES */}
        <div className="company-details">
          <div className="left-details">
            <p><strong>GSTIN :</strong> 24AAAFF299.....</p>
            <p><strong>State :</strong> Gujarat, Code: 24</p>
            <p><strong>PAN No :</strong> AAAFF.....</p>
          </div>
          <div className="middle-details">
            <p><strong>MICRO UNIT AS PER MSME RULES</strong></p>
            <p><strong>UDYAM No:</strong> UDYAM-GJ-24-00.....</p>
          </div>
          <div className="right-details">
            <p><strong>LUT ARN No :</strong> AD24032303.....&nbsp;&nbsp;&nbsp;</p>
            <p><strong>From:</strong> 01/04/2025 <strong>To:</strong> 31/03/2026</p>
          </div>
        </div>

        {/* QUOTATION HEADER with internal date on right side */}
        <div className="quotation-header-section">
          <div className="quotation-title">
            <h3>QUOTATION</h3>
          </div>
          <div className="internal-date-display">
            <p><strong>Date:</strong> {internalDate}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p>
          </div>
        </div>

        {/* TWO BOX LAYOUT: Customer Details (Left) and Quotation Details (Right) */}
        <div className="party-section">
          {/* LEFT BOX: Customer Details */}
          <div className="party-card">
            <h3>Customer Details</h3>
            <p><strong>{party.companyName}</strong></p>
            <p>{party.name}</p>
            <p>{party.gstin}</p>
            <p>{party.address}</p>
            <p>{party.contactNumber}</p>
            <p>{party.email}</p>
          </div>

          {/* RIGHT BOX: Quotation Details */}
          <div className="party-card">
            <h3>Quotation Details</h3>
            <p><strong>Quotation ID:</strong> {quotationId}</p>
            <p><strong>Quotation No:</strong> {quotationNumber}</p>
            <p><strong>Quotation Date:</strong> {quotationDate}</p>
            <p><strong>Ref No:</strong> {refNo || 'N/A'}</p>
          </div>
        </div>

        {/* Products Table - SAME AS SALES */}
        <div className="items-container">
          <table className="items-table">
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
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

        {/* Summary Section */}
        <div className="summary-section">
          {/* Left side for remarks */}
          <div className="remarks-section">
            {remarks && (
              <div className="remarks-content">
                <h4>Remarks</h4>
                <p className="remarks-text">{remarks}</p>
              </div>
            )}
          </div>

          {/* Right side: Amount calculations */}
          <div className="amount-details">
            <table>
              <tbody>
                <tr><td>Subtotal:</td><td>₹{subtotal?.toFixed(2)}</td></tr>

                {cgst > 0 && (
                  <tr>
                    <td>CGST ({isIntraState ? taxSlab / 2 : 0}%):</td>
                    <td>₹{cgst?.toFixed(2)}</td>
                  </tr>
                )}
                {sgst > 0 && (
                  <tr>
                    <td>SGST ({isIntraState ? taxSlab / 2 : 0}%):</td>
                    <td>₹{sgst?.toFixed(2)}</td>
                  </tr>
                )}
                {igst > 0 && (
                  <tr>
                    <td>IGST ({!isIntraState ? taxSlab : 0}%):</td>
                    <td>₹{igst?.toFixed(2)}</td>
                  </tr>
                )}

                {tcs > 0 && (
                  <tr>
                    <td>TCS ({tcsPercent}%):</td>
                    <td>₹{tcs?.toFixed(2)}</td>
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

        {/* Terms & Conditions Section */}
        {includeTerms && (
          <div className="terms-section">
            <h4>Terms & Conditions</h4>
            <pre className="terms-content">{TERMS_CONDITIONS}</pre>
          </div>
        )}

        {/* Certification Section */}
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

        {/* Jurisdiction Note */}
        <div className="jurisdiction-note">
          <p>Subject to Vadodara Jurisdiction</p>
        </div>
      </div>
    </div>
  );
};

export default QuotationPrint;