const db = require("../config/db");

const createApiError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const roundMoney = (value) => {
  return Number(Number(value).toFixed(2));
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

const parsePositiveMoney = (value) => {
  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return roundMoney(parsedValue);
};

const parseDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return value;
};

const parseDateTime = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const validDate = parseDate(value);

    return validDate
      ? `${validDate} 00:00:00`
      : null;
  }

  if (
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
      value
    )
  ) {
    const [datePart, timePart] =
      value.split(" ");

    if (!parseDate(datePart)) {
      return null;
    }

    const [hours, minutes, seconds] =
      timePart.split(":").map(Number);

    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      return null;
    }

    return value;
  }

  return null;
};

const optionalText = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const normalizedValue =
    String(value).trim();

  return normalizedValue || null;
};

const getPurchaseRecord = async (
  purchaseId,
  connection = db
) => {
  const [purchases] = await connection.query(
    `
      SELECT
        purchases.id,

        purchases.purchase_number
          AS purchaseNumber,

        purchases.invoice_number
          AS invoiceNumber,

        purchases.supplier_id
          AS supplierId,

        suppliers.name AS supplierName,
        suppliers.phone AS supplierPhone,

        DATE_FORMAT(
          purchases.purchase_date,
          '%Y-%m-%d'
        ) AS purchaseDate,

        purchases.subtotal,

        purchases.discount_amount
          AS discountAmount,

        purchases.taxable_amount
          AS taxableAmount,

        purchases.tax_amount
          AS taxAmount,

        purchases.round_off
          AS roundOff,

        purchases.grand_total
          AS grandTotal,

        purchases.paid_amount
          AS paidAmount,

        purchases.due_amount
          AS dueAmount,

        purchases.payment_status
          AS paymentStatus,

        purchases.status,

        purchases.created_at
          AS createdAt,

        purchases.updated_at
          AS updatedAt,

        users.full_name AS createdBy

      FROM purchases

      INNER JOIN suppliers
        ON suppliers.id =
          purchases.supplier_id

      LEFT JOIN users
        ON users.id =
          purchases.created_by

      WHERE purchases.id = ?

      LIMIT 1
    `,
    [purchaseId]
  );

  return purchases[0] || null;
};

const getPurchasePaymentRecords = async (
  purchaseId,
  connection = db
) => {
  const [payments] = await connection.query(
    `
      SELECT
        purchase_payments.id,

        purchase_payments.purchase_id
          AS purchaseId,

        purchase_payments.amount,

        purchase_payments.payment_method
          AS paymentMethod,

        purchase_payments.transaction_reference
          AS transactionReference,

        purchase_payments.payment_notes
          AS paymentNotes,

        DATE_FORMAT(
          purchase_payments.payment_date,
          '%Y-%m-%d %H:%i:%s'
        ) AS paymentDate,

        purchase_payments.created_at
          AS createdAt,

        users.full_name AS paidBy

      FROM purchase_payments

      LEFT JOIN users
        ON users.id =
          purchase_payments.paid_by

      WHERE purchase_payments.purchase_id = ?

      ORDER BY
        purchase_payments.payment_date ASC,
        purchase_payments.id ASC
    `,
    [purchaseId]
  );

  return payments;
};

// ======================================================
// POST /api/purchases/:id/payments
// ======================================================

const addPurchasePayment = async (
  req,
  res
) => {
  let connection;
  let transactionStarted = false;

  try {
    const purchaseId = parsePositiveId(
      req.params.id
    );

    if (!purchaseId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid purchase ID is required",
      });
    }

    const {
      amount,
      paymentMethod,
      transactionReference,
      paymentNotes,
      paymentDate,
    } = req.body;

    const parsedAmount =
      parsePositiveMoney(amount);

    if (parsedAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than zero",
      });
    }

    if (
      typeof paymentMethod !== "string" ||
      !paymentMethod.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    const normalizedPaymentMethod =
      paymentMethod.trim().toUpperCase();

    const allowedPaymentMethods = [
      "CASH",
      "CARD",
      "UPI",
      "BANK",
      "CHEQUE",
      "CREDIT_NOTE",
      "OTHER",
    ];

    if (
      !allowedPaymentMethods.includes(
        normalizedPaymentMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const parsedPaymentDate =
      parseDateTime(paymentDate);

    if (parsedPaymentDate === null) {
      return res.status(400).json({
        success: false,
        message:
          "Payment date must use YYYY-MM-DD or YYYY-MM-DD HH:mm:ss format",
      });
    }

    connection = await db.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    const [purchaseRows] =
      await connection.query(
        `
          SELECT
            id,

            purchase_number
              AS purchaseNumber,

            supplier_id
              AS supplierId,

            grand_total
              AS grandTotal,

            paid_amount
              AS paidAmount,

            due_amount
              AS dueAmount,

            payment_status
              AS paymentStatus,

            status

          FROM purchases

          WHERE id = ?

          LIMIT 1
          FOR UPDATE
        `,
        [purchaseId]
      );

    if (purchaseRows.length === 0) {
      throw createApiError(
        404,
        "Purchase invoice was not found"
      );
    }

    const existingPurchase =
      purchaseRows[0];

    if (
      existingPurchase.status === "CANCELLED"
    ) {
      throw createApiError(
        409,
        "Payment cannot be added to a cancelled purchase"
      );
    }

    if (
      existingPurchase.status === "RETURNED"
    ) {
      throw createApiError(
        409,
        "Payment cannot be added to a fully returned purchase"
      );
    }

    const currentDueAmount = roundMoney(
      existingPurchase.dueAmount
    );

    const currentPaidAmount = roundMoney(
      existingPurchase.paidAmount
    );

    if (currentDueAmount <= 0) {
      throw createApiError(
        409,
        "This purchase invoice is already fully paid"
      );
    }

    if (
      parsedAmount >
      currentDueAmount + 0.001
    ) {
      throw createApiError(
        400,
        `Payment amount cannot exceed current due amount ${currentDueAmount.toFixed(
          2
        )}`
      );
    }

    const updatedPaidAmount = roundMoney(
      currentPaidAmount + parsedAmount
    );

    const updatedDueAmount = roundMoney(
      currentDueAmount - parsedAmount
    );

    const normalizedDueAmount =
      Math.abs(updatedDueAmount) < 0.01
        ? 0
        : updatedDueAmount;

    const updatedPaymentStatus =
      normalizedDueAmount === 0
        ? "PAID"
        : "PARTIAL";

    await connection.query(
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
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          COALESCE(?, NOW())
        )
      `,
      [
        purchaseId,
        parsedAmount,
        normalizedPaymentMethod,
        optionalText(transactionReference),
        optionalText(paymentNotes),
        req.user.userId,
        parsedPaymentDate || null,
      ]
    );

    await connection.query(
      `
        UPDATE purchases

        SET
          paid_amount = ?,
          due_amount = ?,
          payment_status = ?

        WHERE id = ?
      `,
      [
        updatedPaidAmount,
        normalizedDueAmount,
        updatedPaymentStatus,
        purchaseId,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    const purchase =
      await getPurchaseRecord(purchaseId);

    const payments =
      await getPurchasePaymentRecords(
        purchaseId
      );

    return res.status(200).json({
      success: true,
      message:
        "Purchase payment added successfully",
      data: {
        purchase,
        payments,
      },
    });
  } catch (error) {
    if (
      connection &&
      transactionStarted
    ) {
      await connection.rollback();
    }

    console.error(
      "Add purchase payment error:",
      error
    );

    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json({
          success: false,
          message: error.message,
        });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to add purchase payment",
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ======================================================
// GET /api/purchases/:id/payments
// ======================================================

const getPurchasePayments = async (
  req,
  res
) => {
  try {
    const purchaseId = parsePositiveId(
      req.params.id
    );

    if (!purchaseId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid purchase ID is required",
      });
    }

    const purchase =
      await getPurchaseRecord(purchaseId);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message:
          "Purchase invoice was not found",
      });
    }

    const payments =
      await getPurchasePaymentRecords(
        purchaseId
      );

    const paymentTotal = roundMoney(
      payments.reduce(
        (total, payment) =>
          total + Number(payment.amount),
        0
      )
    );

    return res.status(200).json({
      success: true,
      data: {
        purchase: {
          id: purchase.id,

          purchaseNumber:
            purchase.purchaseNumber,

          invoiceNumber:
            purchase.invoiceNumber,

          supplierId:
            purchase.supplierId,

          supplierName:
            purchase.supplierName,

          grandTotal:
            purchase.grandTotal,

          paidAmount:
            purchase.paidAmount,

          dueAmount:
            purchase.dueAmount,

          paymentStatus:
            purchase.paymentStatus,

          status:
            purchase.status,
        },

        paymentSummary: {
          count: payments.length,
          paymentTotal:
            paymentTotal.toFixed(2),
        },

        payments,
      },
    });
  } catch (error) {
    console.error(
      "Get purchase payments error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve purchase payments",
      error: error.message,
    });
  }
};

module.exports = {
  addPurchasePayment,
  getPurchasePayments,
};
