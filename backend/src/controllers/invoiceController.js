const PDFDocument = require("pdfkit");
const db = require("../config/db");

const parsePositiveId = (value) => {
  const parsedValue = Number.parseInt(value, 10);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
};

const formatMoney = (value) => {
  return Number(value || 0).toFixed(2);
};

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

const sanitizeFileName = (value) => {
  return String(value)
    .replace(/[^a-zA-Z0-9-_]/g, "_");
};

const getSaleInvoiceData = async (saleId) => {
  const [saleRows] = await db.query(
    `
      SELECT
        sales.id,
        sales.invoice_number AS invoiceNumber,

        DATE_FORMAT(
          sales.sale_date,
          '%Y-%m-%d %H:%i:%s'
        ) AS saleDate,

        sales.customer_id AS customerId,
        customers.customer_code AS customerCode,

        sales.customer_name AS customerName,
        sales.customer_phone AS customerPhone,
        sales.customer_address AS customerAddress,

        sales.sale_type AS saleType,
        sales.total_quantity AS totalQuantity,

        sales.subtotal,
        sales.discount_amount AS discountAmount,
        sales.taxable_amount AS taxableAmount,
        sales.tax_amount AS taxAmount,
        sales.round_off AS roundOff,
        sales.grand_total AS grandTotal,

        sales.paid_amount AS paidAmount,
        sales.due_amount AS dueAmount,

        sales.payment_status AS paymentStatus,
        sales.status,

        sales.doctor_name AS doctorName,
        sales.prescription_number
          AS prescriptionNumber,

        DATE_FORMAT(
          sales.prescription_date,
          '%Y-%m-%d'
        ) AS prescriptionDate,

        sales.prescription_notes
          AS prescriptionNotes,

        sales.notes,

        users.full_name AS createdBy

      FROM sales

      LEFT JOIN customers
        ON customers.id = sales.customer_id

      LEFT JOIN users
        ON users.id = sales.created_by

      WHERE sales.id = ?
      LIMIT 1
    `,
    [saleId]
  );

  if (saleRows.length === 0) {
    return null;
  }

  const [itemRows] = await db.query(
    `
      SELECT
        sale_items.id,

        sale_items.medicine_id AS medicineId,
        medicines.sku,

        sale_items.medicine_name AS medicineName,
        sale_items.generic_name AS genericName,

        medicines.strength,

        sale_items.batch_id AS batchId,
        sale_items.batch_number AS batchNumber,

        DATE_FORMAT(
          sale_items.expiry_date,
          '%Y-%m-%d'
        ) AS expiryDate,

        sale_items.quantity,
        sale_items.returned_quantity
          AS returnedQuantity,

        sale_items.purchase_price AS purchasePrice,
        sale_items.mrp,
        sale_items.selling_price AS sellingPrice,

        sale_items.discount_percent
          AS discountPercent,

        sale_items.discount_amount
          AS discountAmount,

        sale_items.gst_percent AS gstPercent,

        sale_items.taxable_amount
          AS taxableAmount,

        sale_items.tax_amount AS taxAmount,
        sale_items.line_total AS lineTotal

      FROM sale_items

      INNER JOIN medicines
        ON medicines.id = sale_items.medicine_id

      WHERE sale_items.sale_id = ?

      ORDER BY sale_items.id ASC
    `,
    [saleId]
  );

  const [paymentRows] = await db.query(
    `
      SELECT
        sale_payments.id,
        sale_payments.amount,

        sale_payments.payment_method
          AS paymentMethod,

        sale_payments.transaction_reference
          AS transactionReference,

        sale_payments.payment_notes
          AS paymentNotes,

        DATE_FORMAT(
          sale_payments.payment_date,
          '%Y-%m-%d %H:%i:%s'
        ) AS paymentDate,

        users.full_name AS receivedBy

      FROM sale_payments

      LEFT JOIN users
        ON users.id = sale_payments.received_by

      WHERE sale_payments.sale_id = ?

      ORDER BY
        sale_payments.payment_date ASC,
        sale_payments.id ASC
    `,
    [saleId]
  );

  const [returnRows] = await db.query(
    `
      SELECT
        sale_returns.id,

        sale_returns.return_number
          AS returnNumber,

        DATE_FORMAT(
          sale_returns.return_date,
          '%Y-%m-%d %H:%i:%s'
        ) AS returnDate,

        sale_returns.total_quantity
          AS totalQuantity,

        sale_returns.taxable_amount
          AS taxableAmount,

        sale_returns.tax_amount
          AS taxAmount,

        sale_returns.refund_amount
          AS returnValue,

        sale_returns.refund_method
          AS refundMethod,

        sale_returns.reason,
        sale_returns.status

      FROM sale_returns

      WHERE sale_returns.sale_id = ?
        AND sale_returns.status = 'COMPLETED'

      ORDER BY
        sale_returns.return_date ASC,
        sale_returns.id ASC
    `,
    [saleId]
  );

  return {
    sale: saleRows[0],
    items: itemRows,
    payments: paymentRows,
    returns: returnRows,
  };
};

const getSalesInvoicePdf = async (req, res) => {
  try {
    const saleId = parsePositiveId(req.params.id);

    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: "A valid sale ID is required",
      });
    }

    const invoiceData =
      await getSaleInvoiceData(saleId);

    if (!invoiceData) {
      return res.status(404).json({
        success: false,
        message: "Sale invoice was not found",
      });
    }

    const {
      sale,
      items,
      payments,
      returns,
    } = invoiceData;

    const pharmacy = {
      name:
        process.env.PHARMACY_NAME ||
        "PharmaERP Pharmacy",

      address:
        process.env.PHARMACY_ADDRESS ||
        "Pharmacy Address",

      phone:
        process.env.PHARMACY_PHONE ||
        "-",

      email:
        process.env.PHARMACY_EMAIL ||
        "-",

      gstin:
        process.env.PHARMACY_GSTIN ||
        "-",

      drugLicence:
        process.env.PHARMACY_DL_NUMBER ||
        "-",
    };

    const download =
      req.query.download === "true" ||
      req.query.download === "1";

    const fileName = sanitizeFileName(
      `${sale.invoiceNumber}-invoice.pdf`
    );

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `${
        download ? "attachment" : "inline"
      }; filename="${fileName}"`
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,

      info: {
        Title:
          `Sales Invoice ${sale.invoiceNumber}`,

        Author: pharmacy.name,

        Subject:
          `Medicine sales invoice ${sale.invoiceNumber}`,
      },
    });

    doc.pipe(res);

    const pageWidth =
      doc.page.width -
      doc.page.margins.left -
      doc.page.margins.right;

    const contentBottom =
      doc.page.height -
      doc.page.margins.bottom -
      30;

    const colours = {
      primary: "#1f4e78",
      dark: "#222222",
      grey: "#666666",
      lightGrey: "#f2f4f7",
      border: "#c9ced6",
      white: "#ffffff",
      danger: "#a61b1b",
    };

    const drawHorizontalLine = (
      y,
      colour = colours.border
    ) => {
      doc
        .strokeColor(colour)
        .lineWidth(0.7)
        .moveTo(doc.page.margins.left, y)
        .lineTo(
          doc.page.width -
            doc.page.margins.right,
          y
        )
        .stroke();
    };

    const addContinuationPage = (
      sectionTitle
    ) => {
      doc.addPage();

      doc
        .fillColor(colours.primary)
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(
          `${pharmacy.name} - ${sectionTitle}`,
          doc.page.margins.left,
          doc.page.margins.top
        );

      doc
        .fillColor(colours.grey)
        .font("Helvetica")
        .fontSize(8)
        .text(
          `Invoice: ${sale.invoiceNumber}`,
          {
            align: "right",
          }
        );

      drawHorizontalLine(doc.y + 5);

      doc.moveDown(1);
    };

    const ensureSpace = (
      requiredHeight,
      sectionTitle = "Sales Invoice"
    ) => {
      if (
        doc.y + requiredHeight >
        contentBottom
      ) {
        addContinuationPage(sectionTitle);
        return true;
      }

      return false;
    };

    // ==================================================
    // Invoice header
    // ==================================================

    doc
      .fillColor(colours.primary)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(pharmacy.name, {
        align: "center",
      });

    doc
      .fillColor(colours.dark)
      .font("Helvetica")
      .fontSize(9)
      .text(pharmacy.address, {
        align: "center",
      });

    doc.text(
      `Phone: ${pharmacy.phone} | Email: ${pharmacy.email}`,
      {
        align: "center",
      }
    );

    doc.text(
      `GSTIN: ${pharmacy.gstin} | Drug Licence: ${pharmacy.drugLicence}`,
      {
        align: "center",
      }
    );

    doc.moveDown(0.6);

    drawHorizontalLine(doc.y, colours.primary);

    doc.moveDown(0.7);

    doc
      .fillColor(colours.dark)
      .font("Helvetica-Bold")
      .fontSize(15)
      .text("TAX INVOICE", {
        align: "center",
      });

    doc.moveDown(0.8);

    // ==================================================
    // Invoice and customer information
    // ==================================================

    const infoTop = doc.y;
    const infoGap = 15;
    const infoColumnWidth =
      (pageWidth - infoGap) / 2;

    const leftX = doc.page.margins.left;

    const rightX =
      leftX +
      infoColumnWidth +
      infoGap;

    doc
      .roundedRect(
        leftX,
        infoTop,
        infoColumnWidth,
        104,
        4
      )
      .strokeColor(colours.border)
      .stroke();

    doc
      .roundedRect(
        rightX,
        infoTop,
        infoColumnWidth,
        104,
        4
      )
      .strokeColor(colours.border)
      .stroke();

    doc
      .fillColor(colours.primary)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        "Invoice Details",
        leftX + 8,
        infoTop + 8
      );

    doc
      .fillColor(colours.dark)
      .font("Helvetica")
      .fontSize(8.5)
      .text(
        `Invoice No: ${sale.invoiceNumber}`,
        leftX + 8,
        infoTop + 27,
        {
          width: infoColumnWidth - 16,
        }
      );

    doc.text(
      `Invoice Date: ${sale.saleDate}`,
      {
        width: infoColumnWidth - 16,
      }
    );

    doc.text(
      `Sale Type: ${sale.saleType}`,
      {
        width: infoColumnWidth - 16,
      }
    );

    doc.text(
      `Payment Status: ${sale.paymentStatus}`,
      {
        width: infoColumnWidth - 16,
      }
    );

    doc.text(
      `Invoice Status: ${sale.status}`,
      {
        width: infoColumnWidth - 16,
      }
    );

    doc
      .fillColor(colours.primary)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        "Customer Details",
        rightX + 8,
        infoTop + 8
      );

    doc
      .fillColor(colours.dark)
      .font("Helvetica")
      .fontSize(8.5)
      .text(
        `Name: ${safeText(
          sale.customerName,
          "Walk-in Customer"
        )}`,
        rightX + 8,
        infoTop + 27,
        {
          width: infoColumnWidth - 16,
        }
      );

    doc.text(
      `Customer Code: ${safeText(
        sale.customerCode
      )}`,
      {
        width: infoColumnWidth - 16,
      }
    );

    doc.text(
      `Phone: ${safeText(
        sale.customerPhone
      )}`,
      {
        width: infoColumnWidth - 16,
      }
    );

    doc.text(
      `Address: ${safeText(
        sale.customerAddress
      )}`,
      {
        width: infoColumnWidth - 16,
      }
    );

    doc.y = infoTop + 118;

    // ==================================================
    // Medicine table
    // ==================================================

    doc
      .fillColor(colours.primary)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("Medicine Details");

    doc.moveDown(0.4);

    const tableX = doc.page.margins.left;

    const columns = [
      {
        key: "medicine",
        label: "Medicine",
        width: 135,
        align: "left",
      },
      {
        key: "batch",
        label: "Batch / Expiry",
        width: 82,
        align: "left",
      },
      {
        key: "quantity",
        label: "Qty",
        width: 34,
        align: "right",
      },
      {
        key: "returned",
        label: "Ret.",
        width: 34,
        align: "right",
      },
      {
        key: "net",
        label: "Net",
        width: 34,
        align: "right",
      },
      {
        key: "rate",
        label: "Rate",
        width: 55,
        align: "right",
      },
      {
        key: "gst",
        label: "GST",
        width: 45,
        align: "right",
      },
      {
        key: "total",
        label: "Total",
        width: 96,
        align: "right",
      },
    ];

    const drawMedicineTableHeader = () => {
      const headerY = doc.y;
      const headerHeight = 24;

      doc
        .rect(
          tableX,
          headerY,
          pageWidth,
          headerHeight
        )
        .fill(colours.primary);

      let currentX = tableX;

      columns.forEach((column) => {
        doc
          .fillColor(colours.white)
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .text(
            column.label,
            currentX + 4,
            headerY + 8,
            {
              width: column.width - 8,
              align: column.align,
              lineBreak: false,
            }
          );

        currentX += column.width;
      });

      doc.y = headerY + headerHeight;
    };

    drawMedicineTableHeader();

    items.forEach((item) => {
      const soldQuantity = Number(item.quantity);

      const returnedQuantity = Number(
        item.returnedQuantity
      );

      const netQuantity = Math.max(
        soldQuantity - returnedQuantity,
        0
      );

      const netRatio =
        soldQuantity > 0
          ? netQuantity / soldQuantity
          : 0;

      const netLineTotal =
        Number(item.lineTotal) * netRatio;

      const medicineText = [
        safeText(item.medicineName),
        safeText(
          `${safeText(
            item.genericName,
            ""
          )} ${safeText(
            item.strength,
            ""
          )}`.trim(),
          ""
        ),
      ]
        .filter(Boolean)
        .join("\n");

      const batchText =
        `${safeText(item.batchNumber)}\n` +
        `${safeText(item.expiryDate)}`;

      doc
        .font("Helvetica")
        .fontSize(7.5);

      const medicineHeight =
        doc.heightOfString(medicineText, {
          width: columns[0].width - 8,
        });

      const batchHeight =
        doc.heightOfString(batchText, {
          width: columns[1].width - 8,
        });

      const rowHeight = Math.max(
        28,
        medicineHeight + 10,
        batchHeight + 10
      );

      const pageWasAdded = ensureSpace(
        rowHeight + 25,
        "Sales Invoice"
      );

      if (pageWasAdded) {
        drawMedicineTableHeader();
      }

      const rowY = doc.y;

      doc
        .rect(
          tableX,
          rowY,
          pageWidth,
          rowHeight
        )
        .strokeColor(colours.border)
        .lineWidth(0.5)
        .stroke();

      const rowValues = {
        medicine: medicineText,
        batch: batchText,
        quantity: String(soldQuantity),
        returned: String(returnedQuantity),
        net: String(netQuantity),
        rate: formatMoney(item.sellingPrice),
        gst: `${formatMoney(
          item.gstPercent
        )}%`,
        total: `Rs. ${formatMoney(
          netLineTotal
        )}`,
      };

      let currentX = tableX;

      columns.forEach((column, index) => {
        if (index > 0) {
          doc
            .moveTo(currentX, rowY)
            .lineTo(
              currentX,
              rowY + rowHeight
            )
            .strokeColor(colours.border)
            .lineWidth(0.5)
            .stroke();
        }

        doc
          .fillColor(colours.dark)
          .font(
            column.key === "medicine"
              ? "Helvetica-Bold"
              : "Helvetica"
          )
          .fontSize(7.5)
          .text(
            rowValues[column.key],
            currentX + 4,
            rowY + 7,
            {
              width: column.width - 8,
              align: column.align,
            }
          );

        currentX += column.width;
      });

      doc.y = rowY + rowHeight;
    });

    doc.moveDown(1);

    // ==================================================
    // Invoice totals
    // ==================================================

    ensureSpace(155, "Invoice Summary");

    const totalsWidth = 225;
    const totalsX =
      doc.page.width -
      doc.page.margins.right -
      totalsWidth;

    const totalsTop = doc.y;

    const drawTotalLine = (
      label,
      value,
      options = {}
    ) => {
      const {
        bold = false,
        colour = colours.dark,
        fontSize = 9,
      } = options;

      const lineY = doc.y;

      doc
        .fillColor(colour)
        .font(
          bold
            ? "Helvetica-Bold"
            : "Helvetica"
        )
        .fontSize(fontSize)
        .text(label, totalsX + 8, lineY, {
          width: 125,
        });

      doc.text(
        `Rs. ${formatMoney(value)}`,
        totalsX + 133,
        lineY,
        {
          width: totalsWidth - 141,
          align: "right",
        }
      );

      doc.y = lineY + fontSize + 7;
    };

    doc
      .roundedRect(
        totalsX,
        totalsTop,
        totalsWidth,
        142,
        4
      )
      .strokeColor(colours.border)
      .stroke();

    doc.y = totalsTop + 10;

    drawTotalLine(
      "Subtotal",
      sale.subtotal
    );

    drawTotalLine(
      "Discount",
      sale.discountAmount
    );

    drawTotalLine(
      "Taxable Amount",
      sale.taxableAmount
    );

    drawTotalLine(
      "GST",
      sale.taxAmount
    );

    drawTotalLine(
      "Round Off",
      sale.roundOff
    );

    drawHorizontalLine(doc.y);

    doc.moveDown(0.5);

    drawTotalLine(
      "Grand Total",
      sale.grandTotal,
      {
        bold: true,
        colour: colours.primary,
        fontSize: 10,
      }
    );

    drawTotalLine(
      "Paid Amount",
      sale.paidAmount,
      {
        bold: true,
      }
    );

    drawTotalLine(
      "Due Amount",
      sale.dueAmount,
      {
        bold: true,
        colour:
          Number(sale.dueAmount) > 0
            ? colours.danger
            : colours.dark,
      }
    );

    doc.y = totalsTop + 155;

    // ==================================================
    // Prescription information
    // ==================================================

    if (
      sale.doctorName ||
      sale.prescriptionNumber ||
      sale.prescriptionNotes
    ) {
      ensureSpace(90, "Prescription Details");

      doc
        .fillColor(colours.primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Prescription Details");

      doc.moveDown(0.4);

      doc
        .fillColor(colours.dark)
        .font("Helvetica")
        .fontSize(8.5)
        .text(
          `Doctor: ${safeText(
            sale.doctorName
          )}`
        );

      doc.text(
        `Prescription No: ${safeText(
          sale.prescriptionNumber
        )}`
      );

      doc.text(
        `Prescription Date: ${safeText(
          sale.prescriptionDate
        )}`
      );

      doc.text(
        `Notes: ${safeText(
          sale.prescriptionNotes
        )}`
      );

      doc.moveDown(0.8);
    }

    // ==================================================
    // Payment history
    // ==================================================

    if (payments.length > 0) {
      ensureSpace(70, "Payment History");

      doc
        .fillColor(colours.primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Payment History");

      doc.moveDown(0.4);

      payments.forEach((payment, index) => {
        ensureSpace(34, "Payment History");

        const paymentY = doc.y;

        doc
          .fillColor(colours.dark)
          .font("Helvetica")
          .fontSize(8)
          .text(
            `${index + 1}. ${payment.paymentDate}`,
            tableX,
            paymentY,
            {
              width: 130,
            }
          );

        doc.text(
          safeText(payment.paymentMethod),
          tableX + 135,
          paymentY,
          {
            width: 65,
          }
        );

        doc.text(
          safeText(
            payment.transactionReference
          ),
          tableX + 205,
          paymentY,
          {
            width: 155,
          }
        );

        doc
          .font("Helvetica-Bold")
          .text(
            `Rs. ${formatMoney(
              payment.amount
            )}`,
            tableX + 365,
            paymentY,
            {
              width: pageWidth - 365,
              align: "right",
            }
          );

        doc.y = paymentY + 19;

        if (payment.paymentNotes) {
          doc
            .fillColor(colours.grey)
            .font("Helvetica")
            .fontSize(7.5)
            .text(
              `Note: ${payment.paymentNotes}`,
              tableX + 15,
              doc.y,
              {
                width: pageWidth - 15,
              }
            );
        }

        drawHorizontalLine(doc.y + 4);

        doc.y += 10;
      });
    }

    // ==================================================
    // Return history
    // ==================================================

    if (returns.length > 0) {
      ensureSpace(70, "Sales Return History");

      doc
        .fillColor(colours.primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Sales Return History");

      doc.moveDown(0.4);

      returns.forEach((saleReturn, index) => {
        ensureSpace(50, "Sales Return History");

        const returnY = doc.y;

        doc
          .fillColor(colours.dark)
          .font("Helvetica")
          .fontSize(8)
          .text(
            `${index + 1}. ${saleReturn.returnNumber}`,
            tableX,
            returnY,
            {
              width: 125,
            }
          );

        doc.text(
          saleReturn.returnDate,
          tableX + 130,
          returnY,
          {
            width: 120,
          }
        );

        doc.text(
          `Qty: ${saleReturn.totalQuantity}`,
          tableX + 255,
          returnY,
          {
            width: 65,
          }
        );

        doc.text(
          safeText(
            saleReturn.refundMethod
          ),
          tableX + 325,
          returnY,
          {
            width: 70,
          }
        );

        doc
          .font("Helvetica-Bold")
          .text(
            `Rs. ${formatMoney(
              saleReturn.returnValue
            )}`,
            tableX + 400,
            returnY,
            {
              width: pageWidth - 400,
              align: "right",
            }
          );

        doc.y = returnY + 18;

        doc
          .fillColor(colours.grey)
          .font("Helvetica")
          .fontSize(7.5)
          .text(
            `Reason: ${safeText(
              saleReturn.reason
            )}`,
            tableX + 15,
            doc.y,
            {
              width: pageWidth - 15,
            }
          );

        drawHorizontalLine(doc.y + 4);

        doc.y += 10;
      });
    }

    // ==================================================
    // Invoice notes
    // ==================================================

    if (sale.notes) {
      ensureSpace(55, "Invoice Notes");

      doc
        .fillColor(colours.primary)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("Invoice Notes");

      doc
        .fillColor(colours.dark)
        .font("Helvetica")
        .fontSize(8)
        .text(sale.notes);

      doc.moveDown(1);
    }

    // ==================================================
    // Footer note
    // ==================================================

    ensureSpace(80, "Declaration");

    drawHorizontalLine(doc.y);

    doc.moveDown(0.8);

    doc
      .fillColor(colours.grey)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Declaration: Medicines once sold are subject to applicable return rules. Please verify medicine name, batch number and expiry date at the time of purchase.",
        {
          align: "left",
        }
      );

    doc.moveDown(0.8);

    doc
      .fillColor(colours.dark)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(
        `Prepared by: ${safeText(
          sale.createdBy
        )}`,
        {
          align: "right",
        }
      );

    doc.moveDown(1.2);

    doc
      .fillColor(colours.primary)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        "Thank you for choosing us.",
        {
          align: "center",
        }
      );

    // ==================================================
    // Page numbering
    // ==================================================

    const pageRange =
      doc.bufferedPageRange();

    for (
      let pageIndex = pageRange.start;
      pageIndex <
      pageRange.start + pageRange.count;
      pageIndex += 1
    ) {
      doc.switchToPage(pageIndex);

      const footerY =
        doc.page.height - 28;

      doc
        .strokeColor(colours.border)
        .lineWidth(0.5)
        .moveTo(
          doc.page.margins.left,
          footerY - 7
        )
        .lineTo(
          doc.page.width -
            doc.page.margins.right,
          footerY - 7
        )
        .stroke();

      doc
        .fillColor(colours.grey)
        .font("Helvetica")
        .fontSize(7.5)
        .text(
          `Invoice ${sale.invoiceNumber} | Page ${
            pageIndex - pageRange.start + 1
          } of ${pageRange.count}`,
          doc.page.margins.left,
          footerY,
          {
            width: pageWidth,
            align: "center",
            lineBreak: false,
          }
        );
    }

    doc.end();
  } catch (error) {
    console.error(
      "Generate sales invoice PDF error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message:
          "Unable to generate sales invoice PDF",
        error: error.message,
      });
    }

    res.end();
  }
};

module.exports = {
  getSalesInvoicePdf,
};
