const moneyFormatter =
  new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );

const formatMoney = (value) => {
  const amount = Number(value);

  return moneyFormatter.format(
    Number.isFinite(amount)
      ? amount
      : 0
  );
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
};

const getBatchId = (batch) => {
  return (
    batch.id ||
    batch.batchId ||
    batch.batch_id
  );
};

const getAvailableQuantity = (
  batch
) => {
  return Number(
    batch.quantityAvailable ??
    batch.quantity_available ??
    batch.availableStock ??
    batch.available_stock ??
    batch.currentStock ??
    batch.current_stock ??
    0
  );
};

const getExpiryStatus = (batch) => {
  const expiryValue =
    batch.expiryDate ||
    batch.expiry_date;

  if (!expiryValue) {
    return {
      label: "Unknown",
      className: "unknown",
    };
  }

  const expiryDate =
    new Date(expiryValue);

  if (
    Number.isNaN(
      expiryDate.getTime()
    )
  ) {
    return {
      label: "Unknown",
      className: "unknown",
    };
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  const differenceInDays =
    Math.ceil(
      (
        expiryDate.getTime() -
        today.getTime()
      ) /
      (24 * 60 * 60 * 1000)
    );

  if (differenceInDays < 0) {
    return {
      label: "Expired",
      className: "expired",
    };
  }

  if (differenceInDays <= 30) {
    return {
      label: `${differenceInDays} days`,
      className: "expiring",
    };
  }

  return {
    label: "Valid",
    className: "valid",
  };
};

const getStockStatus = (
  quantity
) => {
  if (quantity <= 0) {
    return {
      label: "Out of stock",
      className: "out",
    };
  }

  if (quantity <= 10) {
    return {
      label: "Low stock",
      className: "low",
    };
  }

  return {
    label: "In stock",
    className: "available",
  };
};

const StockTable = ({
  batches = [],
  loading = false,
  error = "",
  onView,
}) => {
  if (loading) {
    return (
      <div className="stock-table-state">
        <div className="stock-loader" />

        <p>Loading stock batches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stock-table-state stock-error-state">
        <strong>
          Unable to load stock
        </strong>

        <p>{error}</p>
      </div>
    );
  }

  if (
    !Array.isArray(batches) ||
    batches.length === 0
  ) {
    return (
      <div className="stock-table-state">
        <div className="stock-empty-icon">
          ST
        </div>

        <strong>
          No stock batches found
        </strong>

        <p>
          Change the filters or create a
          medicine purchase.
        </p>
      </div>
    );
  }

  return (
    <div className="stock-table-wrapper">
      <table className="stock-table">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Batch</th>
            <th>Expiry</th>
            <th>Available</th>
            <th>Purchase price</th>
            <th>MRP</th>
            <th>Selling price</th>
            <th>Stock status</th>
            <th>Batch status</th>
            <th className="stock-actions-heading">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {batches.map((batch) => {
            const batchId =
              getBatchId(batch);

            const quantity =
              getAvailableQuantity(
                batch
              );

            const stockStatus =
              getStockStatus(quantity);

            const expiryStatus =
              getExpiryStatus(batch);

            const isActiveValue =
              batch.isActive ??
              batch.is_active;

            const isActive =
              isActiveValue === true ||
              isActiveValue === 1 ||
              isActiveValue === "1";

            const medicineName =
              batch.brandName ||
              batch.brand_name ||
              batch.medicineName ||
              batch.medicine_name ||
              batch.medicine?.brandName ||
              "Unknown medicine";

            const genericName =
              batch.genericName ||
              batch.generic_name ||
              batch.medicine?.genericName ||
              "";

            const strength =
              batch.strength ||
              batch.medicine?.strength ||
              "";

            const batchNumber =
              batch.batchNumber ||
              batch.batch_number ||
              "-";

            return (
              <tr key={batchId}>
                <td>
                  <div className="stock-medicine-cell">
                    <div className="stock-medicine-avatar">
                      {medicineName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div>
                      <strong>
                        {medicineName}
                      </strong>

                      <span>
                        {genericName}

                        {strength
                          ? ` • ${strength}`
                          : ""}
                      </span>

                      <small>
                        {batch.sku ||
                          "No SKU"}
                      </small>
                    </div>
                  </div>
                </td>

                <td>
                  <div className="stock-batch-cell">
                    <strong>
                      {batchNumber}
                    </strong>

                    <span>
                      ID: {batchId}
                    </span>
                  </div>
                </td>

                <td>
                  <div className="stock-expiry-cell">
                    <strong>
                      {formatDate(
                        batch.expiryDate ||
                        batch.expiry_date
                      )}
                    </strong>

                    <span
                      className={`stock-expiry-status ${expiryStatus.className}`}
                    >
                      {expiryStatus.label}
                    </span>
                  </div>
                </td>

                <td>
                  <strong className="stock-quantity">
                    {quantity}
                  </strong>
                </td>

                <td>
                  {formatMoney(
                    batch.purchasePrice ??
                    batch.purchase_price
                  )}
                </td>

                <td>
                  {formatMoney(
                    batch.mrp
                  )}
                </td>

                <td>
                  {formatMoney(
                    batch.sellingPrice ??
                    batch.selling_price
                  )}
                </td>

                <td>
                  <span
                    className={`stock-status ${stockStatus.className}`}
                  >
                    {stockStatus.label}
                  </span>
                </td>

                <td>
                  <span
                    className={`stock-status ${
                      isActive
                        ? "active"
                        : "inactive"
                    }`}
                  >
                    {isActive
                      ? "Active"
                      : "Inactive"}
                  </span>
                </td>

                <td>
                  <button
                    type="button"
                    className="stock-view-button"
                    onClick={() =>
                      onView?.(batch)
                    }
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default StockTable;