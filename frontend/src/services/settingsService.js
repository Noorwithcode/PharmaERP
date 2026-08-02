import apiClient from "../api/apiClient";

const SETTINGS_URL = "/settings";

const unwrapSettings = (response) => {
  return (
    response?.data?.data?.settings ??
    null
  );
};

const getErrorMessage = (
  error,
  fallback =
    "Unable to process settings request."
) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

/**
 * Get current pharmacy settings
 */
const getSettings = async () => {
  const response = await apiClient.get(
    SETTINGS_URL
  );

  return unwrapSettings(response);
};

/**
 * Update pharmacy settings
 *
 * payload must include the latest version.
 */
const updateSettings = async (
  payload
) => {
  const response = await apiClient.patch(
    SETTINGS_URL,
    payload
  );

  return unwrapSettings(response);
};

const settingsService = {
  getSettings,
  updateSettings,
  getErrorMessage
};

export default settingsService;