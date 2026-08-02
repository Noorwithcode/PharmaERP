const PDFDocument = require("pdfkit");

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

const numberValue = (value) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
};

const money = (value) => {
  return `Rs. ${numberValue(value).toFixed(2)}`;
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const text = String(value).trim();

  const dateMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!dateMatch) {
    return text;
  }

  return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
};

const truncate = (
  value,
  maxLength
) => {
  const text = safeText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(
    0,
    Math.max(maxLength - 3, 1)
  )}...`;
};

/*
|--------------------------------------------------------------------------
| PDF constants
|--------------------------------------------------------------------------
*/

const PAGE_SIZE = "A4";
const PAGE_MARGIN = 36;

const COLORS = {
  primary: "#123B66",
  primaryDark: "#0A2948",
  primaryLight: "#EAF2FA",
  border: "#C9D5E1",
  text: "#1F2937",
  muted: "#64748B",
  white: "#FFFFFF",
  light: "#F8FAFC",
  success: "#166534",
};

const TABLE_COLUMNS = [
  {
    key: "index",
    label: "#",
    width: 24,
    align: "center",
  },
  {
    key: "medicine",
    label: "Medicine",
    width: 137,
    align: "left",
  },
  {
    key: "batch",
    label: "Batch",
    width: 76,
    align: "left",
  },
  {
    key: "quantity",
    label: "Qty",
    width: 34,
    align: "center",
  },
  {
    key: "rate",
    label: "Rate",
    width: 64,
    align: "right",
  },
  {
    key: "discount",
    label: "Disc.",
    width: 57,
    align: "right",
  },
  {
    key: "gst",
    label: "GST",
    width: 54,
    align: "right",
  },
  {
    key: "amount",
    label: "Amount",
    width: 77,
    align: "right",
  },
];

const TABLE_WIDTH = TABLE_COLUMNS.reduce(
  (total, column) =>
    total + column.width,
  0
);

/*
|--------------------------------------------------------------------------
| Drawing helpers
|--------------------------------------------------------------------------
*/

const drawLine = (
  doc,
  x1,
  y1,
  x2,
  y2,
  color = COLORS.border,
  width = 0.7
) => {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(width)
    .moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke()
    .restore();
};

const drawSectionTitle = (
  doc,
  title,
  x,
  y,
  width
) => {
  doc
    .save()
    .fillColor(COLORS.primaryLight)
    .roundedRect(
      x,
      y,
      width,
      22,
      3
    )
    .fill();

  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      title.toUpperCase(),
      x + 8,
      y + 7,
      {
        width: width - 16,
      }
    )
    .restore();

  return y + 28;
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
  const labelWidth =
    options.labelWidth || 88;

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      label,
      x,
      y,
      {
        width: labelWidth,
        continued: false,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(COLORS.text)
    .text(
      safeText(value),
      x + labelWidth,
      y,
      {
        width:
          width -
          labelWidth,
        align:
          options.align ||
          "left",
      }
    );
};

const drawHeader = (
  doc,
  returnHeader
) => {
  const pageWidth =
    doc.page.width;

  const contentWidth =
    pageWidth -
    PAGE_MARGIN * 2;

  doc
    .save()
    .fillColor(COLORS.primary)
    .rect(
      0,
      0,
      pageWidth,
      106
    )
    .fill()
    .restore();

  const companyName = safeText(
    process.env.COMPANY_NAME,
    "PHARMAERP PHARMACY"
  );

  const companyAddress = safeText(
    process.env.COMPANY_ADDRESS,
    "Medicine Billing, Inventory and Pharmacy Management"
  );

  const companyPhone = safeText(
    process.env.COMPANY_PHONE,
    "-"
  );

  const companyEmail = safeText(
    process.env.COMPANY_EMAIL,
    "-"
  );

  const companyGstin = safeText(
    process.env.COMPANY_GSTIN,
    "-"
  );

  doc
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor(COLORS.white)
    .text(
      companyName,
      PAGE_MARGIN,
      25,
      {
        width: 285,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#D9E8F5")
    .text(
      companyAddress,
      PAGE_MARGIN,
      52,
      {
        width: 300,
      }
    );

  doc
    .fontSize(7.8)
    .text(
      `Phone: ${companyPhone}   Email: ${companyEmail}`,
      PAGE_MARGIN,
      70,
      {
        width: 320,
      }
    );

  doc.text(
    `GSTIN: ${companyGstin}`,
    PAGE_MARGIN,
    84,
    {
      width: 250,
    }
  );

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(COLORS.white)
    .text(
      "PURCHASE RETURN",
      350,
      28,
      {
        width:
          pageWidth -
          350 -
          PAGE_MARGIN,
        align: "right",
      }
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#D9E8F5")
    .text(
      "DEBIT NOTE",
      350,
      51,
      {
        width:
          pageWidth -
          350 -
          PAGE_MARGIN,
        align: "right",
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.white)
    .text(
      `Return No: ${safeText(
        returnHeader.returnNumber
      )}`,
      350,
      73,
      {
        width:
          pageWidth -
          350 -
          PAGE_MARGIN,
        align: "right",
      }
    );

  doc.text(
    `Date: ${formatDate(
      returnHeader.returnDate
    )}`,
    350,
    87,
    {
      width:
        pageWidth -
        350 -
        PAGE_MARGIN,
      align: "right",
    }
  );

  return {
    contentWidth,
    nextY: 124,
  };
};

const drawPartyAndReferenceInfo = (
  doc,
  returnHeader,
  y,
  contentWidth
) => {
  const gap = 12;

  const leftWidth =
    (contentWidth - gap) * 0.55;

  const rightWidth =
    contentWidth -
    gap -
    leftWidth;

  const leftX =
    PAGE_MARGIN;

  const rightX =
    leftX +
    leftWidth +
    gap;

  const boxHeight = 112;

  doc
    .save()
    .lineWidth(0.8)
    .strokeColor(COLORS.border)
    .roundedRect(
      leftX,
      y,
      leftWidth,
      boxHeight,
      4
    )
    .stroke()
    .roundedRect(
      rightX,
      y,
      rightWidth,
      boxHeight,
      4
    )
    .stroke()
    .restore();

  doc
    .fillColor(COLORS.primaryLight)
    .rect(
      leftX,
      y,
      leftWidth,
      24
    )
    .fill();

  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      "SUPPLIER DETAILS",
      leftX + 8,
      y + 8,
      {
        width:
          leftWidth - 16,
      }
    );

  doc
    .fillColor(COLORS.primaryLight)
    .rect(
      rightX,
      y,
      rightWidth,
      24
    )
    .fill();

  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      "REFERENCE DETAILS",
      rightX + 8,
      y + 8,
      {
        width:
          rightWidth - 16,
      }
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(
      safeText(
        returnHeader.supplierName
      ),
      leftX + 9,
      y + 34,
      {
        width:
          leftWidth - 18,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8.2)
    .fillColor(COLORS.text)
    .text(
      `Contact: ${safeText(
        returnHeader.supplierContactPerson
      )}`,
      leftX + 9,
      y + 51,
      {
        width:
          leftWidth - 18,
      }
    )
    .text(
      `Phone: ${safeText(
        returnHeader.supplierPhone
      )}`,
      leftX + 9,
      y + 65,
      {
        width:
          leftWidth - 18,
      }
    )
    .text(
      `Email: ${safeText(
        returnHeader.supplierEmail
      )}`,
      leftX + 9,
      y + 79,
      {
        width:
          leftWidth - 18,
      }
    )
    .text(
      `GSTIN: ${safeText(
        returnHeader.supplierGstin
      )}`,
      leftX + 9,
      y + 93,
      {
        width:
          leftWidth - 18,
      }
    );

  drawLabelValue(
    doc,
    "Purchase No:",
    returnHeader.purchaseNumber,
    rightX + 9,
    y + 35,
    rightWidth - 18,
    {
      labelWidth: 78,
    }
  );

  drawLabelValue(
    doc,
    "Invoice No:",
    returnHeader.invoiceNumber,
    rightX + 9,
    y + 54,
    rightWidth - 18,
    {
      labelWidth: 78,
    }
  );

  drawLabelValue(
    doc,
    "Return ID:",
    returnHeader.id,
    rightX + 9,
    y + 73,
    rightWidth - 18,
    {
      labelWidth: 78,
    }
  );

  drawLabelValue(
    doc,
    "Status:",
    returnHeader.status,
    rightX + 9,
    y + 92,
    rightWidth - 18,
    {
      labelWidth: 78,
    }
  );

  return y + boxHeight + 16;
};

const drawTableHeader = (
  doc,
  y
) => {
  let currentX =
    PAGE_MARGIN;

  const headerHeight = 25;

  doc
    .save()
    .fillColor(COLORS.primary)
    .rect(
      PAGE_MARGIN,
      y,
      TABLE_WIDTH,
      headerHeight
    )
    .fill()
    .restore();

  TABLE_COLUMNS.forEach(
    (column) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(7.6)
        .fillColor(COLORS.white)
        .text(
          column.label,
          currentX + 4,
          y + 8,
          {
            width:
              column.width - 8,
            align:
              column.align,
            lineBreak: false,
          }
        );

      currentX +=
        column.width;
    }
  );

  return y + headerHeight;
};

const getMedicineText = (item) => {
  const mainName = safeText(
    item.brandName
  );

  const details = [
    safeText(
      item.genericName,
      ""
    ),
    safeText(
      item.strength,
      ""
    ),
  ]
    .filter(Boolean)
    .join(" ");

  return details
    ? `${mainName}\n${details}`
    : mainName;
};

const drawTableRow = (
  doc,
  item,
  index,
  y
) => {
  const medicineText =
    getMedicineText(item);

  const medicineHeight =
    doc.heightOfString(
      medicineText,
      {
        width:
          TABLE_COLUMNS[1].width -
          8,
        lineGap: 1,
      }
    );

  const rowHeight = Math.max(
    medicineHeight + 12,
    32
  );

  if (index % 2 === 1) {
    doc
      .save()
      .fillColor(COLORS.light)
      .rect(
        PAGE_MARGIN,
        y,
        TABLE_WIDTH,
        rowHeight
      )
      .fill()
      .restore();
  }

  const rowValues = {
    index:
      String(index + 1),

    medicine:
      medicineText,

    batch:
      truncate(
        item.batchNumber,
        18
      ),

    quantity:
      String(
        numberValue(
          item.quantity
        )
      ),

    rate:
      numberValue(
        item.purchasePrice
      ).toFixed(2),

    discount:
      numberValue(
        item.discountAmount
      ).toFixed(2),

    gst:
      numberValue(
        item.taxAmount
      ).toFixed(2),

    amount:
      numberValue(
        item.lineTotal
      ).toFixed(2),
  };

  let currentX =
    PAGE_MARGIN;

  TABLE_COLUMNS.forEach(
    (column) => {
      const isMedicine =
        column.key ===
        "medicine";

      doc
        .font(
          isMedicine
            ? "Helvetica-Bold"
            : "Helvetica"
        )
        .fontSize(
          isMedicine
            ? 7.8
            : 7.5
        )
        .fillColor(COLORS.text)
        .text(
          rowValues[column.key],
          currentX + 4,
          y + 8,
          {
            width:
              column.width - 8,
            height:
              rowHeight - 12,
            align:
              column.align,
            lineGap:
              isMedicine
                ? 1
                : 0,
            ellipsis:
              column.key !==
              "medicine",
          }
        );

      currentX +=
        column.width;
    }
  );

  drawLine(
    doc,
    PAGE_MARGIN,
    y + rowHeight,
    PAGE_MARGIN +
      TABLE_WIDTH,
    y + rowHeight
  );

  let verticalX =
    PAGE_MARGIN;

  TABLE_COLUMNS.forEach(
    (column) => {
      drawLine(
        doc,
        verticalX,
        y,
        verticalX,
        y + rowHeight,
        COLORS.border,
        0.45
      );

      verticalX +=
        column.width;
    }
  );

  drawLine(
    doc,
    PAGE_MARGIN +
      TABLE_WIDTH,
    y,
    PAGE_MARGIN +
      TABLE_WIDTH,
    y + rowHeight,
    COLORS.border,
    0.45
  );

  return y + rowHeight;
};

const drawTotals = (
  doc,
  returnHeader,
  y
) => {
  const boxWidth = 250;

  const x =
    doc.page.width -
    PAGE_MARGIN -
    boxWidth;

  const rows = [
    {
      label:
        "Subtotal",
      value:
        money(
          returnHeader.subtotal
        ),
    },
    {
      label:
        "Discount",
      value:
        money(
          returnHeader.discountAmount
        ),
    },
    {
      label:
        "Taxable Amount",
      value:
        money(
          returnHeader.taxableAmount
        ),
    },
    {
      label:
        "GST Amount",
      value:
        money(
          returnHeader.taxAmount
        ),
    },
    {
      label:
        "Return Total",
      value:
        money(
          returnHeader.returnTotal
        ),
      strong: true,
    },
    {
      label:
        "Due Adjusted",
      value:
        money(
          returnHeader.dueAdjusted
        ),
    },
    {
      label:
        "Refund Amount",
      value:
        money(
          returnHeader.refundAmount
        ),
      strong: true,
    },
  ];

  const rowHeight = 21;

  const height =
    rows.length *
    rowHeight;

  doc
    .save()
    .lineWidth(0.8)
    .strokeColor(COLORS.border)
    .roundedRect(
      x,
      y,
      boxWidth,
      height,
      4
    )
    .stroke()
    .restore();

  rows.forEach(
    (row, index) => {
      const rowY =
        y +
        index *
        rowHeight;

      if (row.strong) {
        doc
          .save()
          .fillColor(
            COLORS.primaryLight
          )
          .rect(
            x,
            rowY,
            boxWidth,
            rowHeight
          )
          .fill()
          .restore();
      }

      doc
        .font(
          row.strong
            ? "Helvetica-Bold"
            : "Helvetica"
        )
        .fontSize(
          row.strong
            ? 9
            : 8.2
        )
        .fillColor(
          row.label ===
          "Refund Amount"
            ? COLORS.success
            : COLORS.text
        )
        .text(
          row.label,
          x + 9,
          rowY + 6,
          {
            width: 126,
          }
        );

      doc.text(
        row.value,
        x + 137,
        rowY + 6,
        {
          width:
            boxWidth -
            146,
          align: "right",
        }
      );

      if (
        index <
        rows.length - 1
      ) {
        drawLine(
          doc,
          x,
          rowY +
            rowHeight,
          x +
            boxWidth,
          rowY +
            rowHeight,
          COLORS.border,
          0.45
        );
      }
    }
  );

  return y + height;
};

const drawSettlementAndReason = (
  doc,
  returnHeader,
  y
) => {
  const contentWidth =
    doc.page.width -
    PAGE_MARGIN * 2;

  const gap = 12;

  const leftWidth =
    (contentWidth - gap) *
    0.52;

  const rightWidth =
    contentWidth -
    gap -
    leftWidth;

  const leftX =
    PAGE_MARGIN;

  const rightX =
    leftX +
    leftWidth +
    gap;

  const boxHeight = 92;

  doc
    .save()
    .strokeColor(COLORS.border)
    .lineWidth(0.8)
    .roundedRect(
      leftX,
      y,
      leftWidth,
      boxHeight,
      4
    )
    .stroke()
    .roundedRect(
      rightX,
      y,
      rightWidth,
      boxHeight,
      4
    )
    .stroke()
    .restore();

  const leftContentY =
    drawSectionTitle(
      doc,
      "Settlement",
      leftX,
      y,
      leftWidth
    );

  drawLabelValue(
    doc,
    "Method:",
    returnHeader.settlementMethod,
    leftX + 8,
    leftContentY + 2,
    leftWidth - 16,
    {
      labelWidth: 75,
    }
  );

  drawLabelValue(
    doc,
    "Reference:",
    returnHeader.settlementReference,
    leftX + 8,
    leftContentY + 22,
    leftWidth - 16,
    {
      labelWidth: 75,
    }
  );

  const rightContentY =
    drawSectionTitle(
      doc,
      "Return Reason",
      rightX,
      y,
      rightWidth
    );

  doc
    .font("Helvetica")
    .fontSize(8.3)
    .fillColor(COLORS.text)
    .text(
      safeText(
        returnHeader.reason
      ),
      rightX + 8,
      rightContentY + 2,
      {
        width:
          rightWidth - 16,
        height:
          boxHeight - 38,
        lineGap: 2,
        ellipsis: true,
      }
    );

  return y + boxHeight;
};

const drawSignature = (
  doc,
  y
) => {
  const contentWidth =
    doc.page.width -
    PAGE_MARGIN * 2;

  const signatureWidth = 170;

  const x =
    PAGE_MARGIN +
    contentWidth -
    signatureWidth;

  drawLine(
    doc,
    x,
    y + 42,
    x + signatureWidth,
    y + 42,
    COLORS.text,
    0.7
  );

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.text)
    .text(
      "AUTHORIZED SIGNATURE",
      x,
      y + 49,
      {
        width:
          signatureWidth,
        align: "center",
      }
    );

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(
      "This is a computer-generated debit note.",
      PAGE_MARGIN,
      y + 49,
      {
        width:
          contentWidth -
          signatureWidth -
          20,
      }
    );

  return y + 68;
};

const addPageNumbers = (
  doc,
  returnHeader
) => {
  const range =
    doc.bufferedPageRange();

  for (
    let index = range.start;
    index <
    range.start +
      range.count;
    index += 1
  ) {
    doc.switchToPage(index);

    const pageNumber =
      index -
      range.start +
      1;

    const footerY =
      doc.page.height - 22;

    /*
    |--------------------------------------------------------------------------
    | Important
    |--------------------------------------------------------------------------
    | PDFKit normally keeps text above the bottom margin. Writing footer text
    | below that margin can automatically create an extra blank page. Temporarily
    | set the bottom margin to zero and disable line wrapping so the footer stays
    | on the current buffered page.
    */

    const originalBottomMargin =
      doc.page.margins.bottom;

    const originalX = doc.x;
    const originalY = doc.y;

    doc.page.margins.bottom = 0;

    drawLine(
      doc,
      PAGE_MARGIN,
      footerY - 6,
      doc.page.width -
        PAGE_MARGIN,
      footerY - 6,
      COLORS.border,
      0.5
    );

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(
        `Debit Note: ${safeText(
          returnHeader.returnNumber
        )}`,
        PAGE_MARGIN,
        footerY,
        {
          width: 260,
          height: 10,
          lineBreak: false,
        }
      );

    doc.text(
      `Page ${pageNumber} of ${range.count}`,
      doc.page.width -
        PAGE_MARGIN -
        160,
      footerY,
      {
        width: 160,
        height: 10,
        align: "right",
        lineBreak: false,
      }
    );

    doc.page.margins.bottom =
      originalBottomMargin;

    doc.x = originalX;
    doc.y = originalY;
  }
};

/*
|--------------------------------------------------------------------------
| Main renderer
|--------------------------------------------------------------------------
*/

const renderPurchaseReturnDebitNote = (
  outputStream,
  data
) => {
  return new Promise(
    (resolve, reject) => {
      const returnHeader =
        data?.returnHeader || {};

      const items =
        Array.isArray(data?.items)
          ? data.items
          : [];

      const doc =
        new PDFDocument({
          size:
            PAGE_SIZE,
          margins: {
            top:
              PAGE_MARGIN,
            right:
              PAGE_MARGIN,
            bottom:
              44,
            left:
              PAGE_MARGIN,
          },
          bufferPages:
            true,
          info: {
            Title:
              `Purchase Return Debit Note ${safeText(
                returnHeader.returnNumber
              )}`,
            Author:
              safeText(
                process.env.COMPANY_NAME,
                "PharmaERP"
              ),
            Subject:
              "Purchase Return Debit Note",
          },
        });

      const handleError = (
        error
      ) => {
        reject(error);
      };

      doc.once(
        "error",
        handleError
      );

      outputStream.once(
        "error",
        handleError
      );

      outputStream.once(
        "finish",
        resolve
      );

      doc.pipe(
        outputStream
      );

      const firstHeader =
        drawHeader(
          doc,
          returnHeader
        );

      let currentY =
        drawPartyAndReferenceInfo(
          doc,
          returnHeader,
          firstHeader.nextY,
          firstHeader.contentWidth
        );

      currentY =
        drawSectionTitle(
          doc,
          "Returned Medicines",
          PAGE_MARGIN,
          currentY,
          TABLE_WIDTH
        );

      currentY =
        drawTableHeader(
          doc,
          currentY
        );

      items.forEach(
        (item, index) => {
          const medicineText =
            getMedicineText(
              item
            );

          const estimatedHeight =
            Math.max(
              doc.heightOfString(
                medicineText,
                {
                  width:
                    TABLE_COLUMNS[1]
                      .width -
                    8,
                  lineGap: 1,
                }
              ) + 12,
              32
            );

          const pageBottom =
            doc.page.height -
            74;

          if (
            currentY +
              estimatedHeight >
            pageBottom
          ) {
            doc.addPage();

            currentY = 46;

            doc
              .font("Helvetica-Bold")
              .fontSize(11)
              .fillColor(
                COLORS.primary
              )
              .text(
                `PURCHASE RETURN DEBIT NOTE - ${safeText(
                  returnHeader.returnNumber
                )}`,
                PAGE_MARGIN,
                30,
                {
                  width:
                    TABLE_WIDTH,
                  align:
                    "center",
                }
              );

            currentY =
              drawTableHeader(
                doc,
                54
              );
          }

          currentY =
            drawTableRow(
              doc,
              item,
              index,
              currentY
            );
        }
      );

      const requiredBottomSpace =
        365;

      if (
        currentY +
          requiredBottomSpace >
        doc.page.height -
          52
      ) {
        doc.addPage();

        currentY = 48;

        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor(
            COLORS.primary
          )
          .text(
            `DEBIT NOTE SUMMARY - ${safeText(
              returnHeader.returnNumber
            )}`,
            PAGE_MARGIN,
            30,
            {
              width:
                TABLE_WIDTH,
              align:
                "center",
            }
          );
      } else {
        currentY += 14;
      }

      currentY =
        drawTotals(
          doc,
          returnHeader,
          currentY
        );

      currentY =
        drawSettlementAndReason(
          doc,
          returnHeader,
          currentY + 16
        );

      drawSignature(
        doc,
        currentY + 18
      );

      addPageNumbers(
        doc,
        returnHeader
      );

      doc.end();
    }
  );
};

module.exports = {
  renderPurchaseReturnDebitNote,
};