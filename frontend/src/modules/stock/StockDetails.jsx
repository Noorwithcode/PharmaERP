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
  const number = Number(value);

  return moneyFormatter.format(
    Number.isFinite(number)
      ? number
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

const getValue = (
  object,
  camelKey,
  snakeKey,
  fallback = "-"
) => {
  const value =
    object?.[camelKey] ??
    object?.[snakeKey];

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
  object,
  camelKey,
  snakeKey
) => {
  const value =
    object?.[camelKey] ??
    object?.[snakeKey];

  return (
    value === true ||
    value === 1 ||
    value === "1"
  );
};

const StockDetails = ({
  batch,
  onClose,
}) => {
  if (!batch) {
    return null;
  }

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
    "-";

  const batchId =
    batch.id ||
    batch.batchId ||
    batch.batch_id;

  const batchNumber =
    getValue(
      batch,
      "batchNumber",
      "batch_number"
    );

  const quantityReceived =
    Number(
      getValue(
        batch,
        "quantityReceived",
        "quantity_received",
        0
      )
    );

  const freeQuantity =
    Number(
      getValue(
        batch,
        "freeQuantity",
        "free_quantity",
        0
      )
    );

  const quantityAvailable =
    Number(
      batch.quantityAvailable ??
      batch.quantity_available ??
      batch.availableStock ??
      batch.available_stock ??
      0
    );

  const purchasePrice =
    Number(
      getValue(
        batch,
        "purchasePrice",
        "purchase_price",
        0
      )
    );

  const mrp = Number(
    batch.mrp || 0
  );

  const sellingPrice =
    Number(
      getValue(
        batch,
        "sellingPrice",
        "selling_price",
        0
      )
    );

  const purchaseValue =
    quantityAvailable *
    purchasePrice;

  const sellingValue =
    quantityAvailable *
    sellingPrice;

  const isActive =
    getBoolean(
      batch,
      "isActive",
      "is_active"
    );

  const expiryValue =
    batch.expiryDate ||
    batch.expiry_date;

  const expiryDate =
    expiryValue
      ? new Date(expiryValue)
      : null;

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  let expiryStatus = "Unknown";
  let expiryClass = "unknown";

  if (
    expiryDate &&
    !Number.isNaN(
      expiryDate.getTime()
    )
  ) {
    expiryDate.setHours(
      0,
      0,
      0,
      0
    );

    const daysToExpiry =
      Math.ceil(
        (
          expiryDate.getTime() -
          today.getTime()
        ) /
        (24 * 60 * 60 * 1000)
      );

    if (daysToExpiry < 0) {
      expiryStatus = "Expired";
      expiryClass = "expired";
    } else if (
      daysToExpiry <= 30
    ) {
      expiryStatus =
        `${daysToExpiry} days remaining`;

      expiryClass = "expiring";
    } else {
      expiryStatus =
        `${daysToExpiry} days remaining`;

      expiryClass = "valid";
    }
  }

  return (
    <div className="stock-details">
      <div className="stock-details-header">
        <div className="stock-details-identity">
          <div className="stock-details-avatar">
            {medicineName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <span className="stock-eyebrow">
              Batch details
            </span>

            <h2>{medicineName}</h2>

            <p>
              {genericName}

              {batch.strength
                ? ` • ${batch.strength}`
                : ""}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="stock-modal-close"
          onClick={onClose}
          aria-label="Close stock details"
        >
          ×
        </button>
      </div>

      <div className="stock-details-body">
        <div className="stock-details-summary">
          <div className="stock-summary-card">
            <span>Available stock</span>

            <strong>
              {quantityAvailable}
            </strong>
          </div>

          <div className="stock-summary-card">
            <span>Purchase value</span>

            <strong>
              {formatMoney(
                purchaseValue
              )}
            </strong>
          </div>

          <div className="stock-summary-card">
            <span>Selling value</span>

            <strong>
              {formatMoney(
                sellingValue
              )}
            </strong>
          </div>

          <div className="stock-summary-card">
            <span>Batch status</span>

            <strong
              className={
                isActive
                  ? "stock-active-text"
                  : "stock-inactive-text"
              }
            >
              {isActive
                ? "Active"
                : "Inactive"}
            </strong>
          </div>
        </div>

        <section className="stock-details-section">
          <div className="stock-section-heading">
            <h3>
              Medicine and batch
            </h3>

            <p>
              Batch identification information
            </p>
          </div>

          <div className="stock-details-grid">
            <div className="stock-detail-item">
              <span>Batch ID</span>

              <strong>
                {batchId || "-"}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Batch number</span>

              <strong>
                {batchNumber}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Medicine ID</span>

              <strong>
                {getValue(
                  batch,
                  "medicineId",
                  "medicine_id"
                )}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>SKU</span>

              <strong>
                {batch.sku || "-"}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Supplier</span>

              <strong>
                {batch.supplierName ||
                  batch.supplier_name ||
                  "-"}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Location</span>

              <strong>
                {batch.location || "-"}
              </strong>
            </div>
          </div>
        </section>

        <section className="stock-details-section">
          <div className="stock-section-heading">
            <h3>
              Quantity information
            </h3>

            <p>
              Received, free and available stock
            </p>
          </div>

          <div className="stock-details-grid">
            <div className="stock-detail-item">
              <span>
                Quantity received
              </span>

              <strong>
                {quantityReceived}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Free quantity</span>

              <strong>
                {freeQuantity}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>
                Available quantity
              </span>

              <strong>
                {quantityAvailable}
              </strong>
            </div>
          </div>
        </section>

        <section className="stock-details-section">
          <div className="stock-section-heading">
            <h3>
              Price information
            </h3>

            <p>
              Purchase and retail price details
            </p>
          </div>

          <div className="stock-details-grid">
            <div className="stock-detail-item">
              <span>Purchase price</span>

              <strong>
                {formatMoney(
                  purchasePrice
                )}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>MRP</span>

              <strong>
                {formatMoney(mrp)}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Selling price</span>

              <strong>
                {formatMoney(
                  sellingPrice
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="stock-details-section">
          <div className="stock-section-heading">
            <h3>
              Manufacture and expiry
            </h3>

            <p>
              Batch production and validity
            </p>
          </div>

          <div className="stock-details-grid">
            <div className="stock-detail-item">
              <span>
                Manufacture date
              </span>

              <strong>
                {formatDate(
                  batch.manufactureDate ||
                  batch.manufacture_date
                )}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Expiry date</span>

              <strong>
                {formatDate(
                  expiryValue
                )}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Expiry status</span>

              <strong
                className={`stock-expiry-text ${expiryClass}`}
              >
                {expiryStatus}
              </strong>
            </div>
          </div>
        </section>

        <section className="stock-details-section">
          <div className="stock-section-heading">
            <h3>
              Purchase reference
            </h3>

            <p>
              Original purchase information
            </p>
          </div>

          <div className="stock-details-grid">
            <div className="stock-detail-item">
              <span>
                Purchase reference
              </span>

              <strong>
                {getValue(
                  batch,
                  "purchaseReference",
                  "purchase_reference"
                )}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Created at</span>

              <strong>
                {formatDate(
                  batch.createdAt ||
                  batch.created_at
                )}
              </strong>
            </div>

            <div className="stock-detail-item">
              <span>Updated at</span>

              <strong>
                {formatDate(
                  batch.updatedAt ||
                  batch.updated_at
                )}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <div className="stock-details-footer">
        <button
          type="button"
          className="stock-primary-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default StockDetails;