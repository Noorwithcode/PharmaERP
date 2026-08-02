import apiClient from "../api/apiClient";

const ADJUSTMENT_URL =
  "/stock-adjustments";

const BATCH_URL =
  "/stock/batches";

const unwrap = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    {}
  );
};

const getErrorMessage = (
  error,
  fallback =
    "Something went wrong."
) => {
  return (
    error?.response
      ?.data?.message ||
    error?.response
      ?.data?.error ||
    error?.message ||
    fallback
  );
};

const getAvailableBatches =
  async (
    params = {}
  ) => {
    const response =
      await apiClient.get(
        BATCH_URL,
        {
          params: {
            page: 1,
            limit: 500,
            isActive: true,
            ...params,
          },
        }
      );

    return unwrap(response);
  };

const createAdjustment =
  async (
    payload
  ) => {
    const response =
      await apiClient.post(
        ADJUSTMENT_URL,
        payload
      );

    return unwrap(response);
  };

const getAdjustments =
  async (
    params = {}
  ) => {
    const response =
      await apiClient.get(
        ADJUSTMENT_URL,
        {
          params,
        }
      );

    return unwrap(response);
  };

const getAdjustmentById =
  async (
    id
  ) => {
    const response =
      await apiClient.get(
        `${ADJUSTMENT_URL}/${id}`
      );

    return unwrap(response);
  };

const stockAdjustmentService = {
  getAvailableBatches,
  createAdjustment,
  getAdjustments,
  getAdjustmentById,
  getErrorMessage,
};

export default stockAdjustmentService;