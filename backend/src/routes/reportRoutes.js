const express = require("express");
const router = express.Router();

const reportController = require(
  "../controllers/reportController"
);

const {
  protect
} = require(
  "../middleware/authMiddleware"
);

router.get(
  "/purchases",
  protect,
  reportController.fetchPurchaseReport
);

router.get(
  "/sales",
  protect,
  reportController.fetchSalesReport
);

router.get(
  "/expiry",
  protect,
  reportController.fetchExpiryReport
);

router.get(
  "/low-stock",
  protect,
  reportController.fetchLowStockReport
);

router.get(
  "/stock-movements",
  protect,
  reportController
    .fetchStockMovementReport
);

router.get(
  "/profit-loss",
  protect,
  reportController
    .fetchProfitLossReport
);

module.exports = router;