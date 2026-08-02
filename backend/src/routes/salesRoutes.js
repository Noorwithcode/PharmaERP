const express = require("express");

const router = express.Router();

const salesController = require(
  "../controllers/salesController"
);

const {
  getSalesInvoicePdf,
} = require(
  "../controllers/salesInvoiceController"
);

const {
  protect,
} = require(
  "../middleware/authMiddleware"
);

/*
|--------------------------------------------------------------------------
| Sales routes
|--------------------------------------------------------------------------
*/

// ======================================================
// Create sale
// ======================================================

// POST /api/sales
// Create a sale and deduct batch stock
router.post(
  "/",
  protect,
  salesController.createNewSale
);

// ======================================================
// Sales history
// ======================================================

// GET /api/sales
// Query:
// search, status, paymentStatus, page, limit
router.get(
  "/",
  protect,
  salesController.getSales
);

// ======================================================
// Sale PDF and receipt
// These must remain before GET /:id
// ======================================================

// GET /api/sales/:id/receipt
// Download 80mm thermal receipt
router.get(
  "/:id/receipt",
  protect,
  salesController.downloadThermalReceipt
);

// GET /api/sales/:id/invoice-pdf
// Download professional A4 invoice
router.get(
  "/:id/invoice-pdf",
  protect,
  getSalesInvoicePdf
);

// GET /api/sales/:id/pdf
// Short A4 invoice route
router.get(
  "/:id/pdf",
  protect,
  getSalesInvoicePdf
);

// ======================================================
// Sale details
// ======================================================

// GET /api/sales/:id/items
// Get items belonging to a sale
router.get(
  "/:id/items",
  protect,
  salesController.getSaleItems
);

// GET /api/sales/:id
// Get sale header/details
// This generic route must remain at the bottom.
router.get(
  "/:id",
  protect,
  salesController.getSaleById
);

module.exports = router;