const db = require("../config/db");

/**
 * Get paginated customers
 */
const getCustomers = async ({
  search = "",
  isActive = null,
  limit = 20,
  offset = 0
}) => {
  const conditions = [];
  const parameters = [];

  if (isActive !== null) {
    conditions.push(
      "customers.is_active = ?"
    );

    parameters.push(isActive);
  }

  if (search) {
    const searchValue =
      `%${search}%`;

    conditions.push(`
      (
        customers.full_name LIKE ?
        OR customers.phone LIKE ?
        OR customers.email LIKE ?
        OR customers.customer_code LIKE ?
      )
    `);

    parameters.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue
    );
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const [rows] = await db.query(
    `
      SELECT
        customers.id,

        customers.customer_code
          AS customerCode,

        customers.full_name
          AS fullName,

        customers.full_name
          AS name,

        customers.phone,
        customers.email,
        customers.address,

        DATE_FORMAT(
          customers.date_of_birth,
          '%Y-%m-%d'
        ) AS dateOfBirth,

        customers.gender,
        customers.notes,

        customers.total_purchases
          AS totalPurchases,

        customers.outstanding_balance
          AS outstandingBalance,

        customers.is_active
          AS isActive,

        customers.created_at
          AS createdAt,

        customers.updated_at
          AS updatedAt

      FROM customers

      ${whereClause}

      ORDER BY
        customers.full_name ASC,
        customers.id DESC

      LIMIT ?
      OFFSET ?
    `,
    [
      ...parameters,
      Number(limit),
      Number(offset)
    ]
  );

  return rows.map((customer) => ({
    ...customer,

    id: Number(customer.id),

    totalPurchases:
      Number(
        customer.totalPurchases || 0
      ),

    outstandingBalance:
      Number(
        customer.outstandingBalance || 0
      ),

    isActive:
      Boolean(customer.isActive)
  }));
};

/**
 * Count customers for pagination
 */
const countCustomers = async ({
  search = "",
  isActive = null
}) => {
  const conditions = [];
  const parameters = [];

  if (isActive !== null) {
    conditions.push(
      "customers.is_active = ?"
    );

    parameters.push(isActive);
  }

  if (search) {
    const searchValue =
      `%${search}%`;

    conditions.push(`
      (
        customers.full_name LIKE ?
        OR customers.phone LIKE ?
        OR customers.email LIKE ?
        OR customers.customer_code LIKE ?
      )
    `);

    parameters.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue
    );
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const [rows] = await db.query(
    `
      SELECT
        COUNT(*) AS total

      FROM customers

      ${whereClause}
    `,
    parameters
  );

  return Number(rows[0].total);
};

/**
 * Get Customer Ledger / Statement
 */
const getCustomerLedger = async (
  customerId,
  startDate,
  endDate
) => {
  /*
   * Opening balance:
   * sales increase customer due,
   * payments and returns reduce due.
   */
  const [openingRows] =
    await db.query(
      `
        SELECT
          COALESCE(
            SUM(debit),
            0
          )
          -
          COALESCE(
            SUM(credit),
            0
          ) AS opening_balance

        FROM (
          SELECT
            sales.grand_total AS debit,
            0 AS credit

          FROM sales

          WHERE sales.customer_id = ?
            AND sales.sale_date < ?
            AND sales.status != 'CANCELLED'

          UNION ALL

          SELECT
            0 AS debit,
            sale_payments.amount AS credit

          FROM sale_payments

          INNER JOIN sales
            ON sales.id =
              sale_payments.sale_id

          WHERE sales.customer_id = ?
            AND sale_payments.payment_date < ?

          UNION ALL

          SELECT
            0 AS debit,
            sale_returns.grand_total AS credit

          FROM sale_returns

          WHERE sale_returns.customer_id = ?
            AND sale_returns.return_date < ?
        ) AS opening_transactions
      `,
      [
        customerId,
        startDate,

        customerId,
        startDate,

        customerId,
        startDate
      ]
    );

  const openingBalance =
    Number(
      openingRows[0]
        .opening_balance || 0
    );

  /*
   * DATE_ADD ensures the complete end date
   * is included for DATETIME columns.
   */
  const [transactions] =
    await db.query(
      `
        SELECT *

        FROM (
          SELECT
            sales.sale_date
              AS transaction_date,

            'SALE'
              AS transaction_type,

            sales.invoice_number
              AS reference_number,

            sales.grand_total
              AS debit,

            0 AS credit,

            sales.notes

          FROM sales

          WHERE sales.customer_id = ?
            AND sales.sale_date >= ?
            AND sales.sale_date <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
            AND sales.status != 'CANCELLED'

          UNION ALL

          SELECT
            sale_payments.payment_date
              AS transaction_date,

            'PAYMENT'
              AS transaction_type,

            COALESCE(
              sale_payments
                .transaction_reference,

              CONCAT(
                'PAY-',
                sale_payments.id
              )
            ) AS reference_number,

            0 AS debit,

            sale_payments.amount
              AS credit,

            sale_payments.payment_notes
              AS notes

          FROM sale_payments

          INNER JOIN sales
            ON sales.id =
              sale_payments.sale_id

          WHERE sales.customer_id = ?
            AND sale_payments.payment_date >= ?
            AND sale_payments.payment_date <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          UNION ALL

          SELECT
            sale_returns.return_date
              AS transaction_date,

            'RETURN'
              AS transaction_type,

            sale_returns
              .return_invoice_number
              AS reference_number,

            0 AS debit,

            sale_returns.grand_total
              AS credit,

            sale_returns.notes

          FROM sale_returns

          WHERE sale_returns.customer_id = ?
            AND sale_returns.return_date >= ?
            AND sale_returns.return_date <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        ) AS ledger_entries

        ORDER BY
          transaction_date ASC
      `,
      [
        customerId,
        startDate,
        endDate,

        customerId,
        startDate,
        endDate,

        customerId,
        startDate,
        endDate
      ]
    );

  return {
    openingBalance,
    transactions
  };
};

module.exports = {
  getCustomers,
  countCustomers,
  getCustomerLedger
};