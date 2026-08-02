require("dotenv").config();

const db = require("../config/db");

const setupSettings = async () => {
  try {
    console.log(
      "Starting PharmaERP settings setup..."
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_settings (
        id TINYINT UNSIGNED
          NOT NULL PRIMARY KEY
          DEFAULT 1,

        pharmacy_name VARCHAR(150)
          NOT NULL,

        address VARCHAR(500)
          NULL,

        phone VARCHAR(20)
          NULL,

        email VARCHAR(150)
          NULL,

        gstin VARCHAR(30)
          NULL,

        drug_license_number VARCHAR(100)
          NULL,

        logo_url VARCHAR(500)
          NULL,

        currency_code CHAR(3)
          NOT NULL DEFAULT 'INR',

        currency_symbol VARCHAR(10)
          NOT NULL DEFAULT '₹',

        timezone VARCHAR(100)
          NOT NULL DEFAULT 'Asia/Kolkata',

        date_format VARCHAR(30)
          NOT NULL DEFAULT 'DD/MM/YYYY',

        sales_invoice_prefix VARCHAR(20)
          NOT NULL DEFAULT 'SAL',

        purchase_number_prefix VARCHAR(20)
          NOT NULL DEFAULT 'PUR',

        low_stock_threshold INT UNSIGNED
          NOT NULL DEFAULT 10,

        expiry_alert_days INT UNSIGNED
          NOT NULL DEFAULT 30,

        allow_negative_stock BOOLEAN
          NOT NULL DEFAULT FALSE,

        invoice_terms TEXT
          NULL,

        invoice_footer VARCHAR(500)
          NULL,

        version BIGINT UNSIGNED
          NOT NULL DEFAULT 1,

        updated_by BIGINT UNSIGNED
          NULL,

        created_at TIMESTAMP
          NOT NULL DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP
          NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT chk_single_pharmacy_settings
          CHECK (id = 1),

        CONSTRAINT fk_pharmacy_settings_updated_by
          FOREIGN KEY (updated_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      )
    `);

    console.log(
      "✅ pharmacy_settings table created"
    );

    /*
     * Insert the singleton settings record.
     * Existing record থাকলে overwrite হবে না।
     */
    await db.query(
      `
        INSERT INTO pharmacy_settings (
          id,
          pharmacy_name,
          address,
          phone,
          email,
          gstin,
          drug_license_number,
          currency_code,
          currency_symbol,
          timezone,
          date_format,
          sales_invoice_prefix,
          purchase_number_prefix,
          low_stock_threshold,
          expiry_alert_days,
          allow_negative_stock,
          invoice_terms,
          invoice_footer
        )
        VALUES (
          1,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'INR',
          '₹',
          'Asia/Kolkata',
          'DD/MM/YYYY',
          'SAL',
          'PUR',
          10,
          30,
          FALSE,
          ?,
          ?
        )
        ON DUPLICATE KEY UPDATE
          id = VALUES(id)
      `,
      [
        process.env.PHARMACY_NAME ||
          "PharmaERP Pharmacy",

        process.env.PHARMACY_ADDRESS ||
          "Raiganj, Uttar Dinajpur, West Bengal",

        process.env.PHARMACY_PHONE ||
          "9876543210",

        process.env.PHARMACY_EMAIL ||
          "pharmacy@example.com",

        process.env.PHARMACY_GSTIN ||
          null,

        process.env.PHARMACY_DL_NUMBER ||
          null,

        [
          "Please verify medicines, batch and expiry",
          "before leaving the pharmacy.",
          "Returns are subject to pharmacy return policy."
        ].join(" "),

        "This is a computer-generated invoice."
      ]
    );

    console.log(
      "✅ Default pharmacy settings inserted"
    );

    const [settings] = await db.query(`
      SELECT
        id,

        pharmacy_name AS pharmacyName,
        address,
        phone,
        email,
        gstin,

        drug_license_number
          AS drugLicenseNumber,

        currency_code AS currencyCode,
        currency_symbol AS currencySymbol,
        timezone,
        date_format AS dateFormat,

        sales_invoice_prefix
          AS salesInvoicePrefix,

        purchase_number_prefix
          AS purchaseNumberPrefix,

        low_stock_threshold
          AS lowStockThreshold,

        expiry_alert_days
          AS expiryAlertDays,

        allow_negative_stock
          AS allowNegativeStock,

        version,
        updated_by AS updatedBy,
        created_at AS createdAt,
        updated_at AS updatedAt

      FROM pharmacy_settings

      WHERE id = 1
    `);

    console.log(
      "\nCurrent pharmacy settings:"
    );

    console.table(settings);

    console.log(
      "✅ Settings setup completed successfully"
    );
  } catch (error) {
    console.error(
      "❌ Settings setup failed"
    );

    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupSettings();