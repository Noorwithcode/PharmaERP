import {
  useEffect,
  useMemo,
  useState,
} from "react";

import stockAdjustmentService from
  "../../services/stockAdjustmentService";

const REASONS = [
  {
    value: "PHYSICAL_COUNT",
    label: "Physical count",
  },
  {
    value: "DAMAGED",
    label: "Damaged",
  },
  {
    value: "EXPIRED",
    label: "Expired",
  },
  {
    value: "LOST",
    label: "Lost / Missing",
  },
  {
    value: "BREAKAGE",
    label: "Breakage",
  },
  {
    value: "SAMPLE",
    label: "Sample issued",
  },
  {
    value: "OPENING_BALANCE",
    label: "Opening balance",
  },
  {
    value: "MANUAL_CORRECTION",
    label: "Manual correction",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

const getToday = () => {
  const now = new Date();

  const offset =
    now.getTimezoneOffset() * 60_000;

  return new Date(
    now.getTime() - offset
  )
    .toISOString()
    .slice(0, 10);
};

const initialForm = () => ({
  adjustmentDate: getToday(),
  batchId: "",
  adjustmentType: "ADD",
  quantity: "",
  reason: "PHYSICAL_COUNT",
  notes: "",
  remarks: "",
});

const extractBatches = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  const candidates = [
    data?.batches,
    data?.items,
    data?.rows,
    data?.data?.batches,
    data?.data?.items,
    data?.data,
  ];

  return (
    candidates.find(Array.isArray) ||
    []
  );
};

const normalizeBatch = (batch) => ({
  ...batch,

  id: Number(
    batch?.id ??
    batch?.batchId
  ),

  medicineId: Number(
    batch?.medicineId ??
    batch?.medicine_id
  ),

  brandName:
    batch?.brandName ??
    batch?.medicineName ??
    batch?.brand_name ??
    "Medicine",

  genericName:
    batch?.genericName ??
    batch?.generic_name ??
    "",

  batchNumber:
    batch?.batchNumber ??
    batch?.batch_number ??
    "-",

  quantityAvailable: Number(
    batch?.quantityAvailable ??
    batch?.quantity_available ??
    batch?.availableStock ??
    batch?.available_stock ??
    0
  ),

  expiryDate:
    batch?.expiryDate ??
    batch?.expiry_date ??
    null,

  isActive: Boolean(
    batch?.isActive ??
    batch?.is_active ??
    true
  ),
});

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(
      0,
      10
    );
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
};

function StockAdjustmentForm({
  onCreated,
  refreshToken = 0,
}) {
  const [
    form,
    setForm,
  ] = useState(initialForm);

  const [
    batches,
    setBatches,
  ] = useState([]);

  const [
    loadingBatches,
    setLoadingBatches,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  useEffect(() => {
    let active = true;

    const loadBatches = async () => {
      setLoadingBatches(true);
      setError("");

      try {
        const data =
          await stockAdjustmentService
            .getAvailableBatches();

        if (!active) {
          return;
        }

        const normalized =
          extractBatches(data)
            .map(normalizeBatch)
            .filter((batch) => {
              return (
                Number.isInteger(
                  batch.id
                ) &&
                batch.id > 0 &&
                Number.isInteger(
                  batch.medicineId
                ) &&
                batch.medicineId > 0 &&
                batch.isActive
              );
            })
            .sort((first, second) => {
              return first.brandName
                .localeCompare(
                  second.brandName
                );
            });

        setBatches(normalized);
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(
          stockAdjustmentService
            .getErrorMessage(
              requestError,
              "Unable to load medicine batches."
            )
        );
      } finally {
        if (active) {
          setLoadingBatches(false);
        }
      }
    };

    loadBatches();

    return () => {
      active = false;
    };
  }, [refreshToken]);

  const selectedBatch =
    useMemo(() => {
      return batches.find(
        (batch) => {
          return (
            batch.id ===
            Number(form.batchId)
          );
        }
      );
    }, [
      batches,
      form.batchId,
    ]);

  const updateField = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const validate = () => {
    if (!selectedBatch) {
      return (
        "Please select a valid " +
        "medicine batch."
      );
    }

    const quantity =
      Number(form.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return (
        "Quantity must be a " +
        "positive whole number."
      );
    }

    if (
      form.adjustmentType ===
        "SUBTRACT" &&
      quantity >
        selectedBatch
          .quantityAvailable
    ) {
      return (
        `Only ${
          selectedBatch
            .quantityAvailable
        } unit(s) are available ` +
        "in this batch."
      );
    }

    if (!form.adjustmentDate) {
      return (
        "Adjustment date is required."
      );
    }

    return "";
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    const validationError =
      validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        adjustmentDate:
          form.adjustmentDate,

        reason:
          form.reason,

        notes:
          form.notes.trim() ||
          null,

        items: [
          {
            medicineId:
              selectedBatch
                .medicineId,

            batchId:
              selectedBatch.id,

            adjustmentType:
              form.adjustmentType,

            quantity:
              Number(
                form.quantity
              ),

            remarks:
              form.remarks
                .trim() ||
              null,
          },
        ],
      };

      const result =
        await stockAdjustmentService
          .createAdjustment(
            payload
          );

      const adjustment =
        result?.adjustment ??
        result?.data
          ?.adjustment ??
        {};

      const reference =
        adjustment
          ?.adjustmentNumber ??
        adjustment
          ?.adjustment_number ??
        "";

      setSuccess(
        reference
          ? `Adjustment ${reference} completed successfully.`
          : "Stock adjustment completed successfully."
      );

      setForm(initialForm());

      if (
        typeof onCreated ===
        "function"
      ) {
        onCreated(result);
      }
    } catch (requestError) {
      setError(
        stockAdjustmentService
          .getErrorMessage(
            requestError,
            "Unable to process stock adjustment."
          )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedBalance =
    selectedBatch
      ? Math.max(
          selectedBatch
            .quantityAvailable +
            (
              form.adjustmentType ===
              "ADD"
                ? Number(
                    form.quantity ||
                    0
                  )
                : -Number(
                    form.quantity ||
                    0
                  )
            ),
          0
        )
      : 0;

  return (
    <form
      className="adjustment-form-card"
      onSubmit={handleSubmit}
    >
      <div className="adjustment-card-heading">
        <div>
          <span className="adjustment-eyebrow">
            Inventory correction
          </span>

          <h2>
            Create stock adjustment
          </h2>

          <p>
            Select a batch, choose
            increase or decrease, and
            record the reason.
          </p>
        </div>

        <span className="adjustment-audit-badge">
          Audit recorded
        </span>
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

      {success && (
        <div className="adjustment-message is-success">
          <span>{success}</span>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <div className="adjustment-form-grid">
        <label className="adjustment-field is-wide">
          <span>
            Medicine batch *
          </span>

          <select
            name="batchId"
            value={form.batchId}
            onChange={updateField}
            disabled={
              loadingBatches ||
              submitting
            }
          >
            <option value="">
              {loadingBatches
                ? "Loading batches..."
                : "Select medicine and batch"}
            </option>

            {batches.map(
              (batch) => (
                <option
                  key={batch.id}
                  value={batch.id}
                >
                  {batch.brandName}
                  {" — "}
                  {batch.batchNumber}
                  {" — Stock: "}
                  {
                    batch
                      .quantityAvailable
                  }
                </option>
              )
            )}
          </select>
        </label>

        <label className="adjustment-field">
          <span>
            Adjustment date *
          </span>

          <input
            type="date"
            name="adjustmentDate"
            value={
              form.adjustmentDate
            }
            onChange={updateField}
            disabled={submitting}
          />
        </label>

        <label className="adjustment-field">
          <span>
            Adjustment type *
          </span>

          <select
            name="adjustmentType"
            value={
              form.adjustmentType
            }
            onChange={updateField}
            disabled={submitting}
          >
            <option value="ADD">
              Increase stock
            </option>

            <option value="SUBTRACT">
              Decrease stock
            </option>
          </select>
        </label>

        <label className="adjustment-field">
          <span>Quantity *</span>

          <input
            type="number"
            name="quantity"
            min="1"
            step="1"
            value={form.quantity}
            onChange={updateField}
            placeholder="Enter quantity"
            disabled={submitting}
          />
        </label>

        <label className="adjustment-field">
          <span>Reason *</span>

          <select
            name="reason"
            value={form.reason}
            onChange={updateField}
            disabled={submitting}
          >
            {REASONS.map(
              (reason) => (
                <option
                  key={reason.value}
                  value={
                    reason.value
                  }
                >
                  {reason.label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="adjustment-field is-wide">
          <span>
            Item remarks
          </span>

          <input
            type="text"
            name="remarks"
            value={form.remarks}
            onChange={updateField}
            maxLength="500"
            placeholder="Example: Five units found during physical counting"
            disabled={submitting}
          />
        </label>

        <label className="adjustment-field is-wide">
          <span>
            Adjustment notes
          </span>

          <textarea
            name="notes"
            value={form.notes}
            onChange={updateField}
            maxLength="500"
            rows="3"
            placeholder="Add overall notes for this adjustment"
            disabled={submitting}
          />
        </label>
      </div>

      {selectedBatch && (
        <div className="selected-batch-summary">
          <div>
            <span>Medicine</span>

            <strong>
              {
                selectedBatch
                  .brandName
              }
            </strong>

            <small>
              {
                selectedBatch
                  .genericName ||
                "-"
              }
            </small>
          </div>

          <div>
            <span>Batch</span>

            <strong>
              {
                selectedBatch
                  .batchNumber
              }
            </strong>

            <small>
              ID: {selectedBatch.id}
            </small>
          </div>

          <div>
            <span>Expiry</span>

            <strong>
              {formatDate(
                selectedBatch
                  .expiryDate
              )}
            </strong>
          </div>

          <div>
            <span>
              Current stock
            </span>

            <strong>
              {
                selectedBatch
                  .quantityAvailable
              }
            </strong>
          </div>

          <div>
            <span>
              Estimated balance
            </span>

            <strong
              className={
                form.adjustmentType ===
                "ADD"
                  ? "is-positive"
                  : "is-negative"
              }
            >
              {estimatedBalance}
            </strong>
          </div>
        </div>
      )}

      <div className="adjustment-form-footer">
        <p>
          Stock, movement entry and
          audit details will be saved
          in one database transaction.
        </p>

        <button
          type="submit"
          className="adjustment-primary-button"
          disabled={
            submitting ||
            loadingBatches
          }
        >
          {submitting
            ? "Processing..."
            : form.adjustmentType ===
                "ADD"
              ? "Increase stock"
              : "Decrease stock"}
        </button>
      </div>
    </form>
  );
}

export default StockAdjustmentForm;