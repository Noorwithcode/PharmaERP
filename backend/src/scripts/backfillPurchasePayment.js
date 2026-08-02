require("dotenv").config();

const db = require("../config/db");

const run = async () => {
  const purchaseId =
    Number.parseInt(
      process.argv[2],
      10
    );

  if (
    !Number.isInteger(purchaseId) ||
    purchaseId <= 0
  ) {
    throw new Error(
      "Run command: node src/scripts/backfillPurchasePayment.js PURCHASE_ID"
    );
  }

  const [purchaseRows] =
    await db.query(
      `
        SELECT
          id,

          paid_amount
            AS paidAmount,

          payment_method
            AS paymentMethod,

          created_by
            AS createdBy,

          created_at
            AS createdAt

        FROM purchases

        WHERE id = ?

        LIMIT 1
      `,
      [purchaseId]
    );

  if (purchaseRows.length === 0) {
    throw new Error(
      `Purchase ID ${purchaseId} was not found`
    );
  }

  const purchase =
    purchaseRows[0];

  const [paymentRows] =
    await db.query(
      `
        SELECT
          COALESCE(
            SUM(amount),
            0
          ) AS recordedTotal

        FROM purchase_payments

        WHERE purchase_id = ?
      `,
      [purchaseId]
    );

  const paidAmount = Number(
    purchase.paidAmount || 0
  );

  const recordedTotal = Number(
    paymentRows[0]
      ?.recordedTotal || 0
  );

  const missingAmount =
    Number(
      (
        paidAmount -
        recordedTotal
      ).toFixed(2)
    );

  if (missingAmount <= 0) {
    console.log(
      "No missing payment history found."
    );

    return;
  }

  await db.query(
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
        ?, ?, ?, ?, ?, ?, ?
      )
    `,
    [
      purchaseId,
      missingAmount,

      purchase.paymentMethod ||
        "OTHER",

      null,

      "Initial payment backfilled from purchase header",

      purchase.createdBy,

      purchase.createdAt ||
        new Date(),
    ]
  );

  console.log(
    `Backfilled payment: Rs. ${missingAmount.toFixed(
      2
    )}`
  );

  const [payments] =
    await db.query(
      `
        SELECT
          id,

          purchase_id
            AS purchaseId,

          amount,

          payment_method
            AS paymentMethod,

          payment_notes
            AS paymentNotes,

          payment_date
            AS paymentDate

        FROM purchase_payments

        WHERE purchase_id = ?

        ORDER BY id ASC
      `,
      [purchaseId]
    );

  console.table(payments);
};

run()
  .catch((error) => {
    console.error(
      "Backfill error:",
      error.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.end();
    } catch {}
  });