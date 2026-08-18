// backend/invoiceTemplate.js
import React from "react";
import ReactDOMServer from "react-dom/server";
import SalesPrint from "../frontend/src/components/SalesPrint"; // adjust path if needed
import fs from "fs";
import path from "path";

// Load compiled SCSS (after build) OR read raw CSS file
const cssPath = path.join(__dirname, "../frontend/src/styles/Salesprint.css");
const css = fs.readFileSync(cssPath, "utf8");

export function renderInvoiceHTML(invoiceData) {
  const component = ReactDOMServer.renderToStaticMarkup(
    <SalesPrint invoice={invoiceData} />
  );

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <style>${css}</style>
    </head>
    <body>
      ${component}
    </body>
    </html>
  `;
}
