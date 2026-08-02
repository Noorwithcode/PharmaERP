const {
  createPurchaseRecord,
  getPurchaseList,
  getPurchaseDetails,
  getPurchaseItemsData,
} = require(
  "../services/purchaseService"
);

const {
  parsePositiveId,
} = require("../utils/formatters");

/*
|--------------------------------------------------------------------------
| Authenticated user
|--------------------------------------------------------------------------
*/

const getAuthenticatedUserId = (
  req
) => {
  return (
    req.user?.userId ||
    req.user?.id ||
    null
  );
};

/*
|--------------------------------------------------------------------------
| Error response
|--------------------------------------------------------------------------
*/

const handleControllerError = (
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
            error: error.message,
          }
        : {}),
    });
};

/*
|--------------------------------------------------------------------------
| Create purchase
|--------------------------------------------------------------------------
*/

const createPurchase = async (
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
      await createPurchaseRecord({
        payload: req.body,
        userId,
      });

    return res.status(201).json({
      success: true,

      message:
        "Purchase created and stock updated successfully",

      data: result,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Unable to create purchase"
    );
  }
};

/*
|--------------------------------------------------------------------------
| Purchase list
|--------------------------------------------------------------------------
*/

const getPurchases = async (
  req,
  res
) => {
  try {
    const result =
      await getPurchaseList({
        search:
          req.query.search,

        supplierId:
          req.query.supplierId,

        paymentStatus:
          req.query.paymentStatus,

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
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Unable to retrieve purchases"
    );
  }
};

/*
|--------------------------------------------------------------------------
| Purchase details
|--------------------------------------------------------------------------
*/

const getPurchaseById = async (
  req,
  res
) => {
  try {
    const purchaseId =
      parsePositiveId(
        req.params.id
      );

    if (!purchaseId) {
      return res.status(400).json({
        success: false,

        message:
          "A valid purchase ID is required",
      });
    }

    const result =
      await getPurchaseDetails(
        purchaseId
      );

    if (!result) {
      return res.status(404).json({
        success: false,

        message:
          "Purchase was not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Unable to retrieve purchase"
    );
  }
};

/*
|--------------------------------------------------------------------------
| Purchase items
|--------------------------------------------------------------------------
*/

const getPurchaseItems = async (
  req,
  res
) => {
  try {
    const purchaseId =
      parsePositiveId(
        req.params.id
      );

    if (!purchaseId) {
      return res.status(400).json({
        success: false,

        message:
          "A valid purchase ID is required",
      });
    }

    const result =
      await getPurchaseItemsData(
        purchaseId
      );

    if (!result) {
      return res.status(404).json({
        success: false,

        message:
          "Purchase was not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Unable to retrieve purchase items"
    );
  }
};

module.exports = {
  createPurchase,
  getPurchases,
  getPurchaseById,
  getPurchaseItems,
};