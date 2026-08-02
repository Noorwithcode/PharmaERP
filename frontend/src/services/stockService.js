import apiClient from "../api/apiClient";

const extractData = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    {}
  );
};

/**
 * Get batch stock list.
 */
const getBatches = async (
  filters = {}
) => {
  const response =
    await apiClient.get(
      "/stock/batches",
      {
        params: {
          search:
            filters.search ||
            undefined,

          medicineId:
            filters.medicineId ||
            undefined,

          isActive:
            filters.isActive === "" ||
            filters.isActive ===
              undefined
              ? undefined
              : filters.isActive,

          stockStatus:
            filters.stockStatus ||
            undefined,

          page:
            filters.page || 1,

          limit:
            filters.limit || 20,
        },
      }
    );

  return extractData(response);
};

/**
 * Get single batch details.
 */
const getBatchById = async (
  batchId
) => {
  const validBatchId =
    Number(batchId);

  if (
    !Number.isInteger(
      validBatchId
    ) ||
    validBatchId <= 0
  ) {
    throw new Error(
      "Valid batch ID is required."
    );
  }

  const response =
    await apiClient.get(
      `/stock/batches/${validBatchId}`
    );

  return extractData(response);
};

/**
 * Create a medicine batch.
 */
const createBatch = async (
  batchData
) => {
  if (!batchData) {
    throw new Error(
      "Batch information is required."
    );
  }

  const response =
    await apiClient.post(
      "/stock/batches",
      batchData
    );

  return extractData(response);
};

/**
 * Get medicine batches that are
 * expired or expiring soon.
 */
const getExpiryAlerts = async (
  days = 90
) => {
  const validDays = Math.min(
    Math.max(
      Number(days) || 90,
      1
    ),
    3650
  );

  const response =
    await apiClient.get(
      "/stock/alerts/expiry",
      {
        params: {
          days: validDays,
        },
      }
    );

  return extractData(response);
};

/**
 * Get low-stock medicines.
 */
const getLowStockReport = async (
  threshold
) => {
  const response =
    await apiClient.get(
      "/stock/alerts/low-stock",
      {
        params: {
          threshold:
            threshold === "" ||
            threshold === undefined
              ? undefined
              : Math.max(
                  Number(
                    threshold
                  ) || 0,
                  0
                ),
        },
      }
    );

  return extractData(response);
};

/**
 * Get stock movement history.
 */
const getStockMovements = async (
  filters = {}
) => {
  const response =
    await apiClient.get(
      "/stock/movements",
      {
        params: {
          search:
            filters.search ||
            undefined,

          medicineId:
            filters.medicineId ||
            undefined,

          batchId:
            filters.batchId ||
            undefined,

          movementType:
            filters.movementType ||
            undefined,

          referenceType:
            filters.referenceType ||
            undefined,

          startDate:
            filters.startDate ||
            undefined,

          endDate:
            filters.endDate ||
            undefined,

          page:
            filters.page || 1,

          limit:
            filters.limit || 20,
        },
      }
    );

  return extractData(response);
};

/**
 * Convert API errors into readable text.
 */
const getStockErrorMessage = (
  error
) => {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    "Unable to process stock request."
  );
};

const stockService = {
  getBatches,
  getBatchById,
  createBatch,
  getExpiryAlerts,
  getLowStockReport,
  getStockMovements,
  getStockErrorMessage,
};

export {
  getBatches,
  getBatchById,
  createBatch,
  getExpiryAlerts,
  getLowStockReport,
  getStockMovements,
  getStockErrorMessage,
};

export default stockService;