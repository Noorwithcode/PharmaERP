const express = require("express");

const {
  createPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturnById,
} = require(
  "../controllers/purchaseReturnController"
);

const {
  getPurchaseReturnDebitNotePdf,
} = require(
  "../controllers/purchaseReturnPdfController"
);

const {
  protect,
} = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Purchase return create and list
|--------------------------------------------------------------------------
*/

// POST /api/purchase-returns
router.post(
  "/",
  protect,
  createPurchaseReturn
);

// GET /api/purchase-returns
router.get(
  "/",
  protect,
  getPurchaseReturns
);

/*
|--------------------------------------------------------------------------
| Purchase return debit note PDF
|--------------------------------------------------------------------------
*/

// GET /api/purchase-returns/:id/debit-note-pdf
router.get(
  "/:id/debit-note-pdf",
  protect,
  getPurchaseReturnDebitNotePdf
);

// GET /api/purchase-returns/:id/pdf
router.get(
  "/:id/pdf",
  protect,
  getPurchaseReturnDebitNotePdf
);

/*
|--------------------------------------------------------------------------
| Purchase return details
|--------------------------------------------------------------------------
| Dynamic /:id route must remain last.
*/

// GET /api/purchase-returns/:id
router.get(
  "/:id",
  protect,
  getPurchaseReturnById
);

module.exports = router;