const reportService = require(
  "../services/reportService"
);

const getDefaultDateRange = () => {
  const endDate =
    new Date()
      .toISOString()
      .slice(0, 10);

  const start = new Date();

  start.setUTCDate(
    start.getUTCDate() - 30
  );

  const startDate =
    start.toISOString().slice(0, 10);

  return {
    startDate,
    endDate
  };
};

const fetchPurchaseReport = async (
  req,
  res,
  next
) => {
  try {
    const defaults =
      getDefaultDateRange();

    const startDate =
      req.query.startDate ||
      defaults.startDate;

    const endDate =
      req.query.endDate ||
      defaults.endDate;

    const data =
      await reportService
        .getPurchaseReport(
          startDate,
          endDate
        );

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const fetchSalesReport = async (
  req,
  res,
  next
) => {
  try {
    const defaults =
      getDefaultDateRange();

    const startDate =
      req.query.startDate ||
      defaults.startDate;

    const endDate =
      req.query.endDate ||
      defaults.endDate;

    const data =
      await reportService
        .getSalesReport(
          startDate,
          endDate
        );

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const fetchExpiryReport = async (
  req,
  res,
  next
) => {
  try {
    const days =
      req.query.days || 90;

    const data =
      await reportService
        .getExpiryReport(days);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const fetchLowStockReport = async (
  req,
  res,
  next
) => {
  try {
    const data =
      await reportService
        .getLowStockReport();

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const fetchStockMovementReport = async (
  req,
  res,
  next
) => {
  try {
    const defaults =
      getDefaultDateRange();

    const startDate =
      req.query.startDate ||
      defaults.startDate;

    const endDate =
      req.query.endDate ||
      defaults.endDate;

    const movementType =
      req.query.movementType;

    const data =
      await reportService
        .getStockMovementReport(
          startDate,
          endDate,
          movementType
        );

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const fetchProfitLossReport = async (
  req,
  res,
  next
) => {
  try {
    const defaults =
      getDefaultDateRange();

    const startDate =
      req.query.startDate ||
      defaults.startDate;

    const endDate =
      req.query.endDate ||
      defaults.endDate;

    const data =
      await reportService
        .getProfitLossReport(
          startDate,
          endDate
        );

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  fetchPurchaseReport,
  fetchSalesReport,
  fetchExpiryReport,
  fetchLowStockReport,
  fetchStockMovementReport,
  fetchProfitLossReport
};