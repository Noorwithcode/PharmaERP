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

const roundMoney = (value) => {
  return Number(
    (Number(value) || 0).toFixed(2)
  );
};

const generateInvoiceNumber = () => {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const randomPart = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `SAL-${datePart}-${randomPart}`;
};

const validSaleStatuses = [
  "COMPLETED",
  "CANCELLED",
  "PARTIALLY_RETURNED",
  "RETURNED",
];

const validPaymentStatuses = [
  "UNPAID",
  "PARTIAL",
  "PAID",
];

const validPaymentMethods = [
  "CASH",
  "CARD",
  "UPI",
  "BANK",
  "CHEQUE",
  "CREDIT",
  "OTHER",
];

/**
 * Create sale with:
 * - Transaction
 * - Batch row locking
 * - Stock deduction
 * - Sale items
 * - Stock movement
 * - Payment records
 * - Customer balance update
 */
const createSale = async (
  saleData,
  userId
) => {
  const {
    customerId = null,
    saleType = "RETAIL",
    discountAmount = 0,
    notes = null,
    doctorName = null,
    prescriptionNumber = null,
    prescriptionDate = null,
    prescriptionNotes = null,
    items,
    payments = [],
  } = saleData;

  const createdBy = Number(userId);

  if (
    !Number.isInteger(createdBy) ||
    createdBy <= 0
  ) {
    throw createError(
      "Valid user ID is required.",
      401
    );
  }

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw createError(
      "Sale must contain at least one item."
    );
  }

  const normalizedSaleType = String(
    saleType || "RETAIL"
  )
    .trim()
    .toUpperCase();

  if (
    !["RETAIL", "WHOLESALE"].includes(
      normalizedSaleType
    )
  ) {
    throw createError(
      "Invalid sale type."
    );
  }

  const normalizedItems = [];
  const usedBatchIds = new Set();

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item = items[index];

    const medicineId = Number(
      item.medicineId ??
      item.medicine_id
    );

    const batchId = Number(
      item.batchId ??
      item.batch_id
    );

    const quantity = Number(
      item.quantity
    );

    if (
      !Number.isInteger(medicineId) ||
      medicineId <= 0
    ) {
      throw createError(
        `Valid medicineId is required for item ${index + 1}.`
      );
    }

    if (
      !Number.isInteger(batchId) ||
      batchId <= 0
    ) {
      throw createError(
        `Valid batchId is required for item ${index + 1}.`
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw createError(
        `Quantity for item ${index + 1} must be a positive integer.`
      );
    }

    if (usedBatchIds.has(batchId)) {
      throw createError(
        `Batch ID ${batchId} appears more than once.`
      );
    }

    usedBatchIds.add(batchId);

    normalizedItems.push({
      medicineId,
      batchId,
      quantity,

      discountAmount: Math.max(
        roundMoney(
          item.discountAmount ??
          item.discount_amount ??
          0
        ),
        0
      ),
    });
  }

  // Consistent locking order reduces deadlock risk.
  normalizedItems.sort(
    (first, second) =>
      first.batchId - second.batchId
  );

  const normalizedPayments =
    payments
      .map((payment, index) => {
        const amount = roundMoney(
          payment.amount
        );

        const paymentMethod = String(
          payment.paymentMethod ||
          payment.payment_method ||
          ""
        )
          .trim()
          .toUpperCase();

        if (amount <= 0) {
          return null;
        }

        if (
          !validPaymentMethods.includes(
            paymentMethod
          )
        ) {
          throw createError(
            `Invalid payment method for payment ${index + 1}.`
          );
        }

        return {
          amount,
          paymentMethod,

          transactionReference:
            payment.referenceNumber ||
            payment.transactionReference ||
            payment.transaction_reference ||
            null,

          paymentNotes:
            payment.paymentNotes ||
            payment.payment_notes ||
            null,
        };
      })
      .filter(Boolean);

  const connection =
    await db.getConnection();

  try {
    await connection.beginTransaction();

    let customer = null;

    if (customerId) {
      const validCustomerId =
        Number(customerId);

      if (
        !Number.isInteger(
          validCustomerId
        ) ||
        validCustomerId <= 0
      ) {
        throw createError(
          "Invalid customer ID."
        );
      }

      const [customerRows] =
        await connection.query(
          `
            SELECT
              id,
              full_name,
              phone,
              address,
              is_active
            FROM customers
            WHERE id = ?
            FOR UPDATE
          `,
          [validCustomerId]
        );

      if (customerRows.length === 0) {
        throw createError(
          "Customer not found.",
          404
        );
      }

      customer = customerRows[0];

      if (!customer.is_active) {
        throw createError(
          "Selected customer is inactive."
        );
      }
    }

    const processedItems = [];

    let subtotal = 0;
    let itemDiscountTotal = 0;
    let taxableAmount = 0;
    let taxAmount = 0;
    let totalQuantity = 0;

    for (
      const item of normalizedItems
    ) {
      const [batchRows] =
        await connection.query(
          `
            SELECT
              medicine_batches.id,
              medicine_batches.medicine_id,
              medicine_batches.batch_number,
              medicine_batches.expiry_date,
              medicine_batches.purchase_price,
              medicine_batches.mrp,
              medicine_batches.selling_price,
              medicine_batches.quantity_available,
              medicine_batches.is_active,

              medicines.brand_name,
              medicines.generic_name,
              medicines.gst_percent,
              medicines.is_active
                AS medicine_is_active

            FROM medicine_batches

            INNER JOIN medicines
              ON medicines.id =
                medicine_batches.medicine_id

            WHERE medicine_batches.id = ?

            FOR UPDATE
          `,
          [item.batchId]
        );

      if (batchRows.length === 0) {
        throw createError(
          `Batch ID ${item.batchId} not found.`,
          404
        );
      }

      const batch = batchRows[0];

      if (
        Number(batch.medicine_id) !==
        item.medicineId
      ) {
        throw createError(
          `Batch ${batch.batch_number} does not belong to Medicine ID ${item.medicineId}.`
        );
      }

      if (
        !batch.is_active ||
        !batch.medicine_is_active
      ) {
        throw createError(
          `Medicine or Batch ${batch.batch_number} is inactive.`
        );
      }

      const expiryDate =
        new Date(batch.expiry_date);

      if (
        Number.isNaN(
          expiryDate.getTime()
        ) ||
        expiryDate <
          new Date(
            new Date()
              .toISOString()
              .slice(0, 10)
          )
      ) {
        throw createError(
          `Batch ${batch.batch_number} is expired.`
        );
      }

      const previousStock = Number(
        batch.quantity_available
      );

      if (
        previousStock <
        item.quantity
      ) {
        throw createError(
          `Insufficient stock for Batch ${batch.batch_number}. Available: ${previousStock}, requested: ${item.quantity}.`,
          409
        );
      }

      // Database values are authoritative.
      const sellingPrice = roundMoney(
        batch.selling_price
      );

      const purchasePrice = roundMoney(
        batch.purchase_price
      );

      const mrp = roundMoney(
        batch.mrp
      );

      const gstPercent = roundMoney(
        batch.gst_percent
      );

      const grossAmount = roundMoney(
        sellingPrice *
        item.quantity
      );

      if (
        item.discountAmount >
        grossAmount
      ) {
        throw createError(
          `Discount cannot exceed item value for Batch ${batch.batch_number}.`
        );
      }

      const lineTaxableAmount =
        roundMoney(
          grossAmount -
          item.discountAmount
        );

      const lineTaxAmount =
        roundMoney(
          lineTaxableAmount *
          (gstPercent / 100)
        );

      const lineTotal = roundMoney(
        lineTaxableAmount +
        lineTaxAmount
      );

      const balanceAfter =
        previousStock -
        item.quantity;

      processedItems.push({
        ...item,
        batchNumber:
          batch.batch_number,

        expiryDate:
          batch.expiry_date,

        brandName:
          batch.brand_name,

        genericName:
          batch.generic_name,

        purchasePrice,
        mrp,
        sellingPrice,
        gstPercent,
        grossAmount,
        taxableAmount:
          lineTaxableAmount,
        taxAmount:
          lineTaxAmount,
        lineTotal,
        previousStock,
        balanceAfter,
      });

      subtotal = roundMoney(
        subtotal + grossAmount
      );

      itemDiscountTotal =
        roundMoney(
          itemDiscountTotal +
          item.discountAmount
        );

      taxableAmount = roundMoney(
        taxableAmount +
        lineTaxableAmount
      );

      taxAmount = roundMoney(
        taxAmount +
        lineTaxAmount
      );

      totalQuantity += item.quantity;
    }

    const headerDiscount =
      Math.max(
        roundMoney(discountAmount),
        0
      );

    const totalBeforeDiscount =
      roundMoney(
        taxableAmount +
        taxAmount
      );

    if (
      headerDiscount >
      totalBeforeDiscount
    ) {
      throw createError(
        "Sale discount cannot exceed sale total."
      );
    }

    const totalDiscount =
      roundMoney(
        itemDiscountTotal +
        headerDiscount
      );

    const grandTotal = roundMoney(
      totalBeforeDiscount -
      headerDiscount
    );

    if (grandTotal <= 0) {
      throw createError(
        "Grand total must be greater than zero."
      );
    }

    const paidAmount = roundMoney(
      normalizedPayments.reduce(
        (total, payment) =>
          total + payment.amount,
        0
      )
    );

    if (
      paidAmount >
      grandTotal + 0.01
    ) {
      throw createError(
        "Paid amount cannot exceed grand total."
      );
    }

    const dueAmount = roundMoney(
      Math.max(
        grandTotal - paidAmount,
        0
      )
    );

    if (
      dueAmount > 0 &&
      !customer
    ) {
      throw createError(
        "Customer is required for a due sale."
      );
    }

    let paymentStatus =
      "UNPAID";

    if (
      paidAmount >=
      grandTotal - 0.01
    ) {
      paymentStatus = "PAID";
    } else if (paidAmount > 0) {
      paymentStatus = "PARTIAL";
    }

    const invoiceNumber =
      generateInvoiceNumber();

    const [saleResult] =
      await connection.query(
        `
          INSERT INTO sales (
            invoice_number,
            customer_id,
            customer_name,
            customer_phone,
            customer_address,
            sale_date,
            sale_type,
            total_quantity,
            subtotal,
            discount_amount,
            taxable_amount,
            tax_amount,
            round_off,
            grand_total,
            paid_amount,
            due_amount,
            payment_status,
            status,
            doctor_name,
            prescription_number,
            prescription_date,
            prescription_notes,
            notes,
            created_by
          )
          VALUES (
            ?, ?, ?, ?, ?,
            NOW(), ?, ?, ?, ?,
            ?, ?, 0.00, ?, ?,
            ?, ?, 'COMPLETED', ?,
            ?, ?, ?, ?, ?
          )
        `,
        [
          invoiceNumber,

          customer
            ? customer.id
            : null,

          customer
            ? customer.full_name
            : null,

          customer
            ? customer.phone
            : null,

          customer
            ? customer.address
            : null,

          normalizedSaleType,
          totalQuantity,
          subtotal,
          totalDiscount,
          taxableAmount,
          taxAmount,
          grandTotal,
          paidAmount,
          dueAmount,
          paymentStatus,

          doctorName || null,

          prescriptionNumber ||
            null,

          prescriptionDate ||
            null,

          prescriptionNotes ||
            null,

          notes || null,
          createdBy,
        ]
      );

    const saleId =
      saleResult.insertId;

    for (
      const item of processedItems
    ) {
      await connection.query(
        `
          INSERT INTO sale_items (
            sale_id,
            medicine_id,
            batch_id,
            medicine_name,
            generic_name,
            batch_number,
            expiry_date,
            quantity,
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
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, 0.00, ?,
            ?, ?, ?, ?
          )
        `,
        [
          saleId,
          item.medicineId,
          item.batchId,
          item.brandName,
          item.genericName,
          item.batchNumber,
          item.expiryDate,
          item.quantity,
          item.purchasePrice,
          item.mrp,
          item.sellingPrice,
          item.discountAmount,
          item.gstPercent,
          item.taxableAmount,
          item.taxAmount,
          item.lineTotal,
        ]
      );

      const [updateResult] =
        await connection.query(
          `
            UPDATE medicine_batches

            SET quantity_available =
              quantity_available - ?

            WHERE id = ?
              AND quantity_available >= ?
          `,
          [
            item.quantity,
            item.batchId,
            item.quantity,
          ]
        );

      if (
        updateResult.affectedRows !== 1
      ) {
        throw createError(
          `Concurrent stock update detected for Batch ${item.batchNumber}.`,
          409
        );
      }

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
          VALUES (
            ?, ?, 'SALE', ?, ?, 'SALE',
            ?, ?, ?
          )
        `,
        [
          item.medicineId,
          item.batchId,
          item.quantity,
          item.balanceAfter,
          saleId,
          `Stock sold through invoice ${invoiceNumber}`,
          createdBy,
        ]
      );
    }

    for (
      const payment of
      normalizedPayments
    ) {
      await connection.query(
        `
          INSERT INTO sale_payments (
            sale_id,
            amount,
            payment_method,
            transaction_reference,
            payment_notes,
            received_by,
            payment_date
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, NOW()
          )
        `,
        [
          saleId,
          payment.amount,
          payment.paymentMethod,

          payment
            .transactionReference,

          payment.paymentNotes,
          createdBy,
        ]
      );
    }

    if (customer) {
      await connection.query(
        `
          UPDATE customers

          SET
            total_purchases =
              total_purchases + ?,

            outstanding_balance =
              outstanding_balance + ?

          WHERE id = ?
        `,
        [
          grandTotal,
          dueAmount,
          customer.id,
        ]
      );
    }

    await connection.commit();

    return {
      saleId,
      invoiceNumber,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentStatus,

      message:
        "Sale completed and stock updated successfully.",
    };
  } catch (error) {
    await connection.rollback();

    if (
      error.code ===
      "ER_DUP_ENTRY"
    ) {
      throw createError(
        "Duplicate invoice or sale item detected.",
        409
      );
    }

    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get paginated sales history.
 */
const getSales = async (
  filters = {}
) => {
  const page = Math.max(
    Number(filters.page) || 1,
    1
  );

  const limit = Math.min(
    Math.max(
      Number(filters.limit) || 10,
      1
    ),
    100
  );

  const offset =
    (page - 1) * limit;

  const conditions = [];
  const values = [];

  if (filters.search?.trim()) {
    const searchValue =
      `%${filters.search.trim()}%`;

    conditions.push(`
      (
        sales.invoice_number LIKE ?
        OR sales.customer_name LIKE ?
        OR sales.customer_phone LIKE ?
      )
    `);

    values.push(
      searchValue,
      searchValue,
      searchValue
    );
  }

  if (filters.status) {
    const status = String(
      filters.status
    ).toUpperCase();

    if (
      !validSaleStatuses.includes(
        status
      )
    ) {
      throw createError(
        "Invalid sale status."
      );
    }

    conditions.push(
      "sales.status = ?"
    );

    values.push(status);
  }

  if (filters.paymentStatus) {
    const paymentStatus = String(
      filters.paymentStatus
    ).toUpperCase();

    if (
      !validPaymentStatuses.includes(
        paymentStatus
      )
    ) {
      throw createError(
        "Invalid payment status."
      );
    }

    conditions.push(
      "sales.payment_status = ?"
    );

    values.push(paymentStatus);
  }

  if (filters.startDate) {
    conditions.push(
      "DATE(sales.sale_date) >= ?"
    );

    values.push(
      filters.startDate
    );
  }

  if (filters.endDate) {
    conditions.push(
      "DATE(sales.sale_date) <= ?"
    );

    values.push(
      filters.endDate
    );
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";

  const [countRows] =
    await db.query(
      `
        SELECT COUNT(*) AS total
        FROM sales
        ${whereClause}
      `,
      values
    );

  const total = Number(
    countRows[0].total
  );

  const [sales] = await db.query(
    `
      SELECT
        sales.id,

        sales.invoice_number
          AS invoiceNumber,

        sales.customer_id
          AS customerId,

        COALESCE(
          sales.customer_name,
          'Walk-in Customer'
        ) AS customerName,

        sales.customer_phone
          AS customerPhone,

        sales.sale_date
          AS saleDate,

        sales.sale_type
          AS saleType,

        sales.total_quantity
          AS totalQuantity,

        sales.subtotal,
        
        sales.discount_amount
          AS discountAmount,

        sales.taxable_amount
          AS taxableAmount,

        sales.tax_amount
          AS taxAmount,

        sales.round_off
          AS roundOff,

        sales.grand_total
          AS grandTotal,

        sales.paid_amount
          AS paidAmount,

        sales.due_amount
          AS dueAmount,

        sales.payment_status
          AS paymentStatus,

        sales.status,

        sales.created_at
          AS createdAt

      FROM sales

      ${whereClause}

      ORDER BY
        sales.sale_date DESC,
        sales.id DESC

      LIMIT ${limit}
      OFFSET ${offset}
    `,
    values
  );

  return {
    sales,

    pagination: {
      page,
      limit,
      total,
      totalItems: total,

      totalPages: Math.max(
        Math.ceil(total / limit),
        1
      ),
    },
  };
};

/**
 * Get sale header/details.
 */
const getSaleById = async (
  saleId
) => {
  const [rows] = await db.query(
    `
      SELECT
        sales.id,

        sales.invoice_number
          AS invoiceNumber,

        sales.customer_id
          AS customerId,

        COALESCE(
          sales.customer_name,
          'Walk-in Customer'
        ) AS customerName,

        sales.customer_phone
          AS customerPhone,

        sales.customer_address
          AS customerAddress,

        sales.sale_date
          AS saleDate,

        sales.sale_type
          AS saleType,

        sales.total_quantity
          AS totalQuantity,

        sales.subtotal,

        sales.discount_amount
          AS discountAmount,

        sales.taxable_amount
          AS taxableAmount,

        sales.tax_amount
          AS taxAmount,

        sales.round_off
          AS roundOff,

        sales.grand_total
          AS grandTotal,

        sales.paid_amount
          AS paidAmount,

        sales.due_amount
          AS dueAmount,

        sales.payment_status
          AS paymentStatus,

        sales.status,

        sales.doctor_name
          AS doctorName,

        sales.prescription_number
          AS prescriptionNumber,

        sales.prescription_date
          AS prescriptionDate,

        sales.prescription_notes
          AS prescriptionNotes,

        sales.notes,

        sales.created_by
          AS createdBy,

        sales.created_at
          AS createdAt,

        sales.updated_at
          AS updatedAt

      FROM sales

      WHERE sales.id = ?

      LIMIT 1
    `,
    [saleId]
  );

  return rows[0] || null;
};

/**
 * Get sale items.
 */
const getSaleItems = async (
  saleId
) => {
  const sale =
    await getSaleById(saleId);

  if (!sale) {
    throw createError(
      "Sale not found.",
      404
    );
  }

  const [items] = await db.query(
    `
      SELECT
        sale_items.id,

        sale_items.sale_id
          AS saleId,

        sale_items.medicine_id
          AS medicineId,

        sale_items.batch_id
          AS batchId,

        sale_items.medicine_name
          AS medicineName,

        sale_items.generic_name
          AS genericName,

        sale_items.batch_number
          AS batchNumber,

        sale_items.expiry_date
          AS expiryDate,

        sale_items.quantity,

        sale_items.returned_quantity
          AS returnedQuantity,

        sale_items.purchase_price
          AS purchasePrice,

        sale_items.mrp,

        sale_items.selling_price
          AS sellingPrice,

        sale_items.discount_percent
          AS discountPercent,

        sale_items.discount_amount
          AS discountAmount,

        sale_items.gst_percent
          AS gstPercent,

        sale_items.taxable_amount
          AS taxableAmount,

        sale_items.tax_amount
          AS taxAmount,

        sale_items.line_total
          AS lineTotal,

        sale_items.created_at
          AS createdAt

      FROM sale_items

      WHERE sale_items.sale_id = ?

      ORDER BY sale_items.id ASC
    `,
    [saleId]
  );

  return items;
};

module.exports = {
  createSale,
  getSales,
  getSaleById,
  getSaleItems,
};