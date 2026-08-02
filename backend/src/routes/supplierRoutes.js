const express = require("express");

const supplierController = require(
    "../controllers/supplierController"
);

const {
    protect
} = require(
    "../middleware/authMiddleware"
);

const router = express.Router();

router.use(protect);

/**
 * GET /api/suppliers
 */
router.get(
    "/",
    supplierController.getSuppliers
);

/**
 * GET /api/suppliers/:id/ledger
 */
router.get(
    "/:id/ledger",
    supplierController.getSupplierLedger
);

module.exports = router;