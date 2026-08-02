const express = require("express");

const stockAdjustmentController = require(
  "../controllers/stockAdjustmentController"
);

const {
  protect,
} = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

router.use(protect);

// POST /api/stock/adjustments
router.post(
  "/",
  stockAdjustmentController
    .createStockAdjustment
);

// GET /api/stock/adjustments
router.get(
  "/",
  stockAdjustmentController
    .getStockAdjustments
);

// GET /api/stock/adjustments/:id
router.get(
  "/:id",
  stockAdjustmentController
    .getStockAdjustmentById
);

module.exports = router;