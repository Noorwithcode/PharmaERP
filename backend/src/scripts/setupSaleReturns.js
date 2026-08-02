require("dotenv").config();

const db = require("../config/db");

const setupSaleReturns = async () => {
  try {
    console.log("Starting sales return setup...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS sale_returns (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        return_number VARCHAR(50) NOT NULL UNIQUE,
        sale_id BIGINT UNSIGNED NOT NULL,

        return_date DATETIME NOT NULL,

        total_quantity INT UNSIGNED
          NOT NULL DEFAULT 0,

        taxable_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        tax_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        refund_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        refund_method ENUM(
          'CASH',
          'CARD',
          'UPI',
          'BANK',
          'CHEQUE',
          'CREDIT_NOTE',
          'OTHER'
        ) NULL,

        refund_reference VARCHAR(150) NULL,

        reason VARCHAR(500) NULL,

        status ENUM(
          'COMPLETED',
          'CANCELLED'
        ) NOT NULL DEFAULT 'COMPLETED',

        created_by BIGINT UNSIGNED NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_sale_returns_sale
          FOREIGN KEY (sale_id)
          REFERENCES sales(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_sale_returns_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        INDEX idx_sale_returns_sale_id (sale_id),
        INDEX idx_sale_returns_return_date (return_date),
        INDEX idx_sale_returns_status (status)
      )
    `);

    console.log("✅ Sale returns table created");

    await db.query(`
      CREATE TABLE IF NOT EXISTS sale_return_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        sale_return_id BIGINT UNSIGNED NOT NULL,
        sale_item_id BIGINT UNSIGNED NOT NULL,

        medicine_id BIGINT UNSIGNED NOT NULL,
        batch_id BIGINT UNSIGNED NOT NULL,

        quantity INT UNSIGNED NOT NULL,

        selling_price DECIMAL(12,2)
          NOT NULL DEFAULT 0.00,

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

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_return_items_return
          FOREIGN KEY (sale_return_id)
          REFERENCES sale_returns(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_return_items_sale_item
          FOREIGN KEY (sale_item_id)
          REFERENCES sale_items(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_return_items_medicine
          FOREIGN KEY (medicine_id)
          REFERENCES medicines(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_return_items_batch
          FOREIGN KEY (batch_id)
          REFERENCES medicine_batches(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        INDEX idx_return_items_return_id (sale_return_id),
        INDEX idx_return_items_sale_item_id (sale_item_id),
        INDEX idx_return_items_medicine_id (medicine_id),
        INDEX idx_return_items_batch_id (batch_id)
      )
    `);

    console.log("✅ Sale return items table created");

    const [tables] = await db.query(
      `
        SELECT
          TABLE_NAME AS tableName,
          TABLE_ROWS AS estimatedRows
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME IN (
            'sale_returns',
            'sale_return_items'
          )
        ORDER BY TABLE_NAME
      `,
      [process.env.DB_NAME]
    );

    console.table(tables);

    console.log(
      "✅ Sales return setup completed successfully"
    );
  } catch (error) {
    console.error("❌ Sales return setup failed");
    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupSaleReturns();
