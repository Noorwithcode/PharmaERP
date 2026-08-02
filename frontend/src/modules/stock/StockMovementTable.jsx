const formatDateTime = (value) => {
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
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
};

const inwardTypes = [
  "OPENING",
  "PURCHASE",
  "SALE_RETURN",
  "ADJUSTMENT_IN",
];

const outwardTypes = [
  "SALE",
  "PURCHASE_RETURN",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "EXPIRED",
];

const getMovementType = (
  movement
) => {
  return String(
    movement.movementType ??
      movement.movement_type ??
      ""
  )
    .trim()
    .toUpperCase();
};

const getMovementDirection = (
  movementType
) => {
  if (
    inwardTypes.includes(
      movementType
    )
  ) {
    return "inward";
  }

  if (
    outwardTypes.includes(
      movementType
    )
  ) {
    return "outward";
  }

  return "neutral";
};

const formatMovementType = (
  movementType
) => {
  return movementType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
};

const StockMovementTable = ({
  movements = [],
  loading = false,
  error = "",
}) => {
  if (loading) {
    return (
      <div className="stock-table-state">
        <div className="stock-loader" />

        <p>
          Loading stock movements...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stock-table-state stock-error-state">
        <strong>
          Unable to load movements
        </strong>

        <p>{error}</p>
      </div>
    );
  }

  if (
    !Array.isArray(movements) ||
    movements.length === 0
  ) {
    return (
      <div className="stock-table-state">
        <div className="stock-empty-icon">
          MV
        </div>

        <strong>
          No stock movements found
        </strong>

        <p>
          Change the filters or create a
          stock transaction.
        </p>
      </div>
    );
  }

  return (
    <div className="stock-movement-table-wrapper">
      <table className="stock-movement-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Medicine</th>
            <th>Batch</th>
            <th>Movement</th>
            <th>Quantity</th>
            <th>Balance after</th>
            <th>Reference</th>
            <th>Created by</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {movements.map(
            (movement) => {
              const movementId =
                movement.id ||
                movement.movementId ||
                movement.movement_id;

              const movementType =
                getMovementType(
                  movement
                );

              const direction =
                getMovementDirection(
                  movementType
                );

              const quantity = Number(
                movement.quantity || 0
              );

              const balanceAfter =
                Number(
                  movement.balanceAfter ??
                    movement.balance_after ??
                    0
                );

              const brandName =
                movement.brandName ||
                movement.brand_name ||
                movement.medicineName ||
                movement.medicine_name ||
                "Unknown medicine";

              const genericName =
                movement.genericName ||
                movement.generic_name ||
                "";

              const batchNumber =
                movement.batchNumber ||
                movement.batch_number ||
                "-";

              const referenceType =
                movement.referenceType ||
                movement.reference_type ||
                "-";

              const referenceId =
                movement.referenceId ??
                movement.reference_id ??
                "-";

              const createdBy =
                movement.createdByName ||
                movement.created_by_name ||
                movement.createdBy ||
                movement.created_by ||
                "-";

              return (
                <tr key={movementId}>
                  <td>
                    <div className="movement-date">
                      <strong>
                        {formatDateTime(
                          movement.createdAt ||
                            movement.created_at ||
                            movement.movementDate ||
                            movement.movement_date
                        )}
                      </strong>

                      <span>
                        ID: {movementId}
                      </span>
                    </div>
                  </td>

                  <td>
                    <div className="movement-medicine">
                      <strong>
                        {brandName}
                      </strong>

                      <span>
                        {genericName}
                      </span>

                      <small>
                        {movement.sku ||
                          "No SKU"}
                      </small>
                    </div>
                  </td>

                  <td>
                    <div className="movement-batch">
                      <strong>
                        {batchNumber}
                      </strong>

                      <span>
                        Batch ID:{" "}
                        {movement.batchId ||
                          movement.batch_id ||
                          "-"}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span
                      className={`movement-type ${direction}`}
                    >
                      {formatMovementType(
                        movementType
                      )}
                    </span>
                  </td>

                  <td>
                    <strong
                      className={`movement-quantity ${direction}`}
                    >
                      {direction ===
                      "inward"
                        ? "+"
                        : direction ===
                            "outward"
                          ? "-"
                          : ""}

                      {quantity}
                    </strong>
                  </td>

                  <td>
                    <strong className="movement-balance">
                      {balanceAfter}
                    </strong>
                  </td>

                  <td>
                    <div className="movement-reference">
                      <strong>
                        {formatMovementType(
                          String(
                            referenceType
                          ).toUpperCase()
                        )}
                      </strong>

                      <span>
                        Reference ID:{" "}
                        {referenceId}
                      </span>
                    </div>
                  </td>

                  <td>
                    {createdBy}
                  </td>

                  <td>
                    <p className="movement-notes">
                      {movement.notes ||
                        "No notes"}
                    </p>
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StockMovementTable;