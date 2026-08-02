import {
  useCallback,
  useEffect,
  useState,
} from "react";

import apiClient from "../api/apiClient";
import "./DashboardPage.css";

const numberFormatter = new Intl.NumberFormat("en-IN");

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const toNumber = (value) => {
  const convertedValue = Number(value);
  return Number.isFinite(convertedValue) ? convertedValue : 0;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateTimeFormatter.format(date);
};

function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await apiClient.get("/dashboard/summary");
      setSummary(response.data?.data || response.data || {});
    } catch (error) {
      console.error("Dashboard loading error:", error);
      setErrorMessage(
        error.response?.data?.message ||
          "Dashboard data load করা যায়নি।"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Dashboard | PharmaERP";
    loadDashboard();
  }, [loadDashboard]);

  const medicines = summary?.medicines || {};
  const inventory = summary?.inventory || {};
  const today = summary?.today || {};
  const todaySales = today.sales || {};
  const todayPurchases = today.purchases || {};
  const dues = summary?.dues || {};
  const alerts = summary?.alerts || {};
  const recentActivity = summary?.recentActivity || {};

  const cards = [
    {
      label: "Total Medicines",
      value: numberFormatter.format(toNumber(medicines.totalMedicines)),
      meta: `${numberFormatter.format(
        toNumber(medicines.prescriptionMedicines)
      )} prescription items`,
      icon: "MD",
      tone: "blue",
    },
    {
      label: "Available Stock",
      value: numberFormatter.format(toNumber(inventory.totalStockQuantity)),
      meta: `${numberFormatter.format(
        toNumber(inventory.batchesWithStock)
      )} active batches`,
      icon: "ST",
      tone: "green",
    },
    {
      label: "Stock Cost Value",
      value: currencyFormatter.format(
        toNumber(inventory.purchaseStockValue)
      ),
      meta: "At purchase price",
      icon: "CV",
      tone: "purple",
    },
    {
      label: "Selling Value",
      value: currencyFormatter.format(
        toNumber(inventory.sellingStockValue)
      ),
      meta: "Potential retail value",
      icon: "SV",
      tone: "orange",
    },
  ];

  const recentSales = Array.isArray(recentActivity.sales)
    ? recentActivity.sales
    : [];

  const recentPurchases = Array.isArray(recentActivity.purchases)
    ? recentActivity.purchases
    : [];

  return (
    <section className="dashboard">
      <div className="dashboard-welcome">
        <div>
          <p className="welcome-label">Live business overview</p>
          <h2>Pharmacy at a glance</h2>
          <span>
            Sales, inventory, dues এবং alerts-এর latest অবস্থান দেখুন।
          </span>
        </div>

        <div className="dashboard-welcome-actions">
          {summary?.generatedAt && (
            <small>Updated {formatDateTime(summary.generatedAt)}</small>
          )}
          <button type="button" onClick={loadDashboard} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh data"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="dashboard-error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={loadDashboard}>
            Try again
          </button>
        </div>
      )}

      <div className="summary-grid">
        {cards.map((card) => (
          <article key={card.label} className="summary-card">
            <div className={`summary-icon ${card.tone}`}>{card.icon}</div>
            <div className="summary-card-content">
              <p>{card.label}</p>
              <strong>{loading ? "..." : card.value}</strong>
              <span>{card.meta}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="today-grid">
        <article className="today-card sales">
          <div className="today-card-heading">
            <span>TS</span>
            <div>
              <p>Today&apos;s sales</p>
              <strong>
                {loading
                  ? "..."
                  : currencyFormatter.format(toNumber(todaySales.totalRevenue))}
              </strong>
            </div>
          </div>
          <dl>
            <div>
              <dt>Invoices</dt>
              <dd>{numberFormatter.format(toNumber(todaySales.totalBills))}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>
                {numberFormatter.format(toNumber(todaySales.totalQuantity))}
              </dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{currencyFormatter.format(toNumber(todaySales.totalDue))}</dd>
            </div>
          </dl>
        </article>

        <article className="today-card purchases">
          <div className="today-card-heading">
            <span>TP</span>
            <div>
              <p>Today&apos;s purchases</p>
              <strong>
                {loading
                  ? "..."
                  : currencyFormatter.format(
                      toNumber(todayPurchases.totalExpense)
                    )}
              </strong>
            </div>
          </div>
          <dl>
            <div>
              <dt>Bills</dt>
              <dd>
                {numberFormatter.format(toNumber(todayPurchases.totalBills))}
              </dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>
                {currencyFormatter.format(toNumber(todayPurchases.totalPaid))}
              </dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>
                {currencyFormatter.format(toNumber(todayPurchases.totalDue))}
              </dd>
            </div>
          </dl>
        </article>
      </div>

      <div className="dashboard-lower-grid">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p>Attention required</p>
              <h3>Inventory alerts</h3>
            </div>
          </div>

          <div className="alert-list">
            <div className="alert-item danger">
              <span className="alert-symbol">LS</span>
              <div>
                <strong>Low stock medicines</strong>
                <p>Reorder প্রয়োজন এমন active medicine</p>
              </div>
              <b>{numberFormatter.format(toNumber(alerts.lowStockCount))}</b>
            </div>

            <div className="alert-item warning">
              <span className="alert-symbol">EX</span>
              <div>
                <strong>Expiring within 30 days</strong>
                <p>Priority review প্রয়োজন এমন batch</p>
              </div>
              <b>{numberFormatter.format(toNumber(alerts.expiringSoonCount))}</b>
            </div>

            <div className="alert-item expired">
              <span className="alert-symbol">XP</span>
              <div>
                <strong>Expired batches</strong>
                <p>{numberFormatter.format(toNumber(alerts.expiredQuantity))} units blocked</p>
              </div>
              <b>{numberFormatter.format(toNumber(alerts.expiredBatchCount))}</b>
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p>Outstanding balance</p>
              <h3>Due summary</h3>
            </div>
          </div>

          <div className="due-list">
            <div className="due-item supplier">
              <span>Supplier payable</span>
              <strong>
                {currencyFormatter.format(toNumber(dues.totalPayable))}
              </strong>
              <small>
                {numberFormatter.format(toNumber(dues.duePurchaseCount))} due bills
              </small>
            </div>

            <div className="due-item customer">
              <span>Customer receivable</span>
              <strong>
                {currencyFormatter.format(toNumber(dues.totalReceivable))}
              </strong>
              <small>
                {numberFormatter.format(toNumber(dues.dueInvoiceCount))} due invoices
              </small>
            </div>
          </div>
        </article>
      </div>

      <div className="activity-grid">
        <article className="dashboard-panel activity-panel">
          <div className="panel-heading">
            <div>
              <p>Latest invoices</p>
              <h3>Recent sales</h3>
            </div>
          </div>

          <div className="activity-list">
            {recentSales.length === 0 ? (
              <p className="empty-state">No sales available.</p>
            ) : (
              recentSales.map((sale) => (
                <div className="activity-row" key={sale.id}>
                  <div>
                    <strong>{sale.invoiceNumber}</strong>
                    <span>{sale.customerName || "Walk-in Customer"}</span>
                  </div>
                  <div className="activity-amount">
                    <strong>{currencyFormatter.format(toNumber(sale.grandTotal))}</strong>
                    <span className={`status-pill ${String(sale.status).toLowerCase()}`}>
                      {sale.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="dashboard-panel activity-panel">
          <div className="panel-heading">
            <div>
              <p>Latest supplier bills</p>
              <h3>Recent purchases</h3>
            </div>
          </div>

          <div className="activity-list">
            {recentPurchases.length === 0 ? (
              <p className="empty-state">No purchases available.</p>
            ) : (
              recentPurchases.map((purchase) => (
                <div className="activity-row" key={purchase.id}>
                  <div>
                    <strong>{purchase.purchaseNumber}</strong>
                    <span>{purchase.supplierName || "Supplier"}</span>
                  </div>
                  <div className="activity-amount">
                    <strong>
                      {currencyFormatter.format(toNumber(purchase.grandTotal))}
                    </strong>
                    <span className={`status-pill ${String(purchase.paymentStatus).toLowerCase()}`}>
                      {purchase.paymentStatus}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

export default DashboardPage;
