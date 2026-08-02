const {
  processPurchaseReturn,
  getReturnDetails,
  getReturnList,
} = require(
  "../services/purchaseReturnService"
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
| POST /api/purchase-returns
|--------------------------------------------------------------------------
*/

const createPurchaseReturn = async (
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
      await processPurchaseReturn({
        payload:
          req.body,
        userId,
      });

    return res.status(201).json({
      success: true,

      message:
        "Purchase return created and stock updated successfully",

      data:
        result,
    });
  } catch (error) {
    return sendErrorResponse(
      error,
      res,
      "Unable to create purchase return"
    );
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/purchase-returns
|--------------------------------------------------------------------------
*/

const getPurchaseReturns = async (
  req,
  res
) => {
  try {
    const result =
      await getReturnList({
        search:
          req.query.search,
        purchaseId:
          req.query.purchaseId,
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
      "Unable to retrieve purchase returns"
    );
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/purchase-returns/:id
|--------------------------------------------------------------------------
*/

const getPurchaseReturnById = async (
  req,
  res
) => {
  try {
    const result =
      await getReturnDetails(
        req.params.id
      );

    if (!result) {
      return res.status(404).json({
        success: false,

        message:
          "Purchase return was not found",
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
      "Unable to retrieve purchase return"
    );
  }
};

module.exports = {
  createPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturnById,
};