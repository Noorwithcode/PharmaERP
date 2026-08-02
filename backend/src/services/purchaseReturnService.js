const crypto = require("crypto");

const {
  runInTransaction,

  getPurchaseForUpdate,
  getPurchaseItemForUpdate,

  insertPurchaseReturn,
  insertPurchaseReturnItem,

  decreaseBatchStock,
  increaseReturnedQuantity,
  insertPurchaseReturnStockMovement,

  getPurchaseReturnQuantitySummary,
  updatePurchaseAfterReturn,

  getPurchaseReturnHeader,
  getPurchaseReturnItems,
  getPurchaseReturns,
} = require(
  "../repositories/purchaseReturnRepository"
);

/*
|--------------------------------------------------------------------------
| Error and parsing helpers
|--------------------------------------------------------------------------
*/

const createApiError = (
  statusCode,
  message
) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

const roundMoney = (value) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Number(
    parsedValue.toFixed(2)
  );
};

const parsePositiveId = (value) => {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
};

const parsePositiveInteger = (
  value
) => {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
};

const parseDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const parsedDate = new Date(
    `${value}T00:00:00.000Z`
  );

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return value;
};

const optionalText = (
  value,
  maxLength = 500
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalizedValue =
    String(value).trim();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.slice(
    0,
    maxLength
  );
};

const generateReturnNumber = () => {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const randomPart = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `PRT-${datePart}-${randomPart}`;
};

const allowedSettlementMethods = [
  "CASH",
  "BANK",
  "UPI",
  "CHEQUE",
  "CREDIT_NOTE",
  "OTHER",
];

/*
|--------------------------------------------------------------------------
| Create purchase return
|--------------------------------------------------------------------------
*/

const processPurchaseReturn = async ({
  payload,
  userId,
}) => {
  const {
    purchaseId,
    returnDate,
    settlementMethod,
    settlementReference,
    reason,
    items,
  } = payload || {};

  const parsedPurchaseId =
    parsePositiveId(purchaseId);

  if (!parsedPurchaseId) {
    throw createApiError(
      400,
      "A valid purchase ID is required"
    );
  }

  const parsedUserId =
    parsePositiveId(userId);

  if (!parsedUserId) {
    throw createApiError(
      401,
      "Authenticated user information was not found"
    );
  }

  let normalizedReturnDate =
    new Date();

  if (
    returnDate !== undefined &&
    returnDate !== null &&
    returnDate !== ""
  ) {
    const parsedReturnDate =
      parseDate(String(returnDate));

    if (!parsedReturnDate) {
      throw createApiError(
        400,
        "Return date must use valid YYYY-MM-DD format"
      );
    }

    normalizedReturnDate =
      `${parsedReturnDate} 00:00:00`;
  }

  const normalizedReason =
    optionalText(reason, 500);

  if (!normalizedReason) {
    throw createApiError(
      400,
      "A return reason is required"
    );
  }

  let normalizedSettlementMethod =
    null;

  if (
    settlementMethod !== undefined &&
    settlementMethod !== null &&
    String(settlementMethod).trim() !== ""
  ) {
    normalizedSettlementMethod =
      String(settlementMethod)
        .trim()
        .toUpperCase();

    if (
      !allowedSettlementMethods.includes(
        normalizedSettlementMethod
      )
    ) {
      throw createApiError(
        400,
        "Invalid settlement method"
      );
    }
  }

  const normalizedSettlementReference =
    optionalText(
      settlementReference,
      150
    );

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw createApiError(
      400,
      "At least one return item is required"
    );
  }

  const preparedItems = [];
  const purchaseItemIds = new Set();

  items.forEach((rawItem, index) => {
    const item = rawItem || {};

    const purchaseItemId =
      parsePositiveId(
        item.purchaseItemId
      );

    if (!purchaseItemId) {
      throw createApiError(
        400,
        `A valid purchaseItemId is required for item ${index + 1}`
      );
    }

    const quantity =
      parsePositiveInteger(
        item.quantity ??
        item.returnQuantity
      );

    if (!quantity) {
      throw createApiError(
        400,
        `Return quantity must be a positive whole number for item ${index + 1}`
      );
    }

    if (
      purchaseItemIds.has(
        purchaseItemId
      )
    ) {
      throw createApiError(
        409,
        `Purchase item ${purchaseItemId} appears more than once`
      );
    }

    purchaseItemIds.add(
      purchaseItemId
    );

    preparedItems.push({
      purchaseItemId,
      quantity,
    });
  });

  const purchaseReturnId =
    await runInTransaction(
      async (connection) => {
        const purchase =
          await getPurchaseForUpdate(
            parsedPurchaseId,
            connection
          );

        if (!purchase) {
          throw createApiError(
            404,
            "Purchase was not found"
          );
        }

        if (
          purchase.status ===
          "CANCELLED"
        ) {
          throw createApiError(
            409,
            "A cancelled purchase cannot be returned"
          );
        }

        if (
          purchase.status ===
          "RETURNED"
        ) {
          throw createApiError(
            409,
            "This purchase is already fully returned"
          );
        }

        let totalQuantity = 0;
        let subtotal = 0;
        let discountAmount = 0;
        let taxableAmount = 0;
        let taxAmount = 0;
        let returnTotal = 0;

        const calculatedItems = [];

        for (
          const preparedItem of preparedItems
        ) {
          const purchaseItem =
            await getPurchaseItemForUpdate(
              parsedPurchaseId,
              preparedItem.purchaseItemId,
              connection
            );

          if (!purchaseItem) {
            throw createApiError(
              404,
              `Purchase item ${preparedItem.purchaseItemId} was not found for this purchase`
            );
          }

          const purchasedQuantity =
            Number(
              purchaseItem.purchasedQuantity
            );

          const returnedQuantity =
            Number(
              purchaseItem.returnedQuantity
            );

          const returnableQuantity =
            purchasedQuantity -
            returnedQuantity;

          if (
            preparedItem.quantity >
            returnableQuantity
          ) {
            throw createApiError(
              400,
              `Return quantity for ${purchaseItem.brandName} cannot exceed remaining returnable quantity ${returnableQuantity}`
            );
          }

          const availableStock =
            Number(
              purchaseItem.quantityAvailable
            );

          if (
            preparedItem.quantity >
            availableStock
          ) {
            throw createApiError(
              409,
              `Only ${availableStock} units are currently available in batch ${purchaseItem.batchNumber}`
            );
          }

          const purchasePrice =
            roundMoney(
              purchaseItem.purchasePrice
            );

          const discountPercent =
            roundMoney(
              purchaseItem.discountPercent
            );

          const gstPercent =
            roundMoney(
              purchaseItem.gstPercent
            );

          const itemSubtotal =
            roundMoney(
              preparedItem.quantity *
              purchasePrice
            );

          const itemDiscountAmount =
            roundMoney(
              itemSubtotal *
              (
                discountPercent /
                100
              )
            );

          const itemTaxableAmount =
            roundMoney(
              itemSubtotal -
              itemDiscountAmount
            );

          const itemTaxAmount =
            roundMoney(
              itemTaxableAmount *
              (
                gstPercent /
                100
              )
            );

          const itemLineTotal =
            roundMoney(
              itemTaxableAmount +
              itemTaxAmount
            );

          totalQuantity +=
            preparedItem.quantity;

          subtotal = roundMoney(
            subtotal +
            itemSubtotal
          );

          discountAmount =
            roundMoney(
              discountAmount +
              itemDiscountAmount
            );

          taxableAmount =
            roundMoney(
              taxableAmount +
              itemTaxableAmount
            );

          taxAmount = roundMoney(
            taxAmount +
            itemTaxAmount
          );

          returnTotal =
            roundMoney(
              returnTotal +
              itemLineTotal
            );

          calculatedItems.push({
            purchaseItemId:
              preparedItem.purchaseItemId,

            medicineId:
              purchaseItem.medicineId,

            batchId:
              purchaseItem.batchId,

            batchNumber:
              purchaseItem.batchNumber,

            brandName:
              purchaseItem.brandName,

            quantity:
              preparedItem.quantity,

            purchasePrice,
            discountPercent,
            discountAmount:
              itemDiscountAmount,
            gstPercent,
            taxableAmount:
              itemTaxableAmount,
            taxAmount:
              itemTaxAmount,
            lineTotal:
              itemLineTotal,

            currentStock:
              availableStock,
          });
        }

        const currentDueAmount =
          roundMoney(
            purchase.dueAmount
          );

        const dueAdjusted =
          roundMoney(
            Math.min(
              currentDueAmount,
              returnTotal
            )
          );

        const refundAmount =
          roundMoney(
            returnTotal -
            dueAdjusted
          );

        if (
          refundAmount > 0 &&
          !normalizedSettlementMethod
        ) {
          throw createApiError(
            400,
            "Settlement method is required when a supplier refund is due"
          );
        }

        const returnNumber =
          generateReturnNumber();

        const createdReturnId =
          await insertPurchaseReturn(
            {
              returnNumber,
              purchaseId:
                parsedPurchaseId,
              supplierId:
                purchase.supplierId,
              returnDate:
                normalizedReturnDate,
              totalQuantity,
              subtotal,
              discountAmount,
              taxableAmount,
              taxAmount,
              returnTotal,
              dueAdjusted,
              refundAmount,
              settlementMethod:
                normalizedSettlementMethod,
              settlementReference:
                normalizedSettlementReference,
              reason:
                normalizedReason,
              createdBy:
                parsedUserId,
            },
            connection
          );

        for (
          const item of calculatedItems
        ) {
          await insertPurchaseReturnItem(
            {
              purchaseReturnId:
                createdReturnId,
              purchaseItemId:
                item.purchaseItemId,
              medicineId:
                item.medicineId,
              batchId:
                item.batchId,
              quantity:
                item.quantity,
              purchasePrice:
                item.purchasePrice,
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

          const updatedReturnedRows =
            await increaseReturnedQuantity(
              item.purchaseItemId,
              item.quantity,
              connection
            );

          if (
            updatedReturnedRows !== 1
          ) {
            throw createApiError(
              409,
              `Return quantity conflict occurred for purchase item ${item.purchaseItemId}`
            );
          }

          const updatedStockRows =
            await decreaseBatchStock(
              item.batchId,
              item.quantity,
              connection
            );

          if (
            updatedStockRows !== 1
          ) {
            throw createApiError(
              409,
              `Insufficient stock in batch ${item.batchNumber}`
            );
          }

          const balanceAfter =
            item.currentStock -
            item.quantity;

          await insertPurchaseReturnStockMovement(
            {
              medicineId:
                item.medicineId,
              batchId:
                item.batchId,
              quantity:
                item.quantity,
              balanceAfter,
              purchaseReturnId:
                createdReturnId,
              notes:
                `Stock returned to supplier through ${returnNumber}`,
              createdBy:
                parsedUserId,
            },
            connection
          );
        }

        const quantitySummary =
          await getPurchaseReturnQuantitySummary(
            parsedPurchaseId,
            connection
          );

        const purchaseStatus =
          quantitySummary.purchasedQuantity > 0 &&
          quantitySummary.returnedQuantity >=
            quantitySummary.purchasedQuantity
            ? "RETURNED"
            : "PARTIALLY_RETURNED";

        const updatedDueAmount =
          roundMoney(
            currentDueAmount -
            dueAdjusted
          );

        let updatedPaymentStatus =
          "UNPAID";

        if (updatedDueAmount <= 0) {
          updatedPaymentStatus =
            "PAID";
        } else if (
          Number(
            purchase.paidAmount
          ) > 0
        ) {
          updatedPaymentStatus =
            "PARTIAL";
        }

        await updatePurchaseAfterReturn(
          parsedPurchaseId,
          {
            dueAmount:
              updatedDueAmount,
            paymentStatus:
              updatedPaymentStatus,
            status:
              purchaseStatus,
          },
          connection
        );

        return createdReturnId;
      }
    );

  return getReturnDetails(
    purchaseReturnId
  );
};

/*
|--------------------------------------------------------------------------
| Return details
|--------------------------------------------------------------------------
*/

const getReturnDetails = async (
  returnId
) => {
  const parsedReturnId =
    parsePositiveId(returnId);

  if (!parsedReturnId) {
    throw createApiError(
      400,
      "A valid purchase return ID is required"
    );
  }

  const returnHeader =
    await getPurchaseReturnHeader(
      parsedReturnId
    );

  if (!returnHeader) {
    return null;
  }

  const items =
    await getPurchaseReturnItems(
      parsedReturnId
    );

  return {
    returnHeader,
    items:
      Array.isArray(items)
        ? items
        : [],
  };
};

/*
|--------------------------------------------------------------------------
| Return list
|--------------------------------------------------------------------------
*/

const getReturnList = async ({
  search,
  purchaseId,
  status,
  dateFrom,
  dateTo,
  page,
  limit,
} = {}) => {
  const pageNumber = Math.max(
    Number.parseInt(page, 10) || 1,
    1
  );

  const limitNumber = Math.min(
    Math.max(
      Number.parseInt(limit, 10) || 10,
      1
    ),
    100
  );

  let parsedPurchaseId = null;

  if (
    purchaseId !== undefined &&
    purchaseId !== null &&
    purchaseId !== ""
  ) {
    parsedPurchaseId =
      parsePositiveId(purchaseId);

    if (!parsedPurchaseId) {
      throw createApiError(
        400,
        "A valid purchase ID is required"
      );
    }
  }

  let normalizedStatus = null;

  if (
    status !== undefined &&
    status !== null &&
    String(status).trim() !== ""
  ) {
    normalizedStatus =
      String(status)
        .trim()
        .toUpperCase();

    if (
      ![
        "COMPLETED",
        "CANCELLED",
      ].includes(
        normalizedStatus
      )
    ) {
      throw createApiError(
        400,
        "Invalid purchase return status"
      );
    }
  }

  let parsedDateFrom = null;

  if (
    dateFrom !== undefined &&
    dateFrom !== null &&
    dateFrom !== ""
  ) {
    parsedDateFrom =
      parseDate(
        String(dateFrom)
      );

    if (!parsedDateFrom) {
      throw createApiError(
        400,
        "dateFrom must use valid YYYY-MM-DD format"
      );
    }
  }

  let parsedDateTo = null;

  if (
    dateTo !== undefined &&
    dateTo !== null &&
    dateTo !== ""
  ) {
    parsedDateTo =
      parseDate(
        String(dateTo)
      );

    if (!parsedDateTo) {
      throw createApiError(
        400,
        "dateTo must use valid YYYY-MM-DD format"
      );
    }
  }

  if (
    parsedDateFrom &&
    parsedDateTo &&
    parsedDateFrom > parsedDateTo
  ) {
    throw createApiError(
      400,
      "dateFrom cannot be after dateTo"
    );
  }

  const result =
    await getPurchaseReturns({
      search:
        String(search || "").trim(),
      purchaseId:
        parsedPurchaseId,
      status:
        normalizedStatus,
      dateFrom:
        parsedDateFrom,
      dateTo:
        parsedDateTo,
      limit:
        limitNumber,
      offset:
        (
          pageNumber - 1
        ) * limitNumber,
    });

  const total = Number(
    result.total || 0
  );

  return {
    returns:
      result.returns || [],

    pagination: {
      page:
        pageNumber,
      limit:
        limitNumber,
      total,
      totalPages:
        Math.ceil(
          total /
          limitNumber
        ),
    },
  };
};

module.exports = {
  processPurchaseReturn,
  getReturnDetails,
  getReturnList,
};