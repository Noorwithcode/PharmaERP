import apiClient from "../api/apiClient";
const SALE_RETURN_URL = "/sale-returns";

const unwrap = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    {}
  );
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

const requirePositiveId = (
  value,
  label = "Sale return ID"
) => {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      `${label} must be a positive integer.`
    );
  }

  return id;
};

const normalizeReturnHeader = (
  header
) => {
  if (!header) {
    return null;
  }

  return {
    ...header,

    id: toNumber(header.id),

    saleId: toNumber(
      header.saleId ??
      header.sale_id
    ),

    customerId:
      header.customerId === null ||
      header.customerId === undefined
        ? null
        : toNumber(
            header.customerId ??
            header.customer_id
          ),

    totalQuantity: toNumber(
      header.totalQuantity ??
      header.total_quantity
    ),

    subtotal: toNumber(
      header.subtotal
    ),

    discountAmount: toNumber(
      header.discountAmount ??
      header.discount_amount
    ),

    taxableAmount: toNumber(
      header.taxableAmount ??
      header.taxable_amount
    ),

    taxAmount: toNumber(
      header.taxAmount ??
      header.tax_amount
    ),

    returnTotal: toNumber(
      header.returnTotal ??
      header.return_total
    ),

    refundAmount: toNumber(
      header.refundAmount ??
      header.refund_amount
    ),
  };
};

const normalizeReturnItem = (
  item
) => {
  return {
    ...item,

    id: toNumber(item.id),

    saleReturnId: toNumber(
      item.saleReturnId ??
      item.sale_return_id
    ),

    saleItemId: toNumber(
      item.saleItemId ??
      item.sale_item_id
    ),

    medicineId: toNumber(
      item.medicineId ??
      item.medicine_id
    ),

    batchId: toNumber(
      item.batchId ??
      item.batch_id
    ),

    quantity: toNumber(
      item.quantity
    ),

    sellingPrice: toNumber(
      item.sellingPrice ??
      item.selling_price
    ),

    discountPercent: toNumber(
      item.discountPercent ??
      item.discount_percent
    ),

    discountAmount: toNumber(
      item.discountAmount ??
      item.discount_amount
    ),

    gstPercent: toNumber(
      item.gstPercent ??
      item.gst_percent
    ),

    taxableAmount: toNumber(
      item.taxableAmount ??
      item.taxable_amount
    ),

    taxAmount: toNumber(
      item.taxAmount ??
      item.tax_amount
    ),

    lineTotal: toNumber(
      item.lineTotal ??
      item.line_total
    ),

    quantityAvailable: toNumber(
      item.quantityAvailable ??
      item.quantity_available
    ),
  };
};

const normalizeReturnDetails = (
  data = {}
) => {
  const returnHeader =
    data.returnHeader ??
    data.saleReturn ??
    data.return ??
    null;

  const items = Array.isArray(
    data.items
  )
    ? data.items.map(
        normalizeReturnItem
      )
    : [];

  return {
    ...data,
    returnHeader:
      normalizeReturnHeader(
        returnHeader
      ),
    items,
  };
};

const normalizeReturnList = (
  data = {}
) => {
  const responseData =
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
      ? data
      : {};

  const list =
    (Array.isArray(data)
      ? data
      : null) ??
    responseData.saleReturns ??
    responseData.returns ??
    responseData.records ??
    [];

  const normalizedList =
    Array.isArray(list)
      ? list.map(
          normalizeReturnHeader
        )
      : [];

  return {
    ...responseData,
    saleReturns:
      normalizedList,
    pagination: {
      page: toNumber(
        responseData.pagination?.page,
        1
      ),
      limit: toNumber(
        responseData.pagination?.limit,
        10
      ),
      total: toNumber(
        responseData.pagination?.total,
        normalizedList.length
      ),
      totalPages: toNumber(
        responseData.pagination?.totalPages,
        1
      ),
    },
  };
};

const getErrorMessage = (
  error,
  fallback =
    "Unable to complete the sale return request."
) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

const createSaleReturn = async (
  payload
) => {
  const response =
    await apiClient.post(
      SALE_RETURN_URL,
      payload
    );

  return normalizeReturnDetails(
    unwrap(response)
  );
};

const getSaleReturns = async (
  params = {}
) => {
  const response =
    await apiClient.get(
      SALE_RETURN_URL,
      {
        params: {
          page: 1,
          limit: 10,
          ...params,
        },
      }
    );

  return normalizeReturnList(
    unwrap(response)
  );
};

const getSaleReturnById = async (
  returnId
) => {
  const id = requirePositiveId(
    returnId
  );

  const response =
    await apiClient.get(
      `${SALE_RETURN_URL}/${id}`
    );

  return normalizeReturnDetails(
    unwrap(response)
  );
};

const extractFilename = (
  contentDisposition,
  fallback
) => {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match =
    contentDisposition.match(
      /filename\*=UTF-8''([^;]+)/i
    );

  if (utf8Match?.[1]) {
    return decodeURIComponent(
      utf8Match[1]
        .trim()
        .replace(/["']/g, "")
    );
  }

  const filenameMatch =
    contentDisposition.match(
      /filename="?([^";]+)"?/i
    );

  return (
    filenameMatch?.[1]?.trim() ||
    fallback
  );
};

const getCreditNotePdf = async (
  returnId
) => {
  const id = requirePositiveId(
    returnId
  );

  const response =
    await apiClient.get(
      `${SALE_RETURN_URL}/${id}/credit-note-pdf`,
      {
        responseType: "blob",
      }
    );

  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob(
          [response.data],
          {
            type: "application/pdf",
          }
        );

  const filename =
    extractFilename(
      response.headers?.[
        "content-disposition"
      ],
      `sale-return-${id}-credit-note.pdf`
    );

  return {
    blob,
    filename,
  };
};

const previewCreditNotePdf = async (
  returnId
) => {
  if (typeof window === "undefined") {
    throw new Error(
      "PDF preview is available only in the browser."
    );
  }

  const previewWindow =
    window.open("", "_blank");

  if (!previewWindow) {
    throw new Error(
      "Please allow pop-ups to view the credit note PDF."
    );
  }

  previewWindow.document.title =
    "Loading credit note...";

  previewWindow.document.body.innerHTML =
    "<p style='font-family:Arial;padding:20px'>Loading credit note...</p>";

  try {
    const {
      blob,
    } = await getCreditNotePdf(
      returnId
    );

    const objectUrl =
      URL.createObjectURL(blob);

    previewWindow.location.replace(
      objectUrl
    );

    window.setTimeout(() => {
      URL.revokeObjectURL(
        objectUrl
      );
    }, 60000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
};

const downloadCreditNotePdf = async (
  returnId
) => {
  if (typeof document === "undefined") {
    throw new Error(
      "PDF download is available only in the browser."
    );
  }

  const {
    blob,
    filename,
  } = await getCreditNotePdf(
    returnId
  );

  const objectUrl =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(
      objectUrl
    );
  }, 1000);
};

const saleReturnService = {
  createSaleReturn,
  getSaleReturns,
  getSaleReturnById,
  getCreditNotePdf,
  previewCreditNotePdf,
  downloadCreditNotePdf,
  getErrorMessage,
};

export default saleReturnService;