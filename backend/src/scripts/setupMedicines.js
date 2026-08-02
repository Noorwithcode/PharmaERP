require("dotenv").config();

const db = require("../config/db");

const setupMedicines = async () => {
  try {
    console.log("Starting medicine master setup...");

    await db.query(`
      CREATE TABLE IF NOT EXISTS medicines (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        sku VARCHAR(50) NOT NULL UNIQUE,
        brand_name VARCHAR(150) NOT NULL,
        generic_name VARCHAR(150) NOT NULL,

        category_id BIGINT UNSIGNED NOT NULL,
        manufacturer_id BIGINT UNSIGNED NOT NULL,

        strength VARCHAR(100) NULL,
        dosage_form VARCHAR(100) NULL,
        unit VARCHAR(50) NOT NULL DEFAULT 'piece',
        pack_size VARCHAR(100) NULL,

        barcode VARCHAR(100) NULL UNIQUE,
        hsn_code VARCHAR(20) NULL,

        gst_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        prescription_required BOOLEAN NOT NULL DEFAULT FALSE,
        reorder_level INT UNSIGNED NOT NULL DEFAULT 10,

        storage_instructions VARCHAR(500) NULL,
        description TEXT NULL,

        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by BIGINT UNSIGNED NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_medicines_category
          FOREIGN KEY (category_id)
          REFERENCES medicine_categories(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_medicines_manufacturer
          FOREIGN KEY (manufacturer_id)
          REFERENCES manufacturers(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_medicines_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        INDEX idx_medicines_brand_name (brand_name),
        INDEX idx_medicines_generic_name (generic_name),
        INDEX idx_medicines_category_id (category_id),
        INDEX idx_medicines_manufacturer_id (manufacturer_id),
        INDEX idx_medicines_is_active (is_active)
      )
    `);

    console.log("✅ Medicines table created");

    const [columns] = await db.query(`
      SELECT
        COLUMN_NAME AS columnName,
        COLUMN_TYPE AS columnType,
        IS_NULLABLE AS isNullable
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'medicines'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME]);

    console.table(columns);

    console.log("✅ Medicine master setup completed successfully");
  } catch (error) {
    console.error("❌ Medicine master setup failed");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupMedicines();
