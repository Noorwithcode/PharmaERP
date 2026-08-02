require("dotenv").config();

const db = require("../config/db");

const setupSales = async () => {
  try {
    console.log("Starting sales and billing setup...");

    // ============================================
    // 1. Customers table
    // ============================================

    await db.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        customer_code VARCHAR(50) NOT NULL UNIQUE,
        full_name VARCHAR(150) NOT NULL,

        phone VARCHAR(20) NULL UNIQUE,
        email VARCHAR(150) NULL,

        address VARCHAR(500) NULL,
        date_of_birth DATE NULL,

        gender ENUM(
          'MALE',
          'FEMALE',
          'OTHER',
          'NOT_SPECIFIED'
        ) NOT NULL DEFAULT 'NOT_SPECIFIED',

        notes VARCHAR(500) NULL,

        total_purchases DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        outstanding_balance DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        is_active BOOLEAN NOT NULL DEFAULT TRUE,

        created_by BIGINT UNSIGNED NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_customers_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        INDEX idx_customers_full_name (full_name),
        INDEX idx_customers_phone (phone),
        INDEX idx_customers_is_active (is_active)
      )
    `);

    console.log("✅ Customers table created");

    // ============================================
    // 2. Sales invoice table
    // ============================================

    await db.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        invoice_number VARCHAR(50) NOT NULL UNIQUE,

        customer_id BIGINT UNSIGNED NULL,

        customer_name VARCHAR(150) NULL,
        customer_phone VARCHAR(20) NULL,
        customer_address VARCHAR(500) NULL,

        sale_date DATETIME NOT NULL,

        sale_type ENUM(
          'RETAIL',
          'WHOLESALE'
        ) NOT NULL DEFAULT 'RETAIL',

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

        round_off DECIMAL(10,2)
          NOT NULL DEFAULT 0.00,

        grand_total DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        paid_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        due_amount DECIMAL(14,2)
          NOT NULL DEFAULT 0.00,

        payment_status ENUM(
          'UNPAID',
          'PARTIAL',
          'PAID'
        ) NOT NULL DEFAULT 'UNPAID',

        status ENUM(
          'COMPLETED',
          'CANCELLED',
          'PARTIALLY_RETURNED',
          'RETURNED'
        ) NOT NULL DEFAULT 'COMPLETED',

        doctor_name VARCHAR(150) NULL,
        prescription_number VARCHAR(100) NULL,

        prescription_date DATE NULL,
        prescription_notes VARCHAR(500) NULL,

        notes VARCHAR(500) NULL,

        created_by BIGINT UNSIGNED NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_sales_customer
          FOREIGN KEY (customer_id)
          REFERENCES customers(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT fk_sales_created_by
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        INDEX idx_sales_customer_id (customer_id),
        INDEX idx_sales_sale_date (sale_date),
        INDEX idx_sales_payment_status (payment_status),
        INDEX idx_sales_status (status),
        INDEX idx_sales_customer_phone (customer_phone)
      )
    `);

    console.log("✅ Sales table created");

    // ============================================
    // 3. Sales invoice items table
    // ============================================

    await db.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        sale_id BIGINT UNSIGNED NOT NULL,
        medicine_id BIGINT UNSIGNED NOT NULL,
        batch_id BIGINT UNSIGNED NOT NULL,

        medicine_name VARCHAR(150) NOT NULL,
        generic_name VARCHAR(150) NULL,

        batch_number VARCHAR(100) NOT NULL,
        expiry_date DATE NOT NULL,

        quantity INT UNSIGNED NOT NULL,

        returned_quantity INT UNSIGNED
          NOT NULL DEFAULT 0,

        purchase_price DECIMAL(12,2)
          NOT NULL DEFAULT 0.00,

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

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_sale_items_sale
          FOREIGN KEY (sale_id)
          REFERENCES sales(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_sale_items_medicine
          FOREIGN KEY (medicine_id)
          REFERENCES medicines(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_sale_items_batch
          FOREIGN KEY (batch_id)
          REFERENCES medicine_batches(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT uq_sale_batch
          UNIQUE (sale_id, batch_id),

        INDEX idx_sale_items_sale_id (sale_id),
        INDEX idx_sale_items_medicine_id (medicine_id),
        INDEX idx_sale_items_batch_id (batch_id),
        INDEX idx_sale_items_expiry_date (expiry_date)
      )
    `);

    console.log("✅ Sale items table created");

    // ============================================
    // 4. Sale payment records
    // ============================================

    await db.query(`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        sale_id BIGINT UNSIGNED NOT NULL,

        amount DECIMAL(14,2) NOT NULL,

        payment_method ENUM(
          'CASH',
          'CARD',
          'UPI',
          'BANK',
          'CHEQUE',
          'CREDIT',
          'OTHER'
        ) NOT NULL,

        transaction_reference VARCHAR(150) NULL,
        payment_notes VARCHAR(500) NULL,

        received_by BIGINT UNSIGNED NULL,

        payment_date DATETIME NOT NULL,

        created_at TIMESTAMP
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_sale_payments_sale
          FOREIGN KEY (sale_id)
          REFERENCES sales(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_sale_payments_received_by
          FOREIGN KEY (received_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        INDEX idx_sale_payments_sale_id (sale_id),
        INDEX idx_sale_payments_method (payment_method),
        INDEX idx_sale_payments_date (payment_date)
      )
    `);

    console.log("✅ Sale payments table created");

    // ============================================
    // Verify created tables
    // ============================================

    const [tables] = await db.query(
      `
        SELECT
          TABLE_NAME AS tableName,
          TABLE_ROWS AS estimatedRows
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME IN (
            'customers',
            'sales',
            'sale_items',
            'sale_payments'
          )
        ORDER BY TABLE_NAME
      `,
      [process.env.DB_NAME]
    );

    console.table(tables);

    console.log(
      "✅ Sales and billing setup completed successfully"
    );
  } catch (error) {
    console.error("❌ Sales and billing setup failed");
    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupSales();
