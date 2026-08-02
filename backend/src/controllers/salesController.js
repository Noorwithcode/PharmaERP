const salesService = require(
  "../services/salesService"
);

const thermalService = require(
  "../services/thermalService"
);

/**
 * Send consistent controller error response.
 */
const sendErrorResponse = (
  res,
  error,
  fallbackMessage
) => {
  if (res.headersSent) {
    return;
  }

  const statusCode =
    Number(error.statusCode) || 500;

  console.error(
    fallbackMessage,
    error
  );

  return res.status(statusCode).json({
    success: false,
    message:
      error.message ||
      fallbackMessage,
  });
};

/**
 * Validate route ID.
 */
const parsePositiveId = (
  value,
  resourceName = "Sale"
) => {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    const error = new Error(
      `Invalid ${resourceName.toLowerCase()} ID.`
    );

    error.statusCode = 400;

    throw error;
  }

  return id;
};

/**
 * @desc    Create a new sale
 * @route   POST /api/sales
 * @access  Private
 */
const createNewSale = async (
  req,
  res
) => {
  try {
    const userId = Number(
      req.user?.id || 1
    );

    const result =
      await salesService.createSale(
        req.body,
        userId
      );

    return res.status(201).json({
      success: true,

      message:
        result.message ||
        "Sale completed successfully.",

      data: {
        saleId: result.saleId,

        invoiceNumber:
          result.invoiceNumber,

        grandTotal:
          result.grandTotal,

        paidAmount:
          result.paidAmount,

        dueAmount:
          result.dueAmount,

        paymentStatus:
          result.paymentStatus,
      },
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Failed to complete sale."
    );
  }
};

/**
 * @desc    Get sales history
 * @route   GET /api/sales
 * @access  Private
 */
const getSales = async (
  req,
  res
) => {
  try {
    const filters = {
      search: req.query.search,
      status: req.query.status,

      paymentStatus:
        req.query.paymentStatus,

      startDate:
        req.query.startDate,

      endDate:
        req.query.endDate,

      page: req.query.page,
      limit: req.query.limit,
    };

    const result =
      await salesService.getSales(
        filters
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Failed to retrieve sales history."
    );
  }
};

/**
 * @desc    Get a single sale
 * @route   GET /api/sales/:id
 * @access  Private
 */
const getSaleById = async (
  req,
  res
) => {
  try {
    const saleId =
      parsePositiveId(
        req.params.id
      );

    const sale =
      await salesService.getSaleById(
        saleId
      );

    if (!sale) {
      const error = new Error(
        "Sale not found."
      );

      error.statusCode = 404;

      throw error;
    }

    return res.status(200).json({
      success: true,
      data: {
        sale,
      },
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Failed to retrieve sale."
    );
  }
};

/**
 * @desc    Get items of a sale
 * @route   GET /api/sales/:id/items
 * @access  Private
 */
const getSaleItems = async (
  req,
  res
) => {
  try {
    const saleId =
      parsePositiveId(
        req.params.id
      );

    const items =
      await salesService
        .getSaleItems(saleId);

    return res.status(200).json({
      success: true,
      data: {
        items,
      },
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Failed to retrieve sale items."
    );
  }
};

/**
 * @desc    Download thermal receipt
 * @route   GET /api/sales/:id/receipt
 * @access  Private
 */
const downloadThermalReceipt =
  async (req, res) => {
    try {
      const saleId =
        parsePositiveId(
          req.params.id
        );

      await thermalService
        .generateThermalReceiptPDF(
          saleId,
          res
        );
    } catch (error) {
      return sendErrorResponse(
        res,
        error,
        "Failed to generate thermal receipt."
      );
    }
  };

module.exports = {
  createNewSale,
  getSales,
  getSaleById,
  getSaleItems,
  downloadThermalReceipt,
};