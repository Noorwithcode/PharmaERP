const MedicineTable = ({
  medicines = [],
  loading = false,
  error = "",
  onView,
  onEdit,
  onToggleStatus,
}) => {
  const getMedicineName = (
    medicine
  ) => {
    return (
      medicine.brandName ||
      medicine.brand_name ||
      medicine.name ||
      "Unnamed medicine"
    );
  };

  const getGenericName = (
    medicine
  ) => {
    return (
      medicine.genericName ||
      medicine.generic_name ||
      "Not specified"
    );
  };

  const getCategoryName = (
    medicine
  ) => {
    return (
      medicine.categoryName ||
      medicine.category_name ||
      medicine.category?.name ||
      "Not assigned"
    );
  };

  const getManufacturerName = (
    medicine
  ) => {
    return (
      medicine.manufacturerName ||
      medicine.manufacturer_name ||
      medicine.manufacturer?.name ||
      "Not assigned"
    );
  };

  const isMedicineActive = (
    medicine
  ) => {
    const value =
      medicine.isActive ??
      medicine.is_active;

    return (
      value === true ||
      value === 1 ||
      value === "1"
    );
  };

  if (loading) {
    return (
      <section className="medicine-table-card">
        <div className="medicine-table-state">
          <div className="medicine-loader" />

          <strong>
            Loading medicines
          </strong>

          <p>
            Please wait while medicine
            records are being loaded.
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="medicine-table-card">
        <div className="medicine-table-state medicine-error-state">
          <strong>
            Unable to load medicines
          </strong>

          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (
    !Array.isArray(
      medicines
    ) ||
    medicines.length === 0
  ) {
    return (
      <section className="medicine-table-card">
        <div className="medicine-table-state medicine-empty-state">
          <div className="medicine-empty-icon">
            Rx
          </div>

          <strong>
            No medicines found
          </strong>

          <p>
            Add a medicine or change
            the search filters.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="medicine-table-card">
      <div className="medicine-table-wrapper">
        <table className="medicine-table">
          <thead>
            <tr>
              <th>
                Medicine
              </th>

              <th>
                SKU / Barcode
              </th>

              <th>
                Category
              </th>

              <th>
                Manufacturer
              </th>

              <th>
                GST
              </th>

              <th>
                Reorder level
              </th>

              <th>
                Status
              </th>

              <th className="medicine-actions-heading">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {medicines.map(
              (medicine) => {
                const medicineId =
                  medicine.id ||
                  medicine
                    .medicineId ||
                  medicine
                    .medicine_id;

                const active =
                  isMedicineActive(
                    medicine
                  );

                const gstPercent =
                  Number(
                    medicine
                      .gstPercent ??
                    medicine
                      .gst_percent ??
                    0
                  );

                const reorderLevel =
                  Number(
                    medicine
                      .reorderLevel ??
                    medicine
                      .reorder_level ??
                    0
                  );

                const barcode =
                  medicine
                    .barcodeValue ||
                  medicine
                    .barcode_value ||
                  medicine
                    .barcode ||
                  "Not assigned";

                return (
                  <tr
                    key={
                      medicineId
                    }
                  >
                    <td>
                      <div className="medicine-name-cell">
                        <div className="medicine-avatar">
                          {getMedicineName(
                            medicine
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {getMedicineName(
                              medicine
                            )}
                          </strong>

                          <span>
                            {getGenericName(
                              medicine
                            )}

                            {medicine
                              .strength
                              ? ` • ${medicine.strength}`
                              : ""}
                          </span>

                          <small>
                            {medicine
                              .dosageForm ||
                              medicine
                                .dosage_form ||
                              medicine
                                .unit ||
                              "Medicine"}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="medicine-code-cell">
                        <strong>
                          {medicine
                            .sku ||
                            "No SKU"}
                        </strong>

                        <span>
                          {barcode}
                        </span>
                      </div>
                    </td>

                    <td>
                      {getCategoryName(
                        medicine
                      )}
                    </td>

                    <td>
                      {getManufacturerName(
                        medicine
                      )}
                    </td>

                    <td>
                      {gstPercent
                        .toFixed(2)}
                      %
                    </td>

                    <td>
                      {reorderLevel}
                    </td>

                    <td>
                      <span
                        className={
                          `medicine-status ${
                            active
                              ? "is-active"
                              : "is-inactive"
                          }`
                        }
                      >
                        {active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="medicine-table-actions">
                        <button
                          type="button"
                          className="medicine-action-button view"
                          onClick={() =>
                            onView?.(
                              medicine
                            )
                          }
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="medicine-action-button edit"
                          onClick={() =>
                            onEdit?.(
                              medicine
                            )
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className={
                            `medicine-action-button ${
                              active
                                ? "deactivate"
                                : "activate"
                            }`
                          }
                          onClick={() =>
                            onToggleStatus?.(
                              medicine,
                              !active
                            )
                          }
                        >
                          {active
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MedicineTable;