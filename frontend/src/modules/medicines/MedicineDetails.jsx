const MedicineDetails = ({
  medicine,
  onClose,
  onEdit,
}) => {
  if (!medicine) {
    return null;
  }

  const valueOf = (
    camelCaseKey,
    snakeCaseKey,
    fallback = "Not specified"
  ) => {
    const value =
      medicine[camelCaseKey] ??
      medicine[snakeCaseKey];

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback;
    }

    return value;
  };

  const getBoolean = (
    camelCaseKey,
    snakeCaseKey
  ) => {
    const value =
      medicine[camelCaseKey] ??
      medicine[snakeCaseKey];

    return (
      value === true ||
      value === 1 ||
      value === "1"
    );
  };

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "Not available";
    }

    const date = new Date(dateValue);

    if (
      Number.isNaN(date.getTime())
    ) {
      return dateValue;
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const brandName = valueOf(
    "brandName",
    "brand_name",
    "Unnamed medicine"
  );

  const genericName = valueOf(
    "genericName",
    "generic_name"
  );

  const categoryName =
    medicine.categoryName ||
    medicine.category_name ||
    medicine.category?.name ||
    "Not assigned";

  const manufacturerName =
    medicine.manufacturerName ||
    medicine.manufacturer_name ||
    medicine.manufacturer?.name ||
    "Not assigned";

  const barcode =
    medicine.barcodeValue ||
    medicine.barcode_value ||
    medicine.barcode ||
    "Not assigned";

  const isActive = getBoolean(
    "isActive",
    "is_active"
  );

  const prescriptionRequired =
    getBoolean(
      "prescriptionRequired",
      "prescription_required"
    );

  return (
    <div className="medicine-details">
      <div className="medicine-details-header">
        <div className="medicine-details-identity">
          <div className="medicine-details-avatar">
            {String(brandName)
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <span className="medicine-form-eyebrow">
              Medicine details
            </span>

            <h2>{brandName}</h2>

            <p>
              {genericName}

              {medicine.strength
                ? ` • ${medicine.strength}`
                : ""}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="medicine-modal-close"
          onClick={onClose}
          aria-label="Close medicine details"
        >
          ×
        </button>
      </div>

      <div className="medicine-details-body">
        <div className="medicine-details-summary">
          <div className="medicine-summary-card">
            <span>Status</span>

            <strong
              className={
                isActive
                  ? "summary-active"
                  : "summary-inactive"
              }
            >
              {isActive
                ? "Active"
                : "Inactive"}
            </strong>
          </div>

          <div className="medicine-summary-card">
            <span>GST rate</span>

            <strong>
              {Number(
                valueOf(
                  "gstPercent",
                  "gst_percent",
                  0
                )
              ).toFixed(2)}
              %
            </strong>
          </div>

          <div className="medicine-summary-card">
            <span>Reorder level</span>

            <strong>
              {valueOf(
                "reorderLevel",
                "reorder_level",
                0
              )}
            </strong>
          </div>

          <div className="medicine-summary-card">
            <span>Prescription</span>

            <strong>
              {prescriptionRequired
                ? "Required"
                : "Not required"}
            </strong>
          </div>
        </div>

        <section className="medicine-details-section">
          <div className="medicine-section-heading">
            <h3>Identification</h3>

            <p>
              Medicine identification and codes
            </p>
          </div>

          <div className="medicine-details-grid">
            <div className="medicine-detail-item">
              <span>Medicine ID</span>

              <strong>
                {medicine.id ||
                  medicine.medicineId ||
                  "Not available"}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>SKU</span>

              <strong>
                {medicine.sku ||
                  "Not assigned"}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>Barcode</span>

              <strong>{barcode}</strong>
            </div>

            <div className="medicine-detail-item">
              <span>Barcode type</span>

              <strong>
                {valueOf(
                  "barcodeType",
                  "barcode_type",
                  "CODE128"
                )}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>HSN code</span>

              <strong>
                {valueOf(
                  "hsnCode",
                  "hsn_code"
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="medicine-details-section">
          <div className="medicine-section-heading">
            <h3>Classification</h3>

            <p>
              Category, manufacturer and dosage
            </p>
          </div>

          <div className="medicine-details-grid">
            <div className="medicine-detail-item">
              <span>Brand name</span>

              <strong>{brandName}</strong>
            </div>

            <div className="medicine-detail-item">
              <span>Generic name</span>

              <strong>
                {genericName}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>Category</span>

              <strong>
                {categoryName}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>Manufacturer</span>

              <strong>
                {manufacturerName}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>Strength</span>

              <strong>
                {medicine.strength ||
                  "Not specified"}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>Dosage form</span>

              <strong>
                {valueOf(
                  "dosageForm",
                  "dosage_form"
                )}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>Unit</span>

              <strong>
                {medicine.unit ||
                  "Not specified"}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>Pack size</span>

              <strong>
                {valueOf(
                  "packSize",
                  "pack_size"
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="medicine-details-section">
          <div className="medicine-section-heading">
            <h3>
              Storage and description
            </h3>

            <p>
              Additional medicine information
            </p>
          </div>

          <div className="medicine-details-grid">
            <div className="medicine-detail-item medicine-detail-wide">
              <span>
                Storage instructions
              </span>

              <strong>
                {valueOf(
                  "storageInstructions",
                  "storage_instructions"
                )}
              </strong>
            </div>

            <div className="medicine-detail-item medicine-detail-wide">
              <span>Description</span>

              <strong>
                {medicine.description ||
                  "No description available"}
              </strong>
            </div>
          </div>
        </section>

        <section className="medicine-details-section">
          <div className="medicine-section-heading">
            <h3>Audit information</h3>

            <p>
              Record creation and update details
            </p>
          </div>

          <div className="medicine-details-grid">
            <div className="medicine-detail-item">
              <span>Created by</span>

              <strong>
                {valueOf(
                  "createdByName",
                  "created_by_name",
                  valueOf(
                    "createdBy",
                    "created_by",
                    "Not available"
                  )
                )}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>Created at</span>

              <strong>
                {formatDate(
                  medicine.createdAt ||
                  medicine.created_at
                )}
              </strong>
            </div>

            <div className="medicine-detail-item">
              <span>Updated at</span>

              <strong>
                {formatDate(
                  medicine.updatedAt ||
                  medicine.updated_at
                )}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <div className="medicine-details-footer">
        <button
          type="button"
          className="medicine-secondary-button"
          onClick={onClose}
        >
          Close
        </button>

        <button
          type="button"
          className="medicine-primary-button"
          onClick={() =>
            onEdit?.(medicine)
          }
        >
          Edit medicine
        </button>
      </div>
    </div>
  );
};

export default MedicineDetails;