require("dotenv").config();

const db = require("../config/db");

const setupStock = async () => {
  try {
    console.log("Starting batch and stock setup...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS medicine_batches (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        medicine_id BIGINT UNSIGNED NOT NULL,
        supplier_id BIGINT UNSIGNED NULL,

        batch_number VARCHAR(100) NOT NULL,

        manufacture_date DATE NULL,
        expiry_date DATE NOT NULL,

        purchase_price DECIMAL(12,2) NOT NULL,
        mrp DECIMAL(12,2) NOT NULL,
        selling_price DECIMAL(12,2) NOT NULL,

        quantity_received INT UNSIGNED NOT NULL DEFAULT 0,
        free_quantity INT UNSIGNED NOT NULL DEFAULT 0,
        quantity_available INT UNSIGNED NOT NULL DEFAULT 0,

        purchase_reference VARCHAR(100) NULL,
        location VARCHAR(100) NULL,

        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by BIGINT UNSIGNED NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_batches_medicine
          FOREIGN KEY (medicine_id)
          REFERENCES medicines(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_batches_supplier
          FOREIGN KEY (supplier_id)
          REFERENCES suppliers(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT fk_batches_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT uq_medicine_batch
          UNIQUE (medicine_id, batch_number),

        INDEX idx_batches_medicine_id (medicine_id),
        INDEX idx_batches_supplier_id (supplier_id),
        INDEX idx_batches_expiry_date (expiry_date),
        INDEX idx_batches_quantity_available (quantity_available),
        INDEX idx_batches_is_active (is_active)
      )
    `);

    console.log("✅ Medicine batches table created");

    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        medicine_id BIGINT UNSIGNED NOT NULL,
        batch_id BIGINT UNSIGNED NOT NULL,

        movement_type ENUM(
          'OPENING',
          'PURCHASE',
          'SALE',
          'SALE_RETURN',
          'PURCHASE_RETURN',
          'ADJUSTMENT_IN',
          'ADJUSTMENT_OUT',
          'DAMAGE',
          'EXPIRED'
        ) NOT NULL,

        quantity INT UNSIGNED NOT NULL,
        balance_after INT UNSIGNED NOT NULL,

        reference_type VARCHAR(50) NULL,
        reference_id BIGINT UNSIGNED NULL,
        notes VARCHAR(500) NULL,

        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_stock_movements_medicine
          FOREIGN KEY (medicine_id)
          REFERENCES medicines(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_stock_movements_batch
          FOREIGN KEY (batch_id)
          REFERENCES medicine_batches(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_stock_movements_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        INDEX idx_movements_medicine_id (medicine_id),
        INDEX idx_movements_batch_id (batch_id),
        INDEX idx_movements_type (movement_type),
        INDEX idx_movements_created_at (created_at)
      )
    `);

    console.log("✅ Stock movements table created");

    const [tables] = await db.query(
      `
        SELECT TABLE_NAME AS tableName
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME IN (
            'medicine_batches',
            'stock_movements'
          )
        ORDER BY TABLE_NAME
      `,
      [process.env.DB_NAME]
    );

    console.table(tables);

    console.log("✅ Batch and stock setup completed successfully");
  } catch (error) {
    console.error("❌ Batch and stock setup failed");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupStock();
