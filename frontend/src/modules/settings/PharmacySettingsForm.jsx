import {
  useEffect,
  useMemo,
  useState
} from "react";

const createInitialForm = (
  settings = {}
) => {
  return {
    pharmacyName:
      settings.pharmacyName || "",

    address:
      settings.address || "",

    phone:
      settings.phone || "",

    email:
      settings.email || "",

    gstin:
      settings.gstin || "",

    drugLicenseNumber:
      settings.drugLicenseNumber || "",

    logoUrl:
      settings.logoUrl || "",

    currencyCode:
      settings.currencyCode || "INR",

    currencySymbol:
      settings.currencySymbol || "₹",

    timezone:
      settings.timezone ||
      "Asia/Kolkata",

    dateFormat:
      settings.dateFormat ||
      "DD/MM/YYYY",

    salesInvoicePrefix:
      settings.salesInvoicePrefix ||
      "SAL",

    purchaseNumberPrefix:
      settings.purchaseNumberPrefix ||
      "PUR",

    lowStockThreshold:
      settings.lowStockThreshold ?? 10,

    expiryAlertDays:
      settings.expiryAlertDays ?? 30,

    allowNegativeStock:
      false,

    invoiceTerms:
      settings.invoiceTerms || "",

    invoiceFooter:
      settings.invoiceFooter || "",

    version:
      settings.version || 1
  };
};

const PharmacySettingsForm = ({
  settings,
  saving = false,
  canEdit = true,
  onSubmit
}) => {
  const [formData, setFormData] =
    useState(
      createInitialForm(settings)
    );

  const [validationError, setValidationError] =
    useState("");

  useEffect(() => {
    setFormData(
      createInitialForm(settings)
    );

    setValidationError("");
  }, [settings]);

  const originalForm = useMemo(() => {
    return createInitialForm(settings);
  }, [settings]);

  const isDirty = useMemo(() => {
    return (
      JSON.stringify(formData) !==
      JSON.stringify(originalForm)
    );
  }, [
    formData,
    originalForm
  ]);

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked
    } = event.target;

    setFormData((current) => ({
      ...current,

      [name]:
        type === "checkbox"
          ? checked
          : value
    }));

    if (validationError) {
      setValidationError("");
    }
  };

  const handleReset = () => {
    setFormData(
      createInitialForm(settings)
    );

    setValidationError("");
  };

  const validateForm = () => {
    if (
      !formData.pharmacyName.trim()
    ) {
      return "Pharmacy name is required.";
    }

    if (
      formData.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        formData.email
      )
    ) {
      return "Enter a valid pharmacy email.";
    }

    if (
      Number(
        formData.lowStockThreshold
      ) < 0
    ) {
      return (
        "Low-stock threshold cannot " +
        "be negative."
      );
    }

    if (
      Number(
        formData.expiryAlertDays
      ) < 1
    ) {
      return (
        "Expiry alert days must be " +
        "at least 1."
      );
    }

    return "";
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    const errorMessage =
      validateForm();

    if (errorMessage) {
      setValidationError(
        errorMessage
      );

      return;
    }

    const payload = {
      ...formData,

      pharmacyName:
        formData.pharmacyName.trim(),

      address:
        formData.address.trim(),

      phone:
        formData.phone.trim(),

      email:
        formData.email.trim(),

      gstin:
        formData.gstin
          .trim()
          .toUpperCase(),

      drugLicenseNumber:
        formData.drugLicenseNumber
          .trim(),

      logoUrl:
        formData.logoUrl.trim(),

      salesInvoicePrefix:
        formData.salesInvoicePrefix
          .trim()
          .toUpperCase(),

      purchaseNumberPrefix:
        formData.purchaseNumberPrefix
          .trim()
          .toUpperCase(),

      lowStockThreshold:
        Number(
          formData.lowStockThreshold
        ),

      expiryAlertDays:
        Number(
          formData.expiryAlertDays
        ),

      allowNegativeStock:
        false,

      version:
        Number(formData.version)
    };

    await onSubmit?.(payload);
  };

  return (
    <form
      className="pharmacy-settings-form"
      onSubmit={handleSubmit}
    >
      {validationError && (
        <div className="settings-form-error">
          {validationError}
        </div>
      )}

      {/* Pharmacy profile */}

      <section className="settings-form-section">
        <div className="settings-section-heading">
          <div>
            <span className="settings-eyebrow">
              Business identity
            </span>

            <h2>
              Pharmacy information
            </h2>

            <p>
              These details will appear
              on invoices and reports.
            </p>
          </div>

          <span className="settings-version-badge">
            Version {formData.version}
          </span>
        </div>

        <div className="settings-form-grid">
          <label className="settings-field settings-field-wide">
            <span>
              Pharmacy name *
            </span>

            <input
              type="text"
              name="pharmacyName"
              value={
                formData.pharmacyName
              }
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              maxLength={150}
              placeholder="Pharmacy name"
              required
            />
          </label>

          <label className="settings-field">
            <span>
              Phone number
            </span>

            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              maxLength={20}
              placeholder="9876543210"
            />
          </label>

          <label className="settings-field">
            <span>
              Email address
            </span>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              maxLength={150}
              placeholder="pharmacy@example.com"
            />
          </label>

          <label className="settings-field settings-field-wide">
            <span>
              Pharmacy address
            </span>

            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              rows={3}
              maxLength={500}
              placeholder="Full pharmacy address"
            />
          </label>

          <label className="settings-field">
            <span>GSTIN</span>

            <input
              type="text"
              name="gstin"
              value={formData.gstin}
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              maxLength={15}
              placeholder="19ABCDE1234F1Z5"
            />
          </label>

          <label className="settings-field">
            <span>
              Drug licence number
            </span>

            <input
              type="text"
              name="drugLicenseNumber"
              value={
                formData
                  .drugLicenseNumber
              }
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              maxLength={100}
              placeholder="Drug licence number"
            />
          </label>

          <label className="settings-field settings-field-wide">
            <span>
              Pharmacy logo URL
            </span>

            <input
              type="text"
              name="logoUrl"
              value={formData.logoUrl}
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              maxLength={500}
              placeholder="https://example.com/logo.png"
            />
          </label>
        </div>
      </section>

      {/* Regional settings */}

      <section className="settings-form-section">
        <div className="settings-section-heading">
          <div>
            <span className="settings-eyebrow">
              Regional preferences
            </span>

            <h2>
              Currency and date
            </h2>

            <p>
              Formatting used across
              PharmaERP.
            </p>
          </div>
        </div>

        <div className="settings-form-grid settings-form-grid-three">
          <label className="settings-field">
            <span>Currency</span>

            <input
              type="text"
              value={`${formData.currencyCode} (${formData.currencySymbol})`}
              disabled
            />
          </label>

          <label className="settings-field">
            <span>Timezone</span>

            <select
              name="timezone"
              value={formData.timezone}
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
            >
              <option value="Asia/Kolkata">
                Asia/Kolkata
              </option>

              <option value="UTC">
                UTC
              </option>
            </select>
          </label>

          <label className="settings-field">
            <span>Date format</span>

            <select
              name="dateFormat"
              value={
                formData.dateFormat
              }
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
            >
              <option value="DD/MM/YYYY">
                DD/MM/YYYY
              </option>

              <option value="DD-MM-YYYY">
                DD-MM-YYYY
              </option>

              <option value="YYYY-MM-DD">
                YYYY-MM-DD
              </option>
            </select>
          </label>
        </div>
      </section>

      {/* Invoice settings */}

      <section className="settings-form-section">
        <div className="settings-section-heading">
          <div>
            <span className="settings-eyebrow">
              Document settings
            </span>

            <h2>
              Invoice preferences
            </h2>

            <p>
              Configure invoice numbers,
              terms and footer.
            </p>
          </div>
        </div>

        <div className="settings-form-grid">
          <label className="settings-field">
            <span>
              Sales invoice prefix
            </span>

            <input
              type="text"
              name="salesInvoicePrefix"
              value={
                formData
                  .salesInvoicePrefix
              }
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              maxLength={20}
              placeholder="SAL"
            />
          </label>

          <label className="settings-field">
            <span>
              Purchase number prefix
            </span>

            <input
              type="text"
              name="purchaseNumberPrefix"
              value={
                formData
                  .purchaseNumberPrefix
              }
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              maxLength={20}
              placeholder="PUR"
            />
          </label>

          <label className="settings-field settings-field-wide">
            <span>Invoice terms</span>

            <textarea
              name="invoiceTerms"
              value={
                formData.invoiceTerms
              }
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              rows={4}
              maxLength={5000}
              placeholder="Invoice terms and conditions"
            />
          </label>

          <label className="settings-field settings-field-wide">
            <span>Invoice footer</span>

            <textarea
              name="invoiceFooter"
              value={
                formData.invoiceFooter
              }
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              rows={2}
              maxLength={500}
              placeholder="Invoice footer message"
            />
          </label>
        </div>
      </section>

      {/* Inventory rules */}

      <section className="settings-form-section">
        <div className="settings-section-heading">
          <div>
            <span className="settings-eyebrow">
              Inventory control
            </span>

            <h2>
              Stock and expiry alerts
            </h2>

            <p>
              Configure system-wide
              inventory alert values.
            </p>
          </div>
        </div>

        <div className="settings-form-grid settings-form-grid-three">
          <label className="settings-field">
            <span>
              Low-stock threshold
            </span>

            <input
              type="number"
              name="lowStockThreshold"
              value={
                formData
                  .lowStockThreshold
              }
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              min={0}
              max={100000}
            />
          </label>

          <label className="settings-field">
            <span>
              Expiry alert days
            </span>

            <input
              type="number"
              name="expiryAlertDays"
              value={
                formData
                  .expiryAlertDays
              }
              onChange={handleChange}
              disabled={
                !canEdit || saving
              }
              min={1}
              max={3650}
            />
          </label>

          <div className="settings-safety-card">
            <div>
              <strong>
                Negative stock
              </strong>

              <p>
                Disabled permanently for
                inventory safety.
              </p>
            </div>

            <span className="settings-safety-status">
              Disabled
            </span>
          </div>
        </div>
      </section>

      <div className="settings-form-actions">
        {!canEdit && (
          <p className="settings-readonly-message">
            You have read-only access
            to these settings.
          </p>
        )}

        <button
          type="button"
          className="settings-secondary-button"
          onClick={handleReset}
          disabled={
            saving || !isDirty
          }
        >
          Reset changes
        </button>

        <button
          type="submit"
          className="settings-primary-button"
          disabled={
            saving ||
            !canEdit ||
            !isDirty
          }
        >
          {saving
            ? "Saving settings..."
            : "Save settings"}
        </button>
      </div>
    </form>
  );
};

export default PharmacySettingsForm;