const db = require("../config/db");

const parsePositiveId = (value) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const parseNonNegativeInteger = (value, fallback = 0) => {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
};

const parsePositiveMoney = (value) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return Number(parsedValue.toFixed(2));
};

const parseDate = (value, required = false) => {
  if (!value) {
    return required ? null : undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return value;
};

const getBatchRecord = async (batchId, connection = db) => {
  const [batches] = await connection.query(
    `
      SELECT
        batches.id,
        batches.medicine_id AS medicineId,

        medicines.sku,
        medicines.brand_name AS brandName,
        medicines.generic_name AS genericName,
        medicines.strength,

        batches.supplier_id AS supplierId,
        suppliers.name AS supplierName,

        batches.batch_number AS batchNumber,

        DATE_FORMAT(
          batches.manufacture_date,
          '%Y-%m-%d'
        ) AS manufactureDate,

        DATE_FORMAT(
          batches.expiry_date,
          '%Y-%m-%d'
        ) AS expiryDate,

        batches.purchase_price AS purchasePrice,
        batches.mrp,
        batches.selling_price AS sellingPrice,

        batches.quantity_received AS quantityReceived,
        batches.free_quantity AS freeQuantity,
        batches.quantity_available AS quantityAvailable,

        batches.purchase_reference AS purchaseReference,
        batches.location,
        batches.is_active AS isActive,

        batches.created_at AS createdAt,
        batches.updated_at AS updatedAt,

        users.full_name AS createdBy,

        CASE
          WHEN batches.expiry_date < CURDATE()
            THEN 'expired'

          WHEN batches.expiry_date <=
            DATE_ADD(CURDATE(), INTERVAL 90 DAY)
            THEN 'expiring'

          ELSE 'valid'
        END AS expiryStatus

      FROM medicine_batches AS batches

      INNER JOIN medicines
        ON medicines.id = batches.medicine_id

      LEFT JOIN suppliers
        ON suppliers.id = batches.supplier_id

      LEFT JOIN users
        ON users.id = batches.created_by

      WHERE batches.id = ?
      LIMIT 1
    `,
    [batchId]
  );

  return batches[0] || null;
};

const createBatch = async (req, res) => {
  let connection;

  try {
    const userId = Number(
      req.user?.id ?? req.user?.userId
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user ID is required",
      });
    }

    const {
      medicineId,
      supplierId,
      batchNumber,
      manufactureDate,
      expiryDate,
      purchasePrice,
      mrp,
      sellingPrice,
      quantityReceived,
      freeQuantity,
      purchaseReference,
      location,
    } = req.body;

    const parsedMedicineId = parsePositiveId(medicineId);

    if (!parsedMedicineId) {
      return res.status(400).json({
        success: false,
        message: "A valid medicine ID is required",
      });
    }

    let parsedSupplierId = null;

    if (
      supplierId !== undefined &&
      supplierId !== null &&
      supplierId !== ""
    ) {
      parsedSupplierId = parsePositiveId(supplierId);

      if (!parsedSupplierId) {
        return res.status(400).json({
          success: false,
          message: "A valid supplier ID is required",
        });
      }
    }

    if (!batchNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Batch number is required",
      });
    }

    const parsedManufactureDate = parseDate(
      manufactureDate,
      false
    );

    const parsedExpiryDate = parseDate(
      expiryDate,
      true
    );

    if (
      manufactureDate &&
      parsedManufactureDate === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Manufacture date must use YYYY-MM-DD format",
      });
    }

    if (!parsedExpiryDate) {
      return res.status(400).json({
        success: false,
        message: "Valid expiry date in YYYY-MM-DD format is required",
      });
    }

    if (
      parsedManufactureDate &&
      parsedManufactureDate >= parsedExpiryDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be after manufacture date",
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    if (parsedExpiryDate <= today) {
      return res.status(400).json({
        success: false,
        message: "Expired batches cannot be added to stock",
      });
    }

    const parsedPurchasePrice =
      parsePositiveMoney(purchasePrice);

    const parsedMrp =
      parsePositiveMoney(mrp);

    const parsedSellingPrice =
      parsePositiveMoney(sellingPrice);

    if (
      parsedPurchasePrice === null ||
      parsedMrp === null ||
      parsedSellingPrice === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Purchase price, MRP and selling price must be positive",
      });
    }

    if (parsedPurchasePrice > parsedMrp) {
      return res.status(400).json({
        success: false,
        message: "Purchase price cannot be greater than MRP",
      });
    }

    if (parsedSellingPrice > parsedMrp) {
      return res.status(400).json({
        success: false,
        message: "Selling price cannot be greater than MRP",
      });
    }

    const parsedQuantityReceived =
      parseNonNegativeInteger(quantityReceived, 0);

    const parsedFreeQuantity =
      parseNonNegativeInteger(freeQuantity, 0);

    if (
      parsedQuantityReceived === null ||
      parsedFreeQuantity === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Stock quantities must be non-negative whole numbers",
      });
    }

    const totalOpeningStock =
      parsedQuantityReceived + parsedFreeQuantity;

    if (totalOpeningStock <= 0) {
      return res.status(400).json({
        success: false,
        message: "Total opening stock must be greater than zero",
      });
    }

    const [medicines] = await db.query(
      `
        SELECT id
        FROM medicines
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
      `,
      [parsedMedicineId]
    );

    if (medicines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Active medicine was not found",
      });
    }

    if (parsedSupplierId) {
      const [suppliers] = await db.query(
        `
          SELECT id
          FROM suppliers
          WHERE id = ?
            AND is_active = 1
          LIMIT 1
        `,
        [parsedSupplierId]
      );

      if (suppliers.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Active supplier was not found",
        });
      }
    }

    connection = await db.getConnection();

    await connection.beginTransaction();

    const [duplicateBatches] = await connection.query(
      `
        SELECT id
        FROM medicine_batches
        WHERE medicine_id = ?
          AND LOWER(batch_number) = LOWER(?)
        LIMIT 1
      `,
      [
        parsedMedicineId,
        batchNumber.trim(),
      ]
    );

    if (duplicateBatches.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          "This batch number already exists for the medicine",
      });
    }

    const [result] = await connection.query(
      `
        INSERT INTO medicine_batches (
          medicine_id,
          supplier_id,
          batch_number,
          manufacture_date,
          expiry_date,
          purchase_price,
          mrp,
          selling_price,
          quantity_received,
          free_quantity,
          quantity_available,
          purchase_reference,
          location,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        parsedMedicineId,
        parsedSupplierId,
        batchNumber.trim().toUpperCase(),
        parsedManufactureDate || null,
        parsedExpiryDate,
        parsedPurchasePrice,
        parsedMrp,
        parsedSellingPrice,
        parsedQuantityReceived,
        parsedFreeQuantity,
        totalOpeningStock,
        purchaseReference?.trim() || null,
        location?.trim() || null,
        userId,
      ]
    );

    const internalQrCode =
      `PHARMAERP-BATCH-${result.insertId}-${batchNumber
        .trim()
        .toUpperCase()}`;

    await connection.query(
      `
        UPDATE medicine_batches
        SET internal_qr_code = ?
        WHERE id = ?
      `,
      [internalQrCode, result.insertId]
    );

    await connection.query(
      `
        INSERT INTO stock_movements (
          medicine_id,
          batch_id,
          movement_type,
          quantity,
          balance_after,
          reference_type,
          reference_id,
          notes,
          created_by
        )
        VALUES (?, ?, 'OPENING', ?, ?, ?, ?, ?, ?)
      `,
      [
        parsedMedicineId,
        result.insertId,
        totalOpeningStock,
        totalOpeningStock,
        "BATCH_OPENING",
        result.insertId,
        "Opening stock created with medicine batch",
        userId,
      ]
    );

    await connection.commit();

    const batch = await getBatchRecord(
      result.insertId
    );

    return res.status(201).json({
      success: true,
      message:
        "Medicine batch and opening stock created successfully",
      data: {
        batch,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Create batch error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This batch already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create medicine batch",
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const getBatches = async (req, res) => {
  try {
    const {
      search = "",
      medicineId,
      supplierId,
      status = "all",
      stock = "all",
      page = "1",
      limit = "10",
    } = req.query;

    const pageNumber = Math.max(
      Number.parseInt(page, 10) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(
        Number.parseInt(limit, 10) || 10,
        1
      ),
      100
    );

    const offset =
      (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (search.trim()) {
      conditions.push(`
        (
          batches.batch_number LIKE ?
          OR medicines.sku LIKE ?
          OR medicines.brand_name LIKE ?
          OR medicines.generic_name LIKE ?
          OR suppliers.name LIKE ?
          OR batches.purchase_reference LIKE ?
        )
      `);

      const searchValue =
        `%${search.trim()}%`;

      values.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    if (medicineId !== undefined) {
      const parsedMedicineId =
        parsePositiveId(medicineId);

      if (!parsedMedicineId) {
        return res.status(400).json({
          success: false,
          message: "A valid medicine ID is required",
        });
      }

      conditions.push(
        "batches.medicine_id = ?"
      );

      values.push(parsedMedicineId);
    }

    if (supplierId !== undefined) {
      const parsedSupplierId =
        parsePositiveId(supplierId);

      if (!parsedSupplierId) {
        return res.status(400).json({
          success: false,
          message: "A valid supplier ID is required",
        });
      }

      conditions.push(
        "batches.supplier_id = ?"
      );

      values.push(parsedSupplierId);
    }

    if (status === "active") {
      conditions.push(
        "batches.is_active = 1"
      );
    }

    if (status === "inactive") {
      conditions.push(
        "batches.is_active = 0"
      );
    }

    if (stock === "available") {
      conditions.push(
        "batches.quantity_available > 0"
      );
    }

    if (stock === "out") {
      conditions.push(
        "batches.quantity_available = 0"
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM medicine_batches AS batches

        INNER JOIN medicines
          ON medicines.id = batches.medicine_id

        LEFT JOIN suppliers
          ON suppliers.id = batches.supplier_id

        ${whereClause}
      `,
      values
    );

    const [batches] = await db.query(
      `
        SELECT
          batches.id,
          batches.medicine_id AS medicineId,

          medicines.sku,
          medicines.brand_name AS brandName,
          medicines.generic_name AS genericName,
          medicines.strength,

          batches.supplier_id AS supplierId,
          suppliers.name AS supplierName,

          batches.batch_number AS batchNumber,

          DATE_FORMAT(
            batches.manufacture_date,
            '%Y-%m-%d'
          ) AS manufactureDate,

          DATE_FORMAT(
            batches.expiry_date,
            '%Y-%m-%d'
          ) AS expiryDate,

          batches.purchase_price AS purchasePrice,
          batches.mrp,
          batches.selling_price AS sellingPrice,

          batches.quantity_received AS quantityReceived,
          batches.free_quantity AS freeQuantity,
          batches.quantity_available AS quantityAvailable,

          batches.purchase_reference AS purchaseReference,
          batches.location,
          batches.is_active AS isActive,
          batches.created_at AS createdAt,

          CASE
            WHEN batches.expiry_date < CURDATE()
              THEN 'expired'

            WHEN batches.expiry_date <=
              DATE_ADD(CURDATE(), INTERVAL 90 DAY)
              THEN 'expiring'

            ELSE 'valid'
          END AS expiryStatus

        FROM medicine_batches AS batches

        INNER JOIN medicines
          ON medicines.id = batches.medicine_id

        LEFT JOIN suppliers
          ON suppliers.id = batches.supplier_id

        ${whereClause}

        ORDER BY
          batches.expiry_date ASC,
          batches.id DESC

        LIMIT ? OFFSET ?
      `,
      [
        ...values,
        limitNumber,
        offset,
      ]
    );

    const total =
      Number(countRows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        batches,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages:
            Math.ceil(total / limitNumber),
        },
      },
    });
  } catch (error) {
    console.error(
      "Get batches error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve medicine batches",
      error: error.message,
    });
  }
};

const getBatchById = async (req, res) => {
  try {
    const batchId =
      parsePositiveId(req.params.id);

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "A valid batch ID is required",
      });
    }

    const batch =
      await getBatchRecord(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Medicine batch was not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        batch,
      },
    });
  } catch (error) {
    console.error(
      "Get batch error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve medicine batch",
      error: error.message,
    });
  }
};

const getExpiryAlerts = async (req, res) => {
  try {
    const requestedDays =
      Number.parseInt(req.query.days, 10);

    const days = Math.min(
      Math.max(
        Number.isInteger(requestedDays)
          ? requestedDays
          : 90,
        1
      ),
      1095
    );

    const [batches] = await db.query(
      `
        SELECT
          batches.id AS batchId,
          batches.batch_number AS batchNumber,

          DATE_FORMAT(
            batches.expiry_date,
            '%Y-%m-%d'
          ) AS expiryDate,

          batches.quantity_available AS quantityAvailable,

          medicines.id AS medicineId,
          medicines.sku,
          medicines.brand_name AS brandName,
          medicines.generic_name AS genericName,
          medicines.strength,

          suppliers.name AS supplierName,

          DATEDIFF(
            batches.expiry_date,
            CURDATE()
          ) AS daysRemaining,

          CASE
            WHEN batches.expiry_date < CURDATE()
              THEN 'expired'
            ELSE 'expiring'
          END AS alertType

        FROM medicine_batches AS batches

        INNER JOIN medicines
          ON medicines.id = batches.medicine_id

        LEFT JOIN suppliers
          ON suppliers.id = batches.supplier_id

        WHERE batches.is_active = 1
          AND batches.quantity_available > 0
          AND batches.expiry_date <=
            DATE_ADD(
              CURDATE(),
              INTERVAL ${days} DAY
            )

        ORDER BY batches.expiry_date ASC
      `
    );

    return res.status(200).json({
      success: true,
      data: {
        alertWindowDays: days,
        count: batches.length,
        batches,
      },
    });
  } catch (error) {
    console.error(
      "Get expiry alerts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve expiry alerts",
      error: error.message,
    });
  }
};

const getLowStockReport = async (
  req,
  res
) => {
  try {
    const [medicines] = await db.query(
      `
        SELECT
          medicines.id,
          medicines.sku,
          medicines.brand_name AS brandName,
          medicines.generic_name AS genericName,
          medicines.strength,
          medicines.reorder_level AS reorderLevel,

          COALESCE(
            SUM(
              CASE
                WHEN batches.is_active = 1
                  AND batches.expiry_date >= CURDATE()
                THEN batches.quantity_available
                ELSE 0
              END
            ),
            0
          ) AS availableStock,

          COUNT(
            DISTINCT CASE
              WHEN batches.is_active = 1
                AND batches.expiry_date >= CURDATE()
                AND batches.quantity_available > 0
              THEN batches.id
            END
          ) AS availableBatchCount

        FROM medicines

        LEFT JOIN medicine_batches AS batches
          ON batches.medicine_id = medicines.id

        WHERE medicines.is_active = 1

        GROUP BY
          medicines.id,
          medicines.sku,
          medicines.brand_name,
          medicines.generic_name,
          medicines.strength,
          medicines.reorder_level

        HAVING availableStock <=
          medicines.reorder_level

        ORDER BY
          availableStock ASC,
          medicines.brand_name ASC
      `
    );

    return res.status(200).json({
      success: true,
      data: {
        count: medicines.length,
        medicines,
      },
    });
  } catch (error) {
    console.error(
      "Get low-stock report error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve low-stock report",
      error: error.message,
    });
  }
};

const getStockMovements = async (
  req,
  res
) => {
  try {
    const {
      medicineId,
      batchId,
      movementType,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNumber = Math.max(
      Number.parseInt(page, 10) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(
        Number.parseInt(limit, 10) || 20,
        1
      ),
      100
    );

    const offset =
      (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (medicineId !== undefined) {
      const parsedMedicineId =
        parsePositiveId(medicineId);

      if (!parsedMedicineId) {
        return res.status(400).json({
          success: false,
          message:
            "A valid medicine ID is required",
        });
      }

      conditions.push(
        "movements.medicine_id = ?"
      );

      values.push(parsedMedicineId);
    }

    if (batchId !== undefined) {
      const parsedBatchId =
        parsePositiveId(batchId);

      if (!parsedBatchId) {
        return res.status(400).json({
          success: false,
          message:
            "A valid batch ID is required",
        });
      }

      conditions.push(
        "movements.batch_id = ?"
      );

      values.push(parsedBatchId);
    }

    if (movementType?.trim()) {
      conditions.push(
        "movements.movement_type = ?"
      );

      values.push(
        movementType.trim().toUpperCase()
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM stock_movements AS movements
        ${whereClause}
      `,
      values
    );

    const [movements] = await db.query(
      `
        SELECT
          movements.id,
          movements.medicine_id AS medicineId,

          medicines.sku,
          medicines.brand_name AS brandName,

          movements.batch_id AS batchId,
          batches.batch_number AS batchNumber,

          movements.movement_type AS movementType,
          movements.quantity,
          movements.balance_after AS balanceAfter,

          movements.reference_type AS referenceType,
          movements.reference_id AS referenceId,
          movements.notes,

          movements.created_at AS createdAt,
          users.full_name AS createdBy

        FROM stock_movements AS movements

        INNER JOIN medicines
          ON medicines.id =
            movements.medicine_id

        INNER JOIN medicine_batches AS batches
          ON batches.id =
            movements.batch_id

        LEFT JOIN users
          ON users.id =
            movements.created_by

        ${whereClause}

        ORDER BY movements.id DESC

        LIMIT ? OFFSET ?
      `,
      [
        ...values,
        limitNumber,
        offset,
      ]
    );

    const total =
      Number(countRows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        movements,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages:
            Math.ceil(total / limitNumber),
        },
      },
    });
  } catch (error) {
    console.error(
      "Get stock movements error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve stock movements",
      error: error.message,
    });
  }
};

module.exports = {
  createBatch,
  getBatches,
  getBatchById,
  getExpiryAlerts,
  getLowStockReport,
  getStockMovements,
};