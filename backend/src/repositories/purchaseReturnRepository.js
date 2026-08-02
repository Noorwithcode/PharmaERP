const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| Transaction
|--------------------------------------------------------------------------
*/

const runInTransaction = async (callback) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const result = await callback(connection);

    await connection.commit();

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/*
|--------------------------------------------------------------------------
| Purchase and item locks
|--------------------------------------------------------------------------
*/

const getPurchaseForUpdate = async (
  purchaseId,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        purchase_number AS purchaseNumber,
        supplier_id AS supplierId,
        grand_total AS grandTotal,
        paid_amount AS paidAmount,
        due_amount AS dueAmount,
        payment_status AS paymentStatus,
        status

      FROM purchases

      WHERE id = ?

      LIMIT 1
      FOR UPDATE
    `,
    [purchaseId]
  );

  return rows[0] || null;
};

const getPurchaseItemForUpdate = async (
  purchaseId,
  purchaseItemId,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT
        purchase_items.id AS purchaseItemId,
        purchase_items.purchase_id AS purchaseId,
        purchase_items.medicine_id AS medicineId,
        purchase_items.batch_id AS batchId,
        purchase_items.quantity AS purchasedQuantity,
        purchase_items.free_quantity AS freeQuantity,
        purchase_items.returned_quantity AS returnedQuantity,
        purchase_items.purchase_price AS purchasePrice,
        purchase_items.discount_percent AS discountPercent,
        purchase_items.gst_percent AS gstPercent,

        medicines.brand_name AS brandName,
        medicines.generic_name AS genericName,
        medicines.strength,

        medicine_batches.batch_number AS batchNumber,
        medicine_batches.quantity_available AS quantityAvailable

      FROM purchase_items

      INNER JOIN medicines
        ON medicines.id = purchase_items.medicine_id

      INNER JOIN medicine_batches
        ON medicine_batches.id = purchase_items.batch_id

      WHERE purchase_items.id = ?
        AND purchase_items.purchase_id = ?

      LIMIT 1
      FOR UPDATE
    `,
    [
      purchaseItemId,
      purchaseId,
    ]
  );

  return rows[0] || null;
};

/*
|--------------------------------------------------------------------------
| Insert purchase return
|--------------------------------------------------------------------------
*/

const insertPurchaseReturn = async (
  returnData,
  connection
) => {
  const [result] = await connection.query(
    `
      INSERT INTO purchase_returns (
        return_number,
        purchase_id,
        supplier_id,
        return_date,
        total_quantity,
        subtotal,
        discount_amount,
        taxable_amount,
        tax_amount,
        return_total,
        due_adjusted,
        refund_amount,
        settlement_method,
        settlement_reference,
        reason,
        status,
        created_by
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, 'COMPLETED', ?
      )
    `,
    [
      returnData.returnNumber,
      returnData.purchaseId,
      returnData.supplierId,
      returnData.returnDate,
      returnData.totalQuantity,
      returnData.subtotal,
      returnData.discountAmount,
      returnData.taxableAmount,
      returnData.taxAmount,
      returnData.returnTotal,
      returnData.dueAdjusted,
      returnData.refundAmount,
      returnData.settlementMethod,
      returnData.settlementReference,
      returnData.reason,
      returnData.createdBy,
    ]
  );

  return result.insertId;
};

const insertPurchaseReturnItem = async (
  item,
  connection
) => {
  const [result] = await connection.query(
    `
      INSERT INTO purchase_return_items (
        purchase_return_id,
        purchase_item_id,
        medicine_id,
        batch_id,
        quantity,
        purchase_price,
        discount_percent,
        discount_amount,
        gst_percent,
        taxable_amount,
        tax_amount,
        line_total
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
    [
      item.purchaseReturnId,
      item.purchaseItemId,
      item.medicineId,
      item.batchId,
      item.quantity,
      item.purchasePrice,
      item.discountPercent,
      item.discountAmount,
      item.gstPercent,
      item.taxableAmount,
      item.taxAmount,
      item.lineTotal,
    ]
  );

  return result.insertId;
};

/*
|--------------------------------------------------------------------------
| Inventory changes
|--------------------------------------------------------------------------
*/

const decreaseBatchStock = async (
  batchId,
  quantity,
  connection
) => {
  const [result] = await connection.query(
    `
      UPDATE medicine_batches

      SET quantity_available =
        quantity_available - ?

      WHERE id = ?
        AND quantity_available >= ?
    `,
    [
      quantity,
      batchId,
      quantity,
    ]
  );

  return result.affectedRows;
};

const increaseReturnedQuantity = async (
  purchaseItemId,
  quantity,
  connection
) => {
  const [result] = await connection.query(
    `
      UPDATE purchase_items

      SET returned_quantity =
        returned_quantity + ?

      WHERE id = ?
        AND returned_quantity + ? <= quantity
    `,
    [
      quantity,
      purchaseItemId,
      quantity,
    ]
  );

  return result.affectedRows;
};

const insertPurchaseReturnStockMovement = async (
  movement,
  connection
) => {
  const [result] = await connection.query(
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
      VALUES (
        ?, ?,
        'PURCHASE_RETURN',
        ?, ?,
        'PURCHASE_RETURN',
        ?, ?, ?
      )
    `,
    [
      movement.medicineId,
      movement.batchId,
      movement.quantity,
      movement.balanceAfter,
      movement.purchaseReturnId,
      movement.notes,
      movement.createdBy,
    ]
  );

  return result.insertId;
};

/*
|--------------------------------------------------------------------------
| Purchase status and payable balance
|--------------------------------------------------------------------------
*/

const getPurchaseReturnQuantitySummary = async (
  purchaseId,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT
        COALESCE(
          SUM(quantity),
          0
        ) AS purchasedQuantity,

        COALESCE(
          SUM(returned_quantity),
          0
        ) AS returnedQuantity

      FROM purchase_items

      WHERE purchase_id = ?
    `,
    [purchaseId]
  );

  return {
    purchasedQuantity: Number(
      rows[0]?.purchasedQuantity || 0
    ),

    returnedQuantity: Number(
      rows[0]?.returnedQuantity || 0
    ),
  };
};

const updatePurchaseAfterReturn = async (
  purchaseId,
  updateData,
  connection
) => {
  await connection.query(
    `
      UPDATE purchases

      SET
        due_amount = ?,
        payment_status = ?,
        status = ?

      WHERE id = ?
    `,
    [
      updateData.dueAmount,
      updateData.paymentStatus,
      updateData.status,
      purchaseId,
    ]
  );
};

/*
|--------------------------------------------------------------------------
| Purchase return details
|--------------------------------------------------------------------------
*/

const getPurchaseReturnHeader = async (
  returnId,
  connection = db
) => {
  const [rows] = await connection.query(
    `
      SELECT
        purchase_returns.id,
        purchase_returns.return_number AS returnNumber,
        purchase_returns.purchase_id AS purchaseId,
        purchases.purchase_number AS purchaseNumber,
        purchases.invoice_number AS invoiceNumber,

        purchase_returns.supplier_id AS supplierId,
        suppliers.name AS supplierName,
        suppliers.contact_person AS supplierContactPerson,
        suppliers.phone AS supplierPhone,
        suppliers.email AS supplierEmail,
        suppliers.address AS supplierAddress,
        suppliers.gstin AS supplierGstin,

        DATE_FORMAT(
          purchase_returns.return_date,
          '%Y-%m-%d %H:%i:%s'
        ) AS returnDate,

        purchase_returns.total_quantity AS totalQuantity,
        purchase_returns.subtotal,
        purchase_returns.discount_amount AS discountAmount,
        purchase_returns.taxable_amount AS taxableAmount,
        purchase_returns.tax_amount AS taxAmount,
        purchase_returns.return_total AS returnTotal,
        purchase_returns.due_adjusted AS dueAdjusted,
        purchase_returns.refund_amount AS refundAmount,
        purchase_returns.settlement_method AS settlementMethod,
        purchase_returns.settlement_reference AS settlementReference,
        purchase_returns.reason,
        purchase_returns.status,

        purchase_returns.created_at AS createdAt,
        purchase_returns.updated_at AS updatedAt,

        users.full_name AS createdBy

      FROM purchase_returns

      INNER JOIN purchases
        ON purchases.id = purchase_returns.purchase_id

      INNER JOIN suppliers
        ON suppliers.id = purchase_returns.supplier_id

      LEFT JOIN users
        ON users.id = purchase_returns.created_by

      WHERE purchase_returns.id = ?

      LIMIT 1
    `,
    [returnId]
  );

  return rows[0] || null;
};

const getPurchaseReturnItems = async (
  returnId,
  connection = db
) => {
  const [rows] = await connection.query(
    `
      SELECT
        purchase_return_items.id,
        purchase_return_items.purchase_return_id AS purchaseReturnId,
        purchase_return_items.purchase_item_id AS purchaseItemId,
        purchase_return_items.medicine_id AS medicineId,
        purchase_return_items.batch_id AS batchId,

        medicines.sku,
        medicines.brand_name AS brandName,
        medicines.generic_name AS genericName,
        medicines.strength,

        medicine_batches.batch_number AS batchNumber,

        purchase_return_items.quantity,
        purchase_return_items.purchase_price AS purchasePrice,
        purchase_return_items.discount_percent AS discountPercent,
        purchase_return_items.discount_amount AS discountAmount,
        purchase_return_items.gst_percent AS gstPercent,
        purchase_return_items.taxable_amount AS taxableAmount,
        purchase_return_items.tax_amount AS taxAmount,
        purchase_return_items.line_total AS lineTotal,

        medicine_batches.quantity_available AS quantityAvailable

      FROM purchase_return_items

      INNER JOIN medicines
        ON medicines.id = purchase_return_items.medicine_id

      INNER JOIN medicine_batches
        ON medicine_batches.id = purchase_return_items.batch_id

      WHERE purchase_return_items.purchase_return_id = ?

      ORDER BY purchase_return_items.id ASC
    `,
    [returnId]
  );

  return rows;
};

/*
|--------------------------------------------------------------------------
| Purchase return list
|--------------------------------------------------------------------------
*/

const getPurchaseReturns = async ({
  search = "",
  purchaseId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  limit = 10,
  offset = 0,
}) => {
  const conditions = [];
  const values = [];

  if (search) {
    conditions.push(`
      (
        purchase_returns.return_number LIKE ?
        OR purchases.purchase_number LIKE ?
        OR purchases.invoice_number LIKE ?
        OR suppliers.name LIKE ?
      )
    `);

    const searchValue = `%${search}%`;

    values.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue
    );
  }

  if (purchaseId) {
    conditions.push(
      "purchase_returns.purchase_id = ?"
    );

    values.push(purchaseId);
  }

  if (status) {
    conditions.push(
      "purchase_returns.status = ?"
    );

    values.push(status);
  }

  if (dateFrom) {
    conditions.push(
      "DATE(purchase_returns.return_date) >= ?"
    );

    values.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(
      "DATE(purchase_returns.return_date) <= ?"
    );

    values.push(dateTo);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const [countRows] = await db.query(
    `
      SELECT
        COUNT(*) AS total

      FROM purchase_returns

      INNER JOIN purchases
        ON purchases.id = purchase_returns.purchase_id

      INNER JOIN suppliers
        ON suppliers.id = purchase_returns.supplier_id

      ${whereClause}
    `,
    values
  );

  const [rows] = await db.query(
    `
      SELECT
        purchase_returns.id,
        purchase_returns.return_number AS returnNumber,
        purchase_returns.purchase_id AS purchaseId,
        purchases.purchase_number AS purchaseNumber,
        purchases.invoice_number AS invoiceNumber,

        purchase_returns.supplier_id AS supplierId,
        suppliers.name AS supplierName,

        DATE_FORMAT(
          purchase_returns.return_date,
          '%Y-%m-%d %H:%i:%s'
        ) AS returnDate,

        purchase_returns.total_quantity AS totalQuantity,
        purchase_returns.return_total AS returnTotal,
        purchase_returns.due_adjusted AS dueAdjusted,
        purchase_returns.refund_amount AS refundAmount,
        purchase_returns.settlement_method AS settlementMethod,
        purchase_returns.status,
        purchase_returns.reason,
        purchase_returns.created_at AS createdAt,

        users.full_name AS createdBy

      FROM purchase_returns

      INNER JOIN purchases
        ON purchases.id = purchase_returns.purchase_id

      INNER JOIN suppliers
        ON suppliers.id = purchase_returns.supplier_id

      LEFT JOIN users
        ON users.id = purchase_returns.created_by

      ${whereClause}

      ORDER BY purchase_returns.id DESC

      LIMIT ? OFFSET ?
    `,
    [
      ...values,
      Number(limit),
      Number(offset),
    ]
  );

  return {
    returns: rows,

    total: Number(
      countRows[0]?.total || 0
    ),
  };
};

module.exports = {
  runInTransaction,

  getPurchaseForUpdate,
  getPurchaseItemForUpdate,

  insertPurchaseReturn,
  insertPurchaseReturnItem,

  decreaseBatchStock,
  increaseReturnedQuantity,
  insertPurchaseReturnStockMovement,

  getPurchaseReturnQuantitySummary,
  updatePurchaseAfterReturn,

  getPurchaseReturnHeader,
  getPurchaseReturnItems,
  getPurchaseReturns,
};