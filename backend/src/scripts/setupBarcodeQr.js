require("dotenv").config();

const db = require("../config/db");

const columnExists = async (
  tableName,
  columnName
) => {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total

      FROM information_schema.COLUMNS

      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [
      process.env.DB_NAME,
      tableName,
      columnName,
    ]
  );

  return Number(rows[0].total) > 0;
};

const indexExists = async (
  tableName,
  indexName
) => {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total

      FROM information_schema.STATISTICS

      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [
      process.env.DB_NAME,
      tableName,
      indexName,
    ]
  );

  return Number(rows[0].total) > 0;
};

const setupBarcodeQr = async () => {
  try {
    console.log(
      "Starting barcode and QR setup..."
    );

    // ============================================
    // 1. Add barcode value to medicines
    // ============================================

    const barcodeValueExists =
      await columnExists(
        "medicines",
        "barcode_value"
      );

    if (!barcodeValueExists) {
      await db.query(`
        ALTER TABLE medicines

        ADD COLUMN barcode_value
          VARCHAR(100) NULL

        AFTER sku
      `);

      console.log(
        "✅ barcode_value added to medicines"
      );
    } else {
      console.log(
        "ℹ️ medicines.barcode_value already exists"
      );
    }

    // ============================================
    // 2. Add barcode type to medicines
    // ============================================

    const barcodeTypeExists =
      await columnExists(
        "medicines",
        "barcode_type"
      );

    if (!barcodeTypeExists) {
      await db.query(`
        ALTER TABLE medicines

        ADD COLUMN barcode_type ENUM(
          'CODE128',
          'EAN13',
          'UPC',
          'OTHER'
        )
        NOT NULL DEFAULT 'CODE128'

        AFTER barcode_value
      `);

      console.log(
        "✅ barcode_type added to medicines"
      );
    } else {
      console.log(
        "ℹ️ medicines.barcode_type already exists"
      );
    }

    // ============================================
    // 3. Add internal QR code to batches
    // ============================================

    const batchQrExists =
      await columnExists(
        "medicine_batches",
        "internal_qr_code"
      );

    if (!batchQrExists) {
      await db.query(`
        ALTER TABLE medicine_batches

        ADD COLUMN internal_qr_code
          VARCHAR(150) NULL

        AFTER batch_number
      `);

      console.log(
        "✅ internal_qr_code added to medicine_batches"
      );
    } else {
      console.log(
        "ℹ️ medicine_batches.internal_qr_code already exists"
      );
    }

    // ============================================
    // 4. Existing medicine barcode backfill
    // ============================================

    const [medicineBackfillResult] =
      await db.query(`
        UPDATE medicines

        SET
          barcode_value = sku,
          barcode_type = 'CODE128'

        WHERE barcode_value IS NULL
           OR TRIM(barcode_value) = ''
      `);

    console.log(
      `✅ ${medicineBackfillResult.affectedRows} medicine barcode(s) generated`
    );

    // ============================================
    // 5. Existing batch QR backfill
    // ============================================

    const [batchBackfillResult] =
      await db.query(`
        UPDATE medicine_batches

        SET internal_qr_code = CONCAT(
          'PHARMAERP-BATCH-',
          id,
          '-',
          batch_number
        )

        WHERE internal_qr_code IS NULL
           OR TRIM(internal_qr_code) = ''
      `);

    console.log(
      `✅ ${batchBackfillResult.affectedRows} batch QR value(s) generated`
    );

    // ============================================
    // 6. Unique medicine barcode index
    // ============================================

    const medicineBarcodeIndexExists =
      await indexExists(
        "medicines",
        "uq_medicines_barcode_value"
      );

    if (!medicineBarcodeIndexExists) {
      await db.query(`
        ALTER TABLE medicines

        ADD UNIQUE INDEX
          uq_medicines_barcode_value (
            barcode_value
          )
      `);

      console.log(
        "✅ Unique medicine barcode index created"
      );
    } else {
      console.log(
        "ℹ️ Medicine barcode index already exists"
      );
    }

    // ============================================
    // 7. Unique batch QR index
    // ============================================

    const batchQrIndexExists =
      await indexExists(
        "medicine_batches",
        "uq_batches_internal_qr_code"
      );

    if (!batchQrIndexExists) {
      await db.query(`
        ALTER TABLE medicine_batches

        ADD UNIQUE INDEX
          uq_batches_internal_qr_code (
            internal_qr_code
          )
      `);

      console.log(
        "✅ Unique batch QR index created"
      );
    } else {
      console.log(
        "ℹ️ Batch QR index already exists"
      );
    }

    // ============================================
    // 8. Verify medicine barcode data
    // ============================================

    const [medicines] = await db.query(`
      SELECT
        id,
        sku,

        barcode_value AS barcodeValue,
        barcode_type AS barcodeType,

        brand_name AS brandName,
        generic_name AS genericName

      FROM medicines

      ORDER BY id ASC
    `);

    console.log("\nMedicine barcodes:");

    console.table(medicines);

    // ============================================
    // 9. Verify batch QR data
    // ============================================

    const [batches] = await db.query(`
      SELECT
        medicine_batches.id,

        medicine_batches.medicine_id
          AS medicineId,

        medicines.brand_name
          AS medicineName,

        medicine_batches.batch_number
          AS batchNumber,

        medicine_batches.internal_qr_code
          AS internalQrCode,

        DATE_FORMAT(
          medicine_batches.expiry_date,
          '%Y-%m-%d'
        ) AS expiryDate,

        medicine_batches.quantity_available
          AS quantityAvailable

      FROM medicine_batches

      INNER JOIN medicines
        ON medicines.id =
          medicine_batches.medicine_id

      ORDER BY medicine_batches.id ASC
    `);

    console.log("\nBatch QR values:");

    console.table(batches);

    console.log(
      "✅ Barcode and QR setup completed successfully"
    );
  } catch (error) {
    console.error(
      "❌ Barcode and QR setup failed"
    );

    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupBarcodeQr();
