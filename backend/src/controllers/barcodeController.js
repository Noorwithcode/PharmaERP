const db = require("../config/db");

const createApiError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

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

const normalizeCode = (
  value,
  maximumLength = 150
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalizedValue = String(value).trim();

  if (
    normalizedValue.length < 3 ||
    normalizedValue.length > maximumLength
  ) {
    return null;
  }

  return normalizedValue;
};

const isValidEan13 = (value) => {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }

  const digits = value
    .split("")
    .map(Number);

  const checksumDigit = digits[12];

  const checksumTotal = digits
    .slice(0, 12)
    .reduce((total, digit, index) => {
      return (
        total +
        digit *
          (index % 2 === 0 ? 1 : 3)
      );
    }, 0);

  const calculatedChecksum =
    (10 - (checksumTotal % 10)) % 10;

  return calculatedChecksum === checksumDigit;
};

const isValidUpc = (value) => {
  return /^\d{12}$/.test(value);
};

const validateBarcode = (
  barcodeValue,
  barcodeType
) => {
  if (
    barcodeType === "EAN13" &&
    !isValidEan13(barcodeValue)
  ) {
    return {
      valid: false,
      message:
        "EAN13 barcode must contain 13 digits with a valid checksum",
    };
  }

  if (
    barcodeType === "UPC" &&
    !isValidUpc(barcodeValue)
  ) {
    return {
      valid: false,
      message:
        "UPC barcode must contain exactly 12 digits",
    };
  }

  if (
    ["CODE128", "OTHER"].includes(barcodeType) &&
    barcodeValue.length < 3
  ) {
    return {
      valid: false,
      message:
        "Barcode value must contain at least 3 characters",
    };
  }

  return {
    valid: true,
    message: null,
  };
};

// ======================================================
// GET /api/barcodes/medicines/:code
// ======================================================

const getMedicineByBarcode = async (
  req,
  res
) => {
  try {
    const barcodeValue = normalizeCode(
      req.params.code,
      100
    );

    if (!barcodeValue) {
      return res.status(400).json({
        success: false,
        message:
          "A valid medicine barcode is required",
      });
    }

    const [medicineRows] = await db.query(
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

          medicines.gst_percent
            AS gstPercent,

          medicines.reorder_level
            AS reorderLevel,

          medicines.prescription_required
            AS prescriptionRequired,

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

        WHERE medicines.barcode_value = ?
           OR medicines.barcode = ?
           OR medicines.sku = ?

        LIMIT 1
      `,
      [
        barcodeValue,
        barcodeValue,
        barcodeValue,
      ]
    );

    if (medicineRows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No medicine was found for this barcode",
      });
    }

    const medicine = medicineRows[0];

    const [batchRows] = await db.query(
      `
        SELECT
          medicine_batches.id
            AS batchId,

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

        WHERE medicine_batches.medicine_id = ?

        ORDER BY
          CASE
            WHEN medicine_batches.is_active = 1
              AND medicine_batches.expiry_date >=
                CURDATE()
              AND medicine_batches.quantity_available > 0
            THEN 0
            ELSE 1
          END,

          medicine_batches.expiry_date ASC,
          medicine_batches.id ASC
      `,
      [medicine.id]
    );

    const sellableBatches = batchRows.filter(
      (batch) =>
        batch.stockStatus === "SELLABLE"
    );

    const totalSellableStock =
      sellableBatches.reduce(
        (total, batch) =>
          total +
          Number(batch.quantityAvailable),
        0
      );

    const totalPhysicalStock =
      batchRows.reduce(
        (total, batch) =>
          total +
          Number(batch.quantityAvailable),
        0
      );

    const preferredFefoBatch =
      sellableBatches[0] || null;

    return res.status(200).json({
      success: true,
      message: "Medicine barcode matched",
      data: {
        medicine: {
          ...medicine,

          prescriptionRequired:
            Boolean(
              Number(
                medicine.prescriptionRequired
              )
            ),

          isActive: Boolean(
            Number(medicine.isActive)
          ),
        },

        inventory: {
          totalPhysicalStock,
          totalSellableStock,

          reorderLevel: Number(
            medicine.reorderLevel
          ),

          lowStock:
            totalSellableStock <=
            Number(medicine.reorderLevel),

          outOfStock:
            totalSellableStock === 0,

          batchCount: batchRows.length,

          sellableBatchCount:
            sellableBatches.length,
        },

        preferredFefoBatch,
        batches: batchRows,
      },
    });
  } catch (error) {
    console.error(
      "Get medicine by barcode error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve medicine barcode details",
      error: error.message,
    });
  }
};

// ======================================================
// GET /api/barcodes/batches/:code
// ======================================================

const getBatchByQrCode = async (
  req,
  res
) => {
  try {
    const qrCode = normalizeCode(
      req.params.code,
      150
    );

    if (!qrCode) {
      return res.status(400).json({
        success: false,
        message:
          "A valid batch QR code is required",
      });
    }

    const [batchRows] = await db.query(
      `
        SELECT
          medicine_batches.id
            AS batchId,

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

          medicine_batches.quantity_received
            AS quantityReceived,

          medicine_batches.free_quantity
            AS freeQuantity,

          medicine_batches.quantity_available
            AS quantityAvailable,

          medicine_batches.is_active
            AS isActive,

          medicines.sku,

          medicines.barcode_value
            AS medicineBarcode,

          medicines.barcode_type
            AS barcodeType,

          medicines.brand_name
            AS brandName,

          medicines.generic_name
            AS genericName,

          medicines.strength,

          medicines.gst_percent
            AS gstPercent,

          medicines.prescription_required
            AS prescriptionRequired,

          CASE
            WHEN medicine_batches.is_active = 0
              THEN 'INACTIVE'

            WHEN medicine_batches.expiry_date <
              CURDATE()
              THEN 'EXPIRED'

            WHEN medicine_batches.quantity_available = 0
              THEN 'OUT_OF_STOCK'

            ELSE 'SELLABLE'
          END AS stockStatus,

          DATEDIFF(
            medicine_batches.expiry_date,
            CURDATE()
          ) AS daysUntilExpiry

        FROM medicine_batches

        INNER JOIN medicines
          ON medicines.id =
            medicine_batches.medicine_id

        WHERE medicine_batches.internal_qr_code = ?
           OR medicine_batches.batch_number = ?

        LIMIT 1
      `,
      [qrCode, qrCode]
    );

    if (batchRows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No medicine batch was found for this QR code",
      });
    }

    const batch = batchRows[0];

    const [movementRows] = await db.query(
      `
        SELECT
          stock_movements.id,

          stock_movements.movement_type
            AS movementType,

          stock_movements.quantity,
          stock_movements.balance_after
            AS balanceAfter,

          stock_movements.reference_type
            AS referenceType,

          stock_movements.reference_id
            AS referenceId,

          stock_movements.notes,

          DATE_FORMAT(
            stock_movements.created_at,
            '%Y-%m-%d %H:%i:%s'
          ) AS movementDate,

          stock_movements.created_by
            AS createdBy

        FROM stock_movements

        WHERE stock_movements.batch_id = ?

        ORDER BY
          stock_movements.created_at DESC,
          stock_movements.id DESC

        LIMIT 10
      `,
      [batch.batchId]
    );

    return res.status(200).json({
      success: true,
      message: "Batch QR code matched",
      data: {
        batch: {
          ...batch,

          isActive: Boolean(
            Number(batch.isActive)
          ),

          prescriptionRequired:
            Boolean(
              Number(
                batch.prescriptionRequired
              )
            ),

          daysUntilExpiry: Number(
            batch.daysUntilExpiry
          ),
        },

        recentMovements: movementRows,
      },
    });
  } catch (error) {
    console.error(
      "Get batch by QR error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve batch QR details",
      error: error.message,
    });
  }
};

// ======================================================
// PATCH /api/barcodes/medicines/:id
// ======================================================

const updateMedicineBarcode = async (
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

    const {
      barcodeValue,
      barcodeType = "CODE128",
    } = req.body;

    const normalizedBarcodeValue =
      normalizeCode(barcodeValue, 100);

    if (!normalizedBarcodeValue) {
      return res.status(400).json({
        success: false,
        message:
          "Barcode value must contain between 3 and 100 characters",
      });
    }

    const normalizedBarcodeType = String(
      barcodeType
    )
      .trim()
      .toUpperCase();

    const allowedBarcodeTypes = [
      "CODE128",
      "EAN13",
      "UPC",
      "OTHER",
    ];

    if (
      !allowedBarcodeTypes.includes(
        normalizedBarcodeType
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid barcode type",
      });
    }

    const validation = validateBarcode(
      normalizedBarcodeValue,
      normalizedBarcodeType
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const [medicineRows] = await db.query(
      `
        SELECT id
        FROM medicines
        WHERE id = ?
        LIMIT 1
      `,
      [medicineId]
    );

    if (medicineRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Medicine was not found",
      });
    }

    await db.query(
      `
        UPDATE medicines

        SET
          barcode_value = ?,
          barcode_type = ?

        WHERE id = ?
      `,
      [
        normalizedBarcodeValue,
        normalizedBarcodeType,
        medicineId,
      ]
    );

    const [updatedRows] = await db.query(
      `
        SELECT
          id,
          sku,

          barcode_value AS barcodeValue,
          barcode_type AS barcodeType,

          brand_name AS brandName,
          generic_name AS genericName,
          strength

        FROM medicines

        WHERE id = ?

        LIMIT 1
      `,
      [medicineId]
    );

    return res.status(200).json({
      success: true,
      message:
        "Medicine barcode updated successfully",
      data: {
        medicine: updatedRows[0],
      },
    });
  } catch (error) {
    console.error(
      "Update medicine barcode error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "This barcode is already assigned to another medicine",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to update medicine barcode",
      error: error.message,
    });
  }
};

// ======================================================
// PATCH /api/barcodes/batches/:id
// ======================================================

const updateBatchQrCode = async (
  req,
  res
) => {
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

    const requestedQrValue =
      req.body.internalQrCode ??
      req.body.qrCode;

    const normalizedQrValue =
      normalizeCode(
        requestedQrValue,
        150
      );

    if (!normalizedQrValue) {
      return res.status(400).json({
        success: false,
        message:
          "QR value must contain between 3 and 150 characters",
      });
    }

    const [batchRows] = await db.query(
      `
        SELECT id
        FROM medicine_batches
        WHERE id = ?
        LIMIT 1
      `,
      [batchId]
    );

    if (batchRows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Medicine batch was not found",
      });
    }

    await db.query(
      `
        UPDATE medicine_batches

        SET internal_qr_code = ?

        WHERE id = ?
      `,
      [
        normalizedQrValue,
        batchId,
      ]
    );

    const [updatedRows] = await db.query(
      `
        SELECT
          medicine_batches.id
            AS batchId,

          medicine_batches.medicine_id
            AS medicineId,

          medicine_batches.batch_number
            AS batchNumber,

          medicine_batches.internal_qr_code
            AS internalQrCode,

          DATE_FORMAT(
            medicine_batches.expiry_date,
            '%Y-%m-%d'
          ) AS expiryDate,

          medicine_batches.quantity_available
            AS quantityAvailable,

          medicines.brand_name
            AS medicineName

        FROM medicine_batches

        INNER JOIN medicines
          ON medicines.id =
            medicine_batches.medicine_id

        WHERE medicine_batches.id = ?

        LIMIT 1
      `,
      [batchId]
    );

    return res.status(200).json({
      success: true,
      message:
        "Batch QR code updated successfully",
      data: {
        batch: updatedRows[0],
      },
    });
  } catch (error) {
    console.error(
      "Update batch QR error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "This QR value is already assigned to another batch",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to update batch QR code",
      error: error.message,
    });
  }
};

module.exports = {
  getMedicineByBarcode,
  getBatchByQrCode,
  updateMedicineBarcode,
  updateBatchQrCode,
};