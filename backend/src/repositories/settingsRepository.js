const db = require("../config/db");

const mapSettingsRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),

    pharmacyName:
      row.pharmacyName,

    address:
      row.address,

    phone:
      row.phone,

    email:
      row.email,

    gstin:
      row.gstin,

    drugLicenseNumber:
      row.drugLicenseNumber,

    logoUrl:
      row.logoUrl,

    currencyCode:
      row.currencyCode,

    currencySymbol:
      row.currencySymbol,

    timezone:
      row.timezone,

    dateFormat:
      row.dateFormat,

    salesInvoicePrefix:
      row.salesInvoicePrefix,

    purchaseNumberPrefix:
      row.purchaseNumberPrefix,

    lowStockThreshold:
      Number(row.lowStockThreshold),

    expiryAlertDays:
      Number(row.expiryAlertDays),

    allowNegativeStock:
      Boolean(row.allowNegativeStock),

    invoiceTerms:
      row.invoiceTerms,

    invoiceFooter:
      row.invoiceFooter,

    version:
      Number(row.version),

    updatedBy:
      row.updatedBy
        ? Number(row.updatedBy)
        : null,

    createdAt:
      row.createdAt,

    updatedAt:
      row.updatedAt
  };
};

const settingsSelectQuery = `
  SELECT
    id,

    pharmacy_name AS pharmacyName,
    address,
    phone,
    email,
    gstin,

    drug_license_number
      AS drugLicenseNumber,

    logo_url AS logoUrl,

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

    invoice_terms AS invoiceTerms,
    invoice_footer AS invoiceFooter,

    version,

    updated_by AS updatedBy,

    created_at AS createdAt,
    updated_at AS updatedAt

  FROM pharmacy_settings

  WHERE id = 1
`;

/**
 * Get current pharmacy settings
 */
const getSettings = async (
  executor = db
) => {
  const [rows] = await executor.query(
    settingsSelectQuery
  );

  return mapSettingsRow(rows[0]);
};

/**
 * Lock settings row inside a transaction.
 *
 * This prevents two administrators from
 * overwriting each other's settings update.
 */
const getSettingsForUpdate = async (
  connection
) => {
  const [rows] = await connection.query(
    `${settingsSelectQuery} FOR UPDATE`
  );

  return mapSettingsRow(rows[0]);
};

/**
 * Update the singleton pharmacy settings row.
 *
 * expectedVersion ensures optimistic
 * concurrency protection.
 */
const updateSettings = async ({
  settings,
  updatedBy,
  expectedVersion,
  connection
}) => {
  const [result] = await connection.query(
    `
      UPDATE pharmacy_settings

      SET
        pharmacy_name = ?,
        address = ?,
        phone = ?,
        email = ?,
        gstin = ?,
        drug_license_number = ?,
        logo_url = ?,

        currency_code = ?,
        currency_symbol = ?,
        timezone = ?,
        date_format = ?,

        sales_invoice_prefix = ?,
        purchase_number_prefix = ?,

        low_stock_threshold = ?,
        expiry_alert_days = ?,

        allow_negative_stock = ?,

        invoice_terms = ?,
        invoice_footer = ?,

        updated_by = ?,
        version = version + 1

      WHERE id = 1
        AND version = ?
    `,
    [
      settings.pharmacyName,
      settings.address,
      settings.phone,
      settings.email,
      settings.gstin,
      settings.drugLicenseNumber,
      settings.logoUrl,

      settings.currencyCode,
      settings.currencySymbol,
      settings.timezone,
      settings.dateFormat,

      settings.salesInvoicePrefix,
      settings.purchaseNumberPrefix,

      settings.lowStockThreshold,
      settings.expiryAlertDays,

      settings.allowNegativeStock
        ? 1
        : 0,

      settings.invoiceTerms,
      settings.invoiceFooter,

      updatedBy,
      expectedVersion
    ]
  );

  return {
    affectedRows:
      Number(result.affectedRows),

    changedRows:
      Number(result.changedRows)
  };
};

module.exports = {
  getSettings,
  getSettingsForUpdate,
  updateSettings
};