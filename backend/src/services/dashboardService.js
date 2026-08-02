const dashboardRepository = require(
  "../repositories/dashboardRepository"
);

const toNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
};

const formatRecentSales = (sales) => {
  return sales.map((sale) => ({
    ...sale,
    id: toNumber(sale.id),
    totalQuantity:
      toNumber(sale.totalQuantity),
    grandTotal:
      toNumber(sale.grandTotal),
    paidAmount:
      toNumber(sale.paidAmount),
    dueAmount:
      toNumber(sale.dueAmount)
  }));
};

const formatRecentPurchases = (
  purchases
) => {
  return purchases.map((purchase) => ({
    ...purchase,
    id: toNumber(purchase.id),
    grandTotal:
      toNumber(purchase.grandTotal),
    paidAmount:
      toNumber(purchase.paidAmount),
    dueAmount:
      toNumber(purchase.dueAmount)
  }));
};

const formatLowStockItems = (items) => {
  return items.map((item) => ({
    ...item,
    medicineId:
      toNumber(item.medicineId),
    reorderLevel:
      toNumber(item.reorderLevel),
    availableStock:
      toNumber(item.availableStock)
  }));
};

const formatExpiryItems = (items) => {
  return items.map((item) => ({
    ...item,
    batchId:
      toNumber(item.batchId),
    medicineId:
      toNumber(item.medicineId),
    quantityAvailable:
      toNumber(item.quantityAvailable),
    daysRemaining:
      toNumber(item.daysRemaining)
  }));
};

/**
 * Complete Dashboard summary।
 *
 * Queries independent হওয়ায় Promise.all
 * দিয়ে parallel execute করা হচ্ছে।
 */
const getDashboardSummary = async () => {
  const [
    medicineSummary,
    stockSummary,
    todaySales,
    todayPurchases,
    receivables,
    payables,
    lowStockSummary,
    lowStockItems,
    expirySummary,
    expiryItems,
    recentSales,
    recentPurchases
  ] = await Promise.all([
    dashboardRepository
      .getMedicineSummary(),

    dashboardRepository
      .getStockSummary(),

    dashboardRepository
      .getTodaySalesSummary(),

    dashboardRepository
      .getTodayPurchaseSummary(),

    dashboardRepository
      .getTotalReceivables(),

    dashboardRepository
      .getTotalPayables(),

    dashboardRepository
      .getLowStockSummary(),

    dashboardRepository
      .getLowStockItems(10),

    dashboardRepository
      .getExpirySummary(),

    dashboardRepository
      .getExpiryItems(10),

    dashboardRepository
      .getRecentSales(5),

    dashboardRepository
      .getRecentPurchases(5)
  ]);

  return {
    generatedAt:
      new Date().toISOString(),

    medicines: {
      totalMedicines:
        toNumber(
          medicineSummary.totalMedicines
        ),

      prescriptionMedicines:
        toNumber(
          medicineSummary
            .prescriptionMedicines
        )
    },

    inventory: {
      totalStockQuantity:
        toNumber(
          stockSummary
            .totalStockQuantity
        ),

      purchaseStockValue:
        toNumber(
          stockSummary
            .purchaseStockValue
        ),

      sellingStockValue:
        toNumber(
          stockSummary
            .sellingStockValue
        ),

      batchesWithStock:
        toNumber(
          stockSummary
            .batchesWithStock
        )
    },

    today: {
      sales: {
        totalBills:
          toNumber(
            todaySales.totalBills
          ),

        totalRevenue:
          toNumber(
            todaySales.totalRevenue
          ),

        totalPaid:
          toNumber(
            todaySales.totalPaid
          ),

        totalDue:
          toNumber(
            todaySales.totalDue
          ),

        totalQuantity:
          toNumber(
            todaySales.totalQuantity
          )
      },

      purchases: {
        totalBills:
          toNumber(
            todayPurchases.totalBills
          ),

        totalExpense:
          toNumber(
            todayPurchases.totalExpense
          ),

        totalPaid:
          toNumber(
            todayPurchases.totalPaid
          ),

        totalDue:
          toNumber(
            todayPurchases.totalDue
          )
      }
    },

    dues: {
      totalReceivable:
        toNumber(
          receivables.totalReceivable
        ),

      dueInvoiceCount:
        toNumber(
          receivables.dueInvoiceCount
        ),

      totalPayable:
        toNumber(
          payables.totalPayable
        ),

      duePurchaseCount:
        toNumber(
          payables.duePurchaseCount
        )
    },

    alerts: {
      lowStockCount:
        toNumber(
          lowStockSummary.lowStockCount
        ),

      expiredBatchCount:
        toNumber(
          expirySummary
            .expiredBatchCount
        ),

      expiringSoonCount:
        toNumber(
          expirySummary
            .expiringSoonCount
        ),

      expiredQuantity:
        toNumber(
          expirySummary
            .expiredQuantity
        ),

      lowStockItems:
        formatLowStockItems(
          lowStockItems
        ),

      expiryItems:
        formatExpiryItems(
          expiryItems
        )
    },

    recentActivity: {
      sales:
        formatRecentSales(recentSales),

      purchases:
        formatRecentPurchases(
          recentPurchases
        )
    }
  };
};

module.exports = {
  getDashboardSummary
};