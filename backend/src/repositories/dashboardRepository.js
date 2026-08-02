const db = require("../config/db");

/**
 * Total active medicines.
 */
const getMedicineSummary = async () => {
  const [rows] = await db.query(`
    SELECT
      COUNT(*) AS totalMedicines,

      COALESCE(
        SUM(
          CASE
            WHEN prescription_required = TRUE
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS prescriptionMedicines
    FROM medicines
    WHERE is_active = TRUE
  `);

  return rows[0];
};

/**
 * Current stock এবং stock valuation.
 */
const getStockSummary = async () => {
  const [rows] = await db.query(`
    SELECT
      COALESCE(
        SUM(quantity_available),
        0
      ) AS totalStockQuantity,

      COALESCE(
        SUM(
          quantity_available *
          purchase_price
        ),
        0
      ) AS purchaseStockValue,

      COALESCE(
        SUM(
          quantity_available *
          selling_price
        ),
        0
      ) AS sellingStockValue,

      COUNT(
        CASE
          WHEN quantity_available > 0
          THEN 1
        END
      ) AS batchesWithStock
    FROM medicine_batches
    WHERE is_active = TRUE
  `);

  return rows[0];
};

/**
 * Today's valid sales summary.
 */
const getTodaySalesSummary = async () => {
  const [rows] = await db.query(`
    SELECT
      COUNT(*) AS totalBills,

      COALESCE(
        SUM(grand_total),
        0
      ) AS totalRevenue,

      COALESCE(
        SUM(paid_amount),
        0
      ) AS totalPaid,

      COALESCE(
        SUM(due_amount),
        0
      ) AS totalDue,

      COALESCE(
        SUM(total_quantity),
        0
      ) AS totalQuantity
    FROM sales
    WHERE DATE(sale_date) = CURDATE()
      AND status IN (
        'COMPLETED',
        'PARTIALLY_RETURNED'
      )
  `);

  return rows[0];
};

/**
 * Today's valid purchases summary.
 *
 * Partially returned purchase-এর
 * remaining amount dashboard-এ থাকবে।
 */
const getTodayPurchaseSummary = async () => {
  const [rows] = await db.query(`
    SELECT
      COUNT(*) AS totalBills,

      COALESCE(
        SUM(grand_total),
        0
      ) AS totalExpense,

      COALESCE(
        SUM(paid_amount),
        0
      ) AS totalPaid,

      COALESCE(
        SUM(due_amount),
        0
      ) AS totalDue
    FROM purchases
    WHERE purchase_date = CURDATE()
      AND status IN (
        'COMPLETED',
        'PARTIALLY_RETURNED'
      )
  `);

  return rows[0];
};

/**
 * Total customer receivables.
 */
const getTotalReceivables = async () => {
  const [rows] = await db.query(`
    SELECT
      COALESCE(
        SUM(due_amount),
        0
      ) AS totalReceivable,

      COUNT(*) AS dueInvoiceCount
    FROM sales
    WHERE payment_status IN (
      'UNPAID',
      'PARTIAL'
    )
      AND status IN (
        'COMPLETED',
        'PARTIALLY_RETURNED'
      )
      AND due_amount > 0
  `);

  return rows[0];
};

/**
 * Total supplier payables.
 *
 * COMPLETED এবং PARTIALLY_RETURNED
 * purchase-এর remaining due ধরা হবে।
 */
const getTotalPayables = async () => {
  const [rows] = await db.query(`
    SELECT
      COALESCE(
        SUM(due_amount),
        0
      ) AS totalPayable,

      COUNT(*) AS duePurchaseCount
    FROM purchases
    WHERE payment_status IN (
      'UNPAID',
      'PARTIAL'
    )
      AND status IN (
        'COMPLETED',
        'PARTIALLY_RETURNED'
      )
      AND due_amount > 0
  `);

  return rows[0];
};

/**
 * Low-stock medicine count.
 *
 * সব active এবং non-expired batch-এর
 * total stock medicine reorder level-এর
 * সমান বা কম হলে low stock।
 */
const getLowStockSummary = async () => {
  const [rows] = await db.query(`
    SELECT
      COUNT(*) AS lowStockCount
    FROM (
      SELECT
        m.id,
        m.reorder_level,

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

      LEFT JOIN medicine_batches mb
        ON mb.medicine_id = m.id

      WHERE m.is_active = TRUE

      GROUP BY
        m.id,
        m.reorder_level

      HAVING availableStock <=
        m.reorder_level
    ) AS low_stock_medicines
  `);

  return rows[0];
};

/**
 * Low-stock medicine details.
 */
const getLowStockItems = async (
  limit = 10
) => {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 10, 1),
    50
  );

  const [rows] = await db.query(
    `
      SELECT
        m.id AS medicineId,
        m.sku,
        m.brand_name AS brandName,
        m.generic_name AS genericName,
        m.reorder_level AS reorderLevel,

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

      LEFT JOIN medicine_batches mb
        ON mb.medicine_id = m.id

      WHERE m.is_active = TRUE

      GROUP BY
        m.id,
        m.sku,
        m.brand_name,
        m.generic_name,
        m.reorder_level

      HAVING availableStock <=
        m.reorder_level

      ORDER BY
        availableStock ASC,
        m.brand_name ASC

      LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
};

/**
 * Expired এবং আগামী 30 দিনের
 * expiring batch summary.
 */
const getExpirySummary = async () => {
  const [rows] = await db.query(`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN expiry_date < CURDATE()
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS expiredBatchCount,

      COALESCE(
        SUM(
          CASE
            WHEN expiry_date >= CURDATE()
              AND expiry_date <=
                DATE_ADD(
                  CURDATE(),
                  INTERVAL 30 DAY
                )
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS expiringSoonCount,

      COALESCE(
        SUM(
          CASE
            WHEN expiry_date < CURDATE()
            THEN quantity_available
            ELSE 0
          END
        ),
        0
      ) AS expiredQuantity

    FROM medicine_batches

    WHERE is_active = TRUE
      AND quantity_available > 0
  `);

  return rows[0];
};

/**
 * Expired এবং expiring-soon batches.
 */
const getExpiryItems = async (
  limit = 10
) => {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 10, 1),
    50
  );

  const [rows] = await db.query(
    `
      SELECT
        mb.id AS batchId,
        mb.batch_number AS batchNumber,
        mb.expiry_date AS expiryDate,

        mb.quantity_available
          AS quantityAvailable,

        mb.location,

        m.id AS medicineId,
        m.sku,
        m.brand_name AS brandName,
        m.generic_name AS genericName,

        CASE
          WHEN mb.expiry_date < CURDATE()
          THEN 'EXPIRED'
          ELSE 'EXPIRING_SOON'
        END AS expiryStatus,

        DATEDIFF(
          mb.expiry_date,
          CURDATE()
        ) AS daysRemaining

      FROM medicine_batches mb

      INNER JOIN medicines m
        ON m.id = mb.medicine_id

      WHERE mb.is_active = TRUE
        AND mb.quantity_available > 0

        AND mb.expiry_date <=
          DATE_ADD(
            CURDATE(),
            INTERVAL 30 DAY
          )

      ORDER BY
        mb.expiry_date ASC

      LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
};

/**
 * Recent sales.
 */
const getRecentSales = async (
  limit = 5
) => {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 5, 1),
    20
  );

  const [rows] = await db.query(
    `
      SELECT
        id,
        invoice_number AS invoiceNumber,
        customer_name AS customerName,
        sale_date AS saleDate,
        total_quantity AS totalQuantity,
        grand_total AS grandTotal,
        paid_amount AS paidAmount,
        due_amount AS dueAmount,
        payment_status AS paymentStatus,
        status

      FROM sales

      ORDER BY id DESC

      LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
};

/**
 * Recent purchases.
 */
const getRecentPurchases = async (
  limit = 5
) => {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 5, 1),
    20
  );

  const [rows] = await db.query(
    `
      SELECT
        p.id,

        p.purchase_number
          AS purchaseNumber,

        p.invoice_number
          AS invoiceNumber,

        p.purchase_date
          AS purchaseDate,

        p.grand_total
          AS grandTotal,

        p.paid_amount
          AS paidAmount,

        p.due_amount
          AS dueAmount,

        p.payment_status
          AS paymentStatus,

        p.status,

        s.name AS supplierName

      FROM purchases p

      INNER JOIN suppliers s
        ON s.id = p.supplier_id

      ORDER BY p.id DESC

      LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
};

module.exports = {
  getMedicineSummary,
  getStockSummary,
  getTodaySalesSummary,
  getTodayPurchaseSummary,
  getTotalReceivables,
  getTotalPayables,
  getLowStockSummary,
  getLowStockItems,
  getExpirySummary,
  getExpiryItems,
  getRecentSales,
  getRecentPurchases
};