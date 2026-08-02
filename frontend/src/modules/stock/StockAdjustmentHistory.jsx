import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import stockAdjustmentService from
  "../../services/stockAdjustmentService";

const initialFilters = {
  adjustmentType: "",
  reason: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
  limit: 10,
};

const REASON_LABELS = {
  PHYSICAL_COUNT:
    "Physical count",

  DAMAGED:
    "Damaged",

  EXPIRED:
    "Expired",

  LOST:
    "Lost / Missing",

  BREAKAGE:
    "Breakage",

  SAMPLE:
    "Sample issued",

  OPENING_BALANCE:
    "Opening balance",

  MANUAL_CORRECTION:
    "Manual correction",

  OTHER:
    "Other",
};

const INWARD_TYPES =
  new Set([
    "ADJUSTMENT_IN",
  ]);

const OUTWARD_TYPES =
  new Set([
    "ADJUSTMENT_OUT",
    "DAMAGE",
    "EXPIRED",
  ]);

const extractAdjustmentList = (
  data
) => {
  if (Array.isArray(data)) {
    return data;
  }

  const candidates = [
    data?.adjustments,
    data?.items,
    data?.rows,

    data?.data
      ?.adjustments,

    data?.data
      ?.items,

    data?.data,
  ];

  return (
    candidates.find(
      Array.isArray
    ) || []
  );
};

const getPagination = (
  data,
  count
) => {
  const pagination =
    data?.pagination ??
    data?.data
      ?.pagination ??
    {};

  const page =
    Number(
      pagination.page
    ) || 1;

  const limit =
    Number(
      pagination.limit
    ) || 10;

  const total =
    Number(
      pagination.total
    ) || count;

  const totalPages =
    Number(
      pagination.totalPages
    ) ||
    Math.max(
      Math.ceil(
        total / limit
      ),
      1
    );

  return {
    page,
    limit,
    total,
    totalPages,
  };
};

const normalizeHeader = (
  row
) => ({
  ...row,

  id:
    Number(row?.id),

  adjustmentNumber:
    row?.adjustmentNumber ??
    row?.adjustment_number ??
    "-",

  adjustmentDate:
    row?.adjustmentDate ??
    row?.adjustment_date ??
    null,

  reason:
    String(
      row?.reason ||
      "OTHER"
    ),

  notes:
    row?.notes ??
    null,

  status:
    String(
      row?.status ||
      "COMPLETED"
    ),

  createdBy:
    row?.createdBy ??
    row?.created_by ??
    null,

  createdAt:
    row?.createdAt ??
    row?.created_at ??
    null,

  totalItems:
    Number(
      row?.totalItems ??
      row?.total_items ??
      0
    ),

  totalQuantity:
    Number(
      row?.totalQuantity ??
      row?.total_quantity ??
      0
    ),
});

const normalizeItem = (
  item
) => ({
  ...item,

  id:
    Number(item?.id),

  medicineId:
    Number(
      item?.medicineId ??
      item?.medicine_id
    ),

  batchId:
    Number(
      item?.batchId ??
      item?.batch_id
    ),

  batchNumber:
    item?.batchNumber ??
    item?.batch_number ??
    "-",

  brandName:
    item?.brandName ??
    item?.medicineName ??
    item?.brand_name ??
    `Medicine #${
      item?.medicineId ??
      item?.medicine_id ??
      "-"
    }`,

  movementType:
    String(
      item?.movementType ??
      item?.movement_type ??
      "ADJUSTMENT_IN"
    ),

  quantity:
    Number(
      item?.quantity ??
      0
    ),

  previousStock:
    Number(
      item?.previousStock ??
      item?.previous_stock ??
      0
    ),

  balanceAfter:
    Number(
      item?.balanceAfter ??
      item?.balance_after ??
      0
    ),

  notes:
    item?.notes ??
    null,
});

const formatDateTime = (
  value
) => {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl
    .DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    )
    .format(date);
};

const formatReason = (
  reason
) => {
  return (
    REASON_LABELS[
      reason
    ] ||
    String(
      reason ||
      "Other"
    )
      .replaceAll(
        "_",
        " "
      )
      .toLowerCase()
      .replace(
        /^./,
        (letter) =>
          letter
            .toUpperCase()
      )
  );
};

const formatMovementType = (
  type
) => {
  const labels = {
    ADJUSTMENT_IN:
      "Adjustment in",

    ADJUSTMENT_OUT:
      "Adjustment out",

    DAMAGE:
      "Damage",

    EXPIRED:
      "Expired",
  };

  return (
    labels[type] ||
    String(type)
      .replaceAll(
        "_",
        " "
      )
  );
};

function StockAdjustmentHistory({
  refreshToken = 0,
}) {
  const [
    filters,
    setFilters,
  ] = useState(
    initialFilters
  );

  const [
    adjustments,
    setAdjustments,
  ] = useState([]);

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    expandedId,
    setExpandedId,
  ] = useState(null);

  const [
    detailsById,
    setDetailsById,
  ] = useState({});

  const [
    detailsLoadingId,
    setDetailsLoadingId,
  ] = useState(null);

  const loadAdjustments =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const params = {
            page:
              filters.page,

            limit:
              filters.limit,
          };

          if (
            filters
              .adjustmentType
          ) {
            params
              .adjustmentType =
              filters
                .adjustmentType;
          }

          if (
            filters.reason
          ) {
            params.reason =
              filters.reason;
          }

          if (
            filters.dateFrom
          ) {
            params.dateFrom =
              filters.dateFrom;
          }

          if (
            filters.dateTo
          ) {
            params.dateTo =
              filters.dateTo;
          }

          const data =
            await stockAdjustmentService
              .getAdjustments(
                params
              );

          const rows =
            extractAdjustmentList(
              data
            ).map(
              normalizeHeader
            );

          setAdjustments(
            rows
          );

          setPagination(
            getPagination(
              data,
              rows.length
            )
          );
        } catch (
          requestError
        ) {
          setAdjustments([]);

          setError(
            stockAdjustmentService
              .getErrorMessage(
                requestError,
                "Unable to load stock adjustments."
              )
          );
        } finally {
          setLoading(false);
        }
      },
      [filters]
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        loadAdjustments,
        200
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    loadAdjustments,
    refreshToken,
  ]);

  const summary =
    useMemo(() => {
      return adjustments
        .reduce(
          (
            result,
            adjustment
          ) => {
            result
              .visibleQuantity +=
              adjustment
                .totalQuantity;

            if (
              adjustment
                .status ===
              "COMPLETED"
            ) {
              result
                .completed += 1;
            }

            return result;
          },
          {
            visibleQuantity: 0,
            completed: 0,
          }
        );
    }, [adjustments]);

  const updateFilter = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFilters(
      (current) => ({
        ...current,
        [name]: value,
        page: 1,
      })
    );

    setExpandedId(null);
  };

  const clearFilters = () => {
    setFilters(
      initialFilters
    );

    setExpandedId(null);
  };

  const toggleDetails =
    async (
      adjustmentId
    ) => {
      if (
        expandedId ===
        adjustmentId
      ) {
        setExpandedId(null);
        return;
      }

      setExpandedId(
        adjustmentId
      );

      if (
        detailsById[
          adjustmentId
        ]
      ) {
        return;
      }

      setDetailsLoadingId(
        adjustmentId
      );

      setError("");

      try {
        const data =
          await stockAdjustmentService
            .getAdjustmentById(
              adjustmentId
            );

        const rawItems =
          data?.items ??
          data?.data?.items ??
          [];

        const details = {
          adjustment:
            data
              ?.adjustment ??
            data?.data
              ?.adjustment ??
            {},

          items:
            Array.isArray(
              rawItems
            )
              ? rawItems.map(
                  normalizeItem
                )
              : [],
        };

        setDetailsById(
          (current) => ({
            ...current,

            [adjustmentId]:
              details,
          })
        );
      } catch (
        requestError
      ) {
        setExpandedId(null);

        setError(
          stockAdjustmentService
            .getErrorMessage(
              requestError,
              "Unable to load adjustment details."
            )
        );
      } finally {
        setDetailsLoadingId(
          null
        );
      }
    };

  const previousPage = () => {
    setFilters(
      (current) => ({
        ...current,

        page:
          Math.max(
            current.page - 1,
            1
          ),
      })
    );
  };

  const nextPage = () => {
    setFilters(
      (current) => ({
        ...current,

        page:
          Math.min(
            current.page + 1,
            pagination
              .totalPages
          ),
      })
    );
  };

  return (
    <section className="adjustment-history-card">
      <div className="adjustment-card-heading">
        <div>
          <span className="adjustment-eyebrow">
            Audit trail
          </span>

          <h2>
            Adjustment history
          </h2>

          <p>
            Review who changed stock,
            when it changed and the
            resulting balance.
          </p>
        </div>

        <button
          type="button"
          className="adjustment-secondary-button"
          onClick={
            loadAdjustments
          }
          disabled={loading}
        >
          {loading
            ? "Loading..."
            : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="adjustment-message is-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className="adjustment-history-summary">
        <div>
          <span>
            Total records
          </span>

          <strong>
            {pagination.total}
          </strong>
        </div>

        <div>
          <span>
            Visible records
          </span>

          <strong>
            {adjustments.length}
          </strong>
        </div>

        <div>
          <span>
            Visible quantity
          </span>

          <strong>
            {
              summary
                .visibleQuantity
            }
          </strong>
        </div>

        <div>
          <span>
            Completed
          </span>

          <strong>
            {
              summary.completed
            }
          </strong>
        </div>
      </div>

      <div className="adjustment-history-filters">
        <label>
          <span>
            Adjustment type
          </span>

          <select
            name="adjustmentType"
            value={
              filters
                .adjustmentType
            }
            onChange={
              updateFilter
            }
          >
            <option value="">
              All types
            </option>

            <option value="ADD">
              Increase
            </option>

            <option value="SUBTRACT">
              Decrease
            </option>
          </select>
        </label>

        <label>
          <span>Reason</span>

          <select
            name="reason"
            value={
              filters.reason
            }
            onChange={
              updateFilter
            }
          >
            <option value="">
              All reasons
            </option>

            {Object
              .entries(
                REASON_LABELS
              )
              .map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {label}
                  </option>
                )
              )}
          </select>
        </label>

        <label>
          <span>
            From date
          </span>

          <input
            type="date"
            name="dateFrom"
            value={
              filters.dateFrom
            }
            onChange={
              updateFilter
            }
            max={
              filters.dateTo ||
              undefined
            }
          />
        </label>

        <label>
          <span>To date</span>

          <input
            type="date"
            name="dateTo"
            value={
              filters.dateTo
            }
            onChange={
              updateFilter
            }
            min={
              filters.dateFrom ||
              undefined
            }
          />
        </label>

        <button
          type="button"
          className="adjustment-clear-button"
          onClick={
            clearFilters
          }
        >
          Clear filters
        </button>
      </div>

      <div className="adjustment-table-wrap">
        <table className="adjustment-history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Reason</th>
              <th>Items</th>
              <th>Quantity</th>
              <th>Status</th>
              <th>
                Created by
              </th>

              <th
                aria-label="Actions"
              />
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="8"
                  className="adjustment-empty-state"
                >
                  Loading stock
                  adjustments...
                </td>
              </tr>
            ) : adjustments
                .length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  className="adjustment-empty-state"
                >
                  No stock adjustment
                  records found.
                </td>
              </tr>
            ) : (
              adjustments.map(
                (
                  adjustment
                ) => {
                  const expanded =
                    expandedId ===
                    adjustment.id;

                  const details =
                    detailsById[
                      adjustment.id
                    ];

                  return (
                    <>
                      <tr
                        key={
                          `header-${adjustment.id}`
                        }
                      >
                        <td>
                          <strong>
                            {formatDateTime(
                              adjustment
                                .adjustmentDate
                            )}
                          </strong>

                          <small>
                            Created{" "}
                            {formatDateTime(
                              adjustment
                                .createdAt
                            )}
                          </small>
                        </td>

                        <td>
                          <strong>
                            {
                              adjustment
                                .adjustmentNumber
                            }
                          </strong>

                          <small>
                            ID:{" "}
                            {
                              adjustment.id
                            }
                          </small>
                        </td>

                        <td>
                          {formatReason(
                            adjustment
                              .reason
                          )}
                        </td>

                        <td>
                          {
                            adjustment
                              .totalItems
                          }
                        </td>

                        <td>
                          <strong>
                            {
                              adjustment
                                .totalQuantity
                            }
                          </strong>
                        </td>

                        <td>
                          <span
                            className={
                              `adjustment-status is-${
                                adjustment
                                  .status
                                  .toLowerCase()
                              }`
                            }
                          >
                            {
                              adjustment
                                .status
                            }
                          </span>
                        </td>

                        <td>
                          {
                            adjustment
                              .createdBy
                              ? `User #${adjustment.createdBy}`
                              : "System"
                          }
                        </td>

                        <td>
                          <button
                            type="button"
                            className="adjustment-details-button"
                            onClick={() =>
                              toggleDetails(
                                adjustment.id
                              )
                            }
                          >
                            {
                              detailsLoadingId ===
                              adjustment.id
                                ? "Loading"
                                : expanded
                                  ? "Hide"
                                  : "View"
                            }
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr
                          key={
                            `details-${adjustment.id}`
                          }
                          className="adjustment-expanded-row"
                        >
                          <td colSpan="8">
                            {!details ? (
                              <p>
                                Loading
                                adjustment
                                details...
                              </p>
                            ) : details
                                .items
                                .length ===
                              0 ? (
                              <p>
                                No adjustment
                                items found.
                              </p>
                            ) : (
                              <div className="adjustment-detail-panel">
                                {details
                                  .items
                                  .map(
                                    (
                                      item
                                    ) => {
                                      const inward =
                                        INWARD_TYPES
                                          .has(
                                            item
                                              .movementType
                                          );

                                      const outward =
                                        OUTWARD_TYPES
                                          .has(
                                            item
                                              .movementType
                                          );

                                      return (
                                        <article
                                          key={
                                            item.id
                                          }
                                          className="adjustment-detail-item"
                                        >
                                          <div>
                                            <span>
                                              Medicine
                                              / Batch
                                            </span>

                                            <strong>
                                              {
                                                item
                                                  .brandName
                                              }
                                            </strong>

                                            <small>
                                              {
                                                item
                                                  .batchNumber
                                              }
                                              {" · "}
                                              Batch
                                              ID:{" "}
                                              {
                                                item
                                                  .batchId
                                              }
                                            </small>
                                          </div>

                                          <div>
                                            <span>
                                              Movement
                                            </span>

                                            <strong
                                              className={
                                                inward
                                                  ? "is-positive"
                                                  : outward
                                                    ? "is-negative"
                                                    : ""
                                              }
                                            >
                                              {formatMovementType(
                                                item
                                                  .movementType
                                              )}
                                            </strong>
                                          </div>

                                          <div>
                                            <span>
                                              Quantity
                                            </span>

                                            <strong>
                                              {
                                                inward
                                                  ? "+"
                                                  : "-"
                                              }
                                              {
                                                item
                                                  .quantity
                                              }
                                            </strong>
                                          </div>

                                          <div>
                                            <span>
                                              Stock
                                              balance
                                            </span>

                                            <strong>
                                              {
                                                item
                                                  .previousStock
                                              }
                                              {" → "}
                                              {
                                                item
                                                  .balanceAfter
                                              }
                                            </strong>
                                          </div>

                                          <div className="is-notes">
                                            <span>
                                              Remarks
                                            </span>

                                            <strong>
                                              {
                                                item
                                                  .notes ||
                                                adjustment
                                                  .notes ||
                                                "-"
                                              }
                                            </strong>
                                          </div>
                                        </article>
                                      );
                                    }
                                  )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                }
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="adjustment-pagination">
        <span>
          Page {pagination.page} of{" "}
          {pagination.totalPages}
          {" · "}
          {pagination.total}
          {" record(s)"}
        </span>

        <div>
          <button
            type="button"
            onClick={
              previousPage
            }
            disabled={
              loading ||
              pagination.page <= 1
            }
          >
            Previous
          </button>

          <button
            type="button"
            onClick={nextPage}
            disabled={
              loading ||
              pagination.page >=
                pagination
                  .totalPages
            }
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

export default StockAdjustmentHistory;