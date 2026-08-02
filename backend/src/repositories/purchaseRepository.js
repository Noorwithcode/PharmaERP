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
| Purchase header
|--------------------------------------------------------------------------
*/

const getPurchaseHeader = async (
  purchaseId,
  connection = db
) => {
  const [rows] = await connection.query(
    `
      SELECT
        purchases.id,
        purchases.purchase_number AS purchaseNumber,
        purchases.supplier_id AS supplierId,
        purchases.invoice_number AS invoiceNumber,

        DATE_FORMAT(
          purchases.invoice_date,
          '%Y-%m-%d'
        ) AS invoiceDate,

        DATE_FORMAT(
          purchases.purchase_date,
          '%Y-%m-%d'
        ) AS purchaseDate,

        purchases.subtotal,
        purchases.discount_amount AS discountAmount,
        purchases.taxable_amount AS taxableAmount,
        purchases.tax_amount AS taxAmount,
        purchases.round_off AS roundOff,
        purchases.grand_total AS grandTotal,
        purchases.paid_amount AS paidAmount,
        purchases.due_amount AS dueAmount,
        purchases.payment_status AS paymentStatus,
        purchases.payment_method AS paymentMethod,
        purchases.status,
        purchases.notes,
        purchases.created_at AS createdAt,
        purchases.updated_at AS updatedAt,

        suppliers.name AS supplierName,
        suppliers.contact_person AS supplierContactPerson,
        suppliers.phone AS supplierPhone,
        suppliers.email AS supplierEmail,
        suppliers.address AS supplierAddress,
        suppliers.gstin AS supplierGstin,

        users.full_name AS createdBy

      FROM purchases

      INNER JOIN suppliers
        ON suppliers.id = purchases.supplier_id

      LEFT JOIN users
        ON users.id = purchases.created_by

      WHERE purchases.id = ?

      LIMIT 1
    `,
    [purchaseId]
  );

  return rows[0] || null;
};

/*
|--------------------------------------------------------------------------
| Purchase items
|--------------------------------------------------------------------------
*/

const getPurchaseItems = async (
  purchaseId,
  connection = db
) => {
  const [rows] = await connection.query(
    `
      SELECT
        purchase_items.id,
        purchase_items.purchase_id AS purchaseId,
        purchase_items.medicine_id AS medicineId,

        medicines.sku,
        medicines.brand_name AS brandName,
        medicines.generic_name AS genericName,
        medicines.strength,

        purchase_items.batch_id AS batchId,
        purchase_items.batch_number AS batchNumber,

        DATE_FORMAT(
          purchase_items.manufacture_date,
          '%Y-%m-%d'
        ) AS manufactureDate,

        DATE_FORMAT(
          purchase_items.expiry_date,
          '%Y-%m-%d'
        ) AS expiryDate,

        purchase_items.quantity,
        purchase_items.free_quantity AS freeQuantity,
        purchase_items.purchase_price AS purchasePrice,
        purchase_items.mrp,
        purchase_items.selling_price AS sellingPrice,
        purchase_items.discount_percent AS discountPercent,
        purchase_items.discount_amount AS discountAmount,
        purchase_items.gst_percent AS gstPercent,
        purchase_items.taxable_amount AS taxableAmount,
        purchase_items.tax_amount AS taxAmount,
        purchase_items.line_total AS lineTotal,

        medicine_batches.quantity_available AS quantityAvailable

      FROM purchase_items

      INNER JOIN medicines
        ON medicines.id = purchase_items.medicine_id

      LEFT JOIN medicine_batches
        ON medicine_batches.id = purchase_items.batch_id

      WHERE purchase_items.purchase_id = ?

      ORDER BY purchase_items.id ASC
    `,
    [purchaseId]
  );

  return rows;
};

/*
|--------------------------------------------------------------------------
| Purchase list
|--------------------------------------------------------------------------
*/

const getPurchases = async ({
  search = "",
  supplierId = null,
  paymentStatus = null,
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
        purchases.purchase_number LIKE ?
        OR purchases.invoice_number LIKE ?
        OR suppliers.name LIKE ?
        OR suppliers.phone LIKE ?
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

  if (supplierId) {
    conditions.push(
      "purchases.supplier_id = ?"
    );

    values.push(supplierId);
  }

  if (paymentStatus) {
    conditions.push(
      "purchases.payment_status = ?"
    );

    values.push(paymentStatus);
  }

  if (status) {
    conditions.push(
      "purchases.status = ?"
    );

    values.push(status);
  }

  if (dateFrom) {
    conditions.push(
      "purchases.purchase_date >= ?"
    );

    values.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(
      "purchases.purchase_date <= ?"
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

      FROM purchases

      INNER JOIN suppliers
        ON suppliers.id = purchases.supplier_id

      ${whereClause}
    `,
    values
  );

  const [rows] = await db.query(
    `
      SELECT
        purchases.id,
        purchases.purchase_number AS purchaseNumber,
        purchases.supplier_id AS supplierId,
        suppliers.name AS supplierName,
        purchases.invoice_number AS invoiceNumber,

        DATE_FORMAT(
          purchases.invoice_date,
          '%Y-%m-%d'
        ) AS invoiceDate,

        DATE_FORMAT(
          purchases.purchase_date,
          '%Y-%m-%d'
        ) AS purchaseDate,

        purchases.subtotal,
        purchases.discount_amount AS discountAmount,
        purchases.tax_amount AS taxAmount,
        purchases.grand_total AS grandTotal,
        purchases.paid_amount AS paidAmount,
        purchases.due_amount AS dueAmount,
        purchases.payment_status AS paymentStatus,
        purchases.payment_method AS paymentMethod,
        purchases.status,
        purchases.created_at AS createdAt,

        users.full_name AS createdBy,

        (
          SELECT COUNT(*)
          FROM purchase_items
          WHERE purchase_items.purchase_id = purchases.id
        ) AS itemCount

      FROM purchases

      INNER JOIN suppliers
        ON suppliers.id = purchases.supplier_id

      LEFT JOIN users
        ON users.id = purchases.created_by

      ${whereClause}

      ORDER BY purchases.id DESC

      LIMIT ? OFFSET ?
    `,
    [
      ...values,
      Number(limit),
      Number(offset),
    ]
  );

  return {
    purchases: rows,
    total: Number(
      countRows[0]?.total || 0
    ),
  };
};

/*
|--------------------------------------------------------------------------
| Supplier queries
|--------------------------------------------------------------------------
*/

const getActiveSupplierForUpdate = async (
  supplierId,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        name

      FROM suppliers

      WHERE id = ?
        AND is_active = 1

      LIMIT 1
      FOR UPDATE
    `,
    [supplierId]
  );

  return rows[0] || null;
};

const findDuplicateSupplierInvoice = async (
  supplierId,
  invoiceNumber,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT id

      FROM purchases

      WHERE supplier_id = ?
        AND LOWER(invoice_number) = LOWER(?)

      LIMIT 1
    `,
    [
      supplierId,
      invoiceNumber,
    ]
  );

  return rows[0] || null;
};

/*
|--------------------------------------------------------------------------
| Medicine query
|--------------------------------------------------------------------------
*/

const getActiveMedicine = async (
  medicineId,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        gst_percent AS gstPercent

      FROM medicines

      WHERE id = ?
        AND is_active = 1

      LIMIT 1
    `,
    [medicineId]
  );

  return rows[0] || null;
};

/*
|--------------------------------------------------------------------------
| Insert purchase
|--------------------------------------------------------------------------
*/

const insertPurchase = async (
  purchase,
  connection
) => {
  const [result] = await connection.query(
    `
      INSERT INTO purchases (
        purchase_number,
        supplier_id,
        invoice_number,
        invoice_date,
        purchase_date,
        subtotal,
        discount_amount,
        taxable_amount,
        tax_amount,
        round_off,
        grand_total,
        paid_amount,
        due_amount,
        payment_status,
        payment_method,
        status,
        notes,
        created_by
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, 'COMPLETED', ?, ?
      )
    `,
    [
      purchase.purchaseNumber,
      purchase.supplierId,
      purchase.invoiceNumber,
      purchase.invoiceDate,
      purchase.purchaseDate,
      purchase.subtotal,
      purchase.discountAmount,
      purchase.taxableAmount,
      purchase.taxAmount,
      purchase.roundOff,
      purchase.grandTotal,
      purchase.paidAmount,
      purchase.dueAmount,
      purchase.paymentStatus,
      purchase.paymentMethod,
      purchase.notes,
      purchase.createdBy,
    ]
  );

  return result.insertId;
};

/*
|--------------------------------------------------------------------------
| Insert purchase payment
|--------------------------------------------------------------------------
*/

const insertPurchasePayment = async (
  payment,
  connection
) => {
  const [result] = await connection.query(
    `
      INSERT INTO purchase_payments (
        purchase_id,
        amount,
        payment_method,
        transaction_reference,
        payment_notes,
        paid_by,
        payment_date
      )
      VALUES (
        ?, ?, ?, ?, ?, ?,
        COALESCE(?, NOW())
      )
    `,
    [
      payment.purchaseId,
      payment.amount,
      payment.paymentMethod,
      payment.transactionReference || null,
      payment.paymentNotes || null,
      payment.paidBy,
      payment.paymentDate || null,
    ]
  );

  return result.insertId;
};

/*
|--------------------------------------------------------------------------
| Batch queries
|--------------------------------------------------------------------------
*/

const getBatchForUpdate = async (
  medicineId,
  batchNumber,
  connection
) => {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        supplier_id AS supplierId,

        DATE_FORMAT(
          expiry_date,
          '%Y-%m-%d'
        ) AS expiryDate,

        quantity_available AS quantityAvailable

      FROM medicine_batches

      WHERE medicine_id = ?
        AND LOWER(batch_number) = LOWER(?)

      LIMIT 1
      FOR UPDATE
    `,
    [
      medicineId,
      batchNumber,
    ]
  );

  return rows[0] || null;
};

const updateMedicineBatch = async (
  batchId,
  batch,
  connection
) => {
  await connection.query(
    `
      UPDATE medicine_batches

      SET
        supplier_id =
          COALESCE(supplier_id, ?),

        manufacture_date =
          COALESCE(manufacture_date, ?),

        expiry_date = ?,
        purchase_price = ?,
        mrp = ?,
        selling_price = ?,

        quantity_received =
          quantity_received + ?,

        free_quantity =
          free_quantity + ?,

        quantity_available = ?,
        purchase_reference = ?,

        location =
          COALESCE(?, location),

        internal_qr_code =
          COALESCE(
            internal_qr_code,
            CONCAT(
              'PHARMAERP-BATCH-',
              id,
              '-',
              batch_number
            )
          ),

        is_active = 1

      WHERE id = ?
    `,
    [
      batch.supplierId,
      batch.manufactureDate,
      batch.expiryDate,
      batch.purchasePrice,
      batch.mrp,
      batch.sellingPrice,
      batch.quantity,
      batch.freeQuantity,
      batch.balanceAfter,
      batch.purchaseNumber,
      batch.location,
      batchId,
    ]
  );
};

const insertMedicineBatch = async (
  batch,
  connection
) => {
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
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
    [
      batch.medicineId,
      batch.supplierId,
      batch.batchNumber,
      batch.manufactureDate,
      batch.expiryDate,
      batch.purchasePrice,
      batch.mrp,
      batch.sellingPrice,
      batch.quantity,
      batch.freeQuantity,
      batch.quantityAvailable,
      batch.purchaseNumber,
      batch.location,
      batch.createdBy,
    ]
  );

  const normalizedBatchNumber = String(
    batch.batchNumber
  )
    .trim()
    .toUpperCase();

  const internalQrCode =
    `PHARMAERP-BATCH-${result.insertId}-${normalizedBatchNumber}`;

  await connection.query(
    `
      UPDATE medicine_batches
      SET internal_qr_code = ?
      WHERE id = ?
    `,
    [internalQrCode, result.insertId]
  );

  return result.insertId;
};

/*
|--------------------------------------------------------------------------
| Insert purchase item
|--------------------------------------------------------------------------
*/

const insertPurchaseItem = async (
  item,
  connection
) => {
  const [result] = await connection.query(
    `
      INSERT INTO purchase_items (
        purchase_id,
        medicine_id,
        batch_id,
        batch_number,
        manufacture_date,
        expiry_date,
        quantity,
        free_quantity,
        purchase_price,
        mrp,
        selling_price,
        discount_percent,
        discount_amount,
        gst_percent,
        taxable_amount,
        tax_amount,
        line_total
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `,
    [
      item.purchaseId,
      item.medicineId,
      item.batchId,
      item.batchNumber,
      item.manufactureDate,
      item.expiryDate,
      item.quantity,
      item.freeQuantity,
      item.purchasePrice,
      item.mrp,
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

const insertStockMovement = async (
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
        ?, ?, 'PURCHASE', ?, ?,
        'PURCHASE', ?, ?, ?
      )
    `,
    [
      movement.medicineId,
      movement.batchId,
      movement.quantity,
      movement.balanceAfter,
      movement.purchaseId,
      movement.notes,
      movement.createdBy,
    ]
  );

  return result.insertId;
};

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  runInTransaction,

  getPurchaseHeader,
  getPurchaseItems,
  getPurchases,

  getActiveSupplierForUpdate,
  findDuplicateSupplierInvoice,
  getActiveMedicine,

  insertPurchase,
  insertPurchasePayment,

  getBatchForUpdate,
  updateMedicineBatch,
  insertMedicineBatch,

  insertPurchaseItem,
  insertStockMovement,
};