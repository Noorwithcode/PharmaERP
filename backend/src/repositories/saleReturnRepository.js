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
| Sale and item locks
|--------------------------------------------------------------------------
*/

const getSaleForUpdate = async (
  saleId,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        invoice_number AS invoiceNumber,
        customer_id AS customerId,
        customer_name AS customerName,
        customer_phone AS customerPhone,
        customer_address AS customerAddress,
        grand_total AS grandTotal,
        paid_amount AS paidAmount,
        due_amount AS dueAmount,
        payment_status AS paymentStatus,
        status

      FROM sales

      WHERE id = ?

      LIMIT 1
      FOR UPDATE
    `,
    [saleId]
  );

  return rows[0] || null;
};

const getSaleItemForUpdate = async (
  saleId,
  saleItemId,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT
        sale_items.id AS saleItemId,
        sale_items.sale_id AS saleId,
        sale_items.medicine_id AS medicineId,
        sale_items.batch_id AS batchId,
        sale_items.medicine_name AS medicineName,
        sale_items.generic_name AS genericName,
        sale_items.batch_number AS batchNumber,

        DATE_FORMAT(
          sale_items.expiry_date,
          '%Y-%m-%d'
        ) AS expiryDate,

        sale_items.quantity AS soldQuantity,
        sale_items.returned_quantity AS returnedQuantity,
        sale_items.selling_price AS sellingPrice,
        sale_items.discount_percent AS discountPercent,
        sale_items.gst_percent AS gstPercent,

        medicine_batches.quantity_available AS quantityAvailable

      FROM sale_items

      INNER JOIN medicine_batches
        ON medicine_batches.id = sale_items.batch_id

      WHERE sale_items.id = ?
        AND sale_items.sale_id = ?

      LIMIT 1
      FOR UPDATE
    `,
    [
      saleItemId,
      saleId,
    ]
  );

  return rows[0] || null;
};

/*
|--------------------------------------------------------------------------
| Insert sale return
|--------------------------------------------------------------------------
*/

const insertSaleReturn = async (
  returnData,
  connection
) => {
  const [result] = await connection.query(
    `
      INSERT INTO sale_returns (
        return_number,
        sale_id,
        return_date,
        total_quantity,
        taxable_amount,
        tax_amount,
        refund_amount,
        refund_method,
        refund_reference,
        reason,
        status,
        created_by
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'COMPLETED', ?
      )
    `,
    [
      returnData.returnNumber,
      returnData.saleId,
      returnData.returnDate,
      returnData.totalQuantity,
      returnData.taxableAmount,
      returnData.taxAmount,
      returnData.refundAmount,
      returnData.refundMethod,
      returnData.refundReference,
      returnData.reason,
      returnData.createdBy,
    ]
  );

  return result.insertId;
};

const insertSaleReturnItem = async (
  item,
  connection
) => {
  const [result] = await connection.query(
    `
      INSERT INTO sale_return_items (
        sale_return_id,
        sale_item_id,
        medicine_id,
        batch_id,
        quantity,
        selling_price,
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
      item.saleReturnId,
      item.saleItemId,
      item.medicineId,
      item.batchId,
      item.quantity,
      item.sellingPrice,
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

const increaseBatchStock = async (
  batchId,
  quantity,
  connection
) => {
  const [result] = await connection.query(
    `
      UPDATE medicine_batches

      SET quantity_available =
        quantity_available + ?

      WHERE id = ?
    `,
    [
      quantity,
      batchId,
    ]
  );

  return result.affectedRows;
};

const increaseReturnedQuantity = async (
  saleItemId,
  quantity,
  connection
) => {
  const [result] = await connection.query(
    `
      UPDATE sale_items

      SET returned_quantity =
        returned_quantity + ?

      WHERE id = ?
        AND returned_quantity + ? <= quantity
    `,
    [
      quantity,
      saleItemId,
      quantity,
    ]
  );

  return result.affectedRows;
};

const insertSaleReturnStockMovement = async (
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
        'SALE_RETURN',
        ?, ?,
        'SALE_RETURN',
        ?, ?, ?
      )
    `,
    [
      movement.medicineId,
      movement.batchId,
      movement.quantity,
      movement.balanceAfter,
      movement.saleReturnId,
      movement.notes,
      movement.createdBy,
    ]
  );

  return result.insertId;
};

/*
|--------------------------------------------------------------------------
| Sale and customer updates
|--------------------------------------------------------------------------
*/

const getSaleReturnQuantitySummary = async (
  saleId,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT
        COALESCE(
          SUM(quantity),
          0
        ) AS soldQuantity,

        COALESCE(
          SUM(returned_quantity),
          0
        ) AS returnedQuantity

      FROM sale_items

      WHERE sale_id = ?
    `,
    [saleId]
  );

  return {
    soldQuantity: Number(
      rows[0]?.soldQuantity || 0
    ),

    returnedQuantity: Number(
      rows[0]?.returnedQuantity || 0
    ),
  };
};

const updateSaleAfterReturn = async (
  saleId,
  updateData,
  connection
) => {
  await connection.query(
    `
      UPDATE sales

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
      saleId,
    ]
  );
};

const updateCustomerAfterSaleReturn = async (
  customerId,
  updateData,
  connection
) => {
  if (!customerId) {
    return;
  }

  await connection.query(
    `
      UPDATE customers

      SET
        total_purchases =
          GREATEST(
            total_purchases - ?,
            0
          ),

        outstanding_balance =
          GREATEST(
            outstanding_balance - ?,
            0
          )

      WHERE id = ?
    `,
    [
      updateData.returnTotal,
      updateData.dueAdjusted,
      customerId,
    ]
  );
};

/*
|--------------------------------------------------------------------------
| Sale return details
|--------------------------------------------------------------------------
*/

const getSaleReturnHeader = async (
  returnId,
  connection = db
) => {
  const [rows] = await connection.query(
    `
      SELECT
        sale_returns.id,
        sale_returns.return_number AS returnNumber,
        sale_returns.sale_id AS saleId,
        sales.invoice_number AS invoiceNumber,

        sales.customer_id AS customerId,

        COALESCE(
          sales.customer_name,
          customers.full_name,
          'Walk-in Customer'
        ) AS customerName,

        COALESCE(
          sales.customer_phone,
          customers.phone
        ) AS customerPhone,

        COALESCE(
          sales.customer_address,
          customers.address
        ) AS customerAddress,

        customers.email AS customerEmail,

        DATE_FORMAT(
          sale_returns.return_date,
          '%Y-%m-%d %H:%i:%s'
        ) AS returnDate,

        sale_returns.total_quantity AS totalQuantity,

        COALESCE(
          (
            SELECT SUM(
              sale_return_items.quantity *
              sale_return_items.selling_price
            )
            FROM sale_return_items
            WHERE sale_return_items.sale_return_id =
              sale_returns.id
          ),
          0
        ) AS subtotal,

        COALESCE(
          (
            SELECT SUM(
              sale_return_items.discount_amount
            )
            FROM sale_return_items
            WHERE sale_return_items.sale_return_id =
              sale_returns.id
          ),
          0
        ) AS discountAmount,

        sale_returns.taxable_amount AS taxableAmount,
        sale_returns.tax_amount AS taxAmount,

        (
          sale_returns.taxable_amount +
          sale_returns.tax_amount
        ) AS returnTotal,

        sale_returns.refund_amount AS refundAmount,
        sale_returns.refund_method AS refundMethod,
        sale_returns.refund_reference AS refundReference,
        sale_returns.reason,
        sale_returns.status,

        sale_returns.created_at AS createdAt,
        sale_returns.updated_at AS updatedAt,

        users.full_name AS createdBy

      FROM sale_returns

      INNER JOIN sales
        ON sales.id = sale_returns.sale_id

      LEFT JOIN customers
        ON customers.id = sales.customer_id

      LEFT JOIN users
        ON users.id = sale_returns.created_by

      WHERE sale_returns.id = ?

      LIMIT 1
    `,
    [returnId]
  );

  return rows[0] || null;
};

const getSaleReturnItems = async (
  returnId,
  connection = db
) => {
  const [rows] = await connection.query(
    `
      SELECT
        sale_return_items.id,
        sale_return_items.sale_return_id AS saleReturnId,
        sale_return_items.sale_item_id AS saleItemId,
        sale_return_items.medicine_id AS medicineId,
        sale_return_items.batch_id AS batchId,

        medicines.sku,

        sale_items.medicine_name AS medicineName,
        sale_items.generic_name AS genericName,
        sale_items.batch_number AS batchNumber,

        DATE_FORMAT(
          sale_items.expiry_date,
          '%Y-%m-%d'
        ) AS expiryDate,

        sale_return_items.quantity,
        sale_return_items.selling_price AS sellingPrice,
        sale_return_items.discount_percent AS discountPercent,
        sale_return_items.discount_amount AS discountAmount,
        sale_return_items.gst_percent AS gstPercent,
        sale_return_items.taxable_amount AS taxableAmount,
        sale_return_items.tax_amount AS taxAmount,
        sale_return_items.line_total AS lineTotal,

        medicine_batches.quantity_available AS quantityAvailable

      FROM sale_return_items

      INNER JOIN sale_items
        ON sale_items.id = sale_return_items.sale_item_id

      INNER JOIN medicines
        ON medicines.id = sale_return_items.medicine_id

      INNER JOIN medicine_batches
        ON medicine_batches.id = sale_return_items.batch_id

      WHERE sale_return_items.sale_return_id = ?

      ORDER BY sale_return_items.id ASC
    `,
    [returnId]
  );

  return rows;
};

/*
|--------------------------------------------------------------------------
| Sale return list
|--------------------------------------------------------------------------
*/

const getSaleReturns = async ({
  search = "",
  saleId = null,
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
        sale_returns.return_number LIKE ?
        OR sales.invoice_number LIKE ?
        OR sales.customer_name LIKE ?
        OR sales.customer_phone LIKE ?
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

  if (saleId) {
    conditions.push(
      "sale_returns.sale_id = ?"
    );

    values.push(saleId);
  }

  if (status) {
    conditions.push(
      "sale_returns.status = ?"
    );

    values.push(status);
  }

  if (dateFrom) {
    conditions.push(
      "DATE(sale_returns.return_date) >= ?"
    );

    values.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(
      "DATE(sale_returns.return_date) <= ?"
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

      FROM sale_returns

      INNER JOIN sales
        ON sales.id = sale_returns.sale_id

      ${whereClause}
    `,
    values
  );

  const [rows] = await db.query(
    `
      SELECT
        sale_returns.id,
        sale_returns.return_number AS returnNumber,
        sale_returns.sale_id AS saleId,
        sales.invoice_number AS invoiceNumber,

        COALESCE(
          sales.customer_name,
          customers.full_name,
          'Walk-in Customer'
        ) AS customerName,

        DATE_FORMAT(
          sale_returns.return_date,
          '%Y-%m-%d %H:%i:%s'
        ) AS returnDate,

        sale_returns.total_quantity AS totalQuantity,
        sale_returns.taxable_amount AS taxableAmount,
        sale_returns.tax_amount AS taxAmount,

        (
          sale_returns.taxable_amount +
          sale_returns.tax_amount
        ) AS returnTotal,

        sale_returns.refund_amount AS refundAmount,
        sale_returns.refund_method AS refundMethod,
        sale_returns.status,
        sale_returns.reason,
        sale_returns.created_at AS createdAt,

        users.full_name AS createdBy

      FROM sale_returns

      INNER JOIN sales
        ON sales.id = sale_returns.sale_id

      LEFT JOIN customers
        ON customers.id = sales.customer_id

      LEFT JOIN users
        ON users.id = sale_returns.created_by

      ${whereClause}

      ORDER BY sale_returns.id DESC

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

  getSaleForUpdate,
  getSaleItemForUpdate,

  insertSaleReturn,
  insertSaleReturnItem,

  increaseBatchStock,
  increaseReturnedQuantity,
  insertSaleReturnStockMovement,

  getSaleReturnQuantitySummary,
  updateSaleAfterReturn,
  updateCustomerAfterSaleReturn,

  getSaleReturnHeader,
  getSaleReturnItems,
  getSaleReturns,
};