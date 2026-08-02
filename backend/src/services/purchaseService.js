const crypto = require("crypto");

const {
  runInTransaction,
  getPurchaseHeader,
  getPurchaseItems,
  getPurchases,

  getActiveSupplierForUpdate,
  findDuplicateSupplierInvoice,
  getActiveMedicine,

  insertPurchase,
  insertPurchasePayment,

  getBatchForUpdate,
  updateMedicineBatch,
  insertMedicineBatch,

  insertPurchaseItem,
  insertStockMovement,
} = require(
  "../repositories/purchaseRepository"
);

const {
  parsePositiveId,
} = require("../utils/formatters");

/*
|--------------------------------------------------------------------------
| API error
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

/*
|--------------------------------------------------------------------------
| Parsing helpers
|--------------------------------------------------------------------------
*/

const roundMoney = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
};

const parseNonNegativeInteger = (
  value,
  fallback = 0
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 0
  ) {
    return null;
  }

  return parsedValue;
};

const parsePositiveMoney = (value) => {
  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return roundMoney(parsedValue);
};

const parseNonNegativeMoney = (
  value,
  fallback = 0
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0
  ) {
    return null;
  }

  return roundMoney(parsedValue);
};

const parsePercentage = (
  value,
  fallback = 0
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0 ||
    parsedValue > 100
  ) {
    return null;
  }

  return roundMoney(parsedValue);
};

const parseRoundOff = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < -100 ||
    parsedValue > 100
  ) {
    return null;
  }

  return roundMoney(parsedValue);
};

const parseDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !==
      value
  ) {
    return null;
  }

  return value;
};

const normalizeOptionalString = (
  value
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  return normalized || null;
};

const generatePurchaseNumber = () => {
  const today = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const randomPart = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `PUR-${today}-${randomPart}`;
};

/*
|--------------------------------------------------------------------------
| Prepare purchase items
|--------------------------------------------------------------------------
*/

const preparePurchaseItems = (items) => {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw createApiError(
      400,
      "At least one purchase item is required"
    );
  }

  const preparedItems = [];
  const batchKeys = new Set();

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  items.forEach((rawItem, index) => {
    const item = rawItem || {};
    const itemNumber = index + 1;

    const medicineId =
      parsePositiveId(
        item.medicineId
      );

    if (!medicineId) {
      throw createApiError(
        400,
        `A valid medicine ID is required for item ${itemNumber}`
      );
    }

    const batchNumber =
      normalizeOptionalString(
        item.batchNumber
      );

    if (!batchNumber) {
      throw createApiError(
        400,
        `Batch number is required for item ${itemNumber}`
      );
    }

    const normalizedBatchNumber =
      batchNumber.toUpperCase();

    const manufactureDate =
      item.manufactureDate ===
        undefined ||
      item.manufactureDate === null ||
      item.manufactureDate === ""
        ? null
        : parseDate(
            String(
              item.manufactureDate
            )
          );

    if (
      item.manufactureDate &&
      !manufactureDate
    ) {
      throw createApiError(
        400,
        `Manufacture date is invalid for item ${itemNumber}`
      );
    }

    const expiryDate = parseDate(
      String(item.expiryDate || "")
    );

    if (!expiryDate) {
      throw createApiError(
        400,
        `Valid expiry date is required for item ${itemNumber}`
      );
    }

    if (
      manufactureDate &&
      manufactureDate >= expiryDate
    ) {
      throw createApiError(
        400,
        `Expiry date must be after manufacture date for item ${itemNumber}`
      );
    }

    if (expiryDate <= today) {
      throw createApiError(
        400,
        `Expired stock cannot be purchased for item ${itemNumber}`
      );
    }

    const quantity =
      parseNonNegativeInteger(
        item.quantity,
        0
      );

    const freeQuantity =
      parseNonNegativeInteger(
        item.freeQuantity,
        0
      );

    if (
      quantity === null ||
      freeQuantity === null
    ) {
      throw createApiError(
        400,
        `Quantities must be whole numbers for item ${itemNumber}`
      );
    }

    if (
      quantity + freeQuantity <=
      0
    ) {
      throw createApiError(
        400,
        `Total received quantity must be greater than zero for item ${itemNumber}`
      );
    }

    const purchasePrice =
      parsePositiveMoney(
        item.purchasePrice
      );

    const mrp =
      parsePositiveMoney(item.mrp);

    const sellingPrice =
      parsePositiveMoney(
        item.sellingPrice
      );

    if (
      purchasePrice === null ||
      mrp === null ||
      sellingPrice === null
    ) {
      throw createApiError(
        400,
        `Purchase price, MRP and selling price must be positive for item ${itemNumber}`
      );
    }

    if (purchasePrice > mrp) {
      throw createApiError(
        400,
        `Purchase price cannot exceed MRP for item ${itemNumber}`
      );
    }

    if (sellingPrice > mrp) {
      throw createApiError(
        400,
        `Selling price cannot exceed MRP for item ${itemNumber}`
      );
    }

    const discountInput =
      item.discountPercent ??
      item.discount_percent ??
      0;

    const discountPercent =
      parsePercentage(
        discountInput,
        0
      );

    if (discountPercent === null) {
      throw createApiError(
        400,
        `Discount percentage is invalid for item ${itemNumber}`
      );
    }

    const gstInput =
      item.gstPercent ??
      item.gstRate ??
      item.taxRate ??
      item.gst_percent ??
      item.tax_rate;

    let gstPercent;

    if (gstInput !== undefined) {
      gstPercent = parsePercentage(
        gstInput,
        0
      );

      if (gstPercent === null) {
        throw createApiError(
          400,
          `GST percentage is invalid for item ${itemNumber}`
        );
      }
    }

    const batchKey =
      `${medicineId}:${normalizedBatchNumber}`;

    if (batchKeys.has(batchKey)) {
      throw createApiError(
        409,
        "The same medicine batch appears more than once"
      );
    }

    batchKeys.add(batchKey);

    preparedItems.push({
      medicineId,
      batchNumber:
        normalizedBatchNumber,
      manufactureDate,
      expiryDate,
      quantity,
      freeQuantity,
      purchasePrice,
      mrp,
      sellingPrice,
      discountPercent,
      gstPercent,
      location:
        normalizeOptionalString(
          item.location
        ),
    });
  });

  return preparedItems;
};

/*
|--------------------------------------------------------------------------
| Create purchase
|--------------------------------------------------------------------------
*/

const createPurchaseRecord = async ({
  payload,
  userId,
}) => {
  const {
    supplierId,
    invoiceNumber,
    invoiceDate,
    purchaseDate,
    paidAmount,
    paymentMethod,
    roundOff,
    notes,
    items,
  } = payload || {};

  const parsedSupplierId =
    parsePositiveId(supplierId);

  if (!parsedSupplierId) {
    throw createApiError(
      400,
      "A valid supplier ID is required"
    );
  }

  const normalizedInvoiceNumber =
    normalizeOptionalString(
      invoiceNumber
    );

  if (!normalizedInvoiceNumber) {
    throw createApiError(
      400,
      "Supplier invoice number is required"
    );
  }

  const parsedInvoiceDate =
    parseDate(
      String(invoiceDate || "")
    );

  if (!parsedInvoiceDate) {
    throw createApiError(
      400,
      "Invoice date must use valid YYYY-MM-DD format"
    );
  }

  const parsedPurchaseDate =
    parseDate(
      String(purchaseDate || "")
    );

  if (!parsedPurchaseDate) {
    throw createApiError(
      400,
      "Purchase date must use valid YYYY-MM-DD format"
    );
  }

  const parsedPaidAmount =
    parseNonNegativeMoney(
      paidAmount,
      0
    );

  if (parsedPaidAmount === null) {
    throw createApiError(
      400,
      "Paid amount must be zero or greater"
    );
  }

  const parsedRoundOff =
    parseRoundOff(roundOff);

  if (parsedRoundOff === null) {
    throw createApiError(
      400,
      "Round-off must be between -100 and 100"
    );
  }

  const allowedPaymentMethods = [
    "CASH",
    "BANK",
    "UPI",
    "CARD",
    "CHEQUE",
    "CREDIT",
    "OTHER",
  ];

  let normalizedPaymentMethod =
    null;

  if (
    paymentMethod !== undefined &&
    paymentMethod !== null &&
    String(paymentMethod).trim() !==
      ""
  ) {
    normalizedPaymentMethod =
      String(paymentMethod)
        .trim()
        .toUpperCase();

    if (
      !allowedPaymentMethods.includes(
        normalizedPaymentMethod
      )
    ) {
      throw createApiError(
        400,
        "Invalid payment method"
      );
    }
  }

  if (
    parsedPaidAmount > 0 &&
    !normalizedPaymentMethod
  ) {
    throw createApiError(
      400,
      "Payment method is required when paid amount is greater than zero"
    );
  }

  const preparedItems =
    preparePurchaseItems(items);

  const purchaseNumber =
    generatePurchaseNumber();

  const purchaseId =
    await runInTransaction(
      async (connection) => {
        const supplier =
          await getActiveSupplierForUpdate(
            parsedSupplierId,
            connection
          );

        if (!supplier) {
          throw createApiError(
            400,
            "Active supplier was not found"
          );
        }

        const duplicateInvoice =
          await findDuplicateSupplierInvoice(
            parsedSupplierId,
            normalizedInvoiceNumber,
            connection
          );

        if (duplicateInvoice) {
          throw createApiError(
            409,
            "This supplier invoice already exists"
          );
        }

        let subtotal = 0;
        let discountAmount = 0;
        let taxableAmount = 0;
        let taxAmount = 0;

        const calculatedItems = [];

        for (
          const item of preparedItems
        ) {
          const medicine =
            await getActiveMedicine(
              item.medicineId,
              connection
            );

          if (!medicine) {
            throw createApiError(
              400,
              `Active medicine ID ${item.medicineId} was not found`
            );
          }

          const parsedMedicineGst =
            parsePercentage(
              medicine.gstPercent,
              0
            );

          const medicineGst =
            parsedMedicineGst === null
              ? 0
              : parsedMedicineGst;

          const finalGstPercent =
            item.gstPercent !==
            undefined
              ? item.gstPercent
              : medicineGst;

          const itemSubtotal =
            roundMoney(
              item.quantity *
                item.purchasePrice
            );

          const itemDiscountAmount =
            roundMoney(
              itemSubtotal *
                (
                  item.discountPercent /
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
                  finalGstPercent /
                  100
                )
            );

          const itemLineTotal =
            roundMoney(
              itemTaxableAmount +
                itemTaxAmount
            );

          subtotal = roundMoney(
            subtotal + itemSubtotal
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

          calculatedItems.push({
            ...item,
            gstPercent:
              finalGstPercent,
            discountAmount:
              itemDiscountAmount,
            taxableAmount:
              itemTaxableAmount,
            taxAmount:
              itemTaxAmount,
            lineTotal:
              itemLineTotal,
          });
        }

        const grandTotal =
          roundMoney(
            taxableAmount +
              taxAmount +
              parsedRoundOff
          );

        if (grandTotal < 0) {
          throw createApiError(
            400,
            "Grand total cannot be negative"
          );
        }

        if (
          parsedPaidAmount >
          grandTotal
        ) {
          throw createApiError(
            400,
            "Paid amount cannot be greater than grand total"
          );
        }

        const dueAmount =
          roundMoney(
            grandTotal -
              parsedPaidAmount
          );

        let paymentStatus =
          "UNPAID";

        if (
          parsedPaidAmount > 0 &&
          dueAmount > 0
        ) {
          paymentStatus =
            "PARTIAL";
        }

        if (dueAmount === 0) {
          paymentStatus = "PAID";
        }

        const createdPurchaseId =
          await insertPurchase(
            {
              purchaseNumber,
              supplierId:
                parsedSupplierId,

              invoiceNumber:
                normalizedInvoiceNumber
                  .trim()
                  .toUpperCase(),

              invoiceDate:
                parsedInvoiceDate,

              purchaseDate:
                parsedPurchaseDate,

              subtotal,
              discountAmount,
              taxableAmount,
              taxAmount,
              roundOff:
                parsedRoundOff,
              grandTotal,
              paidAmount:
                parsedPaidAmount,
              dueAmount,
              paymentStatus,
              paymentMethod:
                normalizedPaymentMethod,

              notes:
                normalizeOptionalString(
                  notes
                ),

              createdBy: userId,
            },
            connection
          );

        /*
        |--------------------------------------------------------------------------
        | Initial payment history
        |--------------------------------------------------------------------------
        */

        if (parsedPaidAmount > 0) {
          await insertPurchasePayment(
            {
              purchaseId:
                createdPurchaseId,

              amount:
                parsedPaidAmount,

              paymentMethod:
                normalizedPaymentMethod,

              transactionReference:
                null,

              paymentNotes:
                "Initial payment recorded during purchase creation",

              paidBy: userId,

              paymentDate: null,
            },
            connection
          );
        }

        /*
        |--------------------------------------------------------------------------
        | Items, batches and stock
        |--------------------------------------------------------------------------
        */

        for (
          const item of calculatedItems
        ) {
          const totalStockAdded =
            item.quantity +
            item.freeQuantity;

          const existingBatch =
            await getBatchForUpdate(
              item.medicineId,
              item.batchNumber,
              connection
            );

          let batchId;
          let balanceAfter;

          if (existingBatch) {
            if (
              existingBatch.expiryDate !==
              item.expiryDate
            ) {
              throw createApiError(
                409,
                `Expiry date does not match existing batch ${item.batchNumber}`
              );
            }

            balanceAfter =
              Number(
                existingBatch
                  .quantityAvailable
              ) +
              totalStockAdded;

            await updateMedicineBatch(
              existingBatch.id,
              {
                supplierId:
                  parsedSupplierId,

                manufactureDate:
                  item.manufactureDate,

                expiryDate:
                  item.expiryDate,

                purchasePrice:
                  item.purchasePrice,

                mrp: item.mrp,

                sellingPrice:
                  item.sellingPrice,

                quantity:
                  item.quantity,

                freeQuantity:
                  item.freeQuantity,

                balanceAfter,
                purchaseNumber,

                location:
                  item.location,
              },
              connection
            );

            batchId =
              existingBatch.id;
          } else {
            balanceAfter =
              totalStockAdded;

            batchId =
              await insertMedicineBatch(
                {
                  medicineId:
                    item.medicineId,

                  supplierId:
                    parsedSupplierId,

                  batchNumber:
                    item.batchNumber,

                  manufactureDate:
                    item.manufactureDate,

                  expiryDate:
                    item.expiryDate,

                  purchasePrice:
                    item.purchasePrice,

                  mrp: item.mrp,

                  sellingPrice:
                    item.sellingPrice,

                  quantity:
                    item.quantity,

                  freeQuantity:
                    item.freeQuantity,

                  quantityAvailable:
                    totalStockAdded,

                  purchaseNumber,

                  location:
                    item.location,

                  createdBy:
                    userId,
                },
                connection
              );
          }

          await insertPurchaseItem(
            {
              purchaseId:
                createdPurchaseId,

              medicineId:
                item.medicineId,

              batchId,

              batchNumber:
                item.batchNumber,

              manufactureDate:
                item.manufactureDate,

              expiryDate:
                item.expiryDate,

              quantity:
                item.quantity,

              freeQuantity:
                item.freeQuantity,

              purchasePrice:
                item.purchasePrice,

              mrp: item.mrp,

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

          await insertStockMovement(
            {
              medicineId:
                item.medicineId,

              batchId,

              quantity:
                totalStockAdded,

              balanceAfter,

              purchaseId:
                createdPurchaseId,

              notes:
                `Stock received through ${purchaseNumber}`,

              createdBy:
                userId,
            },
            connection
          );
        }

        return createdPurchaseId;
      }
    );

  const purchase =
    await getPurchaseHeader(
      purchaseId
    );

  const purchaseItems =
    await getPurchaseItems(
      purchaseId
    );

  return {
    purchase,
    items: purchaseItems,
  };
};

/*
|--------------------------------------------------------------------------
| Purchase list
|--------------------------------------------------------------------------
*/

const getPurchaseList = async ({
  search,
  supplierId,
  paymentStatus,
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
      Number.parseInt(limit, 10) ||
        10,
      1
    ),
    100
  );

  const offset =
    (pageNumber - 1) *
    limitNumber;

  let parsedSupplierId = null;

  if (
    supplierId !== undefined &&
    supplierId !== null &&
    supplierId !== ""
  ) {
    parsedSupplierId =
      parsePositiveId(supplierId);

    if (!parsedSupplierId) {
      throw createApiError(
        400,
        "A valid supplier ID is required"
      );
    }
  }

  let normalizedPaymentStatus =
    null;

  if (
    paymentStatus !== undefined &&
    paymentStatus !== null &&
    String(paymentStatus).trim() !==
      ""
  ) {
    normalizedPaymentStatus =
      String(paymentStatus)
        .trim()
        .toUpperCase();

    if (
      ![
        "UNPAID",
        "PARTIAL",
        "PAID",
      ].includes(
        normalizedPaymentStatus
      )
    ) {
      throw createApiError(
        400,
        "Invalid payment status"
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

    const allowedStatuses = [
      "COMPLETED",
      "PARTIALLY_RETURNED",
      "RETURNED",
      "CANCELLED",
    ];

    if (
      !allowedStatuses.includes(
        normalizedStatus
      )
    ) {
      throw createApiError(
        400,
        "Invalid purchase status"
      );
    }
  }

  let parsedDateFrom = null;

  if (
    dateFrom !== undefined &&
    dateFrom !== null &&
    dateFrom !== ""
  ) {
    parsedDateFrom = parseDate(
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
    parsedDateTo = parseDate(
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
    parsedDateFrom >
      parsedDateTo
  ) {
    throw createApiError(
      400,
      "dateFrom cannot be after dateTo"
    );
  }

  const result =
    await getPurchases({
      search: String(
        search || ""
      ).trim(),

      supplierId:
        parsedSupplierId,

      paymentStatus:
        normalizedPaymentStatus,

      status:
        normalizedStatus,

      dateFrom:
        parsedDateFrom,

      dateTo:
        parsedDateTo,

      limit:
        limitNumber,

      offset,
    });

  const total = Number(
    result.total || 0
  );

  return {
    purchases:
      result.purchases || [],

    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,

      totalPages:
        Math.ceil(
          total / limitNumber
        ),
    },
  };
};

/*
|--------------------------------------------------------------------------
| Purchase details
|--------------------------------------------------------------------------
*/

const getPurchaseDetails = async (
  purchaseId
) => {
  const purchase =
    await getPurchaseHeader(
      purchaseId
    );

  if (!purchase) {
    return null;
  }

  const items =
    await getPurchaseItems(
      purchaseId
    );

  return {
    purchase,

    items:
      Array.isArray(items)
        ? items
        : [],
  };
};

/*
|--------------------------------------------------------------------------
| Purchase items
|--------------------------------------------------------------------------
*/

const getPurchaseItemsData = async (
  purchaseId
) => {
  const purchase =
    await getPurchaseHeader(
      purchaseId
    );

  if (!purchase) {
    return null;
  }

  const items =
    await getPurchaseItems(
      purchaseId
    );

  const normalizedItems =
    Array.isArray(items)
      ? items
      : [];

  return {
    purchaseId,

    purchaseNumber:
      purchase.purchaseNumber,

    count:
      normalizedItems.length,

    items:
      normalizedItems,
  };
};

/*
|--------------------------------------------------------------------------
| Invoice data
|--------------------------------------------------------------------------
*/

const getPurchaseInvoiceData = async (
  purchaseId
) => {
  return getPurchaseDetails(
    purchaseId
  );
};

module.exports = {
  createPurchaseRecord,
  getPurchaseList,
  getPurchaseDetails,
  getPurchaseItemsData,
  getPurchaseInvoiceData,
};