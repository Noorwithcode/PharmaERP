const stockAdjustmentService = require(
  "../services/stockAdjustmentService"
);

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * @desc    Create stock adjustment
 * @route   POST /api/stock-adjustments
 * @access  Private
 */
const createStockAdjustment = async (
  req,
  res,
  next
) => {
  try {
    const payload = {
      ...req.body,

      /*
       * Authentication চালু থাকলে req.user.id নেওয়া হবে।
       * Development testing-এর জন্য fallback user ID 1।
       *
       * Auth final হলে || 1 সরিয়ে দিতে হবে।
       */
      createdBy: req.user?.id || 1
    };

    const result =
      await stockAdjustmentService
        .processStockAdjustment(payload);

    return res.status(201).json({
      success: true,
      message:
        "Stock adjustment processed successfully.",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all stock adjustments
 * @route   GET /api/stock-adjustments
 * @access  Private
 */
const getStockAdjustments = async (
  req,
  res,
  next
) => {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      reason: req.query.reason,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const result =
      await stockAdjustmentService
        .getStockAdjustments(filters);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get stock adjustment by ID
 * @route   GET /api/stock-adjustments/:id
 * @access  Private
 */
const getStockAdjustmentById = async (
  req,
  res,
  next
) => {
  try {
    const adjustmentId =
      Number(req.params.id);

    if (
      !Number.isInteger(adjustmentId) ||
      adjustmentId <= 0
    ) {
      throw createError(
        "Invalid stock adjustment ID."
      );
    }

    const result =
      await stockAdjustmentService
        .getAdjustmentDetails(
          adjustmentId
        );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStockAdjustment,
  getStockAdjustments,
  getStockAdjustmentById
};