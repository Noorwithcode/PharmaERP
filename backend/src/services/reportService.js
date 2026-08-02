const reportRepository = require(
  "../repositories/reportRepository"
);

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toNumber = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
};

/**
 * Monetary value দুই decimal পর্যন্ত রাখে।
 */
const roundMoney = (value) => {
  return Number(
    toNumber(value).toFixed(2)
  );
};

const validateDateRange = (
  startDate,
  endDate
) => {
  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (
    !datePattern.test(startDate) ||
    !datePattern.test(endDate)
  ) {
    throw createError(
      "Dates must use YYYY-MM-DD format."
    );
  }

  const start = new Date(
    `${startDate}T00:00:00Z`
  );

  const end = new Date(
    `${endDate}T00:00:00Z`
  );

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw createError(
      "Invalid report date."
    );
  }

  if (start > end) {
    throw createError(
      "startDate cannot be after endDate."
    );
  }

  return {
    startDate,
    endDate
  };
};

const formatPurchase = (
  purchase
) => {
  return {
    ...purchase,

    id:
      toNumber(purchase.id),

    supplierId:
      toNumber(
        purchase.supplierId
      ),

    subtotal:
      roundMoney(
        purchase.subtotal
      ),

    discountAmount:
      roundMoney(
        purchase.discountAmount
      ),

    taxableAmount:
      roundMoney(
        purchase.taxableAmount
      ),

    taxAmount:
      roundMoney(
        purchase.taxAmount
      ),

    roundOff:
      roundMoney(
        purchase.roundOff
      ),

    grandTotal:
      roundMoney(
        purchase.grandTotal
      ),

    paidAmount:
      roundMoney(
        purchase.paidAmount
      ),

    dueAmount:
      roundMoney(
        purchase.dueAmount
      )
  };
};

const formatSale = (sale) => {
  return {
    ...sale,

    id:
      toNumber(sale.id),

    customerId:
      sale.customerId === null
        ? null
        : toNumber(
            sale.customerId
          ),

    totalQuantity:
      toNumber(
        sale.totalQuantity
      ),

    subtotal:
      roundMoney(
        sale.subtotal
      ),

    discountAmount:
      roundMoney(
        sale.discountAmount
      ),

    taxableAmount:
      roundMoney(
        sale.taxableAmount
      ),

    taxAmount:
      roundMoney(
        sale.taxAmount
      ),

    roundOff:
      roundMoney(
        sale.roundOff
      ),

    grandTotal:
      roundMoney(
        sale.grandTotal
      ),

    paidAmount:
      roundMoney(
        sale.paidAmount
      ),

    dueAmount:
      roundMoney(
        sale.dueAmount
      )
  };
};

/**
 * Purchase report।
 */
const getPurchaseReport = async (
  startDate,
  endDate
) => {
  validateDateRange(
    startDate,
    endDate
  );

  const rows =
    await reportRepository
      .getPurchaseReport(
        startDate,
        endDate
      );

  const purchases =
    rows.map(formatPurchase);

  /*
   * Financial summary-তে completed
   * এবং partially-returned purchases।
   */
  const financialPurchases =
    purchases.filter(
      (purchase) =>
        [
          "COMPLETED",
          "PARTIALLY_RETURNED"
        ].includes(purchase.status)
    );

  const returnedPurchases =
    purchases.filter(
      (purchase) =>
        purchase.status ===
        "RETURNED"
    ).length;

  const cancelledPurchases =
    purchases.filter(
      (purchase) =>
        purchase.status ===
        "CANCELLED"
    ).length;

  return {
    filters: {
      startDate,
      endDate
    },

    summary: {
      totalRecords:
        purchases.length,

      totalBills:
        financialPurchases.length,

      returnedPurchases,
      cancelledPurchases,

      totalPurchaseAmount:
        roundMoney(
          financialPurchases.reduce(
            (sum, purchase) =>
              sum +
              purchase.grandTotal,
            0
          )
        ),

      totalPaid:
        roundMoney(
          financialPurchases.reduce(
            (sum, purchase) =>
              sum +
              purchase.paidAmount,
            0
          )
        ),

      totalDue:
        roundMoney(
          financialPurchases.reduce(
            (sum, purchase) =>
              sum +
              purchase.dueAmount,
            0
          )
        )
    },

    purchases
  };
};

/**
 * Sales report।
 */
const getSalesReport = async (
  startDate,
  endDate
) => {
  validateDateRange(
    startDate,
    endDate
  );

  const rows =
    await reportRepository
      .getSalesReport(
        startDate,
        endDate
      );

  const sales =
    rows.map(formatSale);

  /*
   * Financial summary-তে completed
   * এবং partially-returned sales।
   */
  const financialSales =
    sales.filter(
      (sale) =>
        [
          "COMPLETED",
          "PARTIALLY_RETURNED"
        ].includes(sale.status)
    );

  const returnedInvoices =
    sales.filter(
      (sale) =>
        sale.status === "RETURNED"
    ).length;

  const cancelledInvoices =
    sales.filter(
      (sale) =>
        sale.status === "CANCELLED"
    ).length;

  return {
    filters: {
      startDate,
      endDate
    },

    summary: {
      totalRecords:
        sales.length,

      totalInvoices:
        financialSales.length,

      returnedInvoices,
      cancelledInvoices,

      totalSalesAmount:
        roundMoney(
          financialSales.reduce(
            (sum, sale) =>
              sum +
              sale.grandTotal,
            0
          )
        ),

      totalPaid:
        roundMoney(
          financialSales.reduce(
            (sum, sale) =>
              sum +
              sale.paidAmount,
            0
          )
        ),

      totalDue:
        roundMoney(
          financialSales.reduce(
            (sum, sale) =>
              sum +
              sale.dueAmount,
            0
          )
        )
    },

    sales
  };
};

/**
 * Expiry report।
 */
const getExpiryReport = async (
  days = 90
) => {
  const safeDays =
    Number(days);

  if (
    !Number.isInteger(safeDays) ||
    safeDays < 0 ||
    safeDays > 3650
  ) {
    throw createError(
      "Expiry days must be between " +
      "0 and 3650."
    );
  }

  const rows =
    await reportRepository
      .getExpiryReport(safeDays);

  const batches = rows.map(
    (batch) => ({
      ...batch,

      batchId:
        toNumber(batch.batchId),

      medicineId:
        toNumber(batch.medicineId),

      quantityAvailable:
        toNumber(
          batch.quantityAvailable
        ),

      purchasePrice:
        roundMoney(
          batch.purchasePrice
        ),

      mrp:
        roundMoney(batch.mrp),

      sellingPrice:
        roundMoney(
          batch.sellingPrice
        ),

      daysToExpire:
        toNumber(
          batch.daysToExpire
        )
    })
  );

  return {
    filters: {
      days: safeDays
    },

    summary: {
      totalBatches:
        batches.length,

      expiredBatches:
        batches.filter(
          (batch) =>
            batch.expiryStatus ===
            "EXPIRED"
        ).length,

      expiringSoonBatches:
        batches.filter(
          (batch) =>
            batch.expiryStatus ===
            "EXPIRING_SOON"
        ).length,

      totalQuantity:
        batches.reduce(
          (sum, batch) =>
            sum +
            batch.quantityAvailable,
          0
        ),

      totalPurchaseValue:
        roundMoney(
          batches.reduce(
            (sum, batch) =>
              sum +
              (
                batch.quantityAvailable *
                batch.purchasePrice
              ),
            0
          )
        )
    },

    batches
  };
};

/**
 * Low-stock report।
 */
const getLowStockReport = async () => {
  const rows =
    await reportRepository
      .getLowStockReport();

  const medicines = rows.map(
    (medicine) => {
      const reorderLevel =
        toNumber(
          medicine.reorderLevel
        );

      const availableStock =
        toNumber(
          medicine.availableStock
        );

      return {
        ...medicine,

        medicineId:
          toNumber(
            medicine.medicineId
          ),

        reorderLevel,
        availableStock,

        shortageQuantity:
          Math.max(
            reorderLevel -
            availableStock,
            0
          )
      };
    }
  );

  return {
    summary: {
      lowStockCount:
        medicines.length,

      outOfStockCount:
        medicines.filter(
          (medicine) =>
            medicine.availableStock === 0
        ).length,

      totalShortageQuantity:
        medicines.reduce(
          (sum, medicine) =>
            sum +
            medicine.shortageQuantity,
          0
        )
    },

    medicines
  };
};

/**
 * Stock movement report।
 */
const getStockMovementReport = async (
  startDate,
  endDate,
  movementType
) => {
  validateDateRange(
    startDate,
    endDate
  );

  const normalizedMovementType =
    movementType
      ? String(movementType)
          .trim()
          .toUpperCase()
      : undefined;

  const allowedMovementTypes = [
    "OPENING",
    "PURCHASE",
    "SALE",
    "SALE_RETURN",
    "PURCHASE_RETURN",
    "ADJUSTMENT_IN",
    "ADJUSTMENT_OUT",
    "DAMAGE",
    "EXPIRED"
  ];

  if (
    normalizedMovementType &&
    !allowedMovementTypes.includes(
      normalizedMovementType
    )
  ) {
    throw createError(
      "Invalid stock movement type."
    );
  }

  const rows =
    await reportRepository
      .getStockMovementReport(
        startDate,
        endDate,
        normalizedMovementType
      );

  const movements = rows.map(
    (movement) => ({
      ...movement,

      id:
        toNumber(movement.id),

      quantity:
        toNumber(
          movement.quantity
        ),

      balanceAfter:
        toNumber(
          movement.balanceAfter
        ),

      referenceId:
        movement.referenceId === null
          ? null
          : toNumber(
              movement.referenceId
            ),

      medicineId:
        toNumber(
          movement.medicineId
        ),

      batchId:
        toNumber(
          movement.batchId
        )
    })
  );

  const inwardTypes = [
    "OPENING",
    "PURCHASE",
    "SALE_RETURN",
    "ADJUSTMENT_IN"
  ];

  const outwardTypes = [
    "SALE",
    "PURCHASE_RETURN",
    "ADJUSTMENT_OUT",
    "DAMAGE",
    "EXPIRED"
  ];

  const inwardQuantity =
    movements
      .filter(
        (movement) =>
          inwardTypes.includes(
            movement.movementType
          )
      )
      .reduce(
        (sum, movement) =>
          sum + movement.quantity,
        0
      );

  const outwardQuantity =
    movements
      .filter(
        (movement) =>
          outwardTypes.includes(
            movement.movementType
          )
      )
      .reduce(
        (sum, movement) =>
          sum + movement.quantity,
        0
      );

  return {
    filters: {
      startDate,
      endDate,

      movementType:
        normalizedMovementType ||
        null
    },

    summary: {
      totalMovements:
        movements.length,

      inwardQuantity,
      outwardQuantity,

      netQuantity:
        inwardQuantity -
        outwardQuantity
    },

    movements
  };
};

/**
 * Profit and Loss report।
 */
const getProfitLossReport = async (
  startDate,
  endDate
) => {
  validateDateRange(
    startDate,
    endDate
  );

  const result =
    await reportRepository
      .getProfitLossReport(
        startDate,
        endDate
      );

  const totalInvoices =
    toNumber(
      result.sales.totalInvoices
    );

  const totalSalesRevenue =
    roundMoney(
      result.sales.totalSalesRevenue
    );

  const taxableSales =
    roundMoney(
      result.sales.taxableSales
    );

  const salesDiscount =
    roundMoney(
      result.sales.salesDiscount
    );

  const salesTax =
    roundMoney(
      result.sales.salesTax
    );

  const salesReceived =
    roundMoney(
      result.sales.salesReceived
    );

  const salesDue =
    roundMoney(
      result.sales.salesDue
    );

  const costOfGoodsSold =
    roundMoney(
      result.cost.costOfGoodsSold
    );

  /*
   * Tax বাদ দিয়ে gross profit।
   */
  const grossProfit =
    roundMoney(
      taxableSales -
      costOfGoodsSold
    );

  const grossMarginPercent =
    taxableSales > 0
      ? Number(
          (
            (
              grossProfit /
              taxableSales
            ) * 100
          ).toFixed(2)
        )
      : 0;

  return {
    filters: {
      startDate,
      endDate
    },

    sales: {
      totalInvoices,
      totalSalesRevenue,
      taxableSales,
      salesDiscount,
      salesTax,
      salesReceived,
      salesDue
    },

    cost: {
      costOfGoodsSold
    },

    profit: {
      grossProfit,
      grossMarginPercent
    },

    purchases: {
      totalPurchaseBills:
        toNumber(
          result.purchases
            .totalPurchaseBills
        ),

      totalPurchases:
        roundMoney(
          result.purchases
            .totalPurchases
        ),

      purchasePaid:
        roundMoney(
          result.purchases
            .purchasePaid
        ),

      purchaseDue:
        roundMoney(
          result.purchases
            .purchaseDue
        )
    }
  };
};

module.exports = {
  getPurchaseReport,
  getSalesReport,
  getExpiryReport,
  getLowStockReport,
  getStockMovementReport,
  getProfitLossReport
};