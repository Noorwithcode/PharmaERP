const db = require("../config/db");

const getPurchaseReport = async (
  startDate,
  endDate
) => {
  const [rows] = await db.query(
    `
      SELECT
        p.id,
        p.purchase_number AS purchaseNumber,
        p.invoice_number AS invoiceNumber,
        p.invoice_date AS invoiceDate,
        p.purchase_date AS purchaseDate,

        s.id AS supplierId,
        s.name AS supplierName,

        p.subtotal,
        p.discount_amount AS discountAmount,
        p.taxable_amount AS taxableAmount,
        p.tax_amount AS taxAmount,
        p.round_off AS roundOff,
        p.grand_total AS grandTotal,

        p.paid_amount AS paidAmount,
        p.due_amount AS dueAmount,
        p.payment_status AS paymentStatus,
        p.payment_method AS paymentMethod,
        p.status,
        p.notes,
        p.created_at AS createdAt

      FROM purchases p

      INNER JOIN suppliers s
        ON s.id = p.supplier_id

      WHERE p.purchase_date
        BETWEEN ? AND ?

      ORDER BY
        p.purchase_date DESC,
        p.id DESC
    `,
    [startDate, endDate]
  );

  return rows;
};

const getSalesReport = async (
  startDate,
  endDate
) => {
  const [rows] = await db.query(
    `
      SELECT
        s.id,
        s.invoice_number AS invoiceNumber,

        s.customer_id AS customerId,

        COALESCE(
          s.customer_name,
          c.full_name,
          'Walk-in Customer'
        ) AS customerName,

        COALESCE(
          s.customer_phone,
          c.phone
        ) AS customerPhone,

        s.sale_date AS saleDate,
        s.sale_type AS saleType,
        s.total_quantity AS totalQuantity,

        s.subtotal,
        s.discount_amount AS discountAmount,
        s.taxable_amount AS taxableAmount,
        s.tax_amount AS taxAmount,
        s.round_off AS roundOff,
        s.grand_total AS grandTotal,

        s.paid_amount AS paidAmount,
        s.due_amount AS dueAmount,
        s.payment_status AS paymentStatus,
        s.status,
        s.created_at AS createdAt

      FROM sales s

      LEFT JOIN customers c
        ON c.id = s.customer_id

      WHERE DATE(s.sale_date)
        BETWEEN ? AND ?

      ORDER BY
        s.sale_date DESC,
        s.id DESC
    `,
    [startDate, endDate]
  );

  return rows;
};

const getExpiryReport = async (
  days
) => {
  const [rows] = await db.query(
    `
      SELECT
        mb.id AS batchId,
        mb.batch_number AS batchNumber,
        mb.manufacture_date AS manufactureDate,
        mb.expiry_date AS expiryDate,
        mb.quantity_available
          AS quantityAvailable,

        mb.purchase_price AS purchasePrice,
        mb.mrp,
        mb.selling_price AS sellingPrice,
        mb.location,

        m.id AS medicineId,
        m.sku,
        m.brand_name AS brandName,
        m.generic_name AS genericName,
        m.strength,
        m.unit,

        DATEDIFF(
          mb.expiry_date,
          CURDATE()
        ) AS daysToExpire,

        CASE
          WHEN mb.expiry_date < CURDATE()
          THEN 'EXPIRED'
          ELSE 'EXPIRING_SOON'
        END AS expiryStatus

      FROM medicine_batches mb

      INNER JOIN medicines m
        ON m.id = mb.medicine_id

      WHERE mb.is_active = TRUE
        AND mb.quantity_available > 0

        AND mb.expiry_date <=
          DATE_ADD(
            CURDATE(),
            INTERVAL ? DAY
          )

      ORDER BY
        mb.expiry_date ASC,
        m.brand_name ASC
    `,
    [days]
  );

  return rows;
};

const getLowStockReport = async () => {
  const [rows] = await db.query(`
    SELECT
      m.id AS medicineId,
      m.sku,
      m.brand_name AS brandName,
      m.generic_name AS genericName,
      m.strength,
      m.unit,
      m.reorder_level AS reorderLevel,

      mc.name AS categoryName,

      COALESCE(
        SUM(
          CASE
            WHEN mb.is_active = TRUE
              AND mb.expiry_date >=
                  CURDATE()
            THEN mb.quantity_available
            ELSE 0
          END
        ),
        0
      ) AS availableStock

    FROM medicines m

    LEFT JOIN medicine_categories mc
      ON mc.id = m.category_id

    LEFT JOIN medicine_batches mb
      ON mb.medicine_id = m.id

    WHERE m.is_active = TRUE

    GROUP BY
      m.id,
      m.sku,
      m.brand_name,
      m.generic_name,
      m.strength,
      m.unit,
      m.reorder_level,
      mc.name

    HAVING availableStock <=
      m.reorder_level

    ORDER BY
      availableStock ASC,
      m.brand_name ASC
  `);

  return rows;
};

const getStockMovementReport = async (
  startDate,
  endDate,
  movementType
) => {
  const conditions = [
    "DATE(sm.created_at) BETWEEN ? AND ?"
  ];

  const parameters = [
    startDate,
    endDate
  ];

  if (movementType) {
    conditions.push(
      "sm.movement_type = ?"
    );

    parameters.push(movementType);
  }

  const [rows] = await db.query(
    `
      SELECT
        sm.id,
        sm.movement_type AS movementType,
        sm.quantity,
        sm.balance_after AS balanceAfter,

        sm.reference_type AS referenceType,
        sm.reference_id AS referenceId,
        sm.notes,

        sm.created_by AS createdBy,
        sm.created_at AS createdAt,

        m.id AS medicineId,
        m.sku,
        m.brand_name AS brandName,
        m.generic_name AS genericName,

        mb.id AS batchId,
        mb.batch_number AS batchNumber

      FROM stock_movements sm

      INNER JOIN medicines m
        ON m.id = sm.medicine_id

      INNER JOIN medicine_batches mb
        ON mb.id = sm.batch_id

      WHERE ${conditions.join(" AND ")}

      ORDER BY
        sm.created_at DESC,
        sm.id DESC
    `,
    parameters
  );

  return rows;
};

const getProfitLossReport = async (
  startDate,
  endDate
) => {
  const [salesRows] = await db.query(
    `
      SELECT
        COUNT(*) AS totalInvoices,

        COALESCE(
          SUM(grand_total),
          0
        ) AS totalSalesRevenue,

        COALESCE(
          SUM(taxable_amount),
          0
        ) AS taxableSales,

        COALESCE(
          SUM(discount_amount),
          0
        ) AS salesDiscount,

        COALESCE(
          SUM(tax_amount),
          0
        ) AS salesTax,

        COALESCE(
          SUM(paid_amount),
          0
        ) AS salesReceived,

        COALESCE(
          SUM(due_amount),
          0
        ) AS salesDue

      FROM sales

      WHERE DATE(sale_date)
        BETWEEN ? AND ?

        AND status IN (
          'COMPLETED',
          'PARTIALLY_RETURNED'
        )
    `,
    [startDate, endDate]
  );

  /*
   * Returned quantity বাদ দিয়ে
   * remaining sold stock-এর cost।
   */
  const [costRows] = await db.query(
    `
      SELECT
        COALESCE(
          SUM(
            (
              si.quantity -
              si.returned_quantity
            ) * si.purchase_price
          ),
          0
        ) AS costOfGoodsSold

      FROM sale_items si

      INNER JOIN sales s
        ON s.id = si.sale_id

      WHERE DATE(s.sale_date)
        BETWEEN ? AND ?

        AND s.status IN (
          'COMPLETED',
          'PARTIALLY_RETURNED'
        )
    `,
    [startDate, endDate]
  );

  const [purchaseRows] = await db.query(
    `
      SELECT
        COUNT(*) AS totalPurchaseBills,

        COALESCE(
          SUM(grand_total),
          0
        ) AS totalPurchases,

        COALESCE(
          SUM(paid_amount),
          0
        ) AS purchasePaid,

        COALESCE(
          SUM(due_amount),
          0
        ) AS purchaseDue

      FROM purchases

      WHERE purchase_date
        BETWEEN ? AND ?

        AND status IN (
          'COMPLETED',
          'PARTIALLY_RETURNED'
        )
    `,
    [startDate, endDate]
  );

  return {
    sales: salesRows[0],
    cost: costRows[0],
    purchases: purchaseRows[0]
  };
};

module.exports = {
  getPurchaseReport,
  getSalesReport,
  getExpiryReport,
  getLowStockReport,
  getStockMovementReport,
  getProfitLossReport
};