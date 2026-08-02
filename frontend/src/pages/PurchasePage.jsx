import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import apiClient from "../api/apiClient";
import "./PurchasePage.css";

const currencyFormatter =
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const PAYMENT_METHODS = [
  "CASH",
  "UPI",
  "CARD",
  "BANK",
  "OTHER",
];

const toNumber = (value) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
};

const roundMoney = (value) => {
  return (
    Math.round(
      (toNumber(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
};

const getToday = () => {
  const date = new Date();

  const timezoneOffset =
    date.getTimezoneOffset() *
    60_000;

  return new Date(
    date.getTime() - timezoneOffset
  )
    .toISOString()
    .slice(0, 10);
};

const normaliseDate = (value) => {
  return String(value || "")
    .trim()
    .slice(0, 10);
};

const isValidDate = (value) => {
  const dateValue =
    normaliseDate(value);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateValue
    )
  ) {
    return false;
  }

  const [year, month, day] =
    dateValue
      .split("-")
      .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() === day
  );
};

const extractList = (
  responseData,
  keys
) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  const candidates = [
    ...keys.map(
      (key) =>
        responseData?.data?.[key]
    ),

    responseData?.data?.items,
    responseData?.data?.rows,

    ...keys.map(
      (key) => responseData?.[key]
    ),

    responseData?.items,
    responseData?.rows,
    responseData?.data,
  ];

  return (
    candidates.find(Array.isArray) ||
    []
  );
};

const getMedicineId = (medicine) => {
  return (
    medicine?.id ||
    medicine?.medicineId ||
    medicine?.medicine_id ||
    null
  );
};

const getSupplierId = (supplier) => {
  return (
    supplier?.id ||
    supplier?.supplierId ||
    supplier?.supplier_id ||
    null
  );
};

const getPurchaseResponseData = (
  responseData
) => {
  return (
    responseData?.data?.purchase ||
    responseData?.purchase ||
    responseData?.data ||
    responseData ||
    {}
  );
};

const createPurchaseItem = (
  medicine
) => {
  return {
    rowId: `${
      getMedicineId(medicine)
    }-${Date.now()}-${Math.random()}`,

    medicineId:
      getMedicineId(medicine),

    brandName:
      medicine?.brandName ||
      medicine?.brand_name ||
      "Medicine",

    genericName:
      medicine?.genericName ||
      medicine?.generic_name ||
      "",

    strength:
      medicine?.strength || "",

    batchNumber: "",
    manufactureDate: "",
    expiryDate: "",

    quantity: 1,
    freeQuantity: 0,

    purchasePrice: 0,
    mrp: 0,
    sellingPrice: 0,

    taxRate: toNumber(
      medicine?.gstRate ??
        medicine?.gst_rate ??
        medicine?.taxRate ??
        medicine?.tax_rate ??
        medicine?.gst ??
        0
    ),

    discountAmount: 0,
  };
};

const calculateItem = (item) => {
  const quantity = Math.max(
    toNumber(item.quantity),
    0
  );

  const purchasePrice = Math.max(
    toNumber(item.purchasePrice),
    0
  );

  const grossAmount = roundMoney(
    quantity * purchasePrice
  );

  const discountAmount = Math.min(
    Math.max(
      toNumber(
        item.discountAmount
      ),
      0
    ),
    grossAmount
  );

  const taxableAmount = roundMoney(
    grossAmount - discountAmount
  );

  const taxRate = Math.max(
    toNumber(item.taxRate),
    0
  );

  const taxAmount = roundMoney(
    taxableAmount *
      (taxRate / 100)
  );

  const totalAmount = roundMoney(
    taxableAmount + taxAmount
  );

  return {
    grossAmount,
    discountAmount,
    taxableAmount,
    taxAmount,
    totalAmount,
  };
};

function PurchasePage() {
  const [suppliers, setSuppliers] =
    useState([]);

  const [medicines, setMedicines] =
    useState([]);

  const [items, setItems] =
    useState([]);

  const [
    selectedSupplierId,
    setSelectedSupplierId,
  ] = useState("");

  const [
    selectedMedicineId,
    setSelectedMedicineId,
  ] = useState("");

  const [
    supplierInvoiceNumber,
    setSupplierInvoiceNumber,
  ] = useState("");

  const [
    purchaseDate,
    setPurchaseDate,
  ] = useState(getToday());

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("CASH");

  const [
    paidAmount,
    setPaidAmount,
  ] = useState(0);

  const [
    paymentReference,
    setPaymentReference,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [
    loadingMasters,
    setLoadingMasters,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    downloadingInvoice,
    setDownloadingInvoice,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    completedPurchase,
    setCompletedPurchase,
  ] = useState(null);

  const clearMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const loadMasters =
    useCallback(async () => {
      try {
        setLoadingMasters(true);
        setErrorMessage("");

        const [
          supplierResponse,
          medicineResponse,
        ] = await Promise.all([
          apiClient.get(
            "/suppliers",
            {
              params: {
                page: 1,
                limit: 500,
                isActive: true,
              },
            }
          ),

          apiClient.get(
            "/medicines",
            {
              params: {
                page: 1,
                limit: 500,
                isActive: true,
              },
            }
          ),
        ]);

        setSuppliers(
          extractList(
            supplierResponse.data,
            ["suppliers"]
          )
        );

        setMedicines(
          extractList(
            medicineResponse.data,
            ["medicines"]
          )
        );
      } catch (error) {
        console.error(
          "Purchase master loading error:",
          error
        );

        setErrorMessage(
          error.response?.data
            ?.message ||
            "Supplier অথবা medicine list load করা যায়নি।"
        );
      } finally {
        setLoadingMasters(false);
      }
    }, []);

  useEffect(() => {
    document.title =
      "New Purchase | PharmaERP";

    loadMasters();
  }, [loadMasters]);

  const selectedSupplier =
    useMemo(() => {
      return suppliers.find(
        (supplier) =>
          String(
            getSupplierId(supplier)
          ) ===
          String(
            selectedSupplierId
          )
      );
    }, [
      suppliers,
      selectedSupplierId,
    ]);

  const totals = useMemo(() => {
    return items.reduce(
      (result, item) => {
        const calculation =
          calculateItem(item);

        return {
          quantity:
            result.quantity +
            toNumber(
              item.quantity
            ),

          freeQuantity:
            result.freeQuantity +
            toNumber(
              item.freeQuantity
            ),

          grossAmount:
            result.grossAmount +
            calculation.grossAmount,

          discountAmount:
            result.discountAmount +
            calculation.discountAmount,

          taxAmount:
            result.taxAmount +
            calculation.taxAmount,

          grandTotal:
            result.grandTotal +
            calculation.totalAmount,
        };
      },
      {
        quantity: 0,
        freeQuantity: 0,
        grossAmount: 0,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
      }
    );
  }, [items]);

  const grandTotal = roundMoney(
    totals.grandTotal
  );

  const enteredPaidAmount =
    Math.max(
      toNumber(paidAmount),
      0
    );

  const validPaidAmount = Math.min(
    enteredPaidAmount,
    grandTotal
  );

  const dueAmount = roundMoney(
    Math.max(
      grandTotal -
        validPaidAmount,
      0
    )
  );

  const addMedicine = () => {
    const selectedMedicine =
      medicines.find(
        (medicine) =>
          String(
            getMedicineId(medicine)
          ) ===
          String(
            selectedMedicineId
          )
      );

    if (!selectedMedicine) {
      setErrorMessage(
        "Medicine select করুন।"
      );

      return;
    }

    clearMessages();

    setItems((currentItems) => [
      ...currentItems,
      createPurchaseItem(
        selectedMedicine
      ),
    ]);

    setSelectedMedicineId("");
  };

  const updateItem = (
    rowId,
    fieldName,
    value
  ) => {
    clearMessages();

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.rowId === rowId
          ? {
              ...item,
              [fieldName]: value,
            }
          : item
      )
    );
  };

  const removeItem = (rowId) => {
    clearMessages();

    setItems((currentItems) =>
      currentItems.filter(
        (item) =>
          item.rowId !== rowId
      )
    );
  };

  const validatePurchase = () => {
    if (!selectedSupplierId) {
      throw new Error(
        "Supplier select করুন।"
      );
    }

    if (
      !supplierInvoiceNumber.trim()
    ) {
      throw new Error(
        "Supplier invoice number প্রয়োজন।"
      );
    }

    if (!isValidDate(purchaseDate)) {
      throw new Error(
        "Purchase date অবশ্যই YYYY-MM-DD format-এ হতে হবে।"
      );
    }

    if (items.length === 0) {
      throw new Error(
        "কমপক্ষে একটি medicine যোগ করুন।"
      );
    }

    items.forEach(
      (item, index) => {
        const itemNumber =
          index + 1;

        if (
          !String(
            item.batchNumber || ""
          ).trim()
        ) {
          throw new Error(
            `Item ${itemNumber}: batch number প্রয়োজন।`
          );
        }

        if (
          item.manufactureDate &&
          !isValidDate(
            item.manufactureDate
          )
        ) {
          throw new Error(
            `Item ${itemNumber}: manufacture date invalid।`
          );
        }

        if (
          !isValidDate(
            item.expiryDate
          )
        ) {
          throw new Error(
            `Item ${itemNumber}: expiry date প্রয়োজন।`
          );
        }

        if (
          toNumber(
            item.quantity
          ) <= 0
        ) {
          throw new Error(
            `Item ${itemNumber}: quantity অবশ্যই 1 বা তার বেশি হবে।`
          );
        }

        if (
          toNumber(
            item.freeQuantity
          ) < 0
        ) {
          throw new Error(
            `Item ${itemNumber}: free quantity negative হতে পারবে না।`
          );
        }

        if (
          toNumber(
            item.purchasePrice
          ) <= 0
        ) {
          throw new Error(
            `Item ${itemNumber}: purchase price প্রয়োজন।`
          );
        }

        if (
          toNumber(item.mrp) <= 0
        ) {
          throw new Error(
            `Item ${itemNumber}: MRP প্রয়োজন।`
          );
        }

        if (
          toNumber(
            item.sellingPrice
          ) <= 0
        ) {
          throw new Error(
            `Item ${itemNumber}: selling price প্রয়োজন।`
          );
        }

        if (
          item.manufactureDate &&
          item.expiryDate
        ) {
          const manufactureTime =
            new Date(
              `${normaliseDate(
                item.manufactureDate
              )}T00:00:00`
            ).getTime();

          const expiryTime =
            new Date(
              `${normaliseDate(
                item.expiryDate
              )}T00:00:00`
            ).getTime();

          if (
            expiryTime <=
            manufactureTime
          ) {
            throw new Error(
              `Item ${itemNumber}: expiry date manufacture date-এর পরে হতে হবে।`
            );
          }
        }
      }
    );

    if (
      enteredPaidAmount >
      grandTotal + 0.01
    ) {
      throw new Error(
        "Paid amount grand total-এর বেশি হতে পারবে না।"
      );
    }
  };

  const createPurchase =
    async () => {
      try {
        clearMessages();
        validatePurchase();

        const cleanSupplierInvoice =
          supplierInvoiceNumber.trim();

        const cleanInvoiceDate =
          normaliseDate(
            purchaseDate
          );

        const purchaseItems =
          items.map((item) => {
            const calculation =
              calculateItem(item);

            const cleanBatchNumber =
              String(
                item.batchNumber
              ).trim();

            const cleanManufactureDate =
              item.manufactureDate
                ? normaliseDate(
                    item.manufactureDate
                  )
                : null;

            const cleanExpiryDate =
              normaliseDate(
                item.expiryDate
              );

            return {
              medicineId: Number(
                item.medicineId
              ),

              medicine_id: Number(
                item.medicineId
              ),

              batchNumber:
                cleanBatchNumber,

              batch_number:
                cleanBatchNumber,

              manufactureDate:
                cleanManufactureDate,

              manufacture_date:
                cleanManufactureDate,

              expiryDate:
                cleanExpiryDate,

              expiry_date:
                cleanExpiryDate,

              quantity: Number(
                item.quantity
              ),

              freeQuantity: Number(
                item.freeQuantity || 0
              ),

              free_quantity: Number(
                item.freeQuantity || 0
              ),

              purchasePrice:
                roundMoney(
                  item.purchasePrice
                ),

              purchase_price:
                roundMoney(
                  item.purchasePrice
                ),

              mrp: roundMoney(
                item.mrp
              ),

              sellingPrice:
                roundMoney(
                  item.sellingPrice
                ),

              selling_price:
                roundMoney(
                  item.sellingPrice
                ),

              taxRate: toNumber(
                item.taxRate
              ),

              tax_rate: toNumber(
                item.taxRate
              ),

              gstRate: toNumber(
                item.taxRate
              ),

              gst_rate: toNumber(
                item.taxRate
              ),

              discountAmount:
                calculation.discountAmount,

              discount_amount:
                calculation.discountAmount,
            };
          });

        const payments =
          validPaidAmount > 0
            ? [
                {
                  paymentMethod,
                  payment_method:
                    paymentMethod,

                  amount:
                    validPaidAmount,

                  referenceNumber:
                    paymentReference
                      .trim() ||
                    null,

                  reference_number:
                    paymentReference
                      .trim() ||
                    null,
                },
              ]
            : [];

        /*
         * Compatibility payload:
         * একই value camelCase এবং snake_case
         * দুই format-এ পাঠানো হচ্ছে।
         */
        const requestBody = {
          supplierId: Number(
            selectedSupplierId
          ),

          supplier_id: Number(
            selectedSupplierId
          ),

          supplierInvoiceNumber:
            cleanSupplierInvoice,

          supplierInvoice:
            cleanSupplierInvoice,

          supplierInvoiceNo:
            cleanSupplierInvoice,

          supplier_invoice_number:
            cleanSupplierInvoice,

          supplier_invoice_no:
            cleanSupplierInvoice,

          invoiceNumber:
            cleanSupplierInvoice,

          invoice_number:
            cleanSupplierInvoice,

          invoiceDate:
            cleanInvoiceDate,

          invoice_date:
            cleanInvoiceDate,

          purchaseDate:
            cleanInvoiceDate,

          purchase_date:
            cleanInvoiceDate,

          subtotal: roundMoney(
            totals.grossAmount
          ),

          subTotal: roundMoney(
            totals.grossAmount
          ),

          discountAmount:
            roundMoney(
              totals.discountAmount
            ),

          discount_amount:
            roundMoney(
              totals.discountAmount
            ),

          taxAmount: roundMoney(
            totals.taxAmount
          ),

          tax_amount: roundMoney(
            totals.taxAmount
          ),

          grandTotal,

          grand_total:
            grandTotal,

          notes:
            notes.trim() || null,

          items:
            purchaseItems,

          paymentMethod,

          payment_method:
            paymentMethod,

          paidAmount:
            validPaidAmount,

          paid_amount:
            validPaidAmount,

          paymentReference:
            paymentReference
              .trim() ||
            null,

          payment_reference:
            paymentReference
              .trim() ||
            null,

          payments,
        };

        console.log(
          "Purchase request payload:",
          requestBody
        );

        setSubmitting(true);

        const response =
          await apiClient.post(
            "/purchases",
            requestBody
          );

        const purchase =
          getPurchaseResponseData(
            response.data
          );

        const purchaseId =
          purchase?.id ||
          purchase?.purchaseId ||
          purchase?.purchase_id ||
          response.data?.purchaseId ||
          response.data?.purchase_id ||
          response.data?.data
            ?.purchaseId ||
          response.data?.data
            ?.purchase_id ||
          response.data?.data
            ?.purchase?.id;

        if (!purchaseId) {
          throw new Error(
            "Purchase তৈরি হয়েছে, কিন্তু purchase ID পাওয়া যায়নি।"
          );
        }

        const purchaseNumber =
          purchase?.purchaseNumber ||
          purchase?.purchase_number ||
          purchase?.invoiceNumber ||
          purchase?.invoice_number ||
          response.data?.purchaseNumber ||
          response.data
            ?.purchase_number ||
          `PURCHASE-${purchaseId}`;

        setCompletedPurchase({
          id: purchaseId,

          invoiceNumber:
            purchaseNumber,

          grandTotal: toNumber(
            purchase?.grandTotal ??
              purchase?.grand_total ??
              grandTotal
          ),

          paidAmount: toNumber(
            purchase?.paidAmount ??
              purchase?.paid_amount ??
              validPaidAmount
          ),

          dueAmount: toNumber(
            purchase?.dueAmount ??
              purchase?.due_amount ??
              dueAmount
          ),
        });

        setSuccessMessage(
          `Purchase ${purchaseNumber} successfully created.`
        );
      } catch (error) {
        console.error(
          "Create purchase error:",
          error
        );

        console.error(
          "Backend response:",
          error.response?.data
        );

        setErrorMessage(
          error.response?.data
            ?.message ||
            error.message ||
            "Purchase তৈরি করা যায়নি।"
        );
      } finally {
        setSubmitting(false);
      }
    };

  const downloadInvoice =
    async () => {
      if (
        !completedPurchase?.id
      ) {
        return;
      }

      try {
        setDownloadingInvoice(true);
        setErrorMessage("");

        const response =
          await apiClient.get(
            `/purchases/${completedPurchase.id}/invoice-pdf`,
            {
              params: {
                download: true,
              },

              responseType: "blob",
            }
          );

        const pdfBlob = new Blob(
          [response.data],
          {
            type: "application/pdf",
          }
        );

        const pdfUrl =
          window.URL.createObjectURL(
            pdfBlob
          );

        const link =
          document.createElement(
            "a"
          );

        link.href = pdfUrl;

        link.download =
          `${completedPurchase.invoiceNumber}.pdf`;

        document.body.appendChild(
          link
        );

        link.click();
        link.remove();

        window.URL.revokeObjectURL(
          pdfUrl
        );
      } catch (error) {
        console.error(
          "Purchase invoice download error:",
          error
        );

        setErrorMessage(
          "Purchase invoice PDF download করা যায়নি।"
        );
      } finally {
        setDownloadingInvoice(false);
      }
    };

  const resetPurchase = () => {
    setItems([]);

    setSelectedSupplierId("");
    setSelectedMedicineId("");

    setSupplierInvoiceNumber("");
    setPurchaseDate(getToday());

    setPaymentMethod("CASH");
    setPaidAmount(0);
    setPaymentReference("");

    setNotes("");

    setCompletedPurchase(null);

    setErrorMessage("");
    setSuccessMessage("");
  };

  return (
    <section className="purchase-page">
      <div className="purchase-header">
        <div>
          <p>
            Purchase management
          </p>

          <h2>Create purchase</h2>

          <span>
            Supplier invoice,
            medicine batch, price এবং
            payment record করুন।
          </span>
        </div>

        <div className="purchase-count">
          <span>
            Medicine items
          </span>

          <strong>
            {items.length}
          </strong>
        </div>
      </div>

      {errorMessage && (
        <div
          className="purchase-alert error"
          role="alert"
        >
          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() =>
              setErrorMessage("")
            }
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div
          className="purchase-alert success"
          role="status"
        >
          <p>{successMessage}</p>
        </div>
      )}

      {completedPurchase ? (
        <section className="purchase-success-card">
          <div className="purchase-success-icon">
            ✓
          </div>

          <p>
            Purchase completed
          </p>

          <h2>
            {
              completedPurchase.invoiceNumber
            }
          </h2>

          <div className="purchase-success-summary">
            <article>
              <span>
                Grand total
              </span>

              <strong>
                {currencyFormatter.format(
                  completedPurchase
                    .grandTotal
                )}
              </strong>
            </article>

            <article>
              <span>Paid</span>

              <strong>
                {currencyFormatter.format(
                  completedPurchase
                    .paidAmount
                )}
              </strong>
            </article>

            <article>
              <span>Due</span>

              <strong>
                {currencyFormatter.format(
                  completedPurchase
                    .dueAmount
                )}
              </strong>
            </article>
          </div>

          <div className="purchase-success-actions">
            <button
              type="button"
              onClick={downloadInvoice}
              disabled={
                downloadingInvoice
              }
            >
              {downloadingInvoice
                ? "Downloading..."
                : "Download invoice"}
            </button>

            <button
              type="button"
              onClick={resetPurchase}
            >
              Create another purchase
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="purchase-master-card">
            <div className="purchase-master-grid">
              <label>
                <span>
                  Supplier *
                </span>

                <select
                  value={
                    selectedSupplierId
                  }
                  onChange={(event) => {
                    setSelectedSupplierId(
                      event.target.value
                    );

                    clearMessages();
                  }}
                  disabled={
                    loadingMasters
                  }
                >
                  <option value="">
                    Select supplier
                  </option>

                  {suppliers.map(
                    (supplier) => {
                      const supplierId =
                        getSupplierId(
                          supplier
                        );

                      const supplierName =
                        supplier?.name ||
                        supplier
                          ?.supplierName ||
                        supplier
                          ?.supplier_name ||
                        "Supplier";

                      return (
                        <option
                          key={supplierId}
                          value={supplierId}
                        >
                          {supplierName}
                        </option>
                      );
                    }
                  )}
                </select>
              </label>

              <label>
                <span>
                  Supplier invoice *
                </span>

                <input
                  type="text"
                  value={
                    supplierInvoiceNumber
                  }
                  onChange={(event) => {
                    setSupplierInvoiceNumber(
                      event.target.value
                    );

                    clearMessages();
                  }}
                  placeholder="Supplier invoice number"
                  autoComplete="off"
                />
              </label>

              <label>
                <span>
                  Purchase date *
                </span>

                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => {
                    setPurchaseDate(
                      event.target.value
                    );

                    clearMessages();
                  }}
                />
              </label>
            </div>

            {selectedSupplier && (
              <div className="selected-supplier">
                <strong>
                  {selectedSupplier
                    ?.name ||
                    selectedSupplier
                      ?.supplierName ||
                    selectedSupplier
                      ?.supplier_name}
                </strong>

                <span>
                  {selectedSupplier
                    ?.phone ||
                    selectedSupplier
                      ?.mobile ||
                    selectedSupplier
                      ?.email ||
                    "Supplier selected"}
                </span>
              </div>
            )}
          </div>

          <div className="purchase-add-card">
            <div>
              <p>Add medicine</p>

              <h3>
                Purchase items
              </h3>
            </div>

            <div className="purchase-add-row">
              <select
                value={
                  selectedMedicineId
                }
                onChange={(event) => {
                  setSelectedMedicineId(
                    event.target.value
                  );

                  clearMessages();
                }}
                disabled={
                  loadingMasters
                }
              >
                <option value="">
                  Select medicine
                </option>

                {medicines.map(
                  (medicine) => {
                    const medicineId =
                      getMedicineId(
                        medicine
                      );

                    const brandName =
                      medicine?.brandName ||
                      medicine?.brand_name ||
                      "Medicine";

                    return (
                      <option
                        key={medicineId}
                        value={medicineId}
                      >
                        {brandName}

                        {medicine?.strength
                          ? ` — ${medicine.strength}`
                          : ""}
                      </option>
                    );
                  }
                )}
              </select>

              <button
                type="button"
                onClick={addMedicine}
              >
                + Add medicine
              </button>
            </div>
          </div>

          <div className="purchase-items-card">
            <div className="purchase-card-heading">
              <div>
                <p>
                  Batch information
                </p>

                <h3>
                  Medicine details
                </h3>
              </div>

              <span>
                {items.length} items
              </span>
            </div>

            {items.length === 0 ? (
              <div className="purchase-empty">
                Medicine select করে Add
                Medicine চাপুন।
              </div>
            ) : (
              <div className="purchase-item-list">
                {items.map(
                  (item, index) => {
                    const calculation =
                      calculateItem(
                        item
                      );

                    return (
                      <article
                        className="purchase-item"
                        key={item.rowId}
                      >
                        <div className="purchase-item-heading">
                          <div>
                            <span>
                              Item{" "}
                              {index + 1}
                            </span>

                            <h4>
                              {item.brandName}
                            </h4>

                            <p>
                              {item.genericName}{" "}
                              {item.strength}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeItem(
                                item.rowId
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>

                        <div className="purchase-item-grid">
                          <label>
                            <span>
                              Batch number *
                            </span>

                            <input
                              type="text"
                              value={
                                item.batchNumber
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "batchNumber",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Manufacture date
                            </span>

                            <input
                              type="date"
                              value={
                                item.manufactureDate
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "manufactureDate",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Expiry date *
                            </span>

                            <input
                              type="date"
                              value={
                                item.expiryDate
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "expiryDate",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Quantity *
                            </span>

                            <input
                              type="number"
                              min="1"
                              value={
                                item.quantity
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "quantity",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Free quantity
                            </span>

                            <input
                              type="number"
                              min="0"
                              value={
                                item.freeQuantity
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "freeQuantity",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Purchase price *
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.purchasePrice
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "purchasePrice",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              MRP *
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.mrp
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "mrp",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Selling price *
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.sellingPrice
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "sellingPrice",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>GST %</span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.taxRate
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "taxRate",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Discount
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.discountAmount
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "discountAmount",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </label>
                        </div>

                        <div className="purchase-item-total">
                          <span>
                            Gross:{" "}
                            {currencyFormatter.format(
                              calculation
                                .grossAmount
                            )}
                          </span>

                          <span>
                            GST:{" "}
                            {currencyFormatter.format(
                              calculation
                                .taxAmount
                            )}
                          </span>

                          <strong>
                            Total:{" "}
                            {currencyFormatter.format(
                              calculation
                                .totalAmount
                            )}
                          </strong>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>

          <div className="purchase-bottom-grid">
            <section className="purchase-payment-card">
              <div className="purchase-card-heading">
                <div>
                  <p>Payment</p>

                  <h3>
                    Payment details
                  </h3>
                </div>
              </div>

              <div className="purchase-payment-grid">
                <label>
                  <span>
                    Payment method
                  </span>

                  <select
                    value={paymentMethod}
                    onChange={(event) => {
                      setPaymentMethod(
                        event.target.value
                      );

                      clearMessages();
                    }}
                  >
                    {PAYMENT_METHODS.map(
                      (method) => (
                        <option
                          key={method}
                          value={method}
                        >
                          {method}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Paid amount
                  </span>

                  <input
                    type="number"
                    min="0"
                    max={grandTotal}
                    step="0.01"
                    value={paidAmount}
                    onChange={(event) => {
                      setPaidAmount(
                        event.target.value
                      );

                      clearMessages();
                    }}
                  />
                </label>

                <label>
                  <span>
                    Reference
                  </span>

                  <input
                    type="text"
                    value={
                      paymentReference
                    }
                    onChange={(event) => {
                      setPaymentReference(
                        event.target.value
                      );

                      clearMessages();
                    }}
                    placeholder="Optional reference"
                  />
                </label>

                <label className="purchase-notes">
                  <span>Notes</span>

                  <textarea
                    rows="3"
                    value={notes}
                    onChange={(event) => {
                      setNotes(
                        event.target.value
                      );

                      clearMessages();
                    }}
                    placeholder="Optional purchase notes"
                  />
                </label>
              </div>
            </section>

            <aside className="purchase-summary-card">
              <p>
                Purchase summary
              </p>

              <h3>
                Invoice total
              </h3>

              <div>
                <span>
                  Purchase quantity
                </span>

                <strong>
                  {totals.quantity}
                </strong>
              </div>

              <div>
                <span>
                  Free quantity
                </span>

                <strong>
                  {totals.freeQuantity}
                </strong>
              </div>

              <div>
                <span>
                  Gross amount
                </span>

                <strong>
                  {currencyFormatter.format(
                    totals.grossAmount
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Discount
                </span>

                <strong>
                  −{" "}
                  {currencyFormatter.format(
                    totals.discountAmount
                  )}
                </strong>
              </div>

              <div>
                <span>GST</span>

                <strong>
                  {currencyFormatter.format(
                    totals.taxAmount
                  )}
                </strong>
              </div>

              <div className="purchase-grand-total">
                <span>
                  Grand total
                </span>

                <strong>
                  {currencyFormatter.format(
                    grandTotal
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Paid amount
                </span>

                <strong>
                  {currencyFormatter.format(
                    validPaidAmount
                  )}
                </strong>
              </div>

              <div className="purchase-due">
                <span>
                  Due amount
                </span>

                <strong>
                  {currencyFormatter.format(
                    dueAmount
                  )}
                </strong>
              </div>

              <button
                type="button"
                onClick={createPurchase}
                disabled={
                  submitting ||
                  items.length === 0
                }
              >
                {submitting
                  ? "Creating purchase..."
                  : "Complete purchase"}
              </button>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

export default PurchasePage;