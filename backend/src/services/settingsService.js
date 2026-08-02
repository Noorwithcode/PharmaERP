const db = require("../config/db");

const settingsRepository = require(
  "../repositories/settingsRepository"
);

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
};

const hasOwnProperty = (
  object,
  property
) => {
  return Object.prototype.hasOwnProperty.call(
    object,
    property
  );
};

const normalizeOptionalText = (
  value,
  maximumLength,
  fieldName
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalizedValue =
    String(value).trim();

  if (!normalizedValue) {
    return null;
  }

  if (
    normalizedValue.length >
    maximumLength
  ) {
    throw createError(
      `${fieldName} cannot exceed ` +
      `${maximumLength} characters.`
    );
  }

  return normalizedValue;
};

const normalizeRequiredText = (
  value,
  maximumLength,
  fieldName
) => {
  const normalizedValue =
    String(value || "").trim();

  if (!normalizedValue) {
    throw createError(
      `${fieldName} is required.`
    );
  }

  if (
    normalizedValue.length >
    maximumLength
  ) {
    throw createError(
      `${fieldName} cannot exceed ` +
      `${maximumLength} characters.`
    );
  }

  return normalizedValue;
};

const normalizePositiveInteger = ({
  value,
  fieldName,
  minimum = 0,
  maximum = 100000
}) => {
  const numberValue = Number(value);

  if (
    !Number.isInteger(numberValue) ||
    numberValue < minimum ||
    numberValue > maximum
  ) {
    throw createError(
      `${fieldName} must be an integer ` +
      `between ${minimum} and ${maximum}.`
    );
  }

  return numberValue;
};

const validateEmail = (email) => {
  if (!email) {
    return null;
  }

  const normalizedEmail =
    String(email)
      .trim()
      .toLowerCase();

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    !emailPattern.test(normalizedEmail)
  ) {
    throw createError(
      "A valid pharmacy email is required."
    );
  }

  if (normalizedEmail.length > 150) {
    throw createError(
      "Pharmacy email cannot exceed 150 characters."
    );
  }

  return normalizedEmail;
};

const validatePhone = (phone) => {
  if (!phone) {
    return null;
  }

  const normalizedPhone =
    String(phone).trim();

  const phonePattern =
    /^[0-9+\-\s()]{7,20}$/;

  if (
    !phonePattern.test(normalizedPhone)
  ) {
    throw createError(
      "A valid pharmacy phone number is required."
    );
  }

  return normalizedPhone;
};

const validateGstin = (gstin) => {
  if (!gstin) {
    return null;
  }

  const normalizedGstin =
    String(gstin)
      .trim()
      .toUpperCase();

  const gstinPattern =
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

  if (
    !gstinPattern.test(normalizedGstin)
  ) {
    throw createError(
      "A valid 15-character GSTIN is required."
    );
  }

  return normalizedGstin;
};

const validatePrefix = (
  prefix,
  fieldName
) => {
  const normalizedPrefix =
    String(prefix || "")
      .trim()
      .toUpperCase();

  if (!normalizedPrefix) {
    throw createError(
      `${fieldName} is required.`
    );
  }

  if (
    normalizedPrefix.length > 20
  ) {
    throw createError(
      `${fieldName} cannot exceed 20 characters.`
    );
  }

  const prefixPattern =
    /^[A-Z0-9_-]+$/;

  if (
    !prefixPattern.test(
      normalizedPrefix
    )
  ) {
    throw createError(
      `${fieldName} can contain only ` +
      "letters, numbers, hyphens and underscores."
    );
  }

  return normalizedPrefix;
};

const validateDateFormat = (
  dateFormat
) => {
  const allowedFormats = [
    "DD/MM/YYYY",
    "DD-MM-YYYY",
    "YYYY-MM-DD"
  ];

  const normalizedFormat =
    String(dateFormat || "").trim();

  if (
    !allowedFormats.includes(
      normalizedFormat
    )
  ) {
    throw createError(
      `Invalid date format. Allowed formats: ` +
      `${allowedFormats.join(", ")}.`
    );
  }

  return normalizedFormat;
};

const validateTimezone = (
  timezone
) => {
  const allowedTimezones = [
    "Asia/Kolkata",
    "UTC"
  ];

  const normalizedTimezone =
    String(timezone || "").trim();

  if (
    !allowedTimezones.includes(
      normalizedTimezone
    )
  ) {
    throw createError(
      `Invalid timezone. Allowed timezones: ` +
      `${allowedTimezones.join(", ")}.`
    );
  }

  return normalizedTimezone;
};

/**
 * Get current pharmacy settings
 */
const getSettings = async () => {
  const settings =
    await settingsRepository.getSettings();

  if (!settings) {
    throw createError(
      "Pharmacy settings have not been configured.",
      404
    );
  }

  return settings;
};

/**
 * Validate and update pharmacy settings
 */
const updateSettings = async (
  payload,
  userId
) => {
  const normalizedUserId =
    Number(userId);

  if (
    !Number.isInteger(
      normalizedUserId
    ) ||
    normalizedUserId <= 0
  ) {
    throw createError(
      "Valid authenticated user ID is required.",
      401
    );
  }

  const submittedVersion =
    Number(payload.version);

  if (
    !Number.isInteger(
      submittedVersion
    ) ||
    submittedVersion <= 0
  ) {
    throw createError(
      "A valid settings version is required."
    );
  }

  const connection =
    await db.getConnection();

  let transactionStarted = false;

  try {
    await connection.beginTransaction();

    transactionStarted = true;

    const currentSettings =
      await settingsRepository
        .getSettingsForUpdate(connection);

    if (!currentSettings) {
      throw createError(
        "Pharmacy settings have not been configured.",
        404
      );
    }

    /*
     * The frontend must submit the version
     * received from the latest GET request.
     */
    if (
      submittedVersion !==
      currentSettings.version
    ) {
      throw createError(
        "Settings were updated by another user. " +
        "Refresh the page and try again.",
        409
      );
    }

    const getValue = (
      propertyName
    ) => {
      if (
        hasOwnProperty(
          payload,
          propertyName
        )
      ) {
        return payload[propertyName];
      }

      return currentSettings[
        propertyName
      ];
    };

    /*
     * PharmaERP business rule:
     * negative stock must always remain disabled.
     */
    const requestedNegativeStock =
      getValue("allowNegativeStock");

    if (
      requestedNegativeStock === true ||
      requestedNegativeStock === 1 ||
      requestedNegativeStock === "1" ||
      String(
        requestedNegativeStock
      ).toLowerCase() === "true"
    ) {
      throw createError(
        "Negative stock cannot be enabled."
      );
    }

    const updatedSettings = {
      pharmacyName:
        normalizeRequiredText(
          getValue("pharmacyName"),
          150,
          "Pharmacy name"
        ),

      address:
        normalizeOptionalText(
          getValue("address"),
          500,
          "Address"
        ),

      phone:
        validatePhone(
          getValue("phone")
        ),

      email:
        validateEmail(
          getValue("email")
        ),

      gstin:
        validateGstin(
          getValue("gstin")
        ),

      drugLicenseNumber:
        normalizeOptionalText(
          getValue(
            "drugLicenseNumber"
          ),
          100,
          "Drug licence number"
        ),

      logoUrl:
        normalizeOptionalText(
          getValue("logoUrl"),
          500,
          "Logo URL"
        ),

      currencyCode:
        "INR",

      currencySymbol:
        "₹",

      timezone:
        validateTimezone(
          getValue("timezone")
        ),

      dateFormat:
        validateDateFormat(
          getValue("dateFormat")
        ),

      salesInvoicePrefix:
        validatePrefix(
          getValue(
            "salesInvoicePrefix"
          ),
          "Sales invoice prefix"
        ),

      purchaseNumberPrefix:
        validatePrefix(
          getValue(
            "purchaseNumberPrefix"
          ),
          "Purchase number prefix"
        ),

      lowStockThreshold:
        normalizePositiveInteger({
          value:
            getValue(
              "lowStockThreshold"
            ),

          fieldName:
            "Low-stock threshold",

          minimum: 0,
          maximum: 100000
        }),

      expiryAlertDays:
        normalizePositiveInteger({
          value:
            getValue(
              "expiryAlertDays"
            ),

          fieldName:
            "Expiry alert days",

          minimum: 1,
          maximum: 3650
        }),

      allowNegativeStock:
        false,

      invoiceTerms:
        normalizeOptionalText(
          getValue("invoiceTerms"),
          5000,
          "Invoice terms"
        ),

      invoiceFooter:
        normalizeOptionalText(
          getValue("invoiceFooter"),
          500,
          "Invoice footer"
        )
    };

    const result =
      await settingsRepository
        .updateSettings({
          settings:
            updatedSettings,

          updatedBy:
            normalizedUserId,

          expectedVersion:
            currentSettings.version,

          connection
        });

    if (
      result.affectedRows !== 1
    ) {
      throw createError(
        "Settings update conflict detected. " +
        "Refresh the page and try again.",
        409
      );
    }

    await connection.commit();

    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    throw error;
  } finally {
    connection.release();
  }

  return settingsRepository.getSettings();
};

module.exports = {
  getSettings,
  updateSettings
};