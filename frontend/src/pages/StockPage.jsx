import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import StockTable from
  "../modules/stock/StockTable";
import StockDetails from
  "../modules/stock/StockDetails";
import StockMovementTable from
  "../modules/stock/StockMovementTable";
import stockService from
  "../services/stockService";

import "../modules/stock/stock.css";

const initialBatchFilters = {
  search: "",
  isActive: "",
  stockStatus: "",
  page: 1,
  limit: 20,
};

const initialMovementFilters = {
  search: "",
  movementType: "",
  startDate: "",
  endDate: "",
  page: 1,
  limit: 20,
};

const inwardTypes = [
  "OPENING",
  "PURCHASE",
  "SALE_RETURN",
  "ADJUSTMENT_IN",
];

const outwardTypes = [
  "SALE",
  "PURCHASE_RETURN",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "EXPIRED",
];

const extractList = (
  data,
  keys
) => {
  if (Array.isArray(data)) {
    return data;
  }

  const candidates = [
    ...keys.map((key) => data?.[key]),
    ...keys.map(
      (key) => data?.data?.[key]
    ),
  ];

  return (
    candidates.find(Array.isArray) || []
  );
};

const getQuantity = (batch) => {
  return Number(
    batch.quantityAvailable ??
      batch.quantity_available ??
      batch.availableStock ??
      batch.available_stock ??
      batch.currentStock ??
      batch.current_stock ??
      0
  );
};

const isActiveBatch = (batch) => {
  const value =
    batch.isActive ?? batch.is_active;

  return (
    value === true ||
    value === 1 ||
    value === "1"
  );
};

const StockPage = () => {
  const [activeTab, setActiveTab] =
    useState("batches");

  const [batches, setBatches] =
    useState([]);
  const [batchFilters, setBatchFilters] =
    useState(initialBatchFilters);
  const [batchPagination, setBatchPagination] =
    useState({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
  const [batchesLoading, setBatchesLoading] =
    useState(true);
  const [batchesError, setBatchesError] =
    useState("");

  const [selectedBatch, setSelectedBatch] =
    useState(null);
  const [detailsOpen, setDetailsOpen] =
    useState(false);
  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [movements, setMovements] =
    useState([]);
  const [movementFilters, setMovementFilters] =
    useState(initialMovementFilters);
  const [movementPagination, setMovementPagination] =
    useState({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
  const [movementSummary, setMovementSummary] =
    useState({
      totalMovements: 0,
      inwardQuantity: 0,
      outwardQuantity: 0,
      netQuantity: 0,
    });
  const [movementsLoading, setMovementsLoading] =
    useState(false);
  const [movementsError, setMovementsError] =
    useState("");

  const loadBatches = useCallback(async () => {
    try {
      setBatchesLoading(true);
      setBatchesError("");

      const data =
        await stockService.getBatches(
          batchFilters
        );

      const list = extractList(data, [
        "batches",
        "items",
        "rows",
        "stocks",
      ]);

      setBatches(list);

      const pagination =
        data?.pagination ||
        data?.data?.pagination ||
        {};

      setBatchPagination({
        page: Number(
          pagination.page ||
            pagination.currentPage ||
            batchFilters.page
        ),
        limit: Number(
          pagination.limit ||
            batchFilters.limit
        ),
        total: Number(
          pagination.total ??
            pagination.totalItems ??
            pagination.total_items ??
            list.length
        ),
        totalPages: Math.max(
          Number(
            pagination.totalPages ??
              pagination.total_pages ??
              pagination.pages ??
              1
          ),
          1
        ),
      });
    } catch (error) {
      setBatchesError(
        stockService.getStockErrorMessage(
          error
        )
      );
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  }, [batchFilters]);

  const loadMovements = useCallback(async () => {
    try {
      setMovementsLoading(true);
      setMovementsError("");

      const data =
        await stockService.getStockMovements(
          movementFilters
        );

      const list = extractList(data, [
        "movements",
        "items",
        "rows",
      ]);

      setMovements(list);

      const calculated = list.reduce(
        (summary, movement) => {
          const type = String(
            movement.movementType ??
              movement.movement_type ??
              ""
          ).toUpperCase();
          const quantity = Number(
            movement.quantity || 0
          );

          summary.totalMovements += 1;

          if (inwardTypes.includes(type)) {
            summary.inwardQuantity += quantity;
          }

          if (outwardTypes.includes(type)) {
            summary.outwardQuantity += quantity;
          }

          return summary;
        },
        {
          totalMovements: 0,
          inwardQuantity: 0,
          outwardQuantity: 0,
        }
      );

      const apiSummary =
        data?.summary ||
        data?.data?.summary ||
        {};

      const inwardQuantity = Number(
        apiSummary.inwardQuantity ??
          apiSummary.inward_quantity ??
          calculated.inwardQuantity
      );
      const outwardQuantity = Number(
        apiSummary.outwardQuantity ??
          apiSummary.outward_quantity ??
          calculated.outwardQuantity
      );

      setMovementSummary({
        totalMovements: Number(
          apiSummary.totalMovements ??
            apiSummary.total_movements ??
            calculated.totalMovements
        ),
        inwardQuantity,
        outwardQuantity,
        netQuantity: Number(
          apiSummary.netQuantity ??
            apiSummary.net_quantity ??
            inwardQuantity - outwardQuantity
        ),
      });

      const pagination =
        data?.pagination ||
        data?.data?.pagination ||
        {};

      setMovementPagination({
        page: Number(
          pagination.page ||
            movementFilters.page
        ),
        limit: Number(
          pagination.limit ||
            movementFilters.limit
        ),
        total: Number(
          pagination.total ??
            pagination.totalItems ??
            list.length
        ),
        totalPages: Math.max(
          Number(
            pagination.totalPages ??
              pagination.total_pages ??
              1
          ),
          1
        ),
      });
    } catch (error) {
      setMovementsError(
        stockService.getStockErrorMessage(
          error
        )
      );
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  }, [movementFilters]);

  useEffect(() => {
    document.title =
      "Stock Management | PharmaERP";
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      loadBatches,
      batchFilters.search ? 400 : 0
    );

    return () =>
      window.clearTimeout(timeoutId);
  }, [loadBatches, batchFilters.search]);

  useEffect(() => {
    if (activeTab !== "movements") {
      return undefined;
    }

    const timeoutId = window.setTimeout(
      loadMovements,
      movementFilters.search ? 400 : 0
    );

    return () =>
      window.clearTimeout(timeoutId);
  }, [
    activeTab,
    loadMovements,
    movementFilters.search,
  ]);

  useEffect(() => {
    document.body.style.overflow =
      detailsOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [detailsOpen]);

  const batchSummary = useMemo(() => {
    return {
      totalQuantity: batches.reduce(
        (total, batch) =>
          total + getQuantity(batch),
        0
      ),
      activeBatches:
        batches.filter(isActiveBatch).length,
      lowStockBatches: batches.filter(
        (batch) => {
          const quantity = getQuantity(batch);
          return quantity > 0 && quantity <= 10;
        }
      ).length,
      outOfStockBatches: batches.filter(
        (batch) => getQuantity(batch) <= 0
      ).length,
    };
  }, [batches]);

  const handleBatchFilterChange = (event) => {
    const { name, value } = event.target;
    setBatchFilters((current) => ({
      ...current,
      [name]: value,
      page: 1,
    }));
  };

  const handleMovementFilterChange = (
    event
  ) => {
    const { name, value } = event.target;
    setMovementFilters((current) => ({
      ...current,
      [name]: value,
      page: 1,
    }));
  };

  const handleViewBatch = async (batch) => {
    const batchId =
      batch.id ||
      batch.batchId ||
      batch.batch_id;

    setSelectedBatch(batch);
    setDetailsOpen(true);

    if (!batchId) return;

    try {
      setDetailsLoading(true);
      const data =
        await stockService.getBatchById(
          batchId
        );
      setSelectedBatch(
        data?.batch ||
          data?.data?.batch ||
          data
      );
    } catch (error) {
      window.alert(
        stockService.getStockErrorMessage(
          error
        )
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshCurrentTab = () => {
    if (activeTab === "movements") {
      loadMovements();
    } else {
      loadBatches();
    }
  };

  return (
    <div className="stock-page">
      <section className="stock-page-header">
        <div>
          <span className="stock-eyebrow">
            Inventory management
          </span>
          <h2>Stock management</h2>
          <p>
            Track batches, stock quantity,
            expiry and inventory movements.
          </p>
        </div>

        <button
          type="button"
          className="stock-primary-button"
          onClick={refreshCurrentTab}
          disabled={
            batchesLoading || movementsLoading
          }
        >
          Refresh data
        </button>
      </section>

      <section className="stock-tabs">
        <button
          type="button"
          className={`stock-tab-button ${
            activeTab === "batches"
              ? "is-active"
              : ""
          }`}
          onClick={() => setActiveTab("batches")}
        >
          Batch Stock
        </button>

        <button
          type="button"
          className={`stock-tab-button ${
            activeTab === "movements"
              ? "is-active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("movements")
          }
        >
          Movement History
        </button>
      </section>

      {activeTab === "batches" && (
        <>
          <section className="stock-summary-grid">
            {[
              [
                "ST",
                "Visible stock",
                batchSummary.totalQuantity,
              ],
              [
                "AB",
                "Active batches",
                batchSummary.activeBatches,
              ],
              [
                "LS",
                "Low-stock batches",
                batchSummary.lowStockBatches,
              ],
              [
                "OS",
                "Out-of-stock batches",
                batchSummary.outOfStockBatches,
              ],
            ].map(([icon, label, value]) => (
              <div
                className="stock-page-summary-card"
                key={label}
              >
                <div className="stock-summary-icon">
                  {icon}
                </div>
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </div>
            ))}
          </section>

          <section className="stock-filters">
            <div className="stock-search-field">
              <span className="stock-search-icon">
                ⌕
              </span>
              <input
                type="search"
                name="search"
                value={batchFilters.search}
                onChange={handleBatchFilterChange}
                placeholder="Search medicine, SKU or batch number"
              />
            </div>

            <select
              name="stockStatus"
              value={batchFilters.stockStatus}
              onChange={handleBatchFilterChange}
            >
              <option value="">
                All stock status
              </option>
              <option value="IN_STOCK">
                In stock
              </option>
              <option value="LOW_STOCK">
                Low stock
              </option>
              <option value="OUT_OF_STOCK">
                Out of stock
              </option>
            </select>

            <select
              name="isActive"
              value={batchFilters.isActive}
              onChange={handleBatchFilterChange}
            >
              <option value="">
                All batch status
              </option>
              <option value="true">Active</option>
              <option value="false">
                Inactive
              </option>
            </select>

            <button
              type="button"
              className="stock-secondary-button"
              onClick={() =>
                setBatchFilters(
                  initialBatchFilters
                )
              }
            >
              Clear filters
            </button>
          </section>

          <section className="stock-table-card">
            <StockTable
              batches={batches}
              loading={batchesLoading}
              error={batchesError}
              onView={handleViewBatch}
            />

            {!batchesLoading &&
              !batchesError &&
              batches.length > 0 && (
                <div className="stock-pagination">
                  <div className="stock-pagination-info">
                    Total batches:{" "}
                    {batchPagination.total}
                  </div>
                  <div className="stock-pagination-actions">
                    <button
                      type="button"
                      disabled={
                        batchPagination.page <= 1
                      }
                      onClick={() =>
                        setBatchFilters(
                          (current) => ({
                            ...current,
                            page: Math.max(
                              current.page - 1,
                              1
                            ),
                          })
                        )
                      }
                    >
                      Previous
                    </button>
                    <span className="stock-page-number">
                      Page {batchPagination.page} of{" "}
                      {batchPagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={
                        batchPagination.page >=
                        batchPagination.totalPages
                      }
                      onClick={() =>
                        setBatchFilters(
                          (current) => ({
                            ...current,
                            page: Math.min(
                              current.page + 1,
                              batchPagination.totalPages
                            ),
                          })
                        )
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
          </section>
        </>
      )}

      {activeTab === "movements" && (
        <section className="stock-movement-section">
          <div className="stock-movement-header">
            <div>
              <span className="stock-eyebrow">
                Inventory audit
              </span>
              <h3>Stock movement history</h3>
              <p>
                Purchase, sale, return and
                adjustment movements.
              </p>
            </div>
          </div>

          <div className="stock-movement-summary">
            <div className="movement-summary-card">
              <span>Total movements</span>
              <strong>
                {movementSummary.totalMovements}
              </strong>
            </div>
            <div className="movement-summary-card inward">
              <span>Inward quantity</span>
              <strong>
                +{movementSummary.inwardQuantity}
              </strong>
            </div>
            <div className="movement-summary-card outward">
              <span>Outward quantity</span>
              <strong>
                -{movementSummary.outwardQuantity}
              </strong>
            </div>
            <div className="movement-summary-card net">
              <span>Net quantity</span>
              <strong>
                {movementSummary.netQuantity}
              </strong>
            </div>
          </div>

          <div className="stock-movement-filters">
            <input
              type="search"
              name="search"
              value={movementFilters.search}
              onChange={
                handleMovementFilterChange
              }
              placeholder="Search medicine or batch"
            />

            <select
              name="movementType"
              value={
                movementFilters.movementType
              }
              onChange={
                handleMovementFilterChange
              }
            >
              <option value="">
                All movement types
              </option>
              {[
                "OPENING",
                "PURCHASE",
                "SALE",
                "SALE_RETURN",
                "PURCHASE_RETURN",
                "ADJUSTMENT_IN",
                "ADJUSTMENT_OUT",
                "DAMAGE",
                "EXPIRED",
              ].map((type) => (
                <option value={type} key={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <input
              type="date"
              name="startDate"
              value={movementFilters.startDate}
              onChange={
                handleMovementFilterChange
              }
            />
            <input
              type="date"
              name="endDate"
              value={movementFilters.endDate}
              onChange={
                handleMovementFilterChange
              }
            />
            <button
              type="button"
              className="stock-secondary-button"
              onClick={() =>
                setMovementFilters(
                  initialMovementFilters
                )
              }
            >
              Clear filters
            </button>
          </div>

          <StockMovementTable
            movements={movements}
            loading={movementsLoading}
            error={movementsError}
          />

          {!movementsLoading &&
            !movementsError &&
            movements.length > 0 && (
              <div className="stock-movement-pagination">
                <span>
                  Total movements:{" "}
                  {movementPagination.total}
                </span>
                <div className="stock-movement-pagination-actions">
                  <button
                    type="button"
                    disabled={
                      movementPagination.page <= 1
                    }
                    onClick={() =>
                      setMovementFilters(
                        (current) => ({
                          ...current,
                          page: Math.max(
                            current.page - 1,
                            1
                          ),
                        })
                      )
                    }
                  >
                    Previous
                  </button>
                  <span>
                    Page {movementPagination.page}{" "}
                    of{" "}
                    {movementPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={
                      movementPagination.page >=
                      movementPagination.totalPages
                    }
                    onClick={() =>
                      setMovementFilters(
                        (current) => ({
                          ...current,
                          page: Math.min(
                            current.page + 1,
                            movementPagination.totalPages
                          ),
                        })
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
        </section>
      )}

      {detailsOpen && selectedBatch && (
        <div
          className="stock-modal-overlay"
          role="presentation"
        >
          <div
            className="stock-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Stock batch details"
          >
            {detailsLoading ? (
              <div className="stock-table-state">
                <div className="stock-loader" />
                <p>Loading batch details...</p>
              </div>
            ) : (
              <StockDetails
                batch={selectedBatch}
                onClose={() => {
                  setDetailsOpen(false);
                  setSelectedBatch(null);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockPage;