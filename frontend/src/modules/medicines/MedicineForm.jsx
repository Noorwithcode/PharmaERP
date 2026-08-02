import {
  useEffect,
  useState,
} from "react";

const initialFormState = {
  brandName: "",
  genericName: "",
  categoryId: "",
  manufacturerId: "",
  strength: "",
  dosageForm: "",
  unit: "piece",
  packSize: "",
  barcode: "",
  hsnCode: "",
  gstPercent: "0",
  prescriptionRequired: false,
  reorderLevel: "10",
  storageInstructions: "",
  description: "",
  isActive: true,
};

const MedicineForm = ({
  medicine = null,
  categories = [],
  manufacturers = [],
  saving = false,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] =
    useState(initialFormState);

  const [validationErrors, setValidationErrors] =
    useState({});

  const editing = Boolean(
    medicine?.id ||
    medicine?.medicineId
  );

  useEffect(() => {
    if (!medicine) {
      setFormData(initialFormState);
      setValidationErrors({});
      return;
    }

    setFormData({
      brandName:
        medicine.brandName ||
        medicine.brand_name ||
        "",

      genericName:
        medicine.genericName ||
        medicine.generic_name ||
        "",

      categoryId:
        medicine.categoryId ||
        medicine.category_id ||
        medicine.category?.id ||
        "",

      manufacturerId:
        medicine.manufacturerId ||
        medicine.manufacturer_id ||
        medicine.manufacturer?.id ||
        "",

      strength:
        medicine.strength || "",

      dosageForm:
        medicine.dosageForm ||
        medicine.dosage_form ||
        "",

      unit:
        medicine.unit || "piece",

      packSize:
        medicine.packSize ||
        medicine.pack_size ||
        "",

      barcode:
        medicine.barcode ||
        medicine.barcodeValue ||
        medicine.barcode_value ||
        "",

      hsnCode:
        medicine.hsnCode ||
        medicine.hsn_code ||
        "",

      gstPercent: String(
        medicine.gstPercent ??
        medicine.gst_percent ??
        0
      ),

      prescriptionRequired: Boolean(
        medicine.prescriptionRequired ??
        medicine.prescription_required ??
        false
      ),

      reorderLevel: String(
        medicine.reorderLevel ??
        medicine.reorder_level ??
        10
      ),

      storageInstructions:
        medicine.storageInstructions ||
        medicine.storage_instructions ||
        "",

      description:
        medicine.description || "",

      isActive:
        medicine.isActive === undefined &&
        medicine.is_active === undefined
          ? true
          : Boolean(
              medicine.isActive ??
              medicine.is_active
            ),
    });

    setValidationErrors({});
  }, [medicine]);

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormData((current) => ({
      ...current,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    if (validationErrors[name]) {
      setValidationErrors(
        (current) => ({
          ...current,
          [name]: "",
        })
      );
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.brandName.trim()) {
      errors.brandName =
        "Brand name is required.";
    }

    if (!formData.genericName.trim()) {
      errors.genericName =
        "Generic name is required.";
    }

    if (!formData.categoryId) {
      errors.categoryId =
        "Medicine category is required.";
    }

    if (!formData.manufacturerId) {
      errors.manufacturerId =
        "Manufacturer is required.";
    }

    if (!formData.unit.trim()) {
      errors.unit =
        "Medicine unit is required.";
    }

    const gstPercent = Number(
      formData.gstPercent
    );

    if (
      Number.isNaN(gstPercent) ||
      gstPercent < 0 ||
      gstPercent > 100
    ) {
      errors.gstPercent =
        "GST must be between 0 and 100.";
    }

    const reorderLevel = Number(
      formData.reorderLevel
    );

    if (
      !Number.isInteger(reorderLevel) ||
      reorderLevel < 0
    ) {
      errors.reorderLevel =
        "Reorder level must be zero or a positive integer.";
    }

    setValidationErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      brandName:
        formData.brandName.trim(),

      genericName:
        formData.genericName.trim(),

      categoryId:
        Number(formData.categoryId),

      manufacturerId:
        Number(formData.manufacturerId),

      strength:
        formData.strength.trim() ||
        null,

      dosageForm:
        formData.dosageForm.trim() ||
        null,

      unit:
        formData.unit.trim(),

      packSize:
        formData.packSize.trim() ||
        null,

      barcode:
        formData.barcode.trim() ||
        null,

      hsnCode:
        formData.hsnCode.trim() ||
        null,

      gstPercent:
        Number(formData.gstPercent),

      prescriptionRequired:
        formData.prescriptionRequired,

      reorderLevel:
        Number(formData.reorderLevel),

      storageInstructions:
        formData.storageInstructions.trim() ||
        null,

      description:
        formData.description.trim() ||
        null,

      isActive:
        formData.isActive,
    };

    await onSubmit?.(payload);
  };

  return (
    <form
      className="medicine-form"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="medicine-form-header">
        <div>
          <span className="medicine-form-eyebrow">
            Medicine master
          </span>

          <h2>
            {editing
              ? "Edit medicine"
              : "Add new medicine"}
          </h2>

          <p>
            Enter the medicine's identity,
            classification and tax information.
          </p>
        </div>

        <button
          type="button"
          className="medicine-modal-close"
          onClick={onCancel}
          aria-label="Close medicine form"
          disabled={saving}
        >
          ×
        </button>
      </div>

      <div className="medicine-form-body">
        <section className="medicine-form-section">
          <div className="medicine-section-heading">
            <h3>Basic information</h3>

            <p>
              Medicine name and classification
            </p>
          </div>

          <div className="medicine-form-grid">
            <div className="medicine-field">
              <label htmlFor="brandName">
                Brand name
                <span>*</span>
              </label>

              <input
                id="brandName"
                name="brandName"
                type="text"
                value={formData.brandName}
                onChange={handleChange}
                placeholder="Paracetamol 500"
                disabled={saving}
              />

              {validationErrors.brandName && (
                <small className="medicine-field-error">
                  {validationErrors.brandName}
                </small>
              )}
            </div>

            <div className="medicine-field">
              <label htmlFor="genericName">
                Generic name
                <span>*</span>
              </label>

              <input
                id="genericName"
                name="genericName"
                type="text"
                value={formData.genericName}
                onChange={handleChange}
                placeholder="Paracetamol"
                disabled={saving}
              />

              {validationErrors.genericName && (
                <small className="medicine-field-error">
                  {validationErrors.genericName}
                </small>
              )}
            </div>

            <div className="medicine-field">
              <label htmlFor="categoryId">
                Category
                <span>*</span>
              </label>

              <select
                id="categoryId"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                disabled={saving}
              >
                <option value="">
                  Select category
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name ||
                      category.categoryName ||
                      category.category_name}
                  </option>
                ))}
              </select>

              {validationErrors.categoryId && (
                <small className="medicine-field-error">
                  {validationErrors.categoryId}
                </small>
              )}
            </div>

            <div className="medicine-field">
              <label htmlFor="manufacturerId">
                Manufacturer
                <span>*</span>
              </label>

              <select
                id="manufacturerId"
                name="manufacturerId"
                value={formData.manufacturerId}
                onChange={handleChange}
                disabled={saving}
              >
                <option value="">
                  Select manufacturer
                </option>

                {manufacturers.map(
                  (manufacturer) => (
                    <option
                      key={manufacturer.id}
                      value={manufacturer.id}
                    >
                      {manufacturer.name ||
                        manufacturer.manufacturerName ||
                        manufacturer.manufacturer_name}
                    </option>
                  )
                )}
              </select>

              {validationErrors.manufacturerId && (
                <small className="medicine-field-error">
                  {validationErrors.manufacturerId}
                </small>
              )}
            </div>

            <div className="medicine-field">
              <label htmlFor="strength">
                Strength
              </label>

              <input
                id="strength"
                name="strength"
                type="text"
                value={formData.strength}
                onChange={handleChange}
                placeholder="500 mg"
                disabled={saving}
              />
            </div>

            <div className="medicine-field">
              <label htmlFor="dosageForm">
                Dosage form
              </label>

              <select
                id="dosageForm"
                name="dosageForm"
                value={formData.dosageForm}
                onChange={handleChange}
                disabled={saving}
              >
                <option value="">
                  Select dosage form
                </option>

                <option value="Tablet">
                  Tablet
                </option>

                <option value="Capsule">
                  Capsule
                </option>

                <option value="Syrup">
                  Syrup
                </option>

                <option value="Injection">
                  Injection
                </option>

                <option value="Cream">
                  Cream
                </option>

                <option value="Ointment">
                  Ointment
                </option>

                <option value="Drops">
                  Drops
                </option>

                <option value="Inhaler">
                  Inhaler
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>

            <div className="medicine-field">
              <label htmlFor="unit">
                Unit
                <span>*</span>
              </label>

              <select
                id="unit"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                disabled={saving}
              >
                <option value="piece">
                  Piece
                </option>

                <option value="strip">
                  Strip
                </option>

                <option value="box">
                  Box
                </option>

                <option value="bottle">
                  Bottle
                </option>

                <option value="tube">
                  Tube
                </option>

                <option value="vial">
                  Vial
                </option>

                <option value="ampoule">
                  Ampoule
                </option>

                <option value="pack">
                  Pack
                </option>
              </select>

              {validationErrors.unit && (
                <small className="medicine-field-error">
                  {validationErrors.unit}
                </small>
              )}
            </div>

            <div className="medicine-field">
              <label htmlFor="packSize">
                Pack size
              </label>

              <input
                id="packSize"
                name="packSize"
                type="text"
                value={formData.packSize}
                onChange={handleChange}
                placeholder="10 tablets"
                disabled={saving}
              />
            </div>
          </div>
        </section>

        <section className="medicine-form-section">
          <div className="medicine-section-heading">
            <h3>
              Tax and inventory
            </h3>

            <p>
              Barcode, GST and reorder information
            </p>
          </div>

          <div className="medicine-form-grid">
            <div className="medicine-field">
              <label htmlFor="barcode">
                Barcode
              </label>

              <input
                id="barcode"
                name="barcode"
                type="text"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="8901234567890"
                disabled={saving}
              />
            </div>

            <div className="medicine-field">
              <label htmlFor="hsnCode">
                HSN code
              </label>

              <input
                id="hsnCode"
                name="hsnCode"
                type="text"
                value={formData.hsnCode}
                onChange={handleChange}
                placeholder="30049099"
                disabled={saving}
              />
            </div>

            <div className="medicine-field">
              <label htmlFor="gstPercent">
                GST percentage
              </label>

              <input
                id="gstPercent"
                name="gstPercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.gstPercent}
                onChange={handleChange}
                disabled={saving}
              />

              {validationErrors.gstPercent && (
                <small className="medicine-field-error">
                  {validationErrors.gstPercent}
                </small>
              )}
            </div>

            <div className="medicine-field">
              <label htmlFor="reorderLevel">
                Reorder level
              </label>

              <input
                id="reorderLevel"
                name="reorderLevel"
                type="number"
                min="0"
                step="1"
                value={formData.reorderLevel}
                onChange={handleChange}
                disabled={saving}
              />

              {validationErrors.reorderLevel && (
                <small className="medicine-field-error">
                  {validationErrors.reorderLevel}
                </small>
              )}
            </div>
          </div>
        </section>

        <section className="medicine-form-section">
          <div className="medicine-section-heading">
            <h3>
              Additional information
            </h3>

            <p>
              Storage, prescription and description
            </p>
          </div>

          <div className="medicine-form-grid">
            <div className="medicine-field medicine-field-full">
              <label htmlFor="storageInstructions">
                Storage instructions
              </label>

              <input
                id="storageInstructions"
                name="storageInstructions"
                type="text"
                value={
                  formData.storageInstructions
                }
                onChange={handleChange}
                placeholder="Store below 25°C in a dry place"
                disabled={saving}
              />
            </div>

            <div className="medicine-field medicine-field-full">
              <label htmlFor="description">
                Description
              </label>

              <textarea
                id="description"
                name="description"
                rows="3"
                value={formData.description}
                onChange={handleChange}
                placeholder="Medicine description"
                disabled={saving}
              />
            </div>

            <label className="medicine-checkbox">
              <input
                name="prescriptionRequired"
                type="checkbox"
                checked={
                  formData.prescriptionRequired
                }
                onChange={handleChange}
                disabled={saving}
              />

              <span>
                Prescription required
              </span>
            </label>

            <label className="medicine-checkbox">
              <input
                name="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={handleChange}
                disabled={saving}
              />

              <span>
                Medicine is active
              </span>
            </label>
          </div>
        </section>
      </div>

      <div className="medicine-form-footer">
        <button
          type="button"
          className="medicine-secondary-button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="medicine-primary-button"
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : editing
              ? "Update medicine"
              : "Create medicine"}
        </button>
      </div>
    </form>
  );
};

export default MedicineForm;