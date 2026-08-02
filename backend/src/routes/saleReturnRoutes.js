const express = require("express");

const {
  createSaleReturn,
  getSaleReturns,
  getSaleReturnById,
} = require(
  "../controllers/saleReturnController"
);

const {
  getSaleReturnCreditNotePdf,
} = require(
  "../controllers/saleReturnPdfController"
);

const {
  protect,
} = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Sale return create and list
|--------------------------------------------------------------------------
*/

// POST /api/sale-returns
router.post(
  "/",
  protect,
  createSaleReturn
);

// GET /api/sale-returns
router.get(
  "/",
  protect,
  getSaleReturns
);

/*
|--------------------------------------------------------------------------
| Sale return credit note PDF
|--------------------------------------------------------------------------
*/

// GET /api/sale-returns/:id/credit-note-pdf
router.get(
  "/:id/credit-note-pdf",
  protect,
  getSaleReturnCreditNotePdf
);

// GET /api/sale-returns/:id/pdf
router.get(
  "/:id/pdf",
  protect,
  getSaleReturnCreditNotePdf
);

/*
|--------------------------------------------------------------------------
| Sale return details
|--------------------------------------------------------------------------
| Dynamic /:id route must remain last.
*/

// GET /api/sale-returns/:id
router.get(
  "/:id",
  protect,
  getSaleReturnById
);

module.exports = router;