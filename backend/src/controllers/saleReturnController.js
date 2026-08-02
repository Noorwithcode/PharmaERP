const {
  processSaleReturn,
  getSaleReturnDetails,
  getSaleReturnList,
} = require(
  "../services/saleReturnService"
);

const getAuthenticatedUserId = (
  req
) => {
  return (
    req.user?.userId ||
    req.user?.id ||
    null
  );
};

const sendErrorResponse = (
  error,
  res,
  defaultMessage
) => {
  console.error(
    defaultMessage,
    error
  );

  const statusCode =
    Number(error.statusCode) || 500;

  return res
    .status(statusCode)
    .json({
      success: false,

      message:
        error.message ||
        defaultMessage,

      ...(process.env.NODE_ENV ===
      "development"
        ? {
            error:
              error.message,
          }
        : {}),
    });
};

/*
|--------------------------------------------------------------------------
| POST /api/sale-returns
|--------------------------------------------------------------------------
*/

const createSaleReturn = async (
  req,
  res
) => {
  try {
    const userId =
      getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message:
          "Authenticated user information was not found",
      });
    }

    const result =
      await processSaleReturn({
        payload:
          req.body,
        userId,
      });

    return res.status(201).json({
      success: true,

      message:
        "Sale return created and stock restored successfully",

      data:
        result,
    });
  } catch (error) {
    return sendErrorResponse(
      error,
      res,
      "Unable to create sale return"
    );
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/sale-returns
|--------------------------------------------------------------------------
*/

const getSaleReturns = async (
  req,
  res
) => {
  try {
    const result =
      await getSaleReturnList({
        search:
          req.query.search,
        saleId:
          req.query.saleId,
        status:
          req.query.status,
        dateFrom:
          req.query.dateFrom,
        dateTo:
          req.query.dateTo,
        page:
          req.query.page,
        limit:
          req.query.limit,
      });

    return res.status(200).json({
      success: true,
      data:
        result,
    });
  } catch (error) {
    return sendErrorResponse(
      error,
      res,
      "Unable to retrieve sale returns"
    );
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/sale-returns/:id
|--------------------------------------------------------------------------
*/

const getSaleReturnById = async (
  req,
  res
) => {
  try {
    const result =
      await getSaleReturnDetails(
        req.params.id
      );

    if (!result) {
      return res.status(404).json({
        success: false,

        message:
          "Sale return was not found",
      });
    }

    return res.status(200).json({
      success: true,
      data:
        result,
    });
  } catch (error) {
    return sendErrorResponse(
      error,
      res,
      "Unable to retrieve sale return"
    );
  }
};

module.exports = {
  createSaleReturn,
  getSaleReturns,
  getSaleReturnById,
};