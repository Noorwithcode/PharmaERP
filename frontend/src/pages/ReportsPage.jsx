import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import apiClient from
  "../api/apiClient";

import "./ReportsPage.css";

const REPORT_TYPES = [
  {
    value: "sales",
    label: "Sales Report",
  },
  {
    value: "purchases",
    label: "Purchase Report",
  },
  {
    value: "profit-loss",
    label: "Profit & Loss",
  },
  {
    value: "expiry",
    label: "Expiry Report",
  },
];

const currencyFormatter =
  new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );

const numberFormatter =
  new Intl.NumberFormat(
    "en-IN"
  );

const formatMoney = (
  value
) => {
  return currencyFormatter
    .format(
      Number(value) || 0
    );
};

const formatNumber = (
  value
) => {
  return numberFormatter
    .format(
      Number(value) || 0
    );
};

const formatDate = (
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
    return String(value)
      .slice(0, 10);
  }

  return new Intl
    .DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    )
    .format(date);
};

const getLocalDate = (
  date
) => {
  const offset =
    date.getTimezoneOffset() *
    60_000;

  return new Date(
    date.getTime() - offset
  )
    .toISOString()
    .slice(0, 10);
};

const getDefaultDates = () => {
  const endDate =
    new Date();

  const startDate =
    new Date();

  startDate.setDate(
    startDate.getDate() - 30
  );

  return {
    startDate:
      getLocalDate(
        startDate
      ),

    endDate:
      getLocalDate(
        endDate
      ),
  };
};

const getErrorMessage = (
  error
) => {
  return (
    error?.response
      ?.data?.message ||
    error?.response
      ?.data?.error ||
    error?.message ||
    "Unable to load report."
  );
};

function ReportsPage() {
  const defaultDates =
    useMemo(
      getDefaultDates,
      []
    );

  const [
    activeReport,
    setActiveReport,
  ] = useState("sales");

  const [
    startDate,
    setStartDate,
  ] = useState(
    defaultDates.startDate
  );

  const [
    endDate,
    setEndDate,
  ] = useState(
    defaultDates.endDate
  );

  const [
    expiryDays,
    setExpiryDays,
  ] = useState(90);

  const [
    reportData,
    setReportData,
  ] = useState({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    document.title =
      "Reports | PharmaERP";
  }, []);

  const loadReport =
    useCallback(
      async () => {
        if (
          activeReport !==
            "expiry" &&
          (
            !startDate ||
            !endDate
          )
        ) {
          setError(
            "Start date and end date are required."
          );

          return;
        }

        if (
          activeReport !==
            "expiry" &&
          startDate > endDate
        ) {
          setError(
            "Start date cannot be after end date."
          );

          return;
        }

        setLoading(true);
        setError("");

        try {
          const params =
            activeReport ===
            "expiry"
              ? {
                  days:
                    Number(
                      expiryDays
                    ) || 90,
                }
              : {
                  startDate,
                  endDate,
                };

          const response =
            await apiClient.get(
              `/reports/${activeReport}`,
              {
                params,
              }
            );

          const payload =
            response?.data
              ?.data ??
            response?.data ??
            {};

          setReportData(
            payload
          );
        } catch (
          requestError
        ) {
          setReportData({});

          setError(
            getErrorMessage(
              requestError
            )
          );
        } finally {
          setLoading(false);
        }
      },
      [
        activeReport,
        startDate,
        endDate,
        expiryDays,
      ]
    );

  useEffect(() => {
    loadReport();
  }, [
    activeReport,
  ]);

  const sales =
    Array.isArray(
      reportData?.sales
    )
      ? reportData.sales
      : [];

  const purchases =
    Array.isArray(
      reportData
        ?.purchases
    )
      ? reportData
          .purchases
      : [];

  const expiryBatches =
    Array.isArray(
      reportData
        ?.batches
    )
      ? reportData.batches
      : [];

  const summary =
    reportData
      ?.summary ||
    {};

  const activeTitle =
    REPORT_TYPES.find(
      (report) =>
        report.value ===
        activeReport
    )?.label ||
    "Report";

  const renderSalesSummary =
    () => {
      return (
        <div className="report-summary-grid">
          <article>
            <span>
              Total invoices
            </span>

            <strong>
              {formatNumber(
                summary
                  .totalInvoices
              )}
            </strong>
          </article>

          <article>
            <span>
              Total sales
            </span>

            <strong>
              {formatMoney(
                summary
                  .totalSalesAmount
              )}
            </strong>
          </article>

          <article>
            <span>
              Total paid
            </span>

            <strong>
              {formatMoney(
                summary
                  .totalPaid
              )}
            </strong>
          </article>

          <article>
            <span>
              Total due
            </span>

            <strong>
              {formatMoney(
                summary
                  .totalDue
              )}
            </strong>
          </article>
        </div>
      );
    };

  const renderPurchaseSummary =
    () => {
      return (
        <div className="report-summary-grid">
          <article>
            <span>
              Total bills
            </span>

            <strong>
              {formatNumber(
                summary
                  .totalBills
              )}
            </strong>
          </article>

          <article>
            <span>
              Purchase amount
            </span>

            <strong>
              {formatMoney(
                summary
                  .totalPurchaseAmount
              )}
            </strong>
          </article>

          <article>
            <span>
              Total paid
            </span>

            <strong>
              {formatMoney(
                summary
                  .totalPaid
              )}
            </strong>
          </article>

          <article>
            <span>
              Total due
            </span>

            <strong>
              {formatMoney(
                summary
                  .totalDue
              )}
            </strong>
          </article>
        </div>
      );
    };

  const renderExpirySummary =
    () => {
      return (
        <div className="report-summary-grid">
          <article>
            <span>
              Total batches
            </span>

            <strong>
              {formatNumber(
                summary
                  .totalBatches
              )}
            </strong>
          </article>

          <article>
            <span>
              Expired
            </span>

            <strong className="report-negative">
              {formatNumber(
                summary
                  .expiredBatches
              )}
            </strong>
          </article>

          <article>
            <span>
              Expiring soon
            </span>

            <strong className="report-warning">
              {formatNumber(
                summary
                  .expiringSoonBatches
              )}
            </strong>
          </article>

          <article>
            <span>
              Stock quantity
            </span>

            <strong>
              {formatNumber(
                summary
                  .totalQuantity
              )}
            </strong>
          </article>
        </div>
      );
    };

  const renderProfitLoss =
    () => {
      const salesData =
        reportData
          ?.sales ||
        {};

      const costData =
        reportData
          ?.cost ||
        {};

      const profitData =
        reportData
          ?.profit ||
        {};

      const purchaseData =
        reportData
          ?.purchases ||
        {};

      return (
        <>
          <div className="report-summary-grid profit-summary-grid">
            <article>
              <span>
                Sales revenue
              </span>

              <strong>
                {formatMoney(
                  salesData
                    .totalSalesRevenue
                )}
              </strong>
            </article>

            <article>
              <span>
                Cost of goods sold
              </span>

              <strong>
                {formatMoney(
                  costData
                    .costOfGoodsSold
                )}
              </strong>
            </article>

            <article>
              <span>
                Gross profit
              </span>

              <strong
                className={
                  Number(
                    profitData
                      .grossProfit
                  ) >= 0
                    ? "report-positive"
                    : "report-negative"
                }
              >
                {formatMoney(
                  profitData
                    .grossProfit
                )}
              </strong>
            </article>

            <article>
              <span>
                Gross margin
              </span>

              <strong>
                {Number(
                  profitData
                    .grossMarginPercent
                ) || 0}
                %
              </strong>
            </article>
          </div>

          <div className="profit-details-grid">
            <article>
              <h3>
                Sales details
              </h3>

              <dl>
                <div>
                  <dt>
                    Total invoices
                  </dt>

                  <dd>
                    {formatNumber(
                      salesData
                        .totalInvoices
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Taxable sales
                  </dt>

                  <dd>
                    {formatMoney(
                      salesData
                        .taxableSales
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Sales discount
                  </dt>

                  <dd>
                    {formatMoney(
                      salesData
                        .salesDiscount
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Sales tax
                  </dt>

                  <dd>
                    {formatMoney(
                      salesData
                        .salesTax
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Sales received
                  </dt>

                  <dd>
                    {formatMoney(
                      salesData
                        .salesReceived
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Sales due
                  </dt>

                  <dd>
                    {formatMoney(
                      salesData
                        .salesDue
                    )}
                  </dd>
                </div>
              </dl>
            </article>

            <article>
              <h3>
                Purchase details
              </h3>

              <dl>
                <div>
                  <dt>
                    Purchase bills
                  </dt>

                  <dd>
                    {formatNumber(
                      purchaseData
                        .totalPurchaseBills
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Total purchases
                  </dt>

                  <dd>
                    {formatMoney(
                      purchaseData
                        .totalPurchases
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Purchase paid
                  </dt>

                  <dd>
                    {formatMoney(
                      purchaseData
                        .purchasePaid
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Purchase due
                  </dt>

                  <dd>
                    {formatMoney(
                      purchaseData
                        .purchaseDue
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          </div>
        </>
      );
    };

  const renderSalesTable =
    () => {
      return (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Quantity</th>
                <th>
                  Grand total
                </th>
                <th>Paid</th>
                <th>Due</th>
                <th>
                  Payment
                </th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {sales.length ===
              0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="report-empty-state"
                  >
                    No sales records
                    found.
                  </td>
                </tr>
              ) : (
                sales.map(
                  (sale) => (
                    <tr
                      key={
                        sale.id
                      }
                    >
                      <td>
                        {formatDate(
                          sale
                            .saleDate
                        )}
                      </td>

                      <td>
                        <strong>
                          {
                            sale
                              .invoiceNumber
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          sale
                            .customerName ||
                          "Walk-in Customer"
                        }
                      </td>

                      <td>
                        {formatNumber(
                          sale
                            .totalQuantity
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          sale
                            .grandTotal
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          sale
                            .paidAmount
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          sale
                            .dueAmount
                        )}
                      </td>

                      <td>
                        {
                          sale
                            .paymentStatus
                        }
                      </td>

                      <td>
                        {
                          sale.status
                        }
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      );
    };

  const renderPurchaseTable =
    () => {
      return (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>
                  Purchase number
                </th>
                <th>
                  Supplier invoice
                </th>
                <th>Supplier</th>
                <th>
                  Grand total
                </th>
                <th>Paid</th>
                <th>Due</th>
                <th>
                  Payment
                </th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {purchases.length ===
              0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="report-empty-state"
                  >
                    No purchase
                    records found.
                  </td>
                </tr>
              ) : (
                purchases.map(
                  (
                    purchase
                  ) => (
                    <tr
                      key={
                        purchase.id
                      }
                    >
                      <td>
                        {formatDate(
                          purchase
                            .purchaseDate
                        )}
                      </td>

                      <td>
                        <strong>
                          {
                            purchase
                              .purchaseNumber
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          purchase
                            .invoiceNumber
                        }
                      </td>

                      <td>
                        {
                          purchase
                            .supplierName ||
                          "-"
                        }
                      </td>

                      <td>
                        {formatMoney(
                          purchase
                            .grandTotal
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          purchase
                            .paidAmount
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          purchase
                            .dueAmount
                        )}
                      </td>

                      <td>
                        {
                          purchase
                            .paymentStatus
                        }
                      </td>

                      <td>
                        {
                          purchase
                            .status
                        }
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      );
    };

  const renderExpiryTable =
    () => {
      return (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>
                  Days remaining
                </th>
                <th>Quantity</th>
                <th>
                  Purchase price
                </th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {expiryBatches.length ===
              0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="report-empty-state"
                  >
                    No expired or
                    expiring batches
                    found.
                  </td>
                </tr>
              ) : (
                expiryBatches.map(
                  (batch) => (
                    <tr
                      key={
                        batch
                          .batchId ||
                        batch.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            batch
                              .brandName ||
                            batch
                              .medicineName
                          }
                        </strong>

                        <small>
                          {
                            batch
                              .genericName ||
                            ""
                          }
                        </small>
                      </td>

                      <td>
                        {
                          batch
                            .batchNumber
                        }
                      </td>

                      <td>
                        {formatDate(
                          batch
                            .expiryDate
                        )}
                      </td>

                      <td>
                        {
                          batch
                            .daysUntilExpiry ??
                          batch
                            .daysToExpiry ??
                          "-"
                        }
                      </td>

                      <td>
                        {formatNumber(
                          batch
                            .quantityAvailable ??
                          batch
                            .quantity
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          batch
                            .purchasePrice
                        )}
                      </td>

                      <td>
                        {
                          batch
                            .stockStatus ||
                          batch
                            .expiryStatus ||
                          "-"
                        }
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      );
    };

  return (
    <main className="reports-page">
      <section className="reports-hero">
        <div>
          <span className="reports-eyebrow">
            Business intelligence
          </span>

          <h1>
            Reports centre
          </h1>

          <p>
            Review sales,
            purchases, expiry,
            profitability and
            financial performance.
          </p>
        </div>

        <div className="reports-hero-badge">
          <span>
            Current report
          </span>

          <strong>
            {activeTitle}
          </strong>
        </div>
      </section>

      <section className="report-tabs">
        {REPORT_TYPES.map(
          (report) => (
            <button
              key={
                report.value
              }
              type="button"
              className={
                activeReport ===
                report.value
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                setActiveReport(
                  report.value
                )
              }
            >
              {report.label}
            </button>
          )
        )}
      </section>

      <section className="report-filter-card">
        {activeReport ===
        "expiry" ? (
          <label>
            <span>
              Expiring within
            </span>

            <select
              value={
                expiryDays
              }
              onChange={(
                event
              ) =>
                setExpiryDays(
                  Number(
                    event
                      .target
                      .value
                  )
                )
              }
            >
              <option value="30">
                Next 30 days
              </option>

              <option value="60">
                Next 60 days
              </option>

              <option value="90">
                Next 90 days
              </option>

              <option value="180">
                Next 180 days
              </option>
            </select>
          </label>
        ) : (
          <>
            <label>
              <span>
                Start date
              </span>

              <input
                type="date"
                value={
                  startDate
                }
                max={
                  endDate
                }
                onChange={(
                  event
                ) =>
                  setStartDate(
                    event
                      .target
                      .value
                  )
                }
              />
            </label>

            <label>
              <span>
                End date
              </span>

              <input
                type="date"
                value={
                  endDate
                }
                min={
                  startDate
                }
                onChange={(
                  event
                ) =>
                  setEndDate(
                    event
                      .target
                      .value
                  )
                }
              />
            </label>
          </>
        )}

        <button
          type="button"
          className="report-apply-button"
          onClick={
            loadReport
          }
          disabled={loading}
        >
          {loading
            ? "Loading..."
            : "Generate report"}
        </button>
      </section>

      {error && (
        <div className="report-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            ×
          </button>
        </div>
      )}

      <section className="report-content-card">
        <div className="report-content-heading">
          <div>
            <span className="reports-eyebrow">
              Report result
            </span>

            <h2>
              {activeTitle}
            </h2>
          </div>

          <button
            type="button"
            className="report-refresh-button"
            onClick={
              loadReport
            }
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="report-loading-state">
            Loading report...
          </div>
        ) : (
          <>
            {activeReport ===
              "sales" && (
              <>
                {renderSalesSummary()}
                {renderSalesTable()}
              </>
            )}

            {activeReport ===
              "purchases" && (
              <>
                {renderPurchaseSummary()}
                {renderPurchaseTable()}
              </>
            )}

            {activeReport ===
              "profit-loss" &&
              renderProfitLoss()}

            {activeReport ===
              "expiry" && (
              <>
                {renderExpirySummary()}
                {renderExpiryTable()}
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default ReportsPage;