const express = require("express");

const {
  createBatch,
  getBatches,
  getBatchById,
  getExpiryAlerts,
  getLowStockReport,
  getStockMovements,
} = require("../controllers/stockController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

// Batch routes
router.get("/batches", getBatches);
router.get("/batches/:id", getBatchById);

router.post(
  "/batches",
  authorize("admin", "manager", "pharmacist"),
  createBatch
);

// Alert routes
router.get("/alerts/expiry", getExpiryAlerts);
router.get("/alerts/low-stock", getLowStockReport);

// Stock history
router.get("/movements", getStockMovements);

module.exports = router;
