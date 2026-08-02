import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router";

import StockAdjustmentForm from
  "../modules/stock/StockAdjustmentForm";

import StockAdjustmentHistory from
  "../modules/stock/StockAdjustmentHistory";

import "../modules/stock/stockAdjustment.css";

function StockAdjustmentPage() {
  const [
    activeTab,
    setActiveTab,
  ] = useState("create");

  const [
    refreshToken,
    setRefreshToken,
  ] = useState(0);

  useEffect(() => {
    document.title =
      "Stock Adjustment | PharmaERP";
  }, []);

  const handleCreated = () => {
    setRefreshToken(
      (current) =>
        current + 1
    );
  };

  return (
    <main className="stock-adjustment-page">
      <section className="adjustment-page-hero">
        <div>
          <span className="adjustment-eyebrow">
            Stock management
          </span>

          <h1>
            Stock adjustment
          </h1>

          <p>
            Correct physical stock
            differences while keeping
            movement and audit records
            complete.
          </p>
        </div>

        <div className="adjustment-hero-actions">
          <Link
            to="/stock"
            className="adjustment-secondary-button"
          >
            View batch stock
          </Link>

          <div className="adjustment-hero-count">
            <span>Mode</span>

            <strong>
              {activeTab ===
              "create"
                ? "New entry"
                : "Audit history"}
            </strong>
          </div>
        </div>
      </section>

      <nav
        className="adjustment-tabs"
        aria-label="Stock adjustment sections"
      >
        <button
          type="button"
          className={
            activeTab ===
            "create"
              ? "is-active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "create"
            )
          }
        >
          New adjustment
        </button>

        <button
          type="button"
          className={
            activeTab ===
            "history"
              ? "is-active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "history"
            )
          }
        >
          Adjustment history
        </button>
      </nav>

      {activeTab ===
      "create" ? (
        <StockAdjustmentForm
          onCreated={
            handleCreated
          }
          refreshToken={
            refreshToken
          }
        />
      ) : (
        <StockAdjustmentHistory
          refreshToken={
            refreshToken
          }
        />
      )}
    </main>
  );
}

export default StockAdjustmentPage;