import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import apiClient from "../api/apiClient";
import "./SalesPage.css";

const currencyFormatter =
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const numberFormatter =
  new Intl.NumberFormat("en-IN");

const PAYMENT_METHODS = [
  {
    key: "CASH",
    label: "Cash",
  },
  {
    key: "UPI",
    label: "UPI",
  },
  {
    key: "CARD",
    label: "Card",
  },
  {
    key: "BANK",
    label: "Bank",
  },
  {
    key: "OTHER",
    label: "Other",
  },
];

const roundMoney = (value) => {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
};

const toNumber = (value) => {
  const convertedValue = Number(value);

  return Number.isFinite(convertedValue)
    ? convertedValue
    : 0;
};

const getMedicineList = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  const possibleLists = [
    responseData?.data?.medicines,
    responseData?.data?.items,
    responseData?.data?.rows,
    responseData?.medicines,
    responseData?.items,
    responseData?.rows,
    responseData?.data,
  ];

  return (
    possibleLists.find(Array.isArray) || []
  );
};

const getCustomerList = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  const possibleLists = [
    responseData?.data?.customers,
    responseData?.data?.items,
    responseData?.data?.rows,
    responseData?.customers,
    responseData?.items,
    responseData?.rows,
    responseData?.data,
  ];

  return (
    possibleLists.find(Array.isArray) || []
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

const getBarcodeValue = (medicine) => {
  return (
    medicine?.sku ||
    medicine?.barcodeValue ||
    medicine?.barcode_value ||
    medicine?.barcode ||
    ""
  );
};

const getBatchId = (batch) => {
  return (
    batch?.id ||
    batch?.batchId ||
    batch?.batch_id ||
    null
  );
};

const getAvailableStock = (
  batch,
  inventory = {}
) => {
  const batchStock =
    batch?.quantityAvailable ??
    batch?.quantity_available ??
    batch?.availableQuantity ??
    batch?.available_quantity ??
    batch?.availableStock ??
    batch?.available_stock ??
    batch?.currentQuantity ??
    batch?.current_quantity ??
    batch?.currentStock ??
    batch?.current_stock ??
    batch?.stockQuantity ??
    batch?.stock_quantity;

  if (
    batchStock !== undefined &&
    batchStock !== null
  ) {
    return toNumber(batchStock);
  }

  return toNumber(
    inventory?.sellableStock ??
      inventory?.sellable_stock ??
      inventory?.availableStock ??
      inventory?.available_stock ??
      inventory?.totalStock ??
      inventory?.total_stock ??
      inventory?.totalStockUnits
  );
};

const getSellingPrice = (
  batch,
  medicine
) => {
  return toNumber(
    batch?.sellingPrice ??
      batch?.selling_price ??
      batch?.salePrice ??
      batch?.sale_price ??
      batch?.unitPrice ??
      batch?.unit_price ??
      batch?.mrp ??
      medicine?.sellingPrice ??
      medicine?.selling_price ??
      medicine?.salePrice ??
      medicine?.sale_price ??
      medicine?.mrp
  );
};

const getTaxRate = (medicine) => {
  return toNumber(
    medicine?.gstPercent ??
      medicine?.gst_percent ??
      medicine?.gstRate ??
      medicine?.gst_rate ??
      medicine?.taxRate ??
      medicine?.tax_rate ??
      medicine?.gstPercentage ??
      medicine?.gst_percentage ??
      medicine?.gst ??
      0
  );
};

const getBatchStatus = (batch) => {
  return String(
    batch?.stockStatus ??
      batch?.stock_status ??
      batch?.status ??
      ""
  )
    .trim()
    .toUpperCase();
};

const isBatchActive = (batch) => {
  const activeValue =
    batch?.isActive ??
    batch?.is_active ??
    true;

  return !(
    activeValue === false ||
    activeValue === 0 ||
    activeValue === "0"
  );
};

const isSellableBatch = (
  batch,
  inventory = {}
) => {
  if (!batch) {
    return false;
  }

  const status = getBatchStatus(batch);

  const blockedStatuses = [
    "EXPIRED",
    "INACTIVE",
    "BLOCKED",
    "OUT_OF_STOCK",
    "DELETED",
  ];

  if (blockedStatuses.includes(status)) {
    return false;
  }

  if (!isBatchActive(batch)) {
    return false;
  }

  return (
    getAvailableStock(
      batch,
      inventory
    ) > 0
  );
};

const getBatchExpiryTime = (batch) => {
  const expiryValue =
    batch?.expiryDate ||
    batch?.expiry_date;

  if (!expiryValue) {
    return Number.MAX_SAFE_INTEGER;
  }

  const expiryTime =
    new Date(expiryValue).getTime();

  return Number.isNaN(expiryTime)
    ? Number.MAX_SAFE_INTEGER
    : expiryTime;
};

const findPreferredBatch = (
  responseData
) => {
  const inventory =
    responseData?.inventory || {};

  const directCandidates = [
    responseData?.preferredBatch,
    responseData?.preferredFefoBatch,
    responseData?.preferredFEFOBatch,
    responseData?.preferred_fefo_batch,
    responseData?.preferred_batch,
    responseData?.fefoBatch,
    responseData?.fefo_batch,
    responseData?.selectedBatch,
    responseData?.selected_batch,
    responseData?.batch,

    inventory?.preferredBatch,
    inventory?.preferredFefoBatch,
    inventory?.preferredFEFOBatch,
    inventory?.preferred_fefo_batch,
    inventory?.preferred_batch,
    inventory?.fefoBatch,
    inventory?.fefo_batch,
    inventory?.batch,
  ];

  const directBatch =
    directCandidates.find((batch) =>
      isSellableBatch(
        batch,
        inventory
      )
    );

  if (directBatch) {
    return directBatch;
  }

  const possibleBatchLists = [
    responseData?.batches,
    responseData?.medicineBatches,
    responseData?.medicine_batches,
    responseData?.sellableBatches,
    responseData?.sellable_batches,
    inventory?.batches,
    inventory?.sellableBatches,
    inventory?.sellable_batches,
  ];

  const batchList =
    possibleBatchLists.find(
      Array.isArray
    ) || [];

  return (
    [...batchList]
      .filter((batch) =>
        isSellableBatch(
          batch,
          inventory
        )
      )
      .sort(
        (firstBatch, secondBatch) =>
          getBatchExpiryTime(
            firstBatch
          ) -
          getBatchExpiryTime(
            secondBatch
          )
      )[0] || null
  );
};

const getSaleInformation = (
  responseData
) => {
  return (
    responseData?.data?.sale ||
    responseData?.data ||
    responseData?.sale ||
    responseData ||
    {}
  );
};

function SalesPage() {
  const [searchText, setSearchText] =
    useState("");

  const [medicines, setMedicines] =
    useState([]);

  const [customers, setCustomers] =
    useState([]);

  const [cart, setCart] = useState([]);

  const [loading, setLoading] =
    useState(false);

  const [
    addingMedicineId,
    setAddingMedicineId,
  ] = useState(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [discount, setDiscount] =
    useState(0);

  const [
    paymentModalOpen,
    setPaymentModalOpen,
  ] = useState(false);

  const [
    selectedCustomerId,
    setSelectedCustomerId,
  ] = useState("");

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [paymentAmounts, setPaymentAmounts] =
    useState({
      CASH: 0,
      UPI: 0,
      CARD: 0,
      BANK: 0,
      OTHER: 0,
    });

  const [
    paymentReference,
    setPaymentReference,
  ] = useState("");

  const [saleNotes, setSaleNotes] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [
    downloadingInvoice,
    setDownloadingInvoice,
  ] = useState(false);

  const [
    completedSale,
    setCompletedSale,
  ] = useState(null);

  const loadMedicines = useCallback(
    async (searchValue = "") => {
      try {
        setLoading(true);
        setErrorMessage("");

        const response =
          await apiClient.get(
            "/medicines",
            {
              params: {
                search:
                  searchValue.trim(),
                page: 1,
                limit: 20,
                isActive: true,
              },
            }
          );

        setMedicines(
          getMedicineList(
            response.data
          )
        );
      } catch (error) {
        console.error(
          "Medicine search error:",
          error
        );

        setErrorMessage(
          error.response?.data
            ?.message ||
            "Medicine list load করা যায়নি।"
        );

        setMedicines([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadCustomers =
    useCallback(async () => {
      try {
        const response =
          await apiClient.get(
            "/customers",
            {
              params: {
                page: 1,
                limit: 200,
                isActive: true,
              },
            }
          );

        setCustomers(
          getCustomerList(
            response.data
          )
        );
      } catch (error) {
        console.error(
          "Customer list error:",
          error
        );

        setCustomers([]);
      }
    }, []);

  useEffect(() => {
    document.title =
      "New Sale | PharmaERP";

    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        loadMedicines(searchText);
      }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    searchText,
    loadMedicines,
  ]);

  useEffect(() => {
    document.body.style.overflow =
      paymentModalOpen
        ? "hidden"
        : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [paymentModalOpen]);

  const addBarcodeToCart =
    async (
      barcodeValue,
      fallbackMedicine = {}
    ) => {
      const cleanBarcode =
        String(
          barcodeValue || ""
        ).trim();

      if (!cleanBarcode) {
        setErrorMessage(
          "Medicine barcode বা SKU পাওয়া যায়নি।"
        );

        return false;
      }

      const fallbackMedicineId =
        getMedicineId(
          fallbackMedicine
        );

      const loadingKey =
        fallbackMedicineId ||
        cleanBarcode;

      try {
        setAddingMedicineId(
          loadingKey
        );

        setErrorMessage("");

        const response =
          await apiClient.get(
            `/barcodes/medicines/${encodeURIComponent(
              cleanBarcode
            )}`
          );

        const responseData =
          response.data?.data ||
          response.data ||
          {};

        const medicineData =
          responseData?.medicine ||
          responseData
            ?.medicineDetails ||
          responseData
            ?.medicine_details ||
          fallbackMedicine;

        const inventory =
          responseData?.inventory ||
          {};

        const preferredBatch =
          findPreferredBatch(
            responseData
          );

        if (!preferredBatch) {
          throw new Error(
            "কোনো sellable batch পাওয়া যায়নি।"
          );
        }

        const medicineId =
          getMedicineId(
            medicineData
          ) ||
          fallbackMedicineId;

        if (!medicineId) {
          throw new Error(
            "Medicine ID পাওয়া যায়নি।"
          );
        }

        const batchId =
          getBatchId(
            preferredBatch
          );

        if (!batchId) {
          throw new Error(
            "Batch ID পাওয়া যায়নি।"
          );
        }

        const availableStock =
          getAvailableStock(
            preferredBatch,
            inventory
          );

        if (availableStock <= 0) {
          throw new Error(
            "এই medicine-এর sellable stock নেই।"
          );
        }

        const sellingPrice =
          getSellingPrice(
            preferredBatch,
            medicineData
          );

        if (sellingPrice <= 0) {
          throw new Error(
            "Medicine selling price পাওয়া যায়নি।"
          );
        }

        const taxRate = toNumber(
          medicineData?.gstPercent ??
            medicineData?.gst_percent ??
            responseData?.medicine?.gstPercent ??
            responseData?.medicine?.gst_percent ??
            fallbackMedicine?.gstPercent ??
            fallbackMedicine?.gst_percent ??
            getTaxRate(medicineData) ??
            getTaxRate(fallbackMedicine) ??
            0
        );

        const cartKey =
          `${medicineId}-${batchId}`;

        const existingItem =
          cart.find(
            (item) =>
              item.cartKey ===
              cartKey
          );

        if (
          existingItem &&
          existingItem.quantity >=
            availableStock
        ) {
          setErrorMessage(
            `Available stock ${availableStock}-এর বেশি quantity যোগ করা যাবে না।`
          );

          return false;
        }

        const brandName =
          medicineData
            ?.brandName ||
          medicineData
            ?.brand_name ||
          fallbackMedicine
            ?.brandName ||
          fallbackMedicine
            ?.brand_name ||
          "Unnamed Medicine";

        const genericName =
          medicineData
            ?.genericName ||
          medicineData
            ?.generic_name ||
          fallbackMedicine
            ?.genericName ||
          fallbackMedicine
            ?.generic_name ||
          "";

        const strength =
          medicineData?.strength ||
          fallbackMedicine
            ?.strength ||
          "";

        const batchNumber =
          preferredBatch
            ?.batchNumber ||
          preferredBatch
            ?.batch_number ||
          "-";

        const expiryDate =
          preferredBatch
            ?.expiryDate ||
          preferredBatch
            ?.expiry_date ||
          "-";

        setCart(
          (currentCart) => {
            const existingCartItem =
              currentCart.find(
                (item) =>
                  item.cartKey ===
                  cartKey
              );

            if (
              existingCartItem
            ) {
              return currentCart.map(
                (item) =>
                  item.cartKey ===
                  cartKey
                    ? {
                        ...item,
                        quantity:
                          Math.min(
                            item.quantity +
                              1,
                            availableStock
                          ),
                        availableStock,
                        sellingPrice,
                        taxRate,
                      }
                    : item
              );
            }

            return [
              ...currentCart,
              {
                cartKey,
                medicineId,
                batchId,
                brandName,
                genericName,
                strength,
                batchNumber,
                expiryDate,
                availableStock,
                sellingPrice,
                taxRate,
                quantity: 1,
              },
            ];
          }
        );

        return true;
      } catch (error) {
        console.error(
          "Add medicine error:",
          error
        );

        setErrorMessage(
          error.response?.data
            ?.message ||
            error.message ||
            "Medicine cart-এ যোগ করা যায়নি।"
        );

        return false;
      } finally {
        setAddingMedicineId(null);
      }
    };

  const addMedicineUsingBarcode =
    async (medicine) => {
      await addBarcodeToCart(
        getBarcodeValue(medicine),
        medicine
      );
    };

  const handleSearchKeyDown =
    async (event) => {
      if (
        event.key !== "Enter"
      ) {
        return;
      }

      event.preventDefault();

      const scannedValue =
        searchText.trim();

      if (!scannedValue) {
        return;
      }

      const wasAdded =
        await addBarcodeToCart(
          scannedValue
        );

      if (wasAdded) {
        setSearchText("");
      }
    };

  const changeQuantity = (
    cartKey,
    change
  ) => {
    const selectedItem =
      cart.find(
        (item) =>
          item.cartKey === cartKey
      );

    if (!selectedItem) {
      return;
    }

    const nextQuantity =
      selectedItem.quantity +
      change;

    if (nextQuantity < 1) {
      return;
    }

    if (
      nextQuantity >
      selectedItem.availableStock
    ) {
      setErrorMessage(
        `Available stock ${selectedItem.availableStock}-এর বেশি quantity দেওয়া যাবে না।`
      );

      return;
    }

    setErrorMessage("");

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.cartKey === cartKey
          ? {
              ...item,
              quantity:
                nextQuantity,
            }
          : item
      )
    );
  };

  const removeCartItem = (
    cartKey
  ) => {
    setCart((currentCart) =>
      currentCart.filter(
        (item) =>
          item.cartKey !== cartKey
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setErrorMessage("");
  };

  const subtotal = useMemo(
    () =>
      roundMoney(
        cart.reduce(
          (total, item) =>
            total +
            item.sellingPrice *
              item.quantity,
          0
        )
      ),
    [cart]
  );

  const taxTotal = useMemo(
    () =>
      roundMoney(
        cart.reduce(
          (total, item) => {
            const itemSubtotal =
              item.sellingPrice *
              item.quantity;

            const itemTax =
              itemSubtotal *
              (toNumber(
                item.taxRate
              ) /
                100);

            return total + itemTax;
          },
          0
        )
      ),
    [cart]
  );

  const totalBeforeDiscount =
    roundMoney(
      subtotal + taxTotal
    );

  const validDiscount =
    Math.min(
      Math.max(
        toNumber(discount),
        0
      ),
      totalBeforeDiscount
    );

  const grandTotal =
    roundMoney(
      totalBeforeDiscount -
        validDiscount
    );

  const totalQuantity =
    useMemo(
      () =>
        cart.reduce(
          (total, item) =>
            total +
            item.quantity,
          0
        ),
      [cart]
    );

  const filteredCustomers =
    useMemo(() => {
      const searchValue =
        customerSearch
          .trim()
          .toLowerCase();

      if (!searchValue) {
        return customers;
      }

      return customers.filter(
        (customer) => {
          const searchableText = [
            customer.name,
            customer.customerName,
            customer.customer_name,
            customer.phone,
            customer.mobile,
            customer.customerCode,
            customer.customer_code,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            searchValue
          );
        }
      );
    }, [
      customers,
      customerSearch,
    ]);

  const selectedCustomer =
    useMemo(() => {
      return customers.find(
        (customer) =>
          String(
            customer.id ||
              customer.customerId
          ) ===
          String(
            selectedCustomerId
          )
      );
    }, [
      customers,
      selectedCustomerId,
    ]);

  const paidTotal =
    useMemo(() => {
      return roundMoney(
        PAYMENT_METHODS.reduce(
          (total, method) =>
            total +
            toNumber(
              paymentAmounts[
                method.key
              ]
            ),
          0
        )
      );
    }, [paymentAmounts]);

  const dueAmount =
    roundMoney(
      Math.max(
        grandTotal - paidTotal,
        0
      )
    );

  const openPaymentModal = () => {
    if (cart.length === 0) {
      return;
    }

    setErrorMessage("");
    setCompletedSale(null);

    setPaymentAmounts({
      CASH: grandTotal,
      UPI: 0,
      CARD: 0,
      BANK: 0,
      OTHER: 0,
    });

    setPaymentReference("");
    setSaleNotes("");
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    if (submitting) {
      return;
    }

    setPaymentModalOpen(false);
  };

  const handlePaymentChange = (
    paymentMethod,
    value
  ) => {
    const cleanValue =
      Math.max(
        toNumber(value),
        0
      );

    setPaymentAmounts(
      (currentAmounts) => ({
        ...currentAmounts,
        [paymentMethod]:
          cleanValue,
      })
    );
  };

  const handleCreateSale =
    async () => {
      try {
        setErrorMessage("");

        if (cart.length === 0) {
          throw new Error(
            "Cart empty আছে।"
          );
        }

        if (
          paidTotal >
          grandTotal + 0.01
        ) {
          throw new Error(
            "Paid amount grand total-এর বেশি হতে পারবে না।"
          );
        }

        if (
          dueAmount > 0 &&
          !selectedCustomerId
        ) {
          throw new Error(
            "Due sale-এর জন্য customer select করুন।"
          );
        }

        const payments =
          PAYMENT_METHODS
            .map((method) => {
              const amount =
                roundMoney(
                  toNumber(
                    paymentAmounts[
                      method.key
                    ]
                  )
                );

              return {
                paymentMethod:
                  method.key,
                amount,
                referenceNumber:
                  paymentReference
                    .trim() ||
                  null,
              };
            })
            .filter(
              (payment) =>
                payment.amount > 0
            );

        const requestBody = {
          customerId:
            selectedCustomerId
              ? Number(
                  selectedCustomerId
                )
              : null,

          discountAmount:
            roundMoney(
              validDiscount
            ),

          notes:
            saleNotes.trim() ||
            null,

          items: cart.map(
            (item) => ({
              medicineId:
                Number(
                  item.medicineId
                ),

              batchId:
                Number(
                  item.batchId
                ),

              quantity:
                Number(
                  item.quantity
                ),

              unitPrice:
                roundMoney(
                  item.sellingPrice
                ),

              sellingPrice:
                roundMoney(
                  item.sellingPrice
                ),

              discountAmount: 0,

              taxRate:
                toNumber(
                  item.taxRate
                ),
            })
          ),

          payments,
        };

        setSubmitting(true);

        const response =
          await apiClient.post(
            "/sales",
            requestBody
          );

        const sale =
          getSaleInformation(
            response.data
          );

        const saleId =
          sale.id ||
          sale.saleId ||
          sale.sale_id ||
          response.data?.saleId ||
          response.data?.data
            ?.saleId;

        if (!saleId) {
          throw new Error(
            "Sale তৈরি হয়েছে, কিন্তু Sale ID পাওয়া যায়নি।"
          );
        }

        setCompletedSale({
          id: saleId,

          invoiceNumber:
            sale.invoiceNumber ||
            sale.invoice_number ||
            response.data
              ?.invoiceNumber ||
            `SALE-${saleId}`,

          grandTotal:
            toNumber(
              sale.grandTotal ??
                sale.grand_total ??
                grandTotal
            ),

          paidAmount:
            toNumber(
              sale.paidAmount ??
                sale.paid_amount ??
                paidTotal
            ),

          dueAmount:
            toNumber(
              sale.dueAmount ??
                sale.due_amount ??
                dueAmount
            ),
        });
      } catch (error) {
        console.error(
          "Create sale error:",
          error
        );

        setErrorMessage(
          error.response?.data
            ?.message ||
            error.message ||
            "Sale তৈরি করা যায়নি।"
        );
      } finally {
        setSubmitting(false);
      }
    };

  const downloadInvoice =
    async () => {
      if (!completedSale?.id) {
        return;
      }

      try {
        setDownloadingInvoice(true);
        setErrorMessage("");

        const response =
          await apiClient.get(
            `/sales/${completedSale.id}/invoice-pdf`,
            {
              params: {
                download: true,
              },

              responseType:
                "blob",
            }
          );

        const pdfBlob =
          new Blob(
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
          `${completedSale.invoiceNumber}.pdf`;

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
          "Invoice download error:",
          error
        );

        setErrorMessage(
          "Invoice PDF download করা যায়নি।"
        );
      } finally {
        setDownloadingInvoice(false);
      }
    };

  const startNewSale = () => {
    setCart([]);
    setDiscount(0);
    setSearchText("");
    setSelectedCustomerId("");
    setCustomerSearch("");
    setPaymentReference("");
    setSaleNotes("");
    setCompletedSale(null);
    setPaymentModalOpen(false);
    setErrorMessage("");

    loadMedicines("");
  };

  return (
    <section className="sales-page">
      <div className="sales-toolbar">
        <div>
          <p>Point of sale</p>

          <h2>Create new sale</h2>

          <span>
            Medicine search বা barcode
            scan করে cart-এ যোগ করুন।
          </span>
        </div>

        <div className="sale-number">
          <span>Cart quantity</span>

          <strong>
            {totalQuantity}
          </strong>
        </div>
      </div>

      {errorMessage && (
        <div
          className="sales-error"
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

      <div className="sales-layout">
        <div className="medicine-section">
          <div className="medicine-search-card">
            <label htmlFor="medicine-search">
              Search medicine or scan
              barcode
            </label>

            <div className="medicine-search-row">
              <input
                id="medicine-search"
                type="search"
                value={searchText}
                onChange={(event) =>
                  setSearchText(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleSearchKeyDown
                }
                placeholder="Brand, generic, SKU or barcode"
                autoComplete="off"
              />

              <button
                type="button"
                onClick={() =>
                  loadMedicines(
                    searchText
                  )
                }
                disabled={loading}
              >
                {loading
                  ? "Searching..."
                  : "Search"}
              </button>
            </div>

            <p className="search-hint">
              Barcode scanner ব্যবহার
              করলে code scan করার পরে
              Enter চাপুন।
            </p>
          </div>

          <div className="medicine-result-card">
            <div className="result-heading">
              <div>
                <p>
                  Medicine catalogue
                </p>

                <h3>
                  Available medicines
                </h3>
              </div>

              <span>
                {medicines.length}{" "}
                {medicines.length === 1
                  ? "item"
                  : "items"}
              </span>
            </div>

            {loading &&
            medicines.length === 0 ? (
              <div className="sales-empty">
                Medicine loading...
              </div>
            ) : medicines.length === 0 ? (
              <div className="sales-empty">
                কোনো medicine পাওয়া
                যায়নি।
              </div>
            ) : (
              <div className="medicine-list">
                {medicines.map(
                  (medicine) => {
                    const medicineId =
                      getMedicineId(
                        medicine
                      );

                    const barcodeValue =
                      getBarcodeValue(
                        medicine
                      );

                    const brandName =
                      medicine
                        ?.brandName ||
                      medicine
                        ?.brand_name ||
                      "Unnamed Medicine";

                    const genericName =
                      medicine
                        ?.genericName ||
                      medicine
                        ?.generic_name ||
                      "";

                    const strength =
                      medicine
                        ?.strength ||
                      "";

                    const isAdding =
                      addingMedicineId ===
                        medicineId ||
                      addingMedicineId ===
                        barcodeValue;

                    return (
                      <article
                        className="medicine-item"
                        key={
                          medicineId ||
                          barcodeValue
                        }
                      >
                        <div className="medicine-avatar">
                          {brandName
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="medicine-information">
                          <strong>
                            {brandName}
                          </strong>

                          <span>
                            {genericName}{" "}
                            {strength}
                          </span>

                          <small>
                            {barcodeValue ||
                              "-"}
                          </small>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            addMedicineUsingBarcode(
                              medicine
                            )
                          }
                          disabled={
                            isAdding
                          }
                        >
                          {isAdding
                            ? "Adding..."
                            : "Add"}
                        </button>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="sales-cart">
          <div className="cart-heading">
            <div>
              <p>Current bill</p>
              <h3>Shopping cart</h3>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
              >
                Clear
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="empty-cart">
              <div>SL</div>

              <strong>
                Cart is empty
              </strong>

              <span>
                Medicine select করলে
                এখানে দেখাবে।
              </span>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map((item) => {
                const lineSubtotal =
                  item.sellingPrice *
                  item.quantity;

                const lineTax =
                  lineSubtotal *
                  (toNumber(
                    item.taxRate
                  ) /
                    100);

                return (
                  <article
                    key={item.cartKey}
                    className="cart-item"
                  >
                    <div className="cart-item-top">
                      <div>
                        <strong>
                          {item.brandName}
                        </strong>

                        <span>
                          Batch:{" "}
                          {item.batchNumber}
                        </span>

                        <small>
                          Expiry:{" "}
                          {item.expiryDate}
                        </small>
                      </div>

                      <button
                        type="button"
                        className="remove-item"
                        onClick={() =>
                          removeCartItem(
                            item.cartKey
                          )
                        }
                      >
                        ×
                      </button>
                    </div>

                    <div className="cart-item-bottom">
                      <div className="quantity-control">
                        <button
                          type="button"
                          onClick={() =>
                            changeQuantity(
                              item.cartKey,
                              -1
                            )
                          }
                        >
                          −
                        </button>

                        <strong>
                          {item.quantity}
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            changeQuantity(
                              item.cartKey,
                              1
                            )
                          }
                        >
                          +
                        </button>
                      </div>

                      <div className="cart-price">
                        <span>
                          {currencyFormatter.format(
                            item.sellingPrice
                          )}{" "}
                          each
                        </span>

                        <strong>
                          {currencyFormatter.format(
                            lineSubtotal +
                              lineTax
                          )}
                        </strong>
                      </div>
                    </div>

                    <p className="stock-note">
                      Available stock:{" "}
                      {item.availableStock}
                      {" • "}GST:{" "}
                      {toNumber(
                        item.taxRate
                      )}
                      %
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          <div className="cart-summary">
            <div>
              <span>Subtotal</span>

              <strong>
                {currencyFormatter.format(
                  subtotal
                )}
              </strong>
            </div>

            <div>
              <span>GST</span>

              <strong>
                {currencyFormatter.format(
                  taxTotal
                )}
              </strong>
            </div>

            <label>
              <span>Discount</span>

              <input
                type="number"
                min="0"
                max={
                  totalBeforeDiscount
                }
                step="0.01"
                value={discount}
                onChange={(event) =>
                  setDiscount(
                    event.target.value
                  )
                }
              />
            </label>

            <div className="grand-total">
              <span>Grand total</span>

              <strong>
                {currencyFormatter.format(
                  grandTotal
                )}
              </strong>
            </div>

            <button
              type="button"
              className="checkout-button"
              disabled={
                cart.length === 0
              }
              onClick={
                openPaymentModal
              }
            >
              Continue to payment
            </button>
          </div>
        </aside>
      </div>

      {paymentModalOpen && (
        <div
          className="payment-overlay"
          role="presentation"
        >
          <section
            className="payment-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Complete sale"
          >
            <div className="payment-modal-header">
              <div>
                <p>Complete billing</p>
                <h2>
                  Customer and payment
                </h2>
              </div>

              {!completedSale && (
                <button
                  type="button"
                  onClick={
                    closePaymentModal
                  }
                  aria-label="Close payment"
                >
                  ×
                </button>
              )}
            </div>

            {completedSale ? (
              <div className="sale-success">
                <div className="success-icon">
                  ✓
                </div>

                <p>
                  Sale completed
                </p>

                <h3>
                  {
                    completedSale.invoiceNumber
                  }
                </h3>

                <div className="success-summary">
                  <div>
                    <span>
                      Grand total
                    </span>

                    <strong>
                      {currencyFormatter.format(
                        completedSale.grandTotal
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Paid
                    </span>

                    <strong>
                      {currencyFormatter.format(
                        completedSale.paidAmount
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Due
                    </span>

                    <strong>
                      {currencyFormatter.format(
                        completedSale.dueAmount
                      )}
                    </strong>
                  </div>
                </div>

                <div className="success-actions">
                  <button
                    type="button"
                    className="invoice-button"
                    onClick={
                      downloadInvoice
                    }
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
                    className="new-sale-button"
                    onClick={
                      startNewSale
                    }
                  >
                    Create new sale
                  </button>
                </div>
              </div>
            ) : (
              <div className="payment-modal-body">
                <div className="payment-form-section">
                  <div className="payment-section-heading">
                    <span>01</span>

                    <div>
                      <strong>
                        Customer
                      </strong>

                      <p>
                        Walk-in অথবা
                        existing customer
                      </p>
                    </div>
                  </div>

                  <input
                    type="search"
                    className="customer-search"
                    value={
                      customerSearch
                    }
                    onChange={(event) =>
                      setCustomerSearch(
                        event.target
                          .value
                      )
                    }
                    placeholder="Search customer"
                  />

                  <select
                    className="customer-select"
                    value={
                      selectedCustomerId
                    }
                    onChange={(event) =>
                      setSelectedCustomerId(
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      Walk-in customer
                    </option>

                    {filteredCustomers.map(
                      (customer) => {
                        const id =
                          customer.id ||
                          customer.customerId;

                        const name =
                          customer.name ||
                          customer.customerName ||
                          customer.customer_name ||
                          "Customer";

                        const phone =
                          customer.phone ||
                          customer.mobile ||
                          "";

                        return (
                          <option
                            key={id}
                            value={id}
                          >
                            {name}
                            {phone
                              ? ` — ${phone}`
                              : ""}
                          </option>
                        );
                      }
                    )}
                  </select>

                  {selectedCustomer && (
                    <div className="selected-customer">
                      <strong>
                        {selectedCustomer.name ||
                          selectedCustomer.customerName ||
                          selectedCustomer.customer_name}
                      </strong>

                      <span>
                        {selectedCustomer.phone ||
                          selectedCustomer.mobile ||
                          "No phone"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="payment-form-section">
                  <div className="payment-section-heading">
                    <span>02</span>

                    <div>
                      <strong>
                        Payment
                      </strong>

                      <p>
                        একাধিক payment
                        method ব্যবহার
                        করা যাবে
                      </p>
                    </div>
                  </div>

                  <div className="payment-method-grid">
                    {PAYMENT_METHODS.map(
                      (method) => (
                        <label
                          key={method.key}
                          className="payment-method"
                        >
                          <span>
                            {method.label}
                          </span>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              paymentAmounts[
                                method
                                  .key
                              ]
                            }
                            onChange={(
                              event
                            ) =>
                              handlePaymentChange(
                                method.key,
                                event
                                  .target
                                  .value
                              )
                            }
                          />
                        </label>
                      )
                    )}
                  </div>

                  <label className="payment-reference">
                    <span>
                      Reference number
                    </span>

                    <input
                      type="text"
                      value={
                        paymentReference
                      }
                      onChange={(event) =>
                        setPaymentReference(
                          event.target
                            .value
                        )
                      }
                      placeholder="UPI/Card/Bank reference"
                    />
                  </label>

                  <label className="payment-reference">
                    <span>
                      Sale notes
                    </span>

                    <textarea
                      value={saleNotes}
                      onChange={(event) =>
                        setSaleNotes(
                          event.target
                            .value
                        )
                      }
                      placeholder="Optional notes"
                      rows="3"
                    />
                  </label>
                </div>

                <aside className="payment-summary-card">
                  <p>Bill summary</p>

                  <h3>
                    Payment details
                  </h3>

                  <div>
                    <span>
                      Items
                    </span>

                    <strong>
                      {numberFormatter.format(
                        totalQuantity
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Subtotal
                    </span>

                    <strong>
                      {currencyFormatter.format(
                        subtotal
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>GST</span>

                    <strong>
                      {currencyFormatter.format(
                        taxTotal
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
                        validDiscount
                      )}
                    </strong>
                  </div>

                  <div className="payment-grand-total">
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
                        paidTotal
                      )}
                    </strong>
                  </div>

                  <div
                    className={
                      dueAmount > 0
                        ? "payment-due has-due"
                        : "payment-due"
                    }
                  >
                    <span>
                      Due amount
                    </span>

                    <strong>
                      {currencyFormatter.format(
                        dueAmount
                      )}
                    </strong>
                  </div>

                  {dueAmount > 0 &&
                    !selectedCustomerId && (
                      <p className="due-warning">
                        Due sale-এর জন্য
                        customer select
                        করুন।
                      </p>
                    )}

                  <button
                    type="button"
                    className="complete-sale-button"
                    onClick={
                      handleCreateSale
                    }
                    disabled={
                      submitting
                    }
                  >
                    {submitting
                      ? "Creating sale..."
                      : "Complete sale"}
                  </button>
                </aside>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default SalesPage;