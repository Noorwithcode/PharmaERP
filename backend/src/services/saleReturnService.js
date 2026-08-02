const crypto = require("crypto");

const saleReturnRepository = require(
  "../repositories/saleReturnRepository"
);

const ALLOWED_REFUND_METHODS = [
  "CASH",
  "CARD",
  "UPI",
  "BANK",
  "CREDIT",
  "OTHER",
];

const ALLOWED_RETURN_STATUSES = [
  "COMPLETED",
  "CANCELLED",
];

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toPositiveInteger = (
  value,
  label
) => {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    throw createError(
      `${label} must be a positive integer.`
    );
  }

  return number;
};

const toOptionalPositiveInteger = (
  value,
  label
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return toPositiveInteger(
    value,
    label
  );
};

const roundMoney = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round(
    (number + Number.EPSILON) *
    100
  ) / 100;
};

const normalizeText = (
  value,
  {
    required = false,
    fieldName = "Value",
    maxLength = 500,
  } = {}
) => {
  const text =
    value === undefined ||
    value === null
      ? ""
      : String(value).trim();

  if (required && !text) {
    throw createError(
      `${fieldName} is required.`
    );
  }

  if (text.length > maxLength) {
    throw createError(
      `${fieldName} cannot exceed ${maxLength} characters.`
    );
  }

  return text || null;
};

const normalizeDate = (
  value,
  fieldName
) => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const text = String(value).trim();
  const parsedDate = new Date(text);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    throw createError(
      `${fieldName} is invalid.`
    );
  }

  return text;
};

const normalizeReturnDate = (value) => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return new Date();
  }

  return normalizeDate(
    value,
    "Return date"
  );
};

const normalizeRefundMethod = (
  value
) => {
  const method = String(
    value || "CASH"
  )
    .trim()
    .toUpperCase();

  if (
    !ALLOWED_REFUND_METHODS.includes(
      method
    )
  ) {
    throw createError(
      `Invalid refund method. Allowed methods: ${ALLOWED_REFUND_METHODS.join(
        ", "
      )}.`
    );
  }

  return method;
};

const normalizeReturnStatus = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const status = String(value)
    .trim()
    .toUpperCase();

  if (
    !ALLOWED_RETURN_STATUSES.includes(
      status
    )
  ) {
    throw createError(
      `Invalid sale return status. Allowed statuses: ${ALLOWED_RETURN_STATUSES.join(
        ", "
      )}.`
    );
  }

  return status;
};

const getReferenceDate = (
  returnDate
) => {
  const parsedDate =
    returnDate instanceof Date
      ? returnDate
      : new Date(returnDate);

  const usableDate =
    Number.isNaN(
      parsedDate.getTime()
    )
      ? new Date()
      : parsedDate;

  const year = usableDate
    .getUTCFullYear();

  const month = String(
    usableDate.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    usableDate.getUTCDate()
  ).padStart(2, "0");

  return `${year}${month}${day}`;
};

const generateReturnNumber = (
  returnDate
) => {
  const datePart =
    getReferenceDate(returnDate);

  const randomPart =
    crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();

  return `SRT-${datePart}-${randomPart}`;
};

const normalizeItems = (items) => {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw createError(
      "At least one sale return item is required."
    );
  }

  if (items.length > 200) {
    throw createError(
      "A sale return cannot contain more than 200 items."
    );
  }

  const uniqueSaleItemIds =
    new Set();

  const normalizedItems =
    items.map((item, index) => {
      const position = index + 1;

      const saleItemId =
        toPositiveInteger(
          item?.saleItemId ??
            item?.sale_item_id,
          `Sale item ID for item ${position}`
        );

      const quantity =
        toPositiveInteger(
          item?.quantity,
          `Return quantity for item ${position}`
        );

      if (
        uniqueSaleItemIds.has(
          saleItemId
        )
      ) {
        throw createError(
          `Sale item ID ${saleItemId} appears more than once.`
        );
      }

      uniqueSaleItemIds.add(
        saleItemId
      );

      return {
        saleItemId,
        quantity,
      };
    });

  normalizedItems.sort(
    (first, second) => {
      return (
        first.saleItemId -
        second.saleItemId
      );
    }
  );

  return normalizedItems;
};

const calculateReturnItem = (
  lockedItem,
  requestedItem
) => {
  const soldQuantity = Number(
    lockedItem.soldQuantity || 0
  );

  const returnedQuantity = Number(
    lockedItem.returnedQuantity || 0
  );

  const returnableQuantity =
    Math.max(
      soldQuantity -
        returnedQuantity,
      0
    );

  if (
    requestedItem.quantity >
    returnableQuantity
  ) {
    throw createError(
      `Return quantity exceeds the available returnable quantity for ${lockedItem.medicineName} (${lockedItem.batchNumber}). Returnable quantity: ${returnableQuantity}.`,
      409
    );
  }

  const sellingPrice =
    roundMoney(
      lockedItem.sellingPrice
    );

  const discountPercent =
    roundMoney(
      lockedItem.discountPercent
    );

  const gstPercent =
    roundMoney(
      lockedItem.gstPercent
    );

  const grossAmount =
    roundMoney(
      sellingPrice *
        requestedItem.quantity
    );

  const discountAmount =
    roundMoney(
      grossAmount *
        discountPercent /
        100
    );

  const taxableAmount =
    roundMoney(
      grossAmount -
        discountAmount
    );

  const taxAmount =
    roundMoney(
      taxableAmount *
        gstPercent /
        100
    );

  const lineTotal =
    roundMoney(
      taxableAmount +
        taxAmount
    );

  return {
    saleItemId:
      Number(
        lockedItem.saleItemId
      ),

    medicineId:
      Number(
        lockedItem.medicineId
      ),

    batchId:
      Number(
        lockedItem.batchId
      ),

    medicineName:
      lockedItem.medicineName,

    batchNumber:
      lockedItem.batchNumber,

    quantity:
      requestedItem.quantity,

    quantityAvailable:
      Number(
        lockedItem.quantityAvailable ||
        0
      ),

    sellingPrice,
    discountPercent,
    discountAmount,
    gstPercent,
    taxableAmount,
    taxAmount,
    lineTotal,
  };
};

const getPaymentStatus = ({
  dueAmount,
  paidAmount,
}) => {
  if (dueAmount <= 0) {
    return "PAID";
  }

  if (paidAmount > 0) {
    return "PARTIAL";
  }

  return "UNPAID";
};

const processSaleReturn = async ({
  payload = {},
  userId,
}) => {
  const createdBy =
    toPositiveInteger(
      userId,
      "Authenticated user ID"
    );

  const saleId =
    toPositiveInteger(
      payload.saleId ??
        payload.sale_id,
      "Sale ID"
    );

  const returnDate =
    normalizeReturnDate(
      payload.returnDate ??
        payload.return_date
    );

  const refundMethod =
    normalizeRefundMethod(
      payload.refundMethod ??
        payload.refund_method
    );

  const refundReference =
    normalizeText(
      payload.refundReference ??
        payload.refund_reference,
      {
        fieldName:
          "Refund reference",
        maxLength: 150,
      }
    );

  const reason = normalizeText(
    payload.reason,
    {
      required: true,
      fieldName:
        "Sale return reason",
      maxLength: 500,
    }
  );

  const requestedItems =
    normalizeItems(payload.items);

  const returnId =
    await saleReturnRepository
      .runInTransaction(
        async (connection) => {
          const sale =
            await saleReturnRepository
              .getSaleForUpdate(
                saleId,
                connection
              );

          if (!sale) {
            throw createError(
              "Sales invoice was not found.",
              404
            );
          }

          const saleStatus = String(
            sale.status || ""
          ).toUpperCase();

          if (
            saleStatus ===
            "CANCELLED"
          ) {
            throw createError(
              "A cancelled sale cannot be returned.",
              409
            );
          }

          if (
            saleStatus === "RETURNED"
          ) {
            throw createError(
              "This sales invoice has already been fully returned.",
              409
            );
          }

          const processedItems = [];

          for (
            const requestedItem of
              requestedItems
          ) {
            const lockedItem =
              await saleReturnRepository
                .getSaleItemForUpdate(
                  saleId,
                  requestedItem.saleItemId,
                  connection
                );

            if (!lockedItem) {
              throw createError(
                `Sale item ID ${requestedItem.saleItemId} was not found on this invoice.`,
                404
              );
            }

            processedItems.push(
              calculateReturnItem(
                lockedItem,
                requestedItem
              )
            );
          }

          const totals =
            processedItems.reduce(
              (summary, item) => {
                summary.totalQuantity +=
                  item.quantity;

                summary.taxableAmount =
                  roundMoney(
                    summary.taxableAmount +
                      item.taxableAmount
                  );

                summary.taxAmount =
                  roundMoney(
                    summary.taxAmount +
                      item.taxAmount
                  );

                summary.returnTotal =
                  roundMoney(
                    summary.returnTotal +
                      item.lineTotal
                  );

                return summary;
              },
              {
                totalQuantity: 0,
                taxableAmount: 0,
                taxAmount: 0,
                returnTotal: 0,
              }
            );

          const currentDueAmount =
            roundMoney(
              Math.max(
                Number(
                  sale.dueAmount || 0
                ),
                0
              )
            );

          const paidAmount =
            roundMoney(
              Math.max(
                Number(
                  sale.paidAmount || 0
                ),
                0
              )
            );

          const dueAdjusted =
            roundMoney(
              Math.min(
                totals.returnTotal,
                currentDueAmount
              )
            );

          const refundAmount =
            roundMoney(
              Math.max(
                totals.returnTotal -
                  dueAdjusted,
                0
              )
            );

          const newDueAmount =
            roundMoney(
              Math.max(
                currentDueAmount -
                  dueAdjusted,
                0
              )
            );

          const paymentStatus =
            getPaymentStatus({
              dueAmount:
                newDueAmount,
              paidAmount,
            });

          const returnNumber =
            generateReturnNumber(
              returnDate
            );

          const createdReturnId =
            await saleReturnRepository
              .insertSaleReturn(
                {
                  returnNumber,
                  saleId,
                  returnDate,
                  totalQuantity:
                    totals.totalQuantity,
                  taxableAmount:
                    totals.taxableAmount,
                  taxAmount:
                    totals.taxAmount,
                  refundAmount,
                  refundMethod,
                  refundReference,
                  reason,
                  createdBy,
                },
                connection
              );

          for (
            const item of
              processedItems
          ) {
            const returnedRows =
              await saleReturnRepository
                .increaseReturnedQuantity(
                  item.saleItemId,
                  item.quantity,
                  connection
                );

            if (returnedRows !== 1) {
              throw createError(
                `The returnable quantity changed for ${item.medicineName} (${item.batchNumber}). Please retry.`,
                409
              );
            }

            const stockRows =
              await saleReturnRepository
                .increaseBatchStock(
                  item.batchId,
                  item.quantity,
                  connection
                );

            if (stockRows !== 1) {
              throw createError(
                `Unable to restore stock for Batch ${item.batchNumber}.`,
                409
              );
            }

            const balanceAfter =
              item.quantityAvailable +
              item.quantity;

            await saleReturnRepository
              .insertSaleReturnItem(
                {
                  saleReturnId:
                    createdReturnId,
                  saleItemId:
                    item.saleItemId,
                  medicineId:
                    item.medicineId,
                  batchId:
                    item.batchId,
                  quantity:
                    item.quantity,
                  sellingPrice:
                    item.sellingPrice,
                  discountPercent:
                    item.discountPercent,
                  discountAmount:
                    item.discountAmount,
                  gstPercent:
                    item.gstPercent,
                  taxableAmount:
                    item.taxableAmount,
                  taxAmount:
                    item.taxAmount,
                  lineTotal:
                    item.lineTotal,
                },
                connection
              );

            await saleReturnRepository
              .insertSaleReturnStockMovement(
                {
                  medicineId:
                    item.medicineId,
                  batchId:
                    item.batchId,
                  quantity:
                    item.quantity,
                  balanceAfter,
                  saleReturnId:
                    createdReturnId,
                  notes:
                    `Stock received from customer through ${returnNumber}`,
                  createdBy,
                },
                connection
              );
          }

          const quantitySummary =
            await saleReturnRepository
              .getSaleReturnQuantitySummary(
                saleId,
                connection
              );

          const saleStatusAfterReturn =
            quantitySummary.soldQuantity >
              0 &&
            quantitySummary.returnedQuantity >=
              quantitySummary.soldQuantity
              ? "RETURNED"
              : "PARTIALLY_RETURNED";

          await saleReturnRepository
            .updateSaleAfterReturn(
              saleId,
              {
                dueAmount:
                  newDueAmount,
                paymentStatus,
                status:
                  saleStatusAfterReturn,
              },
              connection
            );

          await saleReturnRepository
            .updateCustomerAfterSaleReturn(
              sale.customerId,
              {
                returnTotal:
                  totals.returnTotal,
                dueAdjusted,
              },
              connection
            );

          return createdReturnId;
        }
      );

  return getSaleReturnDetails(
    returnId
  );
};

const getSaleReturnDetails = async (
  returnId
) => {
  const id = toPositiveInteger(
    returnId,
    "Sale return ID"
  );

  const returnHeader =
    await saleReturnRepository
      .getSaleReturnHeader(id);

  if (!returnHeader) {
    return null;
  }

  const items =
    await saleReturnRepository
      .getSaleReturnItems(id);

  return {
    returnHeader,
    items,
  };
};

const getSaleReturnList = async (
  filters = {}
) => {
  const page = Math.max(
    Number.parseInt(
      filters.page,
      10
    ) || 1,
    1
  );

  const limit = Math.min(
    Math.max(
      Number.parseInt(
        filters.limit,
        10
      ) || 10,
      1
    ),
    100
  );

  const search =
    normalizeText(
      filters.search,
      {
        fieldName: "Search",
        maxLength: 150,
      }
    ) || "";

  const saleId =
    toOptionalPositiveInteger(
      filters.saleId,
      "Sale ID"
    );

  const status =
    normalizeReturnStatus(
      filters.status
    );

  const dateFrom =
    normalizeDate(
      filters.dateFrom,
      "Start date"
    );

  const dateTo =
    normalizeDate(
      filters.dateTo,
      "End date"
    );

  if (
    dateFrom &&
    dateTo &&
    new Date(dateFrom) >
      new Date(dateTo)
  ) {
    throw createError(
      "Start date cannot be after end date."
    );
  }

  const offset =
    (page - 1) * limit;

  const result =
    await saleReturnRepository
      .getSaleReturns({
        search,
        saleId,
        status,
        dateFrom,
        dateTo,
        limit,
        offset,
      });

  const total = Number(
    result.total || 0
  );

  return {
    returns:
      result.returns || [],

    pagination: {
      page,
      limit,
      total,
      totalPages:
        total === 0
          ? 0
          : Math.ceil(
              total / limit
            ),
    },
  };
};

module.exports = {
  processSaleReturn,
  getSaleReturnDetails,
  getSaleReturnList,
};