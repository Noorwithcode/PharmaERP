require("dotenv").config();

const db = require("../config/db");

const columnExists = async (tableName, columnName) => {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [
      process.env.DB_NAME,
      tableName,
      columnName,
    ]
  );

  return Number(rows[0].total) > 0;
};

const setupPurchaseReturns = async () => {
  try {
    console.log(
      "Starting purchase return setup..."
    );

    // ============================================
    // 1. Add returned quantity to purchase items
    // ============================================

    const returnedQuantityExists =
      await columnExists(
        "purchase_items",
        "returned_quantity"
      );

    if (!returnedQuantityExists) {
      await db.query(`
        ALTER TABLE purchase_items
        ADD COLUMN returned_quantity
          INT UNSIGNED NOT NULL DEFAULT 0
        AFTER free_quantity
      `);

      console.log(
        "✅ returned_quantity added to purchase_items"
      );
    } else {
      console.log(
        "ℹ️ returned_quantity already exists"
      );
    }

    // ============================================
    // 2. Update purchases status options
    // ============================================

    await db.query(`
      ALTER TABLE purchases
      MODIFY COLUMN status ENUM(
        'COMPLETED',
        'CANCELLED',
        'PARTIALLY_RETURNED',
        'RETURNED'
      ) NOT NULL DEFAULT 'COMPLETED'
    `);

    console.log(
      "✅ Purchase status options updated"
    );

    // ============================================
    // 3. Purchase returns master table
    // ============================================

    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_returns (
        id BIGINT UNSIGNED
          AUTO_INCREMENT PRIMARY KEY,

        return_number VARCHAR(50)
          NOT NULL UNIQUE,

        purchase_id BIGINT UNSIGNED
          NOT NULL,

        supplier_id BIGINT UNSIGNED
          NOT NULL,

        return_date DATETIME
          NOT NULL,

        total_quantity INT UNSIGNED
          NOT NULL DEFAULT 0,

        subtotal DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        discount_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        taxable_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        tax_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        return_total DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        due_adjusted DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        refund_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        settlement_method ENUM(
          'CASH',
          'BANK',
          'UPI',
          'CHEQUE',
          'CREDIT_NOTE',
          'OTHER'
        ) NULL,

        settlement_reference
          VARCHAR(150) NULL,

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

        CONSTRAINT fk_purchase_returns_purchase
          FOREIGN KEY (purchase_id)
          REFERENCES purchases(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_purchase_returns_supplier
          FOREIGN KEY (supplier_id)
          REFERENCES suppliers(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_purchase_returns_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        INDEX idx_purchase_returns_purchase_id (
          purchase_id
        ),

        INDEX idx_purchase_returns_supplier_id (
          supplier_id
        ),

        INDEX idx_purchase_returns_return_date (
          return_date
        ),

        INDEX idx_purchase_returns_status (
          status
        )
      )
    `);

    console.log(
      "✅ Purchase returns table created"
    );

    // ============================================
    // 4. Purchase return item table
    // ============================================

    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_return_items (
        id BIGINT UNSIGNED
          AUTO_INCREMENT PRIMARY KEY,

        purchase_return_id BIGINT UNSIGNED
          NOT NULL,

        purchase_item_id BIGINT UNSIGNED
          NOT NULL,

        medicine_id BIGINT UNSIGNED
          NOT NULL,

        batch_id BIGINT UNSIGNED
          NOT NULL,

        quantity INT UNSIGNED
          NOT NULL,

        purchase_price DECIMAL(12,2)
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

        CONSTRAINT fk_purchase_return_items_return
          FOREIGN KEY (purchase_return_id)
          REFERENCES purchase_returns(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_purchase_return_items_purchase_item
          FOREIGN KEY (purchase_item_id)
          REFERENCES purchase_items(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_purchase_return_items_medicine
          FOREIGN KEY (medicine_id)
          REFERENCES medicines(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_purchase_return_items_batch
          FOREIGN KEY (batch_id)
          REFERENCES medicine_batches(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT uq_purchase_return_item
          UNIQUE (
            purchase_return_id,
            purchase_item_id
          ),

        INDEX idx_purchase_return_items_return_id (
          purchase_return_id
        ),

        INDEX idx_purchase_return_items_purchase_item_id (
          purchase_item_id
        ),

        INDEX idx_purchase_return_items_medicine_id (
          medicine_id
        ),

        INDEX idx_purchase_return_items_batch_id (
          batch_id
        )
      )
    `);

    console.log(
      "✅ Purchase return items table created"
    );

    // ============================================
    // 5. Verify tables
    // ============================================

    const [tables] = await db.query(
      `
        SELECT
          TABLE_NAME AS tableName,
          TABLE_ROWS AS estimatedRows
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME IN (
            'purchase_returns',
            'purchase_return_items'
          )
        ORDER BY TABLE_NAME
      `,
      [process.env.DB_NAME]
    );

    console.table(tables);

    const [purchaseItemColumns] =
      await db.query(
        `
          SELECT
            COLUMN_NAME AS columnName,
            COLUMN_TYPE AS columnType
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'purchase_items'
            AND COLUMN_NAME = 'returned_quantity'
        `,
        [process.env.DB_NAME]
      );

    console.table(purchaseItemColumns);

    console.log(
      "✅ Purchase return setup completed successfully"
    );
  } catch (error) {
    console.error(
      "❌ Purchase return setup failed"
    );

    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupPurchaseReturns();
