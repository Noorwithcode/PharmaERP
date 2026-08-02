require("dotenv").config();

const db = require("../config/db");

const setupInventoryMasters = async () => {
  try {
    console.log("Starting inventory master tables setup...");

    // Medicine categories
    await db.query(`
      CREATE TABLE IF NOT EXISTS medicine_categories (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255) NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_categories_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      )
    `);

    console.log("✅ Medicine categories table created");

    // Manufacturers
    await db.query(`
      CREATE TABLE IF NOT EXISTS manufacturers (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        contact_person VARCHAR(120) NULL,
        phone VARCHAR(20) NULL,
        email VARCHAR(150) NULL,
        address VARCHAR(500) NULL,
        drug_license_number VARCHAR(100) NULL,
        gstin VARCHAR(20) NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_manufacturers_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      )
    `);

    console.log("✅ Manufacturers table created");

    // Suppliers
    await db.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        contact_person VARCHAR(120) NULL,
        phone VARCHAR(20) NULL,
        email VARCHAR(150) NULL,
        address VARCHAR(500) NULL,
        drug_license_number VARCHAR(100) NULL,
        gstin VARCHAR(20) NULL,
        credit_days INT UNSIGNED NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_suppliers_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      )
    `);

    console.log("✅ Suppliers table created");

    const [tables] = await db.query(`
      SELECT TABLE_NAME AS tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN (
          'medicine_categories',
          'manufacturers',
          'suppliers'
        )
      ORDER BY TABLE_NAME
    `, [process.env.DB_NAME]);

    console.table(tables);

    console.log("✅ Inventory master setup completed successfully");
  } catch (error) {
    console.error("❌ Inventory master setup failed");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupInventoryMasters();
