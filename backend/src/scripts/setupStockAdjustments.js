require("dotenv").config();

const db = require("../config/db");

const setupStockAdjustments = async () => {
  try {
    console.log("Starting stock adjustment setup...");

    // ============================================
    // 1. Stock adjustment master
    // ============================================

    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id BIGINT UNSIGNED
          AUTO_INCREMENT PRIMARY KEY,

        adjustment_number VARCHAR(50)
          NOT NULL UNIQUE,

        adjustment_date DATETIME
          NOT NULL,

        reason VARCHAR(255)
          NOT NULL,

        notes VARCHAR(500)
          NULL,

        status ENUM(
          'COMPLETED',
          'CANCELLED'
        ) NOT NULL DEFAULT 'COMPLETED',

        created_by BIGINT UNSIGNED
          NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_stock_adjustments_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        INDEX idx_stock_adjustments_date (
          adjustment_date
        ),

        INDEX idx_stock_adjustments_status (
          status
        )
      )
    `);

    console.log(
      "✅ Stock adjustments table created"
    );

    // ============================================
    // 2. Stock adjustment items
    // ============================================

    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_adjustment_items (
        id BIGINT UNSIGNED
          AUTO_INCREMENT PRIMARY KEY,

        stock_adjustment_id BIGINT UNSIGNED
          NOT NULL,

        medicine_id BIGINT UNSIGNED
          NOT NULL,

        batch_id BIGINT UNSIGNED
          NOT NULL,

        movement_type ENUM(
          'ADJUSTMENT_IN',
          'ADJUSTMENT_OUT',
          'DAMAGE',
          'EXPIRED'
        ) NOT NULL,

        quantity INT UNSIGNED
          NOT NULL,

        previous_stock INT UNSIGNED
          NOT NULL,

        balance_after INT UNSIGNED
          NOT NULL,

        notes VARCHAR(500)
          NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_adjustment_items_adjustment
          FOREIGN KEY (stock_adjustment_id)
          REFERENCES stock_adjustments(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_adjustment_items_medicine
          FOREIGN KEY (medicine_id)
          REFERENCES medicines(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_adjustment_items_batch
          FOREIGN KEY (batch_id)
          REFERENCES medicine_batches(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT uq_stock_adjustment_item
          UNIQUE (
            stock_adjustment_id,
            batch_id,
            movement_type
          ),

        INDEX idx_adjustment_items_adjustment_id (
          stock_adjustment_id
        ),

        INDEX idx_adjustment_items_medicine_id (
          medicine_id
        ),

        INDEX idx_adjustment_items_batch_id (
          batch_id
        ),

        INDEX idx_adjustment_items_type (
          movement_type
        )
      )
    `);

    console.log(
      "✅ Stock adjustment items table created"
    );

    // ============================================
    // 3. Verify tables
    // ============================================

    const [tables] = await db.query(
      `
        SELECT
          TABLE_NAME AS tableName,
          TABLE_ROWS AS estimatedRows
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME IN (
            'stock_adjustments',
            'stock_adjustment_items'
          )
        ORDER BY TABLE_NAME
      `,
      [process.env.DB_NAME]
    );

    console.table(tables);

    console.log(
      "✅ Stock adjustment setup completed successfully"
    );
  } catch (error) {
    console.error(
      "❌ Stock adjustment setup failed"
    );

    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupStockAdjustments();
