import apiClient from "../api/apiClient";

/**
 * Extract API response data.
 */
const getResponseData = (response) => {
  return response?.data?.data ?? response?.data;
};

/**
 * Get all medicines.
 *
 * Supported filters:
 * search, categoryId, manufacturerId,
 * isActive, page and limit.
 */
const getMedicines = async (filters = {}) => {
  const response = await apiClient.get(
    "/medicines",
    {
      params: {
        search: filters.search || undefined,

        categoryId:
          filters.categoryId || undefined,

        manufacturerId:
          filters.manufacturerId ||
          undefined,

        isActive:
          filters.isActive === "" ||
          filters.isActive === undefined
            ? undefined
            : filters.isActive,

        page: filters.page || 1,
        limit: filters.limit || 20,
      },
    }
  );

  return getResponseData(response);
};

/**
 * Get a medicine by ID.
 */
const getMedicineById = async (
  medicineId
) => {
  if (!medicineId) {
    throw new Error(
      "Medicine ID is required."
    );
  }

  const response = await apiClient.get(
    `/medicines/${medicineId}`
  );

  return getResponseData(response);
};

/**
 * Get medicine using barcode.
 */
const getMedicineByBarcode = async (
  barcode
) => {
  if (!barcode?.trim()) {
    throw new Error(
      "Medicine barcode is required."
    );
  }

  const encodedBarcode =
    encodeURIComponent(barcode.trim());

  const response = await apiClient.get(
    `/barcodes/medicines/${encodedBarcode}`
  );

  return getResponseData(response);
};

/**
 * Create a new medicine.
 */
const createMedicine = async (
  medicineData
) => {
  if (!medicineData) {
    throw new Error(
      "Medicine information is required."
    );
  }

  const response = await apiClient.post(
    "/medicines",
    medicineData
  );

  return getResponseData(response);
};

/**
 * Update an existing medicine.
 */
const updateMedicine = async (
  medicineId,
  medicineData
) => {
  if (!medicineId) {
    throw new Error(
      "Medicine ID is required."
    );
  }

  if (!medicineData) {
    throw new Error(
      "Medicine information is required."
    );
  }

  const response = await apiClient.patch(
    `/medicines/${medicineId}`,
    medicineData
  );

  return getResponseData(response);
};

/**
 * Activate or deactivate a medicine.
 */
const updateMedicineStatus = async (
  medicineId,
  isActive
) => {
  if (!medicineId) {
    throw new Error(
      "Medicine ID is required."
    );
  }

  const response = await apiClient.patch(
    `/medicines/${medicineId}`,
    {
      isActive: Boolean(isActive),
    }
  );

  return getResponseData(response);
};

/**
 * Update medicine barcode.
 */
const updateMedicineBarcode = async (
  medicineId,
  barcodeData
) => {
  if (!medicineId) {
    throw new Error(
      "Medicine ID is required."
    );
  }

  const response = await apiClient.patch(
    `/barcodes/medicines/${medicineId}`,
    barcodeData
  );

  return getResponseData(response);
};

/**
 * Get medicine categories for form dropdown.
 */
const getMedicineCategories =
  async () => {
    const response = await apiClient.get(
      "/categories"
    );

    return getResponseData(response);
  };

/**
 * Get manufacturers for form dropdown.
 */
const getManufacturers = async () => {
  const response = await apiClient.get(
    "/manufacturers"
  );

  return getResponseData(response);
};

/**
 * Convert Axios/backend errors into a
 * readable message for the interface.
 */
const getMedicineErrorMessage = (
  error
) => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to process medicine request."
  );
};

const medicineService = {
  getMedicines,
  getMedicineById,
  getMedicineByBarcode,
  createMedicine,
  updateMedicine,
  updateMedicineStatus,
  updateMedicineBarcode,
  getMedicineCategories,
  getManufacturers,
  getMedicineErrorMessage,
};

export {
  getMedicines,
  getMedicineById,
  getMedicineByBarcode,
  createMedicine,
  updateMedicine,
  updateMedicineStatus,
  updateMedicineBarcode,
  getMedicineCategories,
  getManufacturers,
  getMedicineErrorMessage,
};

export default medicineService;