import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import apiClient from "../api/apiClient";

import saleReturnService from
  "../services/saleReturnService";

import "./SaleReturnPage.css";

const PAGE_LIMIT = 10;

const todayDate = () => {
  return new Date()
    .toISOString()
    .slice(0, 10);
};

const toNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const money = (value) => {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(toNumber(value));
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const normalized = String(value)
    .replace(" ", "T");

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
};

const unwrapResponse = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    {}
  );
};

const getSaleId = (sale) => {
  return toNumber(
    sale?.id ??
    sale?.saleId ??
    sale?.sale_id
  );
};

const getSaleItemId = (item) => {
  return toNumber(
    item?.id ??
    item?.saleItemId ??
    item?.sale_item_id
  );
};

const getReturnableQuantity = (
  item
) => {
  const sold = toNumber(
    item.quantity
  );

  const returned = toNumber(
    item.returnedQuantity ??
    item.returned_quantity
  );

  return Math.max(
    sold - returned,
    0
  );
};

const normalizeSaleDetails = (
  data = {}
) => {
  const sale =
    data.sale ??
    data.saleHeader ??
    data.invoice ??
    data.header ??
    null;

  const items =
    data.items ??
    data.saleItems ??
    data.invoiceItems ??
    [];

  return {
    sale,
    items: Array.isArray(items)
      ? items
      : [],
  };
};

const extractSalesList = (
  data = {}
) => {
  if (Array.isArray(data)) {
    return data;
  }

  const list =
    data.sales ??
    data.invoices ??
    data.records ??
    [];

  return Array.isArray(list)
    ? list
    : [];
};

const estimateReturnLine = (
  item,
  returnQuantity
) => {
  const soldQuantity = Math.max(
    toNumber(item.quantity),
    1
  );

  const unitSubtotal =
    toNumber(
      item.subtotal,
      toNumber(
        item.sellingPrice ??
        item.selling_price
      ) * soldQuantity
    ) / soldQuantity;

  const unitDiscount =
    toNumber(
      item.discountAmount ??
      item.discount_amount
    ) / soldQuantity;

  const unitTaxable =
    toNumber(
      item.taxableAmount ??
      item.taxable_amount,
      (
        unitSubtotal -
        unitDiscount
      ) * soldQuantity
    ) / soldQuantity;

  const unitTax =
    toNumber(
      item.taxAmount ??
      item.tax_amount
    ) / soldQuantity;

  const unitTotal =
    toNumber(
      item.lineTotal ??
      item.line_total,
      (
        unitTaxable +
        unitTax
      ) * soldQuantity
    ) / soldQuantity;

  return {
    subtotal:
      unitSubtotal *
      returnQuantity,

    discountAmount:
      unitDiscount *
      returnQuantity,

    taxableAmount:
      unitTaxable *
      returnQuantity,

    taxAmount:
      unitTax *
      returnQuantity,

    lineTotal:
      unitTotal *
      returnQuantity,
  };
};

const defaultReturnForm = () => ({
  returnDate: todayDate(),
  refundMethod: "CASH",
  refundReference: "",
  reason: "",
});

function SaleReturnPage() {
  const [
    activeTab,
    setActiveTab,
  ] = useState("create");

  const [
    invoiceSearch,
    setInvoiceSearch,
  ] = useState("");

  const [
    sourceSale,
    setSourceSale,
  ] = useState(null);

  const [
    sourceItems,
    setSourceItems,
  ] = useState([]);

  const [
    quantities,
    setQuantities,
  ] = useState({});

  const [
    returnForm,
    setReturnForm,
  ] = useState(
    defaultReturnForm
  );

  const [
    invoiceLoading,
    setInvoiceLoading,
  ] = useState(false);

  const [
    submitLoading,
    setSubmitLoading,
  ] = useState(false);

  const [
    createError,
    setCreateError,
  ] = useState("");

  const [
    createSuccess,
    setCreateSuccess,
  ] = useState(null);

  const [
    history,
    setHistory,
  ] = useState([]);

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(false);

  const [
    historyError,
    setHistoryError,
  ] = useState("");

  const [
    historyPage,
    setHistoryPage,
  ] = useState(1);

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });

  const [
    historyFilters,
    setHistoryFilters,
  ] = useState({
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const [
    selectedReturn,
    setSelectedReturn,
  ] = useState(null);

  const [
    detailsLoading,
    setDetailsLoading,
  ] = useState(false);

  const [
    detailsError,
    setDetailsError,
  ] = useState("");

  const selectedItems =
    useMemo(() => {
      return sourceItems
        .map((item) => {
          const saleItemId =
            getSaleItemId(item);

          const quantity =
            toNumber(
              quantities[
                saleItemId
              ]
            );

          return {
            item,
            saleItemId,
            quantity,
            estimate:
              estimateReturnLine(
                item,
                quantity
              ),
          };
        })
        .filter((entry) => {
          return entry.quantity > 0;
        });
    }, [
      sourceItems,
      quantities,
    ]);

  const returnSummary =
    useMemo(() => {
      return selectedItems.reduce(
        (summary, entry) => {
          summary.totalQuantity +=
            entry.quantity;

          summary.subtotal +=
            entry.estimate.subtotal;

          summary.discountAmount +=
            entry.estimate
              .discountAmount;

          summary.taxableAmount +=
            entry.estimate
              .taxableAmount;

          summary.taxAmount +=
            entry.estimate.taxAmount;

          summary.returnTotal +=
            entry.estimate.lineTotal;

          return summary;
        },
        {
          totalQuantity: 0,
          subtotal: 0,
          discountAmount: 0,
          taxableAmount: 0,
          taxAmount: 0,
          returnTotal: 0,
        }
      );
    }, [selectedItems]);

  const loadHistory =
    useCallback(async () => {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const result =
          await saleReturnService
            .getSaleReturns({
              page: historyPage,
              limit: PAGE_LIMIT,

              search:
                historyFilters.search ||
                undefined,

              status:
                historyFilters.status ||
                undefined,

              dateFrom:
                historyFilters.dateFrom ||
                undefined,

              dateTo:
                historyFilters.dateTo ||
                undefined,
            });

        setHistory(
          result.saleReturns || []
        );

        setPagination(
          result.pagination || {
            page: historyPage,
            limit: PAGE_LIMIT,
            total: 0,
            totalPages: 1,
          }
        );
      } catch (error) {
        setHistoryError(
          saleReturnService
            .getErrorMessage(
              error,
              "Unable to load sale returns."
            )
        );
      } finally {
        setHistoryLoading(false);
      }
    }, [
      historyPage,
      historyFilters,
    ]);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [
    activeTab,
    loadHistory,
  ]);

  const fetchSaleDetails = async (
    saleId
  ) => {
    const response =
      await apiClient.get(
        `/sales/${saleId}`
      );

    return normalizeSaleDetails(
      unwrapResponse(response)
    );
  };

  const findSale = async (query) => {
    const numericId =
      Number(query);

    if (
      Number.isInteger(numericId) &&
      numericId > 0
    ) {
      return fetchSaleDetails(
        numericId
      );
    }

    const listResponse =
      await apiClient.get(
        "/sales",
        {
          params: {
            search: query,
            page: 1,
            limit: 20,
          },
        }
      );

    const candidates =
      extractSalesList(
        unwrapResponse(
          listResponse
        )
      );

    const normalizedQuery =
      String(query)
        .trim()
        .toLowerCase();

    const matchedSale =
      candidates.find((sale) => {
        return String(
          sale.invoiceNumber ??
          sale.invoice_number ??
          ""
        )
          .trim()
          .toLowerCase() ===
          normalizedQuery;
      }) || candidates[0];

    if (!matchedSale) {
      throw new Error(
        "Sales invoice was not found."
      );
    }

    return fetchSaleDetails(
      getSaleId(matchedSale)
    );
  };

  const handleInvoiceSearch =
    async (event) => {
      event.preventDefault();

      const query =
        invoiceSearch.trim();

      if (!query) {
        setCreateError(
          "Enter a sale ID or invoice number."
        );
        return;
      }

      setInvoiceLoading(true);
      setCreateError("");
      setCreateSuccess(null);

      try {
        const result =
          await findSale(query);

        if (!result.sale) {
          throw new Error(
            "Sales invoice details were not found."
          );
        }

        setSourceSale(result.sale);
        setSourceItems(result.items);
        setQuantities({});

        const hasReturnableItems =
          result.items.some(
            (item) => {
              return (
                getReturnableQuantity(
                  item
                ) > 0
              );
            }
          );

        if (!hasReturnableItems) {
          setCreateError(
            "This invoice has no returnable quantity."
          );
        }
      } catch (error) {
        setSourceSale(null);
        setSourceItems([]);
        setQuantities({});

        setCreateError(
          saleReturnService
            .getErrorMessage(
              error,
              "Unable to retrieve the sales invoice."
            )
        );
      } finally {
        setInvoiceLoading(false);
      }
    };

  const updateQuantity = (
    item,
    nextValue
  ) => {
    const saleItemId =
      getSaleItemId(item);

    const maximum =
      getReturnableQuantity(item);

    const quantity = Math.min(
      Math.max(
        Math.floor(
          toNumber(nextValue)
        ),
        0
      ),
      maximum
    );

    setQuantities((current) => ({
      ...current,
      [saleItemId]: quantity,
    }));
  };

  const handleCreateReturn =
    async (event) => {
      event.preventDefault();

      setCreateError("");
      setCreateSuccess(null);

      if (!sourceSale) {
        setCreateError(
          "Select a sales invoice first."
        );
        return;
      }

      if (selectedItems.length === 0) {
        setCreateError(
          "Select at least one item and return quantity."
        );
        return;
      }

      if (!returnForm.reason.trim()) {
        setCreateError(
          "Return reason is required."
        );
        return;
      }

      setSubmitLoading(true);

      try {
        const result =
          await saleReturnService
            .createSaleReturn({
              saleId:
                getSaleId(sourceSale),

              returnDate:
                returnForm.returnDate,

              refundMethod:
                returnForm.refundMethod,

              refundReference:
                returnForm
                  .refundReference
                  .trim() || null,

              reason:
                returnForm.reason.trim(),

              items:
                selectedItems.map(
                  (entry) => ({
                    saleItemId:
                      entry.saleItemId,

                    quantity:
                      entry.quantity,
                  })
                ),
            });

        setCreateSuccess(
          result.returnHeader
        );

        setSourceSale(null);
        setSourceItems([]);
        setQuantities({});
        setInvoiceSearch("");

        setReturnForm(
          defaultReturnForm()
        );

        setHistoryPage(1);
      } catch (error) {
        setCreateError(
          saleReturnService
            .getErrorMessage(
              error,
              "Unable to create the sale return."
            )
        );
      } finally {
        setSubmitLoading(false);
      }
    };

  const handleViewDetails =
    async (returnId) => {
      setSelectedReturn(null);
      setDetailsError("");
      setDetailsLoading(true);

      try {
        const result =
          await saleReturnService
            .getSaleReturnById(
              returnId
            );

        setSelectedReturn(result);
      } catch (error) {
        setDetailsError(
          saleReturnService
            .getErrorMessage(
              error,
              "Unable to load return details."
            )
        );
      } finally {
        setDetailsLoading(false);
      }
    };

  const handlePreviewPdf =
    async (returnId) => {
      try {
        await saleReturnService
          .previewCreditNotePdf(
            returnId
          );
      } catch (error) {
        setHistoryError(
          saleReturnService
            .getErrorMessage(
              error,
              "Unable to open the credit note PDF."
            )
        );
      }
    };

  const clearHistoryFilters = () => {
    setHistoryFilters({
      search: "",
      status: "",
      dateFrom: "",
      dateTo: "",
    });

    setHistoryPage(1);
  };

  const sourceInvoiceNumber =
    sourceSale?.invoiceNumber ??
    sourceSale?.invoice_number ??
    "-";

  const sourceCustomerName =
    sourceSale?.customerName ??
    sourceSale?.customer_name ??
    "Cash Customer";

  return (
    <div className="sale-return-page">
      <section className="sale-return-hero">
        <div>
          <span className="sale-return-eyebrow">
            Returns management
          </span>

          <h2>Sales returns</h2>

          <p>
            Return sold medicines, restore stock and issue credit notes.
          </p>
        </div>

        <div className="sale-return-hero-stat">
          <span>Current section</span>
          <strong>
            {activeTab === "create"
              ? "Create Return"
              : "Return History"}
          </strong>
        </div>
      </section>

      <section className="sale-return-tabs">
        <button
          type="button"
          className={
            activeTab === "create"
              ? "is-active"
              : ""
          }
          onClick={() =>
            setActiveTab("create")
          }
        >
          Create return
        </button>

        <button
          type="button"
          className={
            activeTab === "history"
              ? "is-active"
              : ""
          }
          onClick={() =>
            setActiveTab("history")
          }
        >
          Return history
        </button>
      </section>

      {activeTab === "create" ? (
        <div className="sale-return-create-layout">
          {createError ? (
            <div className="sale-return-alert error">
              <span>{createError}</span>

              <button
                type="button"
                onClick={() =>
                  setCreateError("")
                }
              >
                ×
              </button>
            </div>
          ) : null}

          {createSuccess ? (
            <div className="sale-return-alert success">
              <div>
                <strong>
                  Sale return created successfully.
                </strong>

                <span>
                  {createSuccess.returnNumber}
                  {" • "}
                  {money(
                    createSuccess.returnTotal
                  )}
                </span>
              </div>

              <div className="sale-return-success-actions">
                <button
                  type="button"
                  onClick={() =>
                    saleReturnService
                      .previewCreditNotePdf(
                        createSuccess.id
                      )
                  }
                >
                  View credit note
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("history");
                    setCreateSuccess(null);
                  }}
                >
                  View history
                </button>
              </div>
            </div>
          ) : null}

          <section className="sale-return-card">
            <div className="sale-return-card-heading">
              <div>
                <span>Source invoice</span>
                <h3>Find completed sale</h3>
              </div>
            </div>

            <form
              className="sale-return-invoice-search"
              onSubmit={
                handleInvoiceSearch
              }
            >
              <label>
                Sale ID or invoice number

                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={(event) =>
                    setInvoiceSearch(
                      event.target.value
                    )
                  }
                  placeholder="Example: SAL-20260728-701AEA or 2"
                />
              </label>

              <button
                type="submit"
                className="sale-return-primary-button"
                disabled={invoiceLoading}
              >
                {invoiceLoading
                  ? "Searching..."
                  : "Find invoice"}
              </button>
            </form>
          </section>

          {sourceSale ? (
            <form
              className="sale-return-form"
              onSubmit={
                handleCreateReturn
              }
            >
              <section className="sale-return-card">
                <div className="sale-return-card-heading">
                  <div>
                    <span>Invoice details</span>
                    <h3>{sourceInvoiceNumber}</h3>
                  </div>

                  <span className="sale-return-status completed">
                    {sourceSale.status ||
                      "COMPLETED"}
                  </span>
                </div>

                <div className="sale-return-invoice-summary">
                  <div>
                    <span>Customer</span>
                    <strong>
                      {sourceCustomerName}
                    </strong>
                  </div>

                  <div>
                    <span>Sale date</span>
                    <strong>
                      {formatDate(
                        sourceSale.saleDate ??
                        sourceSale.sale_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Invoice total</span>
                    <strong>
                      {money(
                        sourceSale.grandTotal ??
                        sourceSale.grand_total
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Payment</span>
                    <strong>
                      {sourceSale.paymentStatus ??
                        sourceSale.payment_status ??
                        "-"}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="sale-return-card">
                <div className="sale-return-card-heading">
                  <div>
                    <span>Return items</span>
                    <h3>Select quantity</h3>
                  </div>

                  <strong className="sale-return-item-count">
                    {returnSummary.totalQuantity}
                    {" item(s)"}
                  </strong>
                </div>

                <div className="sale-return-table-wrapper">
                  <table className="sale-return-items-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Batch</th>
                        <th>Sold</th>
                        <th>Returned</th>
                        <th>Returnable</th>
                        <th>Rate</th>
                        <th>Return qty</th>
                        <th>Estimated total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {sourceItems.map(
                        (item) => {
                          const saleItemId =
                            getSaleItemId(item);

                          const quantity =
                            toNumber(
                              quantities[
                                saleItemId
                              ]
                            );

                          const returnable =
                            getReturnableQuantity(
                              item
                            );

                          const estimate =
                            estimateReturnLine(
                              item,
                              quantity
                            );

                          return (
                            <tr key={saleItemId}>
                              <td>
                                <strong>
                                  {item.medicineName ??
                                    item.medicine_name ??
                                    item.brandName ??
                                    "Medicine"}
                                </strong>

                                <span>
                                  {item.genericName ??
                                    item.generic_name ??
                                    "-"}
                                </span>
                              </td>

                              <td>
                                {item.batchNumber ??
                                  item.batch_number ??
                                  "-"}
                              </td>

                              <td>
                                {toNumber(
                                  item.quantity
                                )}
                              </td>

                              <td>
                                {toNumber(
                                  item.returnedQuantity ??
                                  item.returned_quantity
                                )}
                              </td>

                              <td>
                                <strong>
                                  {returnable}
                                </strong>
                              </td>

                              <td>
                                {money(
                                  item.sellingPrice ??
                                  item.selling_price
                                )}
                              </td>

                              <td>
                                <div className="sale-return-quantity-control">
                                  <button
                                    type="button"
                                    disabled={quantity <= 0}
                                    onClick={() =>
                                      updateQuantity(
                                        item,
                                        quantity - 1
                                      )
                                    }
                                  >
                                    −
                                  </button>

                                  <input
                                    type="number"
                                    min="0"
                                    max={returnable}
                                    value={quantity}
                                    disabled={
                                      returnable === 0
                                    }
                                    onChange={(event) =>
                                      updateQuantity(
                                        item,
                                        event.target.value
                                      )
                                    }
                                  />

                                  <button
                                    type="button"
                                    disabled={
                                      quantity >=
                                      returnable
                                    }
                                    onClick={() =>
                                      updateQuantity(
                                        item,
                                        quantity + 1
                                      )
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </td>

                              <td>
                                <strong>
                                  {money(
                                    estimate.lineTotal
                                  )}
                                </strong>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="sale-return-bottom-grid">
                <section className="sale-return-card">
                  <div className="sale-return-card-heading">
                    <div>
                      <span>Refund information</span>
                      <h3>Return details</h3>
                    </div>
                  </div>

                  <div className="sale-return-fields">
                    <label>
                      Return date

                      <input
                        type="date"
                        value={
                          returnForm.returnDate
                        }
                        onChange={(event) =>
                          setReturnForm(
                            (current) => ({
                              ...current,
                              returnDate:
                                event.target.value,
                            })
                          )
                        }
                        required
                      />
                    </label>

                    <label>
                      Refund method

                      <select
                        value={
                          returnForm.refundMethod
                        }
                        onChange={(event) =>
                          setReturnForm(
                            (current) => ({
                              ...current,
                              refundMethod:
                                event.target.value,
                            })
                          )
                        }
                      >
                        <option value="CASH">Cash</option>
                        <option value="CARD">Card</option>
                        <option value="UPI">UPI</option>
                        <option value="BANK">Bank</option>
                        <option value="CREDIT">
                          Credit adjustment
                        </option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>

                    <label className="sale-return-full-field">
                      Refund reference

                      <input
                        type="text"
                        value={
                          returnForm.refundReference
                        }
                        onChange={(event) =>
                          setReturnForm(
                            (current) => ({
                              ...current,
                              refundReference:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="Optional transaction reference"
                      />
                    </label>

                    <label className="sale-return-full-field">
                      Return reason

                      <textarea
                        value={returnForm.reason}
                        onChange={(event) =>
                          setReturnForm(
                            (current) => ({
                              ...current,
                              reason:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="Describe why the customer returned the medicine"
                        rows="4"
                        required
                      />
                    </label>
                  </div>
                </section>

                <section className="sale-return-card sale-return-totals-card">
                  <div className="sale-return-card-heading">
                    <div>
                      <span>Return summary</span>
                      <h3>Estimated refund</h3>
                    </div>
                  </div>

                  <dl className="sale-return-totals">
                    <div>
                      <dt>Total quantity</dt>
                      <dd>
                        {returnSummary.totalQuantity}
                      </dd>
                    </div>

                    <div>
                      <dt>Subtotal</dt>
                      <dd>
                        {money(
                          returnSummary.subtotal
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Discount</dt>
                      <dd>
                        −{money(
                          returnSummary
                            .discountAmount
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>GST</dt>
                      <dd>
                        {money(
                          returnSummary.taxAmount
                        )}
                      </dd>
                    </div>

                    <div className="grand-total">
                      <dt>Refund total</dt>
                      <dd>
                        {money(
                          returnSummary.returnTotal
                        )}
                      </dd>
                    </div>
                  </dl>

                  <p className="sale-return-estimate-note">
                    Final amount is calculated and validated by the backend.
                  </p>

                  <button
                    type="submit"
                    className="sale-return-primary-button sale-return-submit-button"
                    disabled={
                      submitLoading ||
                      selectedItems.length === 0
                    }
                  >
                    {submitLoading
                      ? "Processing return..."
                      : "Complete sale return"}
                  </button>
                </section>
              </div>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="sale-return-history-layout">
          {historyError ? (
            <div className="sale-return-alert error">
              <span>{historyError}</span>

              <button
                type="button"
                onClick={() =>
                  setHistoryError("")
                }
              >
                ×
              </button>
            </div>
          ) : null}

          <section className="sale-return-card">
            <div className="sale-return-history-filters">
              <label>
                Search

                <input
                  type="text"
                  value={
                    historyFilters.search
                  }
                  onChange={(event) => {
                    setHistoryPage(1);
                    setHistoryFilters(
                      (current) => ({
                        ...current,
                        search:
                          event.target.value,
                      })
                    );
                  }}
                  placeholder="Return number, invoice or customer"
                />
              </label>

              <label>
                Status

                <select
                  value={
                    historyFilters.status
                  }
                  onChange={(event) => {
                    setHistoryPage(1);
                    setHistoryFilters(
                      (current) => ({
                        ...current,
                        status:
                          event.target.value,
                      })
                    );
                  }}
                >
                  <option value="">
                    All statuses
                  </option>
                  <option value="COMPLETED">
                    Completed
                  </option>
                  <option value="CANCELLED">
                    Cancelled
                  </option>
                </select>
              </label>

              <label>
                From

                <input
                  type="date"
                  value={
                    historyFilters.dateFrom
                  }
                  onChange={(event) => {
                    setHistoryPage(1);
                    setHistoryFilters(
                      (current) => ({
                        ...current,
                        dateFrom:
                          event.target.value,
                      })
                    );
                  }}
                />
              </label>

              <label>
                To

                <input
                  type="date"
                  value={
                    historyFilters.dateTo
                  }
                  onChange={(event) => {
                    setHistoryPage(1);
                    setHistoryFilters(
                      (current) => ({
                        ...current,
                        dateTo:
                          event.target.value,
                      })
                    );
                  }}
                />
              </label>

              <button
                type="button"
                className="sale-return-secondary-button"
                onClick={clearHistoryFilters}
              >
                Clear filters
              </button>

              <button
                type="button"
                className="sale-return-primary-button"
                onClick={loadHistory}
                disabled={historyLoading}
              >
                Refresh
              </button>
            </div>
          </section>

          <section className="sale-return-card sale-return-history-card">
            <div className="sale-return-card-heading">
              <div>
                <span>Return records</span>
                <h3>Sales return history</h3>
              </div>

              <strong className="sale-return-item-count">
                {pagination.total} record(s)
              </strong>
            </div>

            {historyLoading ? (
              <div className="sale-return-state">
                <div className="sale-return-loader" />
                <p>Loading sale returns...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="sale-return-state">
                <div className="sale-return-empty-icon">
                  SR
                </div>
                <strong>No sale returns found</strong>
                <p>
                  Create a return or change the history filters.
                </p>
              </div>
            ) : (
              <div className="sale-return-table-wrapper">
                <table className="sale-return-history-table">
                  <thead>
                    <tr>
                      <th>Return</th>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Quantity</th>
                      <th>Refund</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <strong>
                            {record.returnNumber ??
                              record.return_number ??
                              `#${record.id}`}
                          </strong>
                        </td>

                        <td>
                          {record.invoiceNumber ??
                            record.invoice_number ??
                            "-"}
                        </td>

                        <td>
                          <strong>
                            {record.customerName ??
                              record.customer_name ??
                              "Cash Customer"}
                          </strong>

                          <span>
                            {record.customerPhone ??
                              record.customer_phone ??
                              ""}
                          </span>
                        </td>

                        <td>
                          {formatDate(
                            record.returnDate ??
                            record.return_date
                          )}
                        </td>

                        <td>
                          {toNumber(
                            record.totalQuantity ??
                            record.total_quantity
                          )}
                        </td>

                        <td>
                          <strong>
                            {money(
                              record.refundAmount ??
                              record.refund_amount ??
                              record.returnTotal ??
                              record.return_total
                            )}
                          </strong>
                        </td>

                        <td>
                          {record.refundMethod ??
                            record.refund_method ??
                            "-"}
                        </td>

                        <td>
                          <span
                            className={`sale-return-status ${String(
                              record.status ||
                              "completed"
                            ).toLowerCase()}`}
                          >
                            {record.status ||
                              "COMPLETED"}
                          </span>
                        </td>

                        <td>
                          <div className="sale-return-row-actions">
                            <button
                              type="button"
                              onClick={() =>
                                handleViewDetails(
                                  record.id
                                )
                              }
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handlePreviewPdf(
                                  record.id
                                )
                              }
                            >
                              PDF
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                saleReturnService
                                  .downloadCreditNotePdf(
                                    record.id
                                  )
                              }
                            >
                              Download
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="sale-return-pagination">
              <span>
                Page {pagination.page} of {Math.max(
                  pagination.totalPages,
                  1
                )}
              </span>

              <div>
                <button
                  type="button"
                  disabled={historyPage <= 1}
                  onClick={() =>
                    setHistoryPage(
                      (page) => page - 1
                    )
                  }
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={
                    historyPage >=
                    Math.max(
                      pagination.totalPages,
                      1
                    )
                  }
                  onClick={() =>
                    setHistoryPage(
                      (page) => page + 1
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {(detailsLoading ||
        detailsError ||
        selectedReturn) ? (
        <div
          className="sale-return-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedReturn(null);
              setDetailsError("");
              setDetailsLoading(false);
            }
          }}
        >
          <section
            className="sale-return-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Sale return details"
          >
            <div className="sale-return-modal-header">
              <div>
                <span>Sale return</span>
                <h3>
                  {selectedReturn
                    ?.returnHeader
                    ?.returnNumber ||
                    "Return details"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedReturn(null);
                  setDetailsError("");
                  setDetailsLoading(false);
                }}
              >
                ×
              </button>
            </div>

            {detailsLoading ? (
              <div className="sale-return-state">
                <div className="sale-return-loader" />
                <p>Loading details...</p>
              </div>
            ) : detailsError ? (
              <div className="sale-return-alert error">
                {detailsError}
              </div>
            ) : selectedReturn ? (
              <div className="sale-return-modal-content">
                <div className="sale-return-detail-grid">
                  <div>
                    <span>Invoice</span>
                    <strong>
                      {selectedReturn
                        .returnHeader
                        ?.invoiceNumber || "-"}
                    </strong>
                  </div>

                  <div>
                    <span>Customer</span>
                    <strong>
                      {selectedReturn
                        .returnHeader
                        ?.customerName ||
                        "Cash Customer"}
                    </strong>
                  </div>

                  <div>
                    <span>Return date</span>
                    <strong>
                      {formatDate(
                        selectedReturn
                          .returnHeader
                          ?.returnDate
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Refund</span>
                    <strong>
                      {money(
                        selectedReturn
                          .returnHeader
                          ?.refundAmount
                      )}
                    </strong>
                  </div>
                </div>

                <div className="sale-return-detail-reason">
                  <span>Reason</span>
                  <p>
                    {selectedReturn
                      .returnHeader
                      ?.reason || "-"}
                  </p>
                </div>

                <div className="sale-return-table-wrapper">
                  <table className="sale-return-detail-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Batch</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>GST</th>
                        <th>Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedReturn.items.map(
                        (item) => (
                          <tr key={item.id}>
                            <td>
                              {item.medicineName}
                            </td>
                            <td>
                              {item.batchNumber}
                            </td>
                            <td>{item.quantity}</td>
                            <td>
                              {money(
                                item.sellingPrice
                              )}
                            </td>
                            <td>
                              {item.gstPercent}%
                            </td>
                            <td>
                              <strong>
                                {money(
                                  item.lineTotal
                                )}
                              </strong>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="sale-return-modal-actions">
                  <button
                    type="button"
                    className="sale-return-secondary-button"
                    onClick={() =>
                      saleReturnService
                        .downloadCreditNotePdf(
                          selectedReturn
                            .returnHeader.id
                        )
                    }
                  >
                    Download PDF
                  </button>

                  <button
                    type="button"
                    className="sale-return-primary-button"
                    onClick={() =>
                      saleReturnService
                        .previewCreditNotePdf(
                          selectedReturn
                            .returnHeader.id
                        )
                    }
                  >
                    View credit note
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default SaleReturnPage;