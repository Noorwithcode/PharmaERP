const PDFDocument = require("pdfkit");
const bwipjs = require("bwip-js");
const QRCode = require("qrcode");

const db = require("../config/db");

// ======================================================
// Helpers
// ======================================================

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

const parseCopies = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 24;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1 ||
    parsedValue > 96
  ) {
    return null;
  }

  return parsedValue;
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

const formatMoney = (value) => {
  return Number(value || 0).toFixed(2);
};

const sanitizeFileName = (value) => {
  return String(value).replace(
    /[^a-zA-Z0-9-_]/g,
    "_"
  );
};

const millimetresToPoints = (value) => {
  return (value * 72) / 25.4;
};

const barcodeTypeMap = {
  CODE128: "code128",
  EAN13: "ean13",
  UPC: "upca",
  OTHER: "code128",
};

// ======================================================
// Image generation helpers
// ======================================================

const generateBarcodeBuffer = async ({
  barcodeValue,
  barcodeType,
  includeText = true,
  scale = 3,
  height = 10,
}) => {
  const bcid =
    barcodeTypeMap[barcodeType] || "code128";

  return bwipjs.toBuffer({
    bcid,
    text: barcodeValue,
    scale,
    height,
    includetext: includeText,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
  });
};

const generateQrBuffer = async (
  qrValue,
  width = 400
) => {
  return QRCode.toBuffer(qrValue, {
    type: "png",
    width,
    margin: 1,
    errorCorrectionLevel: "M",
  });
};

// ======================================================
// Database helpers
// ======================================================

const getMedicinePrintData = async (
  medicineId
) => {
  const [rows] = await db.query(
    `
      SELECT
        medicines.id,
        medicines.sku,

        medicines.barcode_value
          AS barcodeValue,

        medicines.barcode_type
          AS barcodeType,

        medicines.brand_name
          AS brandName,

        medicines.generic_name
          AS genericName,

        medicines.strength,

        medicines.is_active
          AS isActive,

        medicine_categories.name
          AS categoryName,

        manufacturers.name
          AS manufacturerName

      FROM medicines

      LEFT JOIN medicine_categories
        ON medicine_categories.id =
          medicines.category_id

      LEFT JOIN manufacturers
        ON manufacturers.id =
          medicines.manufacturer_id

      WHERE medicines.id = ?

      LIMIT 1
    `,
    [medicineId]
  );

  return rows[0] || null;
};

const getBatchPrintData = async (batchId) => {
  const [rows] = await db.query(
    `
      SELECT
        medicine_batches.id AS batchId,

        medicine_batches.medicine_id
          AS medicineId,

        medicine_batches.batch_number
          AS batchNumber,

        medicine_batches.internal_qr_code
          AS internalQrCode,

        DATE_FORMAT(
          medicine_batches.manufacture_date,
          '%Y-%m-%d'
        ) AS manufactureDate,

        DATE_FORMAT(
          medicine_batches.expiry_date,
          '%Y-%m-%d'
        ) AS expiryDate,

        medicine_batches.purchase_price
          AS purchasePrice,

        medicine_batches.mrp,

        medicine_batches.selling_price
          AS sellingPrice,

        medicine_batches.quantity_available
          AS quantityAvailable,

        medicine_batches.is_active
          AS isActive,

        medicines.sku,

        medicines.barcode_value
          AS barcodeValue,

        medicines.barcode_type
          AS barcodeType,

        medicines.brand_name
          AS brandName,

        medicines.generic_name
          AS genericName,

        medicines.strength,

        manufacturers.name
          AS manufacturerName,

        CASE
          WHEN medicine_batches.is_active = 0
            THEN 'INACTIVE'

          WHEN medicine_batches.expiry_date <
            CURDATE()
            THEN 'EXPIRED'

          WHEN medicine_batches.quantity_available = 0
            THEN 'OUT_OF_STOCK'

          ELSE 'SELLABLE'
        END AS stockStatus

      FROM medicine_batches

      INNER JOIN medicines
        ON medicines.id =
          medicine_batches.medicine_id

      LEFT JOIN manufacturers
        ON manufacturers.id =
          medicines.manufacturer_id

      WHERE medicine_batches.id = ?

      LIMIT 1
    `,
    [batchId]
  );

  return rows[0] || null;
};

// ======================================================
// GET /api/barcodes/images/medicines/:id
// ======================================================

const getMedicineBarcodeImage = async (
  req,
  res
) => {
  try {
    const medicineId = parsePositiveId(
      req.params.id
    );

    if (!medicineId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid medicine ID is required",
      });
    }

    const medicine =
      await getMedicinePrintData(medicineId);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine was not found",
      });
    }

    if (!medicine.barcodeValue) {
      return res.status(409).json({
        success: false,
        message:
          "No barcode is assigned to this medicine",
      });
    }

    const barcodeBuffer =
      await generateBarcodeBuffer({
        barcodeValue:
          medicine.barcodeValue,

        barcodeType:
          medicine.barcodeType,

        includeText: true,
        scale: 4,
        height: 14,
      });

    const download =
      req.query.download === "true" ||
      req.query.download === "1";

    const fileName = sanitizeFileName(
      `${medicine.sku}-barcode.png`
    );

    res.setHeader(
      "Content-Type",
      "image/png"
    );

    res.setHeader(
      "Content-Length",
      barcodeBuffer.length
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

    return res.send(barcodeBuffer);
  } catch (error) {
    console.error(
      "Generate medicine barcode error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to generate medicine barcode image",
      error: error.message,
    });
  }
};

// ======================================================
// GET /api/barcodes/images/batches/:id
// ======================================================

const getBatchQrImage = async (req, res) => {
  try {
    const batchId = parsePositiveId(
      req.params.id
    );

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid batch ID is required",
      });
    }

    const batch =
      await getBatchPrintData(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message:
          "Medicine batch was not found",
      });
    }

    if (!batch.internalQrCode) {
      return res.status(409).json({
        success: false,
        message:
          "No QR value is assigned to this batch",
      });
    }

    const qrBuffer = await generateQrBuffer(
      batch.internalQrCode,
      500
    );

    const download =
      req.query.download === "true" ||
      req.query.download === "1";

    const fileName = sanitizeFileName(
      `${batch.batchNumber}-qr.png`
    );

    res.setHeader(
      "Content-Type",
      "image/png"
    );

    res.setHeader(
      "Content-Length",
      qrBuffer.length
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

    return res.send(qrBuffer);
  } catch (error) {
    console.error(
      "Generate batch QR error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to generate batch QR image",
      error: error.message,
    });
  }
};

// ======================================================
// GET /api/barcodes/labels/batches/:id/pdf
// ======================================================

const getBatchLabelPdf = async (req, res) => {
  try {
    const batchId = parsePositiveId(
      req.params.id
    );

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid batch ID is required",
      });
    }

    const copies = parseCopies(
      req.query.copies
    );

    if (!copies) {
      return res.status(400).json({
        success: false,
        message:
          "Copies must be between 1 and 96",
      });
    }

    const batch =
      await getBatchPrintData(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message:
          "Medicine batch was not found",
      });
    }

    if (!batch.barcodeValue) {
      return res.status(409).json({
        success: false,
        message:
          "No barcode is assigned to this medicine",
      });
    }

    if (!batch.internalQrCode) {
      return res.status(409).json({
        success: false,
        message:
          "No QR value is assigned to this batch",
      });
    }

    const barcodeBuffer =
      await generateBarcodeBuffer({
        barcodeValue:
          batch.barcodeValue,

        barcodeType:
          batch.barcodeType,

        includeText: false,
        scale: 3,
        height: 7,
      });

    const qrBuffer = await generateQrBuffer(
      batch.internalQrCode,
      250
    );

    const pharmacyName =
      process.env.PHARMACY_NAME ||
      "PharmaERP Pharmacy";

    const download =
      req.query.download === "true" ||
      req.query.download === "1";

    const fileName = sanitizeFileName(
      `${batch.batchNumber}-labels.pdf`
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
      margin: 0,
      bufferPages: true,

      info: {
        Title:
          `${batch.batchNumber} labels`,

        Author: pharmacyName,
      },
    });

    doc.pipe(res);

    const pageMarginX =
      millimetresToPoints(7);

    const pageMarginY =
      millimetresToPoints(7);

    const horizontalGap =
      millimetresToPoints(2);

    const verticalGap =
      millimetresToPoints(2);

    const columns = 3;
    const rows = 8;
    const labelsPerPage = columns * rows;

    const labelWidth =
      (
        doc.page.width -
        pageMarginX * 2 -
        horizontalGap * (columns - 1)
      ) / columns;

    const labelHeight =
      (
        doc.page.height -
        pageMarginY * 2 -
        verticalGap * (rows - 1)
      ) / rows;

    const drawLabel = (x, y) => {
      const padding = 5;
      const innerX = x + padding;
      const innerY = y + padding;

      const innerWidth =
        labelWidth - padding * 2;

      const qrSize = 42;

      doc
        .roundedRect(
          x,
          y,
          labelWidth,
          labelHeight,
          3
        )
        .lineWidth(0.5)
        .strokeColor("#b8bec7")
        .stroke();

      doc
        .fillColor("#1f4e78")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(
          safeText(batch.brandName),
          innerX,
          innerY,
          {
            width:
              innerWidth - qrSize - 6,
            height: 18,
            ellipsis: true,
          }
        );

      doc
        .fillColor("#222222")
        .font("Helvetica")
        .fontSize(6.3)
        .text(
          `${safeText(
            batch.genericName
          )} ${safeText(
            batch.strength,
            ""
          )}`.trim(),
          innerX,
          innerY + 18,
          {
            width:
              innerWidth - qrSize - 6,
            height: 10,
            ellipsis: true,
          }
        );

      doc
        .font("Helvetica-Bold")
        .fontSize(6.3)
        .text(
          `Batch: ${batch.batchNumber}`,
          innerX,
          innerY + 31,
          {
            width:
              innerWidth - qrSize - 6,
            lineBreak: false,
          }
        );

      doc
        .font("Helvetica")
        .fontSize(6.3)
        .text(
          `Expiry: ${batch.expiryDate}`,
          innerX,
          innerY + 41,
          {
            width:
              innerWidth - qrSize - 6,
            lineBreak: false,
          }
        );

      doc
        .fillColor("#1f4e78")
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(
          `MRP: Rs. ${formatMoney(
            batch.mrp
          )}`,
          innerX,
          innerY + 51,
          {
            width:
              innerWidth - qrSize - 6,
            lineBreak: false,
          }
        );

      doc.image(
        qrBuffer,
        x + labelWidth - qrSize - padding,
        innerY,
        {
          width: qrSize,
          height: qrSize,
        }
      );

      doc
        .fillColor("#222222")
        .font("Helvetica-Bold")
        .fontSize(5)
        .text(
          batch.stockStatus,
          x + labelWidth - qrSize - padding,
          innerY + qrSize + 1,
          {
            width: qrSize,
            align: "center",
            lineBreak: false,
          }
        );

      doc.image(
        barcodeBuffer,
        innerX,
        innerY + 62,
        {
          fit: [innerWidth, 17],
          align: "center",
        }
      );

      doc
        .fillColor("#222222")
        .font("Helvetica")
        .fontSize(4.8)
        .text(
          batch.barcodeValue,
          innerX,
          innerY + 79,
          {
            width: innerWidth,
            align: "center",
            lineBreak: false,
          }
        );
    };

    for (
      let index = 0;
      index < copies;
      index += 1
    ) {
      if (
        index > 0 &&
        index % labelsPerPage === 0
      ) {
        doc.addPage({
          size: "A4",
          margin: 0,
        });
      }

      const pagePosition =
        index % labelsPerPage;

      const row = Math.floor(
        pagePosition / columns
      );

      const column =
        pagePosition % columns;

      const x =
        pageMarginX +
        column *
          (labelWidth + horizontalGap);

      const y =
        pageMarginY +
        row *
          (labelHeight + verticalGap);

      drawLabel(x, y);
    }

    doc.end();
  } catch (error) {
    console.error(
      "Generate batch label PDF error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message:
          "Unable to generate batch label PDF",
        error: error.message,
      });
    }

    res.end();
  }
};

// ======================================================
// Correct exports
// ======================================================

module.exports = {
  getMedicineBarcodeImage,
  getBatchQrImage,
  getBatchLabelPdf,
};