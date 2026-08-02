const crypto = require("crypto");
const db = require("../config/db");

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Example:
 * ADJ-20260801-A12B34CD
 */
const generateAdjustmentNumber = () => {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const uniquePart = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `ADJ-${datePart}-${uniquePart}`;
};

const normalizeMovementType = (item) => {
  const suppliedType = String(
    item.movementType ||
    item.movement_type ||
    item.adjustmentType ||
    ""
  )
    .trim()
    .toUpperCase();

  const typeMap = {
    ADD: "ADJUSTMENT_IN",
    INCREASE: "ADJUSTMENT_IN",
    ADJUSTMENT_IN: "ADJUSTMENT_IN",

    SUBTRACT: "ADJUSTMENT_OUT",
    DECREASE: "ADJUSTMENT_OUT",
    ADJUSTMENT_OUT: "ADJUSTMENT_OUT",

    DAMAGE: "DAMAGE",
    DAMAGED: "DAMAGE",

    EXPIRED: "EXPIRED"
  };

  return typeMap[suppliedType] || null;
};

const isStockIncrease = (movementType) => {
  return movementType === "ADJUSTMENT_IN";
};

const isStockDecrease = (movementType) => {
  return [
    "ADJUSTMENT_OUT",
    "DAMAGE",
    "EXPIRED"
  ].includes(movementType);
};

/**
 * Create stock adjustment.
 *
 * Transaction-এর মধ্যে:
 * 1. Adjustment header
 * 2. Batch row lock
 * 3. Batch quantity update
 * 4. Adjustment item
 * 5. Stock movement
 */
const createStockAdjustment = async (
  adjustmentData,
  adjustmentItems
) => {
  const connection =
    await db.getConnection();

  try {
    await connection.beginTransaction();

    const adjustmentNumber =
      adjustmentData.adjustmentNumber ||
      adjustmentData.referenceNumber ||
      generateAdjustmentNumber();

    const adjustmentDate =
      adjustmentData.adjustmentDate ||
      new Date();

    const [adjustmentResult] =
      await connection.query(
        `
          INSERT INTO stock_adjustments (
            adjustment_number,
            adjustment_date,
            reason,
            notes,
            status,
            created_by
          )
          VALUES (?, ?, ?, ?, 'COMPLETED', ?)
        `,
        [
          adjustmentNumber,
          adjustmentDate,
          adjustmentData.reason,
          adjustmentData.notes || null,
          adjustmentData.createdBy || null
        ]
      );

    const stockAdjustmentId =
      adjustmentResult.insertId;

    /*
     * সব request একই batch order-এ
     * lock নিলে deadlock risk কমে।
     */
    const sortedItems = [
      ...adjustmentItems
    ].sort(
      (firstItem, secondItem) =>
        Number(firstItem.batchId) -
        Number(secondItem.batchId)
    );

    const processedBatchIds =
      new Set();

    for (const item of sortedItems) {
      const medicineId =
        Number(item.medicineId);

      const batchId =
        Number(item.batchId);

      const quantity =
        Number(item.quantity);

      const movementType =
        normalizeMovementType(item);

      if (
        !Number.isInteger(medicineId) ||
        medicineId <= 0
      ) {
        throw createError(
          "Valid medicine ID is required."
        );
      }

      if (
        !Number.isInteger(batchId) ||
        batchId <= 0
      ) {
        throw createError(
          "Valid batch ID is required."
        );
      }

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        throw createError(
          `Quantity for Batch ID ${batchId} ` +
          "must be a positive integer."
        );
      }

      if (!movementType) {
        throw createError(
          `Invalid movement type for ` +
          `Batch ID ${batchId}.`
        );
      }

      if (
        processedBatchIds.has(batchId)
      ) {
        throw createError(
          `Batch ID ${batchId} appears ` +
          "more than once."
        );
      }

      processedBatchIds.add(batchId);

      /*
       * FOR UPDATE latest batch row read
       * করে transaction শেষ হওয়া পর্যন্ত
       * row lock করে রাখে।
       */
      const [batchRows] =
        await connection.query(
          `
            SELECT
              id,
              medicine_id,
              batch_number,
              quantity_available,
              is_active
            FROM medicine_batches
            WHERE id = ?
            FOR UPDATE
          `,
          [batchId]
        );

      if (batchRows.length === 0) {
        throw createError(
          `Batch ID ${batchId} not found.`,
          404
        );
      }

      const batch = batchRows[0];

      if (!Boolean(batch.is_active)) {
        throw createError(
          `Batch ${batch.batch_number} ` +
          "is inactive.",
          409
        );
      }

      if (
        Number(batch.medicine_id) !==
        medicineId
      ) {
        throw createError(
          `Batch ID ${batchId} does not ` +
          `belong to Medicine ID ` +
          `${medicineId}.`
        );
      }

      const previousStock =
        Number(batch.quantity_available);

      if (
        isStockDecrease(movementType) &&
        previousStock < quantity
      ) {
        throw createError(
          `Insufficient stock for Batch ` +
          `${batch.batch_number}. ` +
          `Available stock: ` +
          `${previousStock}, requested ` +
          `quantity: ${quantity}.`,
          409
        );
      }

      const balanceAfter =
        isStockIncrease(movementType)
          ? previousStock + quantity
          : previousStock - quantity;

      let updateResult;

      if (
        isStockIncrease(movementType)
      ) {
        [updateResult] =
          await connection.query(
            `
              UPDATE medicine_batches
              SET quantity_available =
                quantity_available + ?
              WHERE id = ?
                AND medicine_id = ?
                AND is_active = TRUE
            `,
            [
              quantity,
              batchId,
              medicineId
            ]
          );
      } else {
        /*
         * Atomic stock decrease।
         * quantity_available >= quantity
         * negative stock-এর বিরুদ্ধে
         * দ্বিতীয় protection।
         */
        [updateResult] =
          await connection.query(
            `
              UPDATE medicine_batches
              SET quantity_available =
                quantity_available - ?
              WHERE id = ?
                AND medicine_id = ?
                AND is_active = TRUE
                AND quantity_available >= ?
            `,
            [
              quantity,
              batchId,
              medicineId,
              quantity
            ]
          );
      }

      if (
        updateResult.affectedRows !== 1
      ) {
        throw createError(
          `Stock update failed for ` +
          `Batch ID ${batchId}. Stock may ` +
          "have changed concurrently.",
          409
        );
      }

      await connection.query(
        `
          INSERT INTO stock_adjustment_items (
            stock_adjustment_id,
            medicine_id,
            batch_id,
            movement_type,
            quantity,
            previous_stock,
            balance_after,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          stockAdjustmentId,
          medicineId,
          batchId,
          movementType,
          quantity,
          previousStock,
          balanceAfter,
          item.notes ||
            item.remarks ||
            adjustmentData.notes ||
            null
        ]
      );

      /*
       * reference_id-তে master
       * stock adjustment ID রাখা হচ্ছে।
       */
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
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          medicineId,
          batchId,
          movementType,
          quantity,
          balanceAfter,
          "STOCK_ADJUSTMENT",
          stockAdjustmentId,
          item.notes ||
            item.remarks ||
            adjustmentData.notes ||
            null,
          adjustmentData.createdBy ||
            null
        ]
      );
    }

    await connection.commit();

    return stockAdjustmentId;
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      throw createError(
        "Duplicate stock adjustment " +
        "detected. Please try again.",
        409
      );
    }

    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get adjustment header.
 */
const getStockAdjustmentHeader = async (
  adjustmentId
) => {
  const [rows] = await db.query(
    `
      SELECT
        id,
        adjustment_number
          AS adjustmentNumber,
        adjustment_date
          AS adjustmentDate,
        reason,
        notes,
        status,
        created_by AS createdBy,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM stock_adjustments
      WHERE id = ?
    `,
    [adjustmentId]
  );

  return rows[0] || null;
};

/**
 * Get adjustment items.
 */
const getStockAdjustmentItems = async (
  adjustmentId
) => {
  const [rows] = await db.query(
    `
      SELECT
        sai.id,
        sai.stock_adjustment_id
          AS stockAdjustmentId,
        sai.medicine_id AS medicineId,
        sai.batch_id AS batchId,
        mb.batch_number AS batchNumber,
        sai.movement_type
          AS movementType,
        sai.quantity,
        sai.previous_stock
          AS previousStock,
        sai.balance_after
          AS balanceAfter,
        sai.notes,
        sai.created_at AS createdAt
      FROM stock_adjustment_items sai
      INNER JOIN medicine_batches mb
        ON mb.id = sai.batch_id
      WHERE sai.stock_adjustment_id = ?
      ORDER BY sai.id ASC
    `,
    [adjustmentId]
  );

  /*
   * MySQL numeric fields API-তে
   * number হিসেবে return করা।
   */
  return rows.map((item) => ({
    ...item,
    id: Number(item.id),
    stockAdjustmentId:
      Number(item.stockAdjustmentId),
    medicineId:
      Number(item.medicineId),
    batchId:
      Number(item.batchId),
    quantity:
      Number(item.quantity),
    previousStock:
      Number(item.previousStock),
    balanceAfter:
      Number(item.balanceAfter)
  }));
};

/**
 * Get adjustment list/report.
 */
const getStockAdjustments = async ({
  page = 1,
  limit = 20,
  status,
  reason,
  dateFrom,
  dateTo
} = {}) => {
  const safePage = Math.max(
    Number(page) || 1,
    1
  );

  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 20,
      1
    ),
    100
  );

  const offset =
    (safePage - 1) * safeLimit;

  const conditions = [];
  const parameters = [];

  if (status) {
    conditions.push("sa.status = ?");
    parameters.push(
      String(status)
        .trim()
        .toUpperCase()
    );
  }

  if (reason) {
    conditions.push("sa.reason = ?");

    parameters.push(
      String(reason)
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_")
    );
  }

  if (dateFrom) {
    conditions.push(
      "DATE(sa.adjustment_date) >= ?"
    );

    parameters.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(
      "DATE(sa.adjustment_date) <= ?"
    );

    parameters.push(dateTo);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";

  const [countRows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM stock_adjustments sa
      ${whereClause}
    `,
    parameters
  );

  const [adjustments] =
    await db.query(
      `
        SELECT
          sa.id,
          sa.adjustment_number
            AS adjustmentNumber,
          sa.adjustment_date
            AS adjustmentDate,
          sa.reason,
          sa.notes,
          sa.status,
          sa.created_by AS createdBy,
          sa.created_at AS createdAt,
          COUNT(sai.id) AS totalItems,
          COALESCE(
            SUM(sai.quantity),
            0
          ) AS totalQuantity
        FROM stock_adjustments sa
        LEFT JOIN stock_adjustment_items sai
          ON sai.stock_adjustment_id =
             sa.id
        ${whereClause}
        GROUP BY
          sa.id,
          sa.adjustment_number,
          sa.adjustment_date,
          sa.reason,
          sa.notes,
          sa.status,
          sa.created_by,
          sa.created_at
        ORDER BY sa.id DESC
        LIMIT ? OFFSET ?
      `,
      [
        ...parameters,
        safeLimit,
        offset
      ]
    );

  const total =
    Number(countRows[0].total);

  /*
   * COUNT এবং SUM result number-এ
   * convert করা হচ্ছে।
   */
  const formattedAdjustments =
    adjustments.map(
      (adjustment) => ({
        ...adjustment,
        id: Number(adjustment.id),
        createdBy:
          adjustment.createdBy === null
            ? null
            : Number(
                adjustment.createdBy
              ),
        totalItems: Number(
          adjustment.totalItems
        ),
        totalQuantity: Number(
          adjustment.totalQuantity
        )
      })
    );

  return {
    adjustments:
      formattedAdjustments,

    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages:
        Math.ceil(total / safeLimit)
    }
  };
};

module.exports = {
  createStockAdjustment,
  getStockAdjustmentHeader,
  getStockAdjustmentItems,
  getStockAdjustments
};