const formatMoney = (value) => {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const safeText = (value, fallback = "-") => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  return String(value).trim();
};

const parsePositiveId = (value) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const sanitizeFileName = (value) => {
  return String(value || "document")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
};

module.exports = {
  formatMoney,
  formatDate,
  safeText,
  parsePositiveId,
  sanitizeFileName,
};
