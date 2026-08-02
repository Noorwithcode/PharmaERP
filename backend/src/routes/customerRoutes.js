const express = require("express");

const customerController = require(
  "../controllers/customerController"
);

const {
  protect
} = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

router.use(protect);

/**
 * Customer list
 *
 * GET /api/customers
 * GET /api/customers?page=1&limit=200&isActive=true
 */
router.get(
  "/",
  customerController.getCustomers
);

/**
 * Customer ledger
 *
 * GET /api/customers/:id/ledger
 */
router.get(
  "/:id/ledger",
  customerController.getCustomerLedger
);

module.exports = router;