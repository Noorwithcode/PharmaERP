require("dotenv").config();

const db = require("../config/db");

const setupPurchases = async () => {
  try {
    console.log("Starting purchase management setup...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        purchase_number VARCHAR(50) NOT NULL UNIQUE,

        supplier_id BIGINT UNSIGNED NOT NULL,
        invoice_number VARCHAR(100) NOT NULL,
        invoice_date DATE NOT NULL,
        purchase_date DATE NOT NULL,

        subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        taxable_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        round_off DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        grand_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,

        paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        due_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,

        payment_status ENUM(
          'UNPAID',
          'PARTIAL',
          'PAID'
        ) NOT NULL DEFAULT 'UNPAID',

        payment_method ENUM(
          'CASH',
          'BANK',
          'UPI',
          'CHEQUE',
          'CREDIT',
          'OTHER'
        ) NULL,

        status ENUM(
          'COMPLETED',
          'CANCELLED'
        ) NOT NULL DEFAULT 'COMPLETED',

        notes VARCHAR(500) NULL,

        created_by BIGINT UNSIGNED NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_purchases_supplier
          FOREIGN KEY (supplier_id)
          REFERENCES suppliers(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_purchases_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT uq_supplier_invoice
          UNIQUE (supplier_id, invoice_number),

        INDEX idx_purchases_supplier_id (supplier_id),
        INDEX idx_purchases_purchase_date (purchase_date),
        INDEX idx_purchases_invoice_date (invoice_date),
        INDEX idx_purchases_payment_status (payment_status),
        INDEX idx_purchases_status (status)
      )
    `);

    console.log("✅ Purchases table created");

    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        purchase_id BIGINT UNSIGNED NOT NULL,
        medicine_id BIGINT UNSIGNED NOT NULL,
        batch_id BIGINT UNSIGNED NOT NULL,

        batch_number VARCHAR(100) NOT NULL,
        manufacture_date DATE NULL,
        expiry_date DATE NOT NULL,

        quantity INT UNSIGNED NOT NULL,
        free_quantity INT UNSIGNED NOT NULL DEFAULT 0,

        purchase_price DECIMAL(12,2) NOT NULL,
        mrp DECIMAL(12,2) NOT NULL,
        selling_price DECIMAL(12,2) NOT NULL,

        discount_percent DECIMAL(5,2)
          NOT NULL DEFAULT 0.00,

        discount_amount DECIMAL(12,2)
          NOT NULL DEFAULT 0.00,

        gst_percent DECIMAL(5,2)
          NOT NULL DEFAULT 0.00,

        taxable_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        tax_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        line_total DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_purchase_items_purchase
          FOREIGN KEY (purchase_id)
          REFERENCES purchases(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_purchase_items_medicine
          FOREIGN KEY (medicine_id)
          REFERENCES medicines(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_purchase_items_batch
          FOREIGN KEY (batch_id)
          REFERENCES medicine_batches(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT uq_purchase_batch
          UNIQUE (purchase_id, batch_id),

        INDEX idx_purchase_items_purchase_id (purchase_id),
        INDEX idx_purchase_items_medicine_id (medicine_id),
        INDEX idx_purchase_items_batch_id (batch_id),
        INDEX idx_purchase_items_expiry_date (expiry_date)
      )
    `);

    console.log("✅ Purchase items table created");

    const [tables] = await db.query(
      `
        SELECT
          TABLE_NAME AS tableName,
          TABLE_ROWS AS estimatedRows
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME IN (
            'purchases',
            'purchase_items'
          )
        ORDER BY TABLE_NAME
      `,
      [process.env.DB_NAME]
    );

    console.table(tables);

    console.log(
      "✅ Purchase management setup completed successfully"
    );
  } catch (error) {
    console.error("❌ Purchase management setup failed");
    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupPurchases();
