import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router";
import apiClient from "../api/apiClient";
import "./SalesHistoryPage.css";

const currencyFormatter =
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const numberFormatter =
  new Intl.NumberFormat("en-IN");

const toNumber = (value) => {
  const convertedValue = Number(value);

  return Number.isFinite(convertedValue)
    ? convertedValue
    : 0;
};

const getSalesList = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  const possibleLists = [
    responseData?.data?.sales,
    responseData?.data?.items,
    responseData?.data?.rows,
    responseData?.sales,
    responseData?.items,
    responseData?.rows,
    responseData?.data,
  ];

  return (
    possibleLists.find(Array.isArray) || []
  );
};

const getPagination = (responseData) => {
  const pagination =
    responseData?.data?.pagination ||
    responseData?.pagination ||
    {};

  return {
    page: toNumber(
      pagination.page ||
        pagination.currentPage ||
        1
    ),

    totalPages: Math.max(
      toNumber(
        pagination.totalPages ||
          pagination.total_pages ||
          pagination.pages ||
          1
      ),
      1
    ),

    totalItems: toNumber(
      pagination.totalItems ||
        pagination.total_items ||
        pagination.total ||
        0
    ),
  };
};

const getSaleData = (responseData) => {
  return (
    responseData?.data?.sale ||
    responseData?.sale ||
    responseData?.data ||
    responseData ||
    {}
  );
};

const getSaleItems = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  const possibleLists = [
    responseData?.data?.items,
    responseData?.data?.saleItems,
    responseData?.items,
    responseData?.saleItems,
    responseData?.data,
  ];

  return (
    possibleLists.find(Array.isArray) || []
  );
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
};

const getStatusClass = (status) => {
  return String(status || "")
    .toLowerCase()
    .replaceAll("_", "-");
};

function SalesHistoryPage() {
  const [sales, setSales] = useState([]);

  const [searchText, setSearchText] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [
    paymentStatus,
    setPaymentStatus,
  ] = useState("");

  const [page, setPage] = useState(1);

  const [pagination, setPagination] =
    useState({
      page: 1,
      totalPages: 1,
      totalItems: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [selectedSale, setSelectedSale] =
    useState(null);

  const [selectedItems, setSelectedItems] =
    useState([]);

  const [
    detailsLoading,
    setDetailsLoading,
  ] = useState(false);

  const [
    downloadingSaleId,
    setDownloadingSaleId,
  ] = useState(null);

  const loadSales = useCallback(
    async ({
      search = "",
      saleStatus = "",
      salePaymentStatus = "",
      currentPage = 1,
    } = {}) => {
      try {
        setLoading(true);
        setErrorMessage("");

        const response =
          await apiClient.get("/sales", {
            params: {
              search: search.trim() || undefined,
              status:
                saleStatus || undefined,
              paymentStatus:
                salePaymentStatus ||
                undefined,
              page: currentPage,
              limit: 10,
            },
          });

        setSales(
          getSalesList(response.data)
        );

        setPagination(
          getPagination(response.data)
        );
      } catch (error) {
        console.error(
          "Sales history error:",
          error
        );

        setErrorMessage(
          error.response?.data?.message ||
            "Sales history load করা যায়নি।"
        );

        setSales([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    document.title =
      "Sales History | PharmaERP";
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSales({
        search: searchText,
        saleStatus: status,
        salePaymentStatus:
          paymentStatus,
        currentPage: page,
      });
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    searchText,
    status,
    paymentStatus,
    page,
    loadSales,
  ]);

  const totalVisibleAmount =
    useMemo(() => {
      return sales.reduce(
        (total, sale) =>
          total +
          toNumber(
            sale.grandTotal ??
              sale.grand_total
          ),
        0
      );
    }, [sales]);

  const openSaleDetails = async (
    sale
  ) => {
    const saleId =
      sale.id ||
      sale.saleId ||
      sale.sale_id;

    if (!saleId) {
      return;
    }

    try {
      setDetailsLoading(true);
      setSelectedSale(sale);
      setSelectedItems([]);
      setErrorMessage("");

      const [
        detailsResponse,
        itemsResponse,
      ] = await Promise.all([
        apiClient.get(
          `/sales/${saleId}`
        ),

        apiClient.get(
          `/sales/${saleId}/items`
        ),
      ]);

      const details =
        getSaleData(
          detailsResponse.data
        );

      const items =
        getSaleItems(
          itemsResponse.data
        );

      setSelectedSale({
        ...sale,
        ...details,
      });

      setSelectedItems(items);
    } catch (error) {
      console.error(
        "Sale details error:",
        error
      );

      setErrorMessage(
        error.response?.data?.message ||
          "Sale details load করা যায়নি।"
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeSaleDetails = () => {
    if (detailsLoading) {
      return;
    }

    setSelectedSale(null);
    setSelectedItems([]);
  };

  const downloadInvoice = async (
    sale
  ) => {
    const saleId =
      sale.id ||
      sale.saleId ||
      sale.sale_id;

    if (!saleId) {
      return;
    }

    const invoiceNumber =
      sale.invoiceNumber ||
      sale.invoice_number ||
      `sale-${saleId}`;

    try {
      setDownloadingSaleId(saleId);
      setErrorMessage("");

      const response =
        await apiClient.get(
          `/sales/${saleId}/invoice-pdf`,
          {
            params: {
              download: true,
            },

            responseType: "blob",
          }
        );

      const blob = new Blob(
        [response.data],
        {
          type: "application/pdf",
        }
      );

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        `${invoiceNumber}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(
        "Invoice download error:",
        error
      );

      setErrorMessage(
        "Invoice PDF download করা যায়নি।"
      );
    } finally {
      setDownloadingSaleId(null);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setStatus("");
    setPaymentStatus("");
    setPage(1);
  };

  return (
    <section className="sales-history-page">
      <div className="sales-history-header">
        <div>
          <p>Sales management</p>

          <h2>Sales history</h2>

          <span>
            Invoice search, payment status,
            details এবং PDF invoice দেখুন।
          </span>
        </div>

        <Link
          to="/sales"
          className="new-sale-link"
        >
          + Create new sale
        </Link>
      </div>

      {errorMessage && (
        <div
          className="history-error"
          role="alert"
        >
          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() =>
              setErrorMessage("")
            }
          >
            ×
          </button>
        </div>
      )}

      <div className="history-summary-grid">
        <article>
          <span>Visible invoices</span>

          <strong>
            {loading
              ? "..."
              : numberFormatter.format(
                  sales.length
                )}
          </strong>
        </article>

        <article>
          <span>Total records</span>

          <strong>
            {loading
              ? "..."
              : numberFormatter.format(
                  pagination.totalItems
                )}
          </strong>
        </article>

        <article>
          <span>Visible sale value</span>

          <strong>
            {loading
              ? "..."
              : currencyFormatter.format(
                  totalVisibleAmount
                )}
          </strong>
        </article>
      </div>

      <div className="sales-filter-card">
        <div className="history-search">
          <label htmlFor="sales-search">
            Search
          </label>

          <input
            id="sales-search"
            type="search"
            value={searchText}
            onChange={(event) => {
              setSearchText(
                event.target.value
              );

              setPage(1);
            }}
            placeholder="Invoice, customer or phone"
          />
        </div>

        <label>
          <span>Sale status</span>

          <select
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value
              );

              setPage(1);
            }}
          >
            <option value="">
              All statuses
            </option>

            <option value="COMPLETED">
              Completed
            </option>

            <option value="PARTIALLY_RETURNED">
              Partially returned
            </option>

            <option value="RETURNED">
              Returned
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </label>

        <label>
          <span>Payment status</span>

          <select
            value={paymentStatus}
            onChange={(event) => {
              setPaymentStatus(
                event.target.value
              );

              setPage(1);
            }}
          >
            <option value="">
              All payments
            </option>

            <option value="PAID">
              Paid
            </option>

            <option value="PARTIAL">
              Partial
            </option>

            <option value="DUE">
              Due
            </option>

            <option value="UNPAID">
              Unpaid
            </option>
          </select>
        </label>

        <button
          type="button"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      </div>

      <div className="sales-table-card">
        <div className="sales-table-heading">
          <div>
            <p>Invoice records</p>
            <h3>All sales</h3>
          </div>

          <button
            type="button"
            onClick={() =>
              loadSales({
                search: searchText,
                saleStatus: status,
                salePaymentStatus:
                  paymentStatus,
                currentPage: page,
              })
            }
            disabled={loading}
          >
            {loading
              ? "Loading..."
              : "Refresh"}
          </button>
        </div>

        {loading && sales.length === 0 ? (
          <div className="history-empty">
            Sales loading...
          </div>
        ) : sales.length === 0 ? (
          <div className="history-empty">
            কোনো sales invoice পাওয়া যায়নি।
          </div>
        ) : (
          <>
            <div className="sales-table-wrapper">
              <table className="sales-history-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Quantity</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Due</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {sales.map((sale) => {
                    const saleId =
                      sale.id ||
                      sale.saleId ||
                      sale.sale_id;

                    const invoiceNumber =
                      sale.invoiceNumber ||
                      sale.invoice_number ||
                      `SALE-${saleId}`;

                    const customerName =
                      sale.customerName ||
                      sale.customer_name ||
                      "Walk-in Customer";

                    const customerPhone =
                      sale.customerPhone ||
                      sale.customer_phone ||
                      "";

                    const saleDate =
                      sale.saleDate ||
                      sale.sale_date ||
                      sale.createdAt ||
                      sale.created_at;

                    const totalQuantity =
                      toNumber(
                        sale.totalQuantity ??
                          sale.total_quantity
                      );

                    const grandTotal =
                      toNumber(
                        sale.grandTotal ??
                          sale.grand_total
                      );

                    const paidAmount =
                      toNumber(
                        sale.paidAmount ??
                          sale.paid_amount
                      );

                    const dueAmount =
                      toNumber(
                        sale.dueAmount ??
                          sale.due_amount
                      );

                    const currentPaymentStatus =
                      sale.paymentStatus ||
                      sale.payment_status ||
                      "-";

                    const currentStatus =
                      sale.status || "-";

                    return (
                      <tr key={saleId}>
                        <td data-label="Invoice">
                          <strong>
                            {invoiceNumber}
                          </strong>
                        </td>

                        <td data-label="Customer">
                          <strong>
                            {customerName}
                          </strong>

                          {customerPhone && (
                            <small>
                              {customerPhone}
                            </small>
                          )}
                        </td>

                        <td data-label="Date">
                          {formatDate(
                            saleDate
                          )}
                        </td>

                        <td data-label="Quantity">
                          {numberFormatter.format(
                            totalQuantity
                          )}
                        </td>

                        <td data-label="Total">
                          {currencyFormatter.format(
                            grandTotal
                          )}
                        </td>

                        <td data-label="Paid">
                          {currencyFormatter.format(
                            paidAmount
                          )}
                        </td>

                        <td data-label="Due">
                          {currencyFormatter.format(
                            dueAmount
                          )}
                        </td>

                        <td data-label="Payment">
                          <span
                            className={`status-badge ${getStatusClass(
                              currentPaymentStatus
                            )}`}
                          >
                            {currentPaymentStatus}
                          </span>
                        </td>

                        <td data-label="Status">
                          <span
                            className={`status-badge ${getStatusClass(
                              currentStatus
                            )}`}
                          >
                            {currentStatus.replaceAll(
                              "_",
                              " "
                            )}
                          </span>
                        </td>

                        <td data-label="Actions">
                          <div className="sale-actions">
                            <button
                              type="button"
                              onClick={() =>
                                openSaleDetails(
                                  sale
                                )
                              }
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                downloadInvoice(
                                  sale
                                )
                              }
                              disabled={
                                downloadingSaleId ===
                                saleId
                              }
                            >
                              {downloadingSaleId ===
                              saleId
                                ? "..."
                                : "PDF"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="history-pagination">
              <button
                type="button"
                disabled={
                  page <= 1 || loading
                }
                onClick={() =>
                  setPage(
                    (currentPage) =>
                      Math.max(
                        currentPage - 1,
                        1
                      )
                  )
                }
              >
                Previous
              </button>

              <span>
                Page {page} of{" "}
                {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={
                  page >=
                    pagination.totalPages ||
                  loading
                }
                onClick={() =>
                  setPage(
                    (currentPage) =>
                      Math.min(
                        currentPage + 1,
                        pagination.totalPages
                      )
                  )
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {selectedSale && (
        <div className="sale-details-overlay">
          <section className="sale-details-modal">
            <div className="sale-details-header">
              <div>
                <p>Sale details</p>

                <h2>
                  {selectedSale.invoiceNumber ||
                    selectedSale.invoice_number ||
                    `SALE-${
                      selectedSale.id
                    }`}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeSaleDetails}
              >
                ×
              </button>
            </div>

            {detailsLoading ? (
              <div className="details-loading">
                Sale details loading...
              </div>
            ) : (
              <div className="sale-details-body">
                <div className="sale-information-grid">
                  <article>
                    <span>Customer</span>

                    <strong>
                      {selectedSale.customerName ||
                        selectedSale.customer_name ||
                        "Walk-in Customer"}
                    </strong>
                  </article>

                  <article>
                    <span>Sale date</span>

                    <strong>
                      {formatDate(
                        selectedSale.saleDate ||
                          selectedSale.sale_date ||
                          selectedSale.createdAt ||
                          selectedSale.created_at
                      )}
                    </strong>
                  </article>

                  <article>
                    <span>Payment status</span>

                    <strong>
                      {selectedSale.paymentStatus ||
                        selectedSale.payment_status ||
                        "-"}
                    </strong>
                  </article>

                  <article>
                    <span>Sale status</span>

                    <strong>
                      {String(
                        selectedSale.status ||
                          "-"
                      ).replaceAll(
                        "_",
                        " "
                      )}
                    </strong>
                  </article>
                </div>

                <div className="sale-item-list">
                  <h3>Medicine items</h3>

                  {selectedItems.length ===
                  0 ? (
                    <div className="history-empty">
                      কোনো item পাওয়া যায়নি।
                    </div>
                  ) : (
                    selectedItems.map(
                      (item) => {
                        const quantity =
                          toNumber(
                            item.quantity
                          );

                        const unitPrice =
                          toNumber(
                            item.unitPrice ??
                              item.unit_price ??
                              item.sellingPrice ??
                              item.selling_price
                          );

                        const lineTotal =
                          toNumber(
                            item.lineTotal ??
                              item.line_total ??
                              item.totalAmount ??
                              item.total_amount ??
                              unitPrice *
                                quantity
                          );

                        return (
                          <article
                            className="sale-detail-item"
                            key={
                              item.id ||
                              `${item.medicineId}-${item.batchId}`
                            }
                          >
                            <div>
                              <strong>
                                {item.brandName ||
                                  item.brand_name ||
                                  item.medicineName ||
                                  item.medicine_name ||
                                  "Medicine"}
                              </strong>

                              <span>
                                Batch:{" "}
                                {item.batchNumber ||
                                  item.batch_number ||
                                  "-"}
                              </span>
                            </div>

                            <div>
                              <span>
                                {quantity} ×{" "}
                                {currencyFormatter.format(
                                  unitPrice
                                )}
                              </span>

                              <strong>
                                {currencyFormatter.format(
                                  lineTotal
                                )}
                              </strong>
                            </div>
                          </article>
                        );
                      }
                    )
                  )}
                </div>

                <div className="sale-detail-summary">
                  <div>
                    <span>Grand total</span>

                    <strong>
                      {currencyFormatter.format(
                        toNumber(
                          selectedSale.grandTotal ??
                            selectedSale.grand_total
                        )
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Paid amount</span>

                    <strong>
                      {currencyFormatter.format(
                        toNumber(
                          selectedSale.paidAmount ??
                            selectedSale.paid_amount
                        )
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Due amount</span>

                    <strong>
                      {currencyFormatter.format(
                        toNumber(
                          selectedSale.dueAmount ??
                            selectedSale.due_amount
                        )
                      )}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="details-invoice-button"
                  onClick={() =>
                    downloadInvoice(
                      selectedSale
                    )
                  }
                >
                  Download invoice PDF
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default SalesHistoryPage;