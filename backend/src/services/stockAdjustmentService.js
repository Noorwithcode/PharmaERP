const stockAdjustmentRepository = require(
  "../repositories/stockAdjustmentRepository"
);

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const allowedAdjustmentTypes = [
  "ADD",
  "SUBTRACT"
];

const allowedReasons = [
  "PHYSICAL_COUNT",
  "DAMAGED",
  "EXPIRED",
  "LOST",
  "BREAKAGE",
  "SAMPLE",
  "OPENING_BALANCE",
  "MANUAL_CORRECTION",
  "OTHER"
];

/**
 * Optional text safely normalize করে।
 */
const normalizeOptionalText = (
  value,
  maximumLength,
  fieldName
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw createError(
      `${fieldName} must be a string.`
    );
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (
    normalizedValue.length > maximumLength
  ) {
    throw createError(
      `${fieldName} cannot exceed ` +
      `${maximumLength} characters.`
    );
  }

  return normalizedValue;
};

/**
 * Date validate এবং MySQL-compatible value return করে।
 */
const validateAdjustmentDate = (dateValue) => {
  if (!dateValue) {
    return new Date();
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw createError(
      "Invalid adjustment date."
    );
  }

  return parsedDate;
};

/**
 * Reason normalize করে।
 *
 * Example:
 * "Physical Count" -> "PHYSICAL_COUNT"
 */
const normalizeReason = (reason) => {
  const normalizedReason = String(
    reason || "OTHER"
  )
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (
    !allowedReasons.includes(
      normalizedReason
    )
  ) {
    throw createError(
      "Invalid reason. Allowed reasons: " +
      allowedReasons.join(", ")
    );
  }

  return normalizedReason;
};

/**
 * Database movement type নির্ধারণ করে।
 */
const resolveMovementType = (
  adjustmentType,
  reason
) => {
  if (adjustmentType === "ADD") {
    return "ADJUSTMENT_IN";
  }

  if (reason === "DAMAGED") {
    return "DAMAGE";
  }

  if (reason === "EXPIRED") {
    return "EXPIRED";
  }

  return "ADJUSTMENT_OUT";
};

/**
 * নতুন Stock Adjustment process করে।
 */
const processStockAdjustment = async (
  payload = {}
) => {
  const {
    adjustmentDate,
    reason = "OTHER",
    notes = null,
    items,
    createdBy
  } = payload;

  const normalizedCreatedBy =
    Number(createdBy);

  if (
    !Number.isInteger(
      normalizedCreatedBy
    ) ||
    normalizedCreatedBy <= 0
  ) {
    throw createError(
      "Valid createdBy user ID is required.",
      401
    );
  }

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw createError(
      "Adjustment must contain at least one item."
    );
  }

  if (items.length > 100) {
    throw createError(
      "A maximum of 100 items is allowed " +
      "in one stock adjustment."
    );
  }

  const normalizedReason =
    normalizeReason(reason);

  const normalizedNotes =
    normalizeOptionalText(
      notes,
      500,
      "Notes"
    );

  const uniqueBatchIds = new Set();

  const processedItems = items.map(
    (item, index) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        throw createError(
          `Item ${index + 1} is invalid.`
        );
      }

      const medicineId =
        Number(item.medicineId);

      const batchId =
        Number(item.batchId);

      const quantity =
        Number(item.quantity);

      const adjustmentType = String(
        item.adjustmentType || ""
      )
        .trim()
        .toUpperCase();

      if (
        !Number.isInteger(medicineId) ||
        medicineId <= 0
      ) {
        throw createError(
          `Valid medicineId is required ` +
          `for item ${index + 1}.`
        );
      }

      if (
        !Number.isInteger(batchId) ||
        batchId <= 0
      ) {
        throw createError(
          `Valid batchId is required ` +
          `for item ${index + 1}.`
        );
      }

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        throw createError(
          `Quantity for item ${index + 1} ` +
          "must be a positive integer."
        );
      }

      if (
        !allowedAdjustmentTypes.includes(
          adjustmentType
        )
      ) {
        throw createError(
          `Invalid adjustmentType for item ` +
          `${index + 1}. Use ADD or SUBTRACT.`
        );
      }

      /*
       * Damaged এবং expired stock কখনো
       * ADD করা যাবে না।
       */
      if (
        adjustmentType === "ADD" &&
        ["DAMAGED", "EXPIRED"].includes(
          normalizedReason
        )
      ) {
        throw createError(
          `${normalizedReason} stock must use ` +
          "SUBTRACT adjustment type."
        );
      }

      if (uniqueBatchIds.has(batchId)) {
        throw createError(
          `Batch ID ${batchId} appears ` +
          "more than once."
        );
      }

      uniqueBatchIds.add(batchId);

      const itemNotes =
        normalizeOptionalText(
          item.notes ?? item.remarks,
          500,
          `Notes for item ${index + 1}`
        );

      return {
        medicineId,
        batchId,
        adjustmentType,

        /*
         * Repository এটি সরাসরি database
         * movement_type হিসেবে ব্যবহার করবে।
         */
        movementType:
          resolveMovementType(
            adjustmentType,
            normalizedReason
          ),

        quantity,
        notes: itemNotes
      };
    }
  );

  /*
   * সব transaction একই batch order-এ
   * lock নিলে deadlock risk কমে।
   */
  processedItems.sort(
    (firstItem, secondItem) =>
      firstItem.batchId -
      secondItem.batchId
  );

  const adjustmentData = {
    adjustmentDate:
      validateAdjustmentDate(
        adjustmentDate
      ),

    reason: normalizedReason,
    notes: normalizedNotes,
    createdBy: normalizedCreatedBy
  };

  const adjustmentId =
    await stockAdjustmentRepository
      .createStockAdjustment(
        adjustmentData,
        processedItems
      );

  return getAdjustmentDetails(
    adjustmentId
  );
};

/**
 * একটি Stock Adjustment-এর full details।
 */
const getAdjustmentDetails = async (
  adjustmentId
) => {
  const normalizedAdjustmentId =
    Number(adjustmentId);

  if (
    !Number.isInteger(
      normalizedAdjustmentId
    ) ||
    normalizedAdjustmentId <= 0
  ) {
    throw createError(
      "Invalid stock adjustment ID."
    );
  }

  const header =
    await stockAdjustmentRepository
      .getStockAdjustmentHeader(
        normalizedAdjustmentId
      );

  if (!header) {
    throw createError(
      "Stock adjustment not found.",
      404
    );
  }

  const items =
    await stockAdjustmentRepository
      .getStockAdjustmentItems(
        normalizedAdjustmentId
      );

  return {
    adjustment: header,
    items
  };
};

/**
 * Stock Adjustment list/report।
 */
const getStockAdjustments = async (
  filters = {}
) => {
  const page = Math.max(
    Number(filters.page) || 1,
    1
  );

  const limit = Math.min(
    Math.max(
      Number(filters.limit) || 20,
      1
    ),
    100
  );

  const status = filters.status
    ? String(filters.status)
        .trim()
        .toUpperCase()
    : undefined;

  if (
    status &&
    !["COMPLETED", "CANCELLED"].includes(
      status
    )
  ) {
    throw createError(
      "Status must be COMPLETED or CANCELLED."
    );
  }

  return stockAdjustmentRepository
    .getStockAdjustments({
      page,
      limit,
      status,
      reason: filters.reason,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    });
};

module.exports = {
  processStockAdjustment,
  getAdjustmentDetails,
  getStockAdjustments
};