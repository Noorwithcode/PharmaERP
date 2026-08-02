const express = require("express");

const {
  createPurchase,
  getPurchases,
  getPurchaseById,
  getPurchaseItems,
} = require(
  "../controllers/purchaseController"
);

const {
  getPurchaseInvoicePdf,
} = require(
  "../controllers/purchaseInvoiceController"
);

const {
  addPurchasePayment,
  getPurchasePayments,
} = require(
  "../controllers/purchasePaymentController"
);

const {
  protect,
} = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Purchase create and list
|--------------------------------------------------------------------------
*/

// POST /api/purchases
router.post(
  "/",
  protect,
  createPurchase
);

// GET /api/purchases
router.get(
  "/",
  protect,
  getPurchases
);

/*
|--------------------------------------------------------------------------
| Purchase payments
|--------------------------------------------------------------------------
*/

// POST /api/purchases/:id/payments
router.post(
  "/:id/payments",
  protect,
  addPurchasePayment
);

// GET /api/purchases/:id/payments
router.get(
  "/:id/payments",
  protect,
  getPurchasePayments
);

/*
|--------------------------------------------------------------------------
| Purchase items
|--------------------------------------------------------------------------
*/

// GET /api/purchases/:id/items
router.get(
  "/:id/items",
  protect,
  getPurchaseItems
);

/*
|--------------------------------------------------------------------------
| Purchase invoice PDF
|--------------------------------------------------------------------------
*/

// GET /api/purchases/:id/invoice-pdf
router.get(
  "/:id/invoice-pdf",
  protect,
  getPurchaseInvoicePdf
);

// GET /api/purchases/:id/pdf
router.get(
  "/:id/pdf",
  protect,
  getPurchaseInvoicePdf
);

/*
|--------------------------------------------------------------------------
| Purchase details
|--------------------------------------------------------------------------
| Dynamic /:id route must remain last.
*/

// GET /api/purchases/:id
router.get(
  "/:id",
  protect,
  getPurchaseById
);

module.exports = router;