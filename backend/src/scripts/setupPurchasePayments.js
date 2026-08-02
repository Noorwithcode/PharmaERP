require("dotenv").config();

const db = require("../config/db");

const setupPurchasePayments = async () => {
  try {
    console.log("Starting purchase payment setup...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_payments (
        id BIGINT UNSIGNED
          AUTO_INCREMENT PRIMARY KEY,

        purchase_id BIGINT UNSIGNED
          NOT NULL,

        amount DECIMAL(14,2)
          NOT NULL,

        payment_method ENUM(
          'CASH',
          'CARD',
          'UPI',
          'BANK',
          'CHEQUE',
          'CREDIT_NOTE',
          'OTHER'
        ) NOT NULL,

        transaction_reference
          VARCHAR(150) NULL,

        payment_notes
          VARCHAR(500) NULL,

        paid_by BIGINT UNSIGNED
          NULL,

        payment_date DATETIME
          NOT NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_purchase_payments_purchase
          FOREIGN KEY (purchase_id)
          REFERENCES purchases(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_purchase_payments_paid_by
          FOREIGN KEY (paid_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        INDEX idx_purchase_payments_purchase_id (
          purchase_id
        ),

        INDEX idx_purchase_payments_date (
          payment_date
        ),

        INDEX idx_purchase_payments_method (
          payment_method
        )
      )
    `);

    console.log(
      "✅ Purchase payments table created"
    );

    // Existing purchases-এর paid amount payment
    // history-তে opening entry হিসেবে save হবে।
    const [backfillResult] = await db.query(`
      INSERT INTO purchase_payments (
        purchase_id,
        amount,
        payment_method,
        transaction_reference,
        payment_notes,
        paid_by,
        payment_date
      )

      SELECT
        purchases.id,
        purchases.paid_amount,
        'OTHER',
        NULL,
        'Opening payment imported from purchase record',
        purchases.created_by,
        NOW()

      FROM purchases

      WHERE purchases.paid_amount > 0

        AND NOT EXISTS (
          SELECT 1
          FROM purchase_payments
          WHERE purchase_payments.purchase_id =
            purchases.id
            AND purchase_payments.payment_notes =
              'Opening payment imported from purchase record'
        )
    `);

    console.log(
      `✅ ${backfillResult.affectedRows} existing payment record(s) imported`
    );

    const [tables] = await db.query(
      `
        SELECT
          TABLE_NAME AS tableName,
          TABLE_ROWS AS estimatedRows

        FROM information_schema.TABLES

        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'purchase_payments'
      `,
      [process.env.DB_NAME]
    );

    console.table(tables);

    const [payments] = await db.query(`
      SELECT
        purchase_payments.id,

        purchase_payments.purchase_id
          AS purchaseId,

        purchases.purchase_number
          AS purchaseNumber,

        purchase_payments.amount,

        purchase_payments.payment_method
          AS paymentMethod,

        purchase_payments.payment_notes
          AS paymentNotes,

        DATE_FORMAT(
          purchase_payments.payment_date,
          '%Y-%m-%d %H:%i:%s'
        ) AS paymentDate

      FROM purchase_payments

      INNER JOIN purchases
        ON purchases.id =
          purchase_payments.purchase_id

      ORDER BY purchase_payments.id ASC
    `);

    console.table(payments);

    console.log(
      "✅ Purchase payment setup completed successfully"
    );
  } catch (error) {
    console.error(
      "❌ Purchase payment setup failed"
    );

    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupPurchasePayments();
