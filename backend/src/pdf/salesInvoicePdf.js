const PDFDocument = require("pdfkit");

const {
  formatMoney,
  formatDate,
  safeText
} = require("../utils/formatters");

const PAGE = {
  left: 40,
  right: 555,
  top: 40,
  contentBottom: 755,
  tableBottom: 655,
  footerY: 772
};

const COLORS = {
  primary: "#153E75",
  secondary: "#2B6CB0",
  lightBlue: "#EBF8FF",
  lightGray: "#F7FAFC",
  border: "#CBD5E0",
  text: "#1A202C",
  muted: "#4A5568",
  red: "#C53030",
  green: "#276749",
  white: "#FFFFFF"
};

const toNumber = (value) => {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

const toText = (
  value,
  fallback = "-"
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return safeText(String(value));
};

const firstTextValue = (
  ...values
) => {
  const matchedValue =
    values.find((value) => {
      return (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      );
    });

  return matchedValue === undefined
    ? ""
    : String(matchedValue).trim();
};

/**
 * Database settings are preferred.
 * Environment variables remain only as
 * backward-compatible fallbacks.
 */
const buildPharmacyProfile = (
  pharmacy = {}
) => {
  return {
    pharmacyName:
      firstTextValue(
        pharmacy.pharmacyName,
        process.env.PHARMACY_NAME,
        "PharmaERP Pharmacy"
      ),

    address:
      firstTextValue(
        pharmacy.address,
        process.env.PHARMACY_ADDRESS,
        "Raiganj, Uttar Dinajpur, West Bengal"
      ),

    phone:
      firstTextValue(
        pharmacy.phone,
        process.env.PHARMACY_PHONE,
        "-"
      ),

    email:
      firstTextValue(
        pharmacy.email,
        process.env.PHARMACY_EMAIL
      ),

    gstin:
      firstTextValue(
        pharmacy.gstin,
        process.env.PHARMACY_GSTIN,
        "-"
      ),

    drugLicenseNumber:
      firstTextValue(
        pharmacy.drugLicenseNumber,
        process.env.PHARMACY_DL_NUMBER,
        "-"
      ),

    invoiceTerms:
      firstTextValue(
        pharmacy.invoiceTerms,
        "Please verify medicines, batch and expiry before leaving. Returns are subject to pharmacy return policy."
      ),

    invoiceFooter:
      firstTextValue(
        pharmacy.invoiceFooter,
        "This is a computer-generated tax invoice."
      )
  };
};

const drawLine = (
  doc,
  y,
  color = COLORS.border
) => {
  doc
    .moveTo(PAGE.left, y)
    .lineTo(PAGE.right, y)
    .lineWidth(0.7)
    .strokeColor(color)
    .stroke();
};

const drawMainHeader = (
  doc,
  sale,
  pharmacy
) => {
  doc
    .rect(
      PAGE.left,
      PAGE.top,
      PAGE.right - PAGE.left,
      92
    )
    .fill(COLORS.primary);

  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(
      toText(
        pharmacy.pharmacyName,
        "PHARMA ERP PHARMACY"
      ),
      52,
      52,
      {
        width: 305,
        lineBreak: false
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      toText(
        pharmacy.address,
        "Raiganj, Uttar Dinajpur, West Bengal"
      ),
      52,
      77,
      {
        width: 305,
        height: 13,
        ellipsis: true
      }
    );

  doc.text(
    `Phone: ${toText(
      pharmacy.phone,
      "9876543210"
    )}`,
    52,
    92,
    {
      width: 305,
      lineBreak: false
    }
  );

  if (pharmacy.email) {
    doc.text(
      `Email: ${toText(
        pharmacy.email
      )}`,
      52,
      106,
      {
        width: 305,
        lineBreak: false
      }
    );
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(17)
    .fillColor(COLORS.white)
    .text(
      "TAX INVOICE",
      365,
      54,
      {
        width: 175,
        align: "right",
        lineBreak: false
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Original for Recipient",
      365,
      77,
      {
        width: 175,
        align: "right",
        lineBreak: false
      }
    );

  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      `GSTIN: ${toText(
        pharmacy.gstin
      )}`,
      PAGE.left,
      141,
      {
        width: 275,
        lineBreak: false
      }
    );

  doc.text(
    `Drug Licence: ${toText(
      pharmacy.drugLicenseNumber
    )}`,
    PAGE.left,
    155,
    {
      width: 290,
      lineBreak: false
    }
  );

  doc
    .font("Helvetica-Bold")
    .text(
      "Invoice No:",
      350,
      141,
      {
        width: 80,
        align: "right",
        lineBreak: false
      }
    );

  doc
    .font("Helvetica")
    .text(
      toText(sale.invoiceNumber),
      435,
      141,
      {
        width: 120,
        align: "right",
        lineBreak: false
      }
    );

  doc
    .font("Helvetica-Bold")
    .text(
      "Invoice Date:",
      350,
      155,
      {
        width: 80,
        align: "right",
        lineBreak: false
      }
    );

  doc
    .font("Helvetica")
    .text(
      formatDate(sale.saleDate),
      435,
      155,
      {
        width: 120,
        align: "right",
        lineBreak: false
      }
    );

  drawLine(doc, 174);
};

const drawCustomerSection = (
  doc,
  sale
) => {
  const top = 184;

  doc
    .roundedRect(
      PAGE.left,
      top,
      PAGE.right - PAGE.left,
      77,
      3
    )
    .fillAndStroke(
      COLORS.lightGray,
      COLORS.border
    );

  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      "BILL TO",
      50,
      top + 9,
      {
        lineBreak: false
      }
    );

  doc
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(
      toText(
        sale.customerName,
        "Cash Customer"
      ),
      50,
      top + 25,
      {
        width: 235,
        lineBreak: false,
        ellipsis: true
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      `Phone: ${toText(
        sale.customerPhone
      )}`,
      50,
      top + 42,
      {
        width: 235,
        lineBreak: false,
        ellipsis: true
      }
    );

  doc.text(
    `Address: ${toText(
      sale.customerAddress
    )}`,
    50,
    top + 56,
    {
      width: 235,
      height: 14,
      ellipsis: true
    }
  );

  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      "SALE DETAILS",
      320,
      top + 9,
      {
        lineBreak: false
      }
    );

  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      `Sale Type: ${toText(
        sale.saleType,
        "RETAIL"
      )}`,
      320,
      top + 27,
      {
        width: 220,
        lineBreak: false
      }
    );

  doc.text(
    `Payment: ${toText(
      sale.paymentStatus
    )}`,
    320,
    top + 43,
    {
      width: 220,
      lineBreak: false
    }
  );

  if (sale.doctorName) {
    doc.text(
      `Doctor: ${toText(
        sale.doctorName
      )}`,
      320,
      top + 59,
      {
        width: 220,
        lineBreak: false,
        ellipsis: true
      }
    );
  }
};

const columns = [
  {
    label: "SL",
    key: "serial",
    x: 40,
    width: 24,
    align: "center"
  },
  {
    label: "Medicine",
    key: "medicine",
    x: 64,
    width: 132,
    align: "left"
  },
  {
    label: "Batch",
    key: "batch",
    x: 196,
    width: 66,
    align: "left"
  },
  {
    label: "Expiry",
    key: "expiry",
    x: 262,
    width: 56,
    align: "center"
  },
  {
    label: "Qty",
    key: "quantity",
    x: 318,
    width: 34,
    align: "center"
  },
  {
    label: "Rate",
    key: "rate",
    x: 352,
    width: 60,
    align: "right"
  },
  {
    label: "GST",
    key: "gst",
    x: 412,
    width: 42,
    align: "center"
  },
  {
    label: "Amount",
    key: "amount",
    x: 454,
    width: 101,
    align: "right"
  }
];

const drawTableHeader = (
  doc,
  y
) => {
  doc
    .rect(
      PAGE.left,
      y,
      PAGE.right - PAGE.left,
      25
    )
    .fill(COLORS.secondary);

  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(8);

  columns.forEach((column) => {
    doc.text(
      column.label,
      column.x + 3,
      y + 8,
      {
        width: column.width - 6,
        align: column.align,
        lineBreak: false
      }
    );
  });

  return y + 25;
};

const getMedicineName = (item) => {
  const medicineName =
    item.brandName ||
    item.medicineName ||
    item.brand_name ||
    "Medicine";

  const strength =
    item.strength || "";

  return strength
    ? `${medicineName} ${strength}`
    : medicineName;
};

const getRate = (item) => {
  return toNumber(
    item.sellingPrice ??
    item.unitPrice ??
    item.rate
  );
};

const getGstPercent = (item) => {
  return toNumber(
    item.gstPercent ??
    item.taxRate ??
    item.gst_percent
  );
};

const getLineTotal = (item) => {
  const existingTotal =
    item.lineTotal ??
    item.totalAmount ??
    item.line_total;

  if (
    existingTotal !== undefined &&
    existingTotal !== null
  ) {
    return toNumber(existingTotal);
  }

  return (
    toNumber(item.quantity) *
    getRate(item)
  );
};

const getRowHeight = (
  doc,
  item
) => {
  const medicineName =
    getMedicineName(item);

  const medicineHeight =
    doc.heightOfString(
      toText(medicineName),
      {
        width: 126
      }
    );

  return Math.max(
    28,
    medicineHeight + 12
  );
};

const drawTableRow = (
  doc,
  item,
  index,
  y,
  rowHeight
) => {
  if (index % 2 === 0) {
    doc
      .rect(
        PAGE.left,
        y,
        PAGE.right - PAGE.left,
        rowHeight
      )
      .fill(COLORS.lightGray);
  }

  const expiryDate =
    item.expiryDate ||
    item.expiry_date;

  const rowValues = {
    serial: index + 1,

    medicine:
      toText(
        getMedicineName(item)
      ),

    batch:
      toText(
        item.batchNumber ||
        item.batch_number
      ),

    expiry:
      expiryDate
        ? formatDate(expiryDate)
        : "-",

    quantity:
      toNumber(item.quantity),

    rate:
      formatMoney(
        getRate(item)
      ),

    gst:
      `${getGstPercent(item)}%`,

    amount:
      formatMoney(
        getLineTotal(item)
      )
  };

  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(8);

  columns.forEach((column) => {
    doc.text(
      String(
        rowValues[column.key]
      ),
      column.x + 3,
      y + 9,
      {
        width: column.width - 6,
        align: column.align,
        height: rowHeight - 10,
        ellipsis: true
      }
    );
  });

  doc
    .moveTo(
      PAGE.left,
      y + rowHeight
    )
    .lineTo(
      PAGE.right,
      y + rowHeight
    )
    .lineWidth(0.4)
    .strokeColor(COLORS.border)
    .stroke();

  return y + rowHeight;
};

const drawContinuedPageHeader = (
  doc,
  sale,
  pharmacy
) => {
  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(
      toText(
        pharmacy.pharmacyName,
        "PHARMA ERP PHARMACY"
      ),
      PAGE.left,
      42,
      {
        width: 300,
        lineBreak: false
      }
    );

  doc
    .fontSize(10)
    .text(
      `Invoice: ${toText(
        sale.invoiceNumber
      )}`,
      325,
      44,
      {
        width: 230,
        align: "right",
        lineBreak: false
      }
    );

  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Continued",
      325,
      60,
      {
        width: 230,
        align: "right",
        lineBreak: false
      }
    );

  drawLine(doc, 77);

  return drawTableHeader(
    doc,
    89
  );
};

const drawSummaryRow = (
  doc,
  label,
  value,
  y,
  options = {}
) => {
  doc
    .fillColor(
      options.color ||
      COLORS.text
    )
    .font(
      options.bold
        ? "Helvetica-Bold"
        : "Helvetica"
    )
    .fontSize(
      options.fontSize || 9
    )
    .text(
      label,
      352,
      y,
      {
        width: 105,
        align: "right",
        lineBreak: false
      }
    );

  doc.text(
    value,
    466,
    y,
    {
      width: 78,
      align: "right",
      lineBreak: false
    }
  );
};

const drawSummary = (
  doc,
  sale,
  startY,
  pharmacy
) => {
  const summaryY = startY + 14;

  const subtotal =
    toNumber(sale.subtotal);

  const discount =
    toNumber(
      sale.discountAmount
    );

  const taxAmount =
    toNumber(sale.taxAmount);

  const roundOff =
    toNumber(sale.roundOff);

  const grandTotal =
    toNumber(sale.grandTotal);

  const paidAmount =
    toNumber(sale.paidAmount);

  const dueAmount =
    toNumber(sale.dueAmount);

  const boxHeight =
    discount > 0 ||
      roundOff !== 0
      ? 132
      : 116;

  doc
    .roundedRect(
      342,
      summaryY,
      213,
      boxHeight,
      3
    )
    .strokeColor(COLORS.border)
    .stroke();

  let rowY = summaryY + 11;

  drawSummaryRow(
    doc,
    "Subtotal:",
    formatMoney(subtotal),
    rowY
  );

  rowY += 16;

  if (discount > 0) {
    drawSummaryRow(
      doc,
      "Discount:",
      `-${formatMoney(discount)}`,
      rowY
    );

    rowY += 16;
  }

  drawSummaryRow(
    doc,
    "Total GST:",
    formatMoney(taxAmount),
    rowY
  );

  rowY += 16;

  if (roundOff !== 0) {
    drawSummaryRow(
      doc,
      "Round Off:",
      formatMoney(roundOff),
      rowY
    );

    rowY += 16;
  }

  doc
    .rect(
      343,
      rowY - 4,
      211,
      27
    )
    .fill(COLORS.lightBlue);

  drawSummaryRow(
    doc,
    "Grand Total:",
    formatMoney(grandTotal),
    rowY + 3,
    {
      bold: true,
      fontSize: 11,
      color: COLORS.primary
    }
  );

  rowY += 32;

  drawSummaryRow(
    doc,
    "Paid Amount:",
    formatMoney(paidAmount),
    rowY,
    {
      color: COLORS.green
    }
  );

  if (dueAmount > 0) {
    rowY += 16;

    drawSummaryRow(
      doc,
      "Due Amount:",
      formatMoney(dueAmount),
      rowY,
      {
        bold: true,
        color: COLORS.red
      }
    );
  }

  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      "Terms & Conditions",
      PAGE.left,
      summaryY,
      {
        lineBreak: false
      }
    );

  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(
      toText(
        pharmacy.invoiceTerms,
        "Please verify medicines, batch and expiry before leaving."
      ),
      PAGE.left,
      summaryY + 17,
      {
        width: 275,
        height: 43,
        lineGap: 2,
        ellipsis: true
      }
    );

  if (sale.notes) {
    doc
      .fillColor(COLORS.primary)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(
        "Invoice Notes",
        PAGE.left,
        summaryY + 68,
        {
          lineBreak: false
        }
      );

    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(
        toText(sale.notes),
        PAGE.left,
        summaryY + 83,
        {
          width: 275,
          height: 30,
          ellipsis: true
        }
      );
  }

  const signatureY =
    Math.min(
      Math.max(
        summaryY + 142,
        rowY + 38
      ),
      735
    );

  doc
    .moveTo(405, signatureY)
    .lineTo(545, signatureY)
    .lineWidth(0.7)
    .strokeColor(COLORS.text)
    .stroke();

  doc
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      "Authorized Signatory",
      405,
      signatureY + 7,
      {
        width: 140,
        align: "center",
        lineBreak: false
      }
    );
};

const drawFooter = (
  doc,
  pageNumber,
  totalPages,
  pharmacy
) => {
  const footerY = PAGE.footerY;

  doc
    .moveTo(PAGE.left, footerY)
    .lineTo(PAGE.right, footerY)
    .lineWidth(0.5)
    .strokeColor(COLORS.border)
    .stroke();

  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      toText(
        pharmacy.invoiceFooter,
        "This is a computer-generated tax invoice."
      ),
      PAGE.left,
      footerY + 8,
      {
        width: 270,
        lineBreak: false,
        ellipsis: true
      }
    );

  doc.text(
    toText(
      pharmacy.pharmacyName,
      "PharmaERP Pharmacy"
    ),
    310,
    footerY + 8,
    {
      width: 165,
      align: "right",
      lineBreak: false,
      ellipsis: true
    }
  );

  doc
    .fontSize(7)
    .text(
      `Page ${pageNumber} of ${totalPages}`,
      480,
      footerY + 8,
      {
        width: 75,
        align: "right",
        lineBreak: false
      }
    );
};

/**
 * Generate professional A4 GST sales invoice.
 */
const renderSalesInvoice = async ({
  sale,
  items,
  pharmacy = {},
  res
}) => {
  return new Promise(
    (resolve, reject) => {
      const pharmacyProfile =
        buildPharmacyProfile(
          pharmacy
        );

      const doc = new PDFDocument({
        size: "A4",

        margins: {
          top: 40,
          right: 40,
          bottom: 42,
          left: 40
        },

        bufferPages: true,

        info: {
          Title:
            `Sales Invoice ${toText(
              sale.invoiceNumber
            )}`,

          Author:
            toText(
              pharmacyProfile.pharmacyName,
              "PharmaERP Pharmacy"
            ),

          Subject:
            "GST Sales Tax Invoice"
        }
      });

      doc.on("error", reject);
      res.on("error", reject);

      doc.pipe(res);

      drawMainHeader(
        doc,
        sale,
        pharmacyProfile
      );
      drawCustomerSection(doc, sale);

      let yPosition =
        drawTableHeader(doc, 276);

      const invoiceItems =
        Array.isArray(items)
          ? items
          : [];

      invoiceItems.forEach(
        (item, index) => {
          const rowHeight =
            getRowHeight(doc, item);

          if (
            yPosition + rowHeight >
            PAGE.tableBottom
          ) {
            doc.addPage();

            yPosition =
              drawContinuedPageHeader(
                doc,
                sale,
                pharmacyProfile
              );
          }

          yPosition =
            drawTableRow(
              doc,
              item,
              index,
              yPosition,
              rowHeight
            );
        }
      );

      if (
        invoiceItems.length === 0
      ) {
        doc
          .fillColor(COLORS.muted)
          .font("Helvetica")
          .fontSize(9)
          .text(
            "No invoice items available.",
            PAGE.left,
            yPosition + 12,
            {
              width:
                PAGE.right -
                PAGE.left,
              align: "center",
              lineBreak: false
            }
          );

        yPosition += 40;
      }

      /*
       * Summary-এর জন্য minimum
       * 190px জায়গা রাখা হচ্ছে।
       */
      if (
        yPosition + 190 >
        PAGE.contentBottom
      ) {
        doc.addPage();

        yPosition =
          drawContinuedPageHeader(
            doc,
            sale,
            pharmacyProfile
          );
      }

      drawSummary(
        doc,
        sale,
        yPosition,
        pharmacyProfile
      );

      /*
       * প্রতিটি existing page-এ footer।
       * Footer safe area-এর মধ্যে থাকায়
       * নতুন blank page তৈরি হবে না।
       */
      const pageRange =
        doc.bufferedPageRange();

      for (
        let pageIndex = 0;
        pageIndex < pageRange.count;
        pageIndex += 1
      ) {
        doc.switchToPage(
          pageRange.start +
          pageIndex
        );

        drawFooter(
          doc,
          pageIndex + 1,
          pageRange.count,
          pharmacyProfile
        );
      }

      doc.end();

      doc.on("end", resolve);
    }
  );
};

module.exports = {
  renderSalesInvoice
};