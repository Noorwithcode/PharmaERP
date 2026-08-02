const PDFDocument = require("pdfkit");

/*
|--------------------------------------------------------------------------
| Page configuration
|--------------------------------------------------------------------------
*/

const PAGE = {
  marginLeft: 34,
  marginRight: 34,
  contentBottom: 785,
};

const COLORS = {
  primary: "#0F4C81",
  primaryDark: "#08355D",
  secondary: "#EAF3FA",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#D6DEE6",
  light: "#F8FAFC",
  white: "#FFFFFF",
  success: "#15803D",
  warning: "#B45309",
  danger: "#B91C1C",
};

/*
|--------------------------------------------------------------------------
| Formatting helpers
|--------------------------------------------------------------------------
*/

const safeText = (value, fallback = "-") => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  return String(value).trim();
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
 * Environment variables are retained only
 * as backward-compatible fallbacks.
 */
const buildCompanyProfile = (
  pharmacy = {}
) => {
  return {
    name:
      firstTextValue(
        pharmacy.pharmacyName,
        process.env.PHARMACY_NAME,
        "PharmaERP Pharmacy"
      ),

    address:
      firstTextValue(
        pharmacy.address,
        process.env.PHARMACY_ADDRESS,
        "Pharmacy Address"
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
        process.env.PHARMACY_EMAIL,
        "-"
      ),

    gstin:
      firstTextValue(
        pharmacy.gstin,
        process.env.PHARMACY_GSTIN,
        "-"
      ),

    drugLicence:
      firstTextValue(
        pharmacy.drugLicenseNumber,
        process.env.PHARMACY_DL_NUMBER,
        process.env.PHARMACY_DRUG_LICENCE,
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
        "Computer-generated purchase invoice"
      )
  };
};

const numberValue = (value) => {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

const formatMoney = (value) => {
  return `Rs. ${numberValue(value).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const [year, month, day] = value.split("-");

    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return safeText(value);
  }

  return date.toLocaleDateString("en-GB");
};

const paymentStatusColor = (status) => {
  const normalizedStatus = safeText(status, "")
    .toUpperCase();

  if (normalizedStatus === "PAID") {
    return COLORS.success;
  }

  if (normalizedStatus === "PARTIAL") {
    return COLORS.warning;
  }

  return COLORS.danger;
};

/*
|--------------------------------------------------------------------------
| Common drawing helpers
|--------------------------------------------------------------------------
*/

const drawBox = (
  doc,
  x,
  y,
  width,
  height,
  options = {}
) => {
  doc.save();

  doc
    .lineWidth(options.lineWidth || 0.7)
    .roundedRect(
      x,
      y,
      width,
      height,
      options.radius || 6
    );

  if (options.fillColor) {
    doc.fillAndStroke(
      options.fillColor,
      options.strokeColor || COLORS.border
    );
  } else {
    doc.stroke(
      options.strokeColor || COLORS.border
    );
  }

  doc.restore();
};

const drawLabelValue = (
  doc,
  label,
  value,
  x,
  y,
  width,
  options = {}
) => {
  doc
    .font("Helvetica")
    .fontSize(options.labelSize || 7.5)
    .fillColor(COLORS.muted)
    .text(label, x, y, {
      width,
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(options.valueSize || 8.5)
    .fillColor(
      options.valueColor || COLORS.text
    )
    .text(
      safeText(value),
      x,
      y + 11,
      {
        width,
        lineBreak: false,
        ellipsis: true,
      }
    );
};

/*
|--------------------------------------------------------------------------
| Invoice header
|--------------------------------------------------------------------------
*/

const drawHeader = (
  doc,
  purchase,
  company,
  continued = false
) => {
  const x = PAGE.marginLeft;
  const y = 28;

  const width =
    doc.page.width -
    PAGE.marginLeft -
    PAGE.marginRight;

  const height = continued ? 60 : 78;

  doc
    .roundedRect(
      x,
      y,
      width,
      height,
      8
    )
    .fill(COLORS.primary);

  doc
    .font("Helvetica-Bold")
    .fontSize(continued ? 16 : 20)
    .fillColor(COLORS.white)
    .text(
      company.name,
      x + 18,
      y + 14,
      {
        width: 300,
        lineBreak: false,
        ellipsis: true,
      }
    );

  if (!continued) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#E8F2FB")
      .text(
        safeText(company.address),
        x + 18,
        y + 39,
        {
          width: 300,
          lineBreak: false,
          ellipsis: true,
        }
      );

    doc.text(
      `Phone: ${safeText(
        company.phone
      )}   |   Email: ${safeText(
        company.email
      )}`,
      x + 18,
      y + 52,
      {
        width: 310,
        lineBreak: false,
        ellipsis: true,
      }
    );

    doc.text(
      `GSTIN: ${safeText(
        company.gstin
      )}   |   Drug Licence: ${safeText(
        company.drugLicence
      )}`,
      x + 18,
      y + 64,
      {
        width: 310,
        lineBreak: false,
        ellipsis: true,
      }
    );
  } else {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#E8F2FB")
      .text(
        "Purchase invoice continued",
        x + 18,
        y + 37,
        {
          lineBreak: false,
        }
      );
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(continued ? 15 : 17)
    .fillColor(COLORS.white)
    .text(
      continued
        ? "PURCHASE INVOICE"
        : "PURCHASE INVOICE",
      x + 330,
      y + 16,
      {
        width: 175,
        align: "right",
        lineBreak: false,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#E8F2FB")
    .text(
      `Purchase No: ${safeText(
        purchase.purchaseNumber
      )}`,
      x + 330,
      y + 40,
      {
        width: 175,
        align: "right",
        lineBreak: false,
        ellipsis: true,
      }
    );

  if (!continued) {
    doc.text(
      `Purchase Date: ${formatDate(
        purchase.purchaseDate
      )}`,
      x + 330,
      y + 54,
      {
        width: 175,
        align: "right",
        lineBreak: false,
      }
    );
  }

  return y + height + 14;
};

/*
|--------------------------------------------------------------------------
| Supplier and purchase information
|--------------------------------------------------------------------------
*/

const drawInvoiceInformation = (
  doc,
  purchase,
  startY
) => {
  const x = PAGE.marginLeft;

  const totalWidth =
    doc.page.width -
    PAGE.marginLeft -
    PAGE.marginRight;

  const gap = 12;
  const leftWidth = 287;
  const rightWidth =
    totalWidth - leftWidth - gap;

  const boxHeight = 106;

  drawBox(
    doc,
    x,
    startY,
    leftWidth,
    boxHeight,
    {
      fillColor: COLORS.light,
    }
  );

  drawBox(
    doc,
    x + leftWidth + gap,
    startY,
    rightWidth,
    boxHeight,
    {
      fillColor: COLORS.light,
    }
  );

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.primary)
    .text(
      "SUPPLIER DETAILS",
      x + 13,
      startY + 11,
      {
        lineBreak: false,
      }
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(COLORS.text)
    .text(
      safeText(purchase.supplierName),
      x + 13,
      startY + 30,
      {
        width: leftWidth - 26,
        lineBreak: false,
        ellipsis: true,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      `Contact: ${safeText(
        purchase.supplierContactPerson
      )}`,
      x + 13,
      startY + 48,
      {
        width: leftWidth - 26,
        lineBreak: false,
        ellipsis: true,
      }
    );

  doc.text(
    `Phone: ${safeText(
      purchase.supplierPhone
    )}`,
    x + 13,
    startY + 62,
    {
      width: 125,
      lineBreak: false,
      ellipsis: true,
    }
  );

  doc.text(
    `GSTIN: ${safeText(
      purchase.supplierGstin
    )}`,
    x + 142,
    startY + 62,
    {
      width: 130,
      lineBreak: false,
      ellipsis: true,
    }
  );

  doc.text(
    `Address: ${safeText(
      purchase.supplierAddress
    )}`,
    x + 13,
    startY + 77,
    {
      width: leftWidth - 26,
      height: 23,
      ellipsis: true,
    }
  );

  const rightX =
    x + leftWidth + gap + 13;

  const halfColumn =
    (rightWidth - 39) / 2;

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.primary)
    .text(
      "PURCHASE DETAILS",
      rightX,
      startY + 11,
      {
        lineBreak: false,
      }
    );

  drawLabelValue(
    doc,
    "Supplier Invoice",
    purchase.invoiceNumber,
    rightX,
    startY + 30,
    halfColumn
  );

  drawLabelValue(
    doc,
    "Invoice Date",
    formatDate(purchase.invoiceDate),
    rightX + halfColumn + 13,
    startY + 30,
    halfColumn
  );

  drawLabelValue(
    doc,
    "Payment Method",
    purchase.paymentMethod,
    rightX,
    startY + 64,
    halfColumn
  );

  drawLabelValue(
    doc,
    "Payment Status",
    purchase.paymentStatus,
    rightX + halfColumn + 13,
    startY + 64,
    halfColumn,
    {
      valueColor: paymentStatusColor(
        purchase.paymentStatus
      ),
    }
  );

  return startY + boxHeight + 14;
};

/*
|--------------------------------------------------------------------------
| Medicine table
|--------------------------------------------------------------------------
*/

const TABLE_COLUMNS = [
  {
    title: "#",
    width: 28,
    align: "center",
  },
  {
    title: "Medicine",
    width: 145,
    align: "left",
  },
  {
    title: "Batch / Expiry",
    width: 82,
    align: "left",
  },
  {
    title: "Qty",
    width: 38,
    align: "center",
  },
  {
    title: "Free",
    width: 38,
    align: "center",
  },
  {
    title: "Rate",
    width: 58,
    align: "right",
  },
  {
    title: "GST",
    width: 42,
    align: "right",
  },
  {
    title: "Total",
    width: 96,
    align: "right",
  },
];

const drawTableHeader = (
  doc,
  startY
) => {
  let currentX = PAGE.marginLeft;

  const tableWidth = TABLE_COLUMNS.reduce(
    (total, column) =>
      total + column.width,
    0
  );

  doc
    .rect(
      PAGE.marginLeft,
      startY,
      tableWidth,
      27
    )
    .fill(COLORS.primaryDark);

  TABLE_COLUMNS.forEach((column) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(COLORS.white)
      .text(
        column.title,
        currentX + 5,
        startY + 9,
        {
          width: column.width - 10,
          align: column.align,
          lineBreak: false,
        }
      );

    currentX += column.width;
  });

  return startY + 27;
};

const getMedicineText = (item) => {
  const brandName = safeText(
    item.brandName,
    "Medicine"
  );

  const details = [
    item.genericName,
    item.strength,
  ]
    .filter(Boolean)
    .join(" ");

  return details
    ? `${brandName}\n${details}`
    : brandName;
};

const getRowHeight = (doc, item) => {
  doc
    .font("Helvetica")
    .fontSize(7.5);

  const medicineHeight =
    doc.heightOfString(
      getMedicineText(item),
      {
        width: 135,
      }
    );

  const batchHeight =
    doc.heightOfString(
      `${safeText(
        item.batchNumber
      )}\nExp: ${formatDate(
        item.expiryDate
      )}`,
      {
        width: 72,
      }
    );

  return Math.max(
    38,
    medicineHeight + 14,
    batchHeight + 14
  );
};

const drawTableRow = (
  doc,
  item,
  index,
  startY
) => {
  const rowHeight =
    getRowHeight(doc, item);

  let currentX = PAGE.marginLeft;

  const values = [
    String(index + 1),

    getMedicineText(item),

    `${safeText(
      item.batchNumber
    )}\nExp: ${formatDate(
      item.expiryDate
    )}`,

    safeText(item.quantity, "0"),

    safeText(item.freeQuantity, "0"),

    formatMoney(item.purchasePrice),

    `${numberValue(
      item.gstPercent
    ).toFixed(2)}%`,

    formatMoney(item.lineTotal),
  ];

  const tableWidth = TABLE_COLUMNS.reduce(
    (total, column) =>
      total + column.width,
    0
  );

  doc
    .rect(
      PAGE.marginLeft,
      startY,
      tableWidth,
      rowHeight
    )
    .fill(
      index % 2 === 0
        ? COLORS.white
        : COLORS.light
    );

  TABLE_COLUMNS.forEach(
    (column, columnIndex) => {
      doc
        .rect(
          currentX,
          startY,
          column.width,
          rowHeight
        )
        .lineWidth(0.35)
        .stroke(COLORS.border);

      doc
        .font(
          columnIndex === 1
            ? "Helvetica-Bold"
            : "Helvetica"
        )
        .fontSize(7.2)
        .fillColor(
          columnIndex === 1
            ? COLORS.text
            : COLORS.muted
        )
        .text(
          values[columnIndex],
          currentX + 5,
          startY + 8,
          {
            width: column.width - 10,
            height: rowHeight - 12,
            align: column.align,
            ellipsis: true,
          }
        );

      currentX += column.width;
    }
  );

  return startY + rowHeight;
};

const drawItemsTable = (
  doc,
  purchase,
  items,
  startY,
  company
) => {
  let currentY =
    drawTableHeader(doc, startY);

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    const tableWidth =
      TABLE_COLUMNS.reduce(
        (total, column) =>
          total + column.width,
        0
      );

    doc
      .rect(
        PAGE.marginLeft,
        currentY,
        tableWidth,
        40
      )
      .stroke(COLORS.border);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(
        "No purchase items found",
        PAGE.marginLeft,
        currentY + 15,
        {
          width: tableWidth,
          align: "center",
          lineBreak: false,
        }
      );

    return currentY + 40;
  }

  items.forEach((item, index) => {
    const requiredHeight =
      getRowHeight(doc, item);

    if (
      currentY + requiredHeight >
      PAGE.contentBottom
    ) {
      doc.addPage();

      currentY = drawHeader(
        doc,
        purchase,
        company,
        true
      );

      currentY =
        drawTableHeader(
          doc,
          currentY
        );
    }

    currentY = drawTableRow(
      doc,
      item,
      index,
      currentY
    );
  });

  return currentY;
};

/*
|--------------------------------------------------------------------------
| Totals, notes and signature
|--------------------------------------------------------------------------
*/

const drawTotalsSection = (
  doc,
  purchase,
  startY,
  company
) => {
  const requiredHeight = 198;

  let currentY = startY + 15;

  if (
    currentY + requiredHeight >
    PAGE.contentBottom
  ) {
    doc.addPage();

    currentY = drawHeader(
      doc,
      purchase,
      company,
      true
    );
  }

  const x = PAGE.marginLeft;

  const contentWidth =
    doc.page.width -
    PAGE.marginLeft -
    PAGE.marginRight;

  const gap = 12;
  const totalsWidth = 236;

  const notesWidth =
    contentWidth -
    totalsWidth -
    gap;

  drawBox(
    doc,
    x,
    currentY,
    notesWidth,
    180,
    {
      fillColor: COLORS.light,
    }
  );

  drawBox(
    doc,
    x + notesWidth + gap,
    currentY,
    totalsWidth,
    180,
    {
      fillColor: COLORS.white,
    }
  );

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.primary)
    .text(
      "NOTES & AUTHORISATION",
      x + 13,
      currentY + 12,
      {
        lineBreak: false,
      }
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor(COLORS.primary)
    .text(
      "INVOICE TERMS",
      x + 13,
      currentY + 76,
      {
        width: notesWidth - 26,
        lineBreak: false,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text(
      safeText(
        company.invoiceTerms,
        "Please verify all purchase details before approval."
      ),
      x + 13,
      currentY + 89,
      {
        width: notesWidth - 26,
        height: 27,
        lineGap: 1,
        ellipsis: true,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      safeText(
        purchase.notes,
        "No additional notes."
      ),
      x + 13,
      currentY + 34,
      {
        width: notesWidth - 26,
        height: 32,
        ellipsis: true,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(
      `Created by: ${safeText(
        purchase.createdBy
      )}`,
      x + 13,
      currentY + 121,
      {
        width: notesWidth - 26,
        lineBreak: false,
        ellipsis: true,
      }
    );

  doc
    .moveTo(
      x + notesWidth - 135,
      currentY + 145
    )
    .lineTo(
      x + notesWidth - 20,
      currentY + 145
    )
    .strokeColor(COLORS.border)
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text(
      "Authorised Signature",
      x + notesWidth - 135,
      currentY + 151,
      {
        width: 115,
        align: "center",
        lineBreak: false,
      }
    );

  const totalsX =
    x + notesWidth + gap + 14;

  const totalsTextWidth =
    totalsWidth - 28;

  let totalsY = currentY + 15;

  const drawTotalRow = (
    label,
    value,
    options = {}
  ) => {
    doc
      .font(
        options.bold
          ? "Helvetica-Bold"
          : "Helvetica"
      )
      .fontSize(
        options.size || 8
      )
      .fillColor(
        options.color || COLORS.text
      )
      .text(
        label,
        totalsX,
        totalsY,
        {
          width: totalsTextWidth / 2,
          lineBreak: false,
        }
      );

    doc.text(
      formatMoney(value),
      totalsX + totalsTextWidth / 2,
      totalsY,
      {
        width: totalsTextWidth / 2,
        align: "right",
        lineBreak: false,
      }
    );

    totalsY += options.gap || 18;
  };

  drawTotalRow(
    "Subtotal",
    purchase.subtotal
  );

  drawTotalRow(
    "Discount",
    purchase.discountAmount
  );

  drawTotalRow(
    "Taxable Amount",
    purchase.taxableAmount
  );

  drawTotalRow(
    "GST Amount",
    purchase.taxAmount
  );

  drawTotalRow(
    "Round Off",
    purchase.roundOff
  );

  doc
    .moveTo(totalsX, totalsY - 4)
    .lineTo(
      totalsX + totalsTextWidth,
      totalsY - 4
    )
    .strokeColor(COLORS.border)
    .stroke();

  drawTotalRow(
    "Grand Total",
    purchase.grandTotal,
    {
      bold: true,
      size: 10,
      color: COLORS.primaryDark,
      gap: 22,
    }
  );

  drawTotalRow(
    "Paid Amount",
    purchase.paidAmount,
    {
      color: COLORS.success,
    }
  );

  drawTotalRow(
    "Due Amount",
    purchase.dueAmount,
    {
      bold: true,
      color:
        numberValue(
          purchase.dueAmount
        ) > 0
          ? COLORS.danger
          : COLORS.success,
    }
  );

  return currentY + 180;
};

/*
|--------------------------------------------------------------------------
| Page footer
|--------------------------------------------------------------------------
*/

const drawFooter = (
  doc,
  pageNumber,
  totalPages,
  company
) => {
  const y = doc.page.height - 26;

  doc.save();

  doc
    .moveTo(
      PAGE.marginLeft,
      y - 7
    )
    .lineTo(
      doc.page.width -
        PAGE.marginRight,
      y - 7
    )
    .lineWidth(0.5)
    .strokeColor(COLORS.border)
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(6.8)
    .fillColor(COLORS.muted)
    .text(
      safeText(
        company.invoiceFooter,
        "Computer-generated purchase invoice"
      ),
      PAGE.marginLeft,
      y,
      {
        width: 245,
        lineBreak: false,
        ellipsis: true,
      }
    );

  doc.text(
    safeText(
      company.name,
      "PharmaERP Pharmacy"
    ),
    280,
    y,
    {
      width: 150,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    }
  );

  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    doc.page.width -
      PAGE.marginRight -
      120,
    y,
    {
      width: 120,
      align: "right",
      lineBreak: false,
    }
  );

  doc.restore();
};

/*
|--------------------------------------------------------------------------
| Render purchase invoice
|--------------------------------------------------------------------------
*/

const renderPurchaseInvoice = async ({
  purchase,
  items,
  pharmacy = {},
  res,
}) => {
  if (!purchase) {
    throw new Error(
      "Purchase data is required to generate PDF"
    );
  }

  const company =
    buildCompanyProfile(
      pharmacy
    );

  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title:
        `${safeText(
          purchase.purchaseNumber,
          "Purchase"
        )} Purchase Invoice`,
      Author: company.name,
      Subject: "Purchase Invoice",
    },
  });

  doc.pipe(res);

  let currentY = drawHeader(
    doc,
    purchase,
    company
  );

  currentY =
    drawInvoiceInformation(
      doc,
      purchase,
      currentY
    );

  currentY = drawItemsTable(
    doc,
    purchase,
    items,
    currentY,
    company
  );

  drawTotalsSection(
    doc,
    purchase,
    currentY,
    company
  );

  const pageRange =
    doc.bufferedPageRange();

  for (
    let index = 0;
    index < pageRange.count;
    index += 1
  ) {
    doc.switchToPage(
      pageRange.start + index
    );

    drawFooter(
      doc,
      index + 1,
      pageRange.count,
      company
    );
  }

  doc.end();
};

module.exports = {
  renderPurchaseInvoice,
};