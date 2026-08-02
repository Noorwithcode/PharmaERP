const express = require("express");

const {
  getMedicineByBarcode,
  getBatchByQrCode,
  updateMedicineBarcode,
  updateBatchQrCode,
} = require(
  "../controllers/barcodeController"
);

const {
  getMedicineBarcodeImage,
  getBatchQrImage,
  getBatchLabelPdf,
} = require(
  "../controllers/barcodePrintController"
);

const {
  protect,
  authorize,
} = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

router.use(protect);

// ======================================================
// Barcode and QR image generation
// ======================================================

// Medicine barcode PNG
router.get(
  "/images/medicines/:id",
  authorize(
    "admin",
    "manager",
    "pharmacist",
    "cashier"
  ),
  getMedicineBarcodeImage
);

// Batch QR PNG
router.get(
  "/images/batches/:id",
  authorize(
    "admin",
    "manager",
    "pharmacist",
    "cashier"
  ),
  getBatchQrImage
);

// Printable batch labels PDF
router.get(
  "/labels/batches/:id/pdf",
  authorize(
    "admin",
    "manager",
    "pharmacist"
  ),
  getBatchLabelPdf
);

// ======================================================
// Barcode and QR scan
// ======================================================

// Scan medicine barcode
router.get(
  "/medicines/:code",
  authorize(
    "admin",
    "manager",
    "pharmacist",
    "cashier"
  ),
  getMedicineByBarcode
);

// Scan batch QR code
router.get(
  "/batches/:code",
  authorize(
    "admin",
    "manager",
    "pharmacist",
    "cashier"
  ),
  getBatchByQrCode
);

// ======================================================
// Barcode and QR update
// ======================================================

// Update medicine barcode
router.patch(
  "/medicines/:id",
  authorize(
    "admin",
    "manager",
    "pharmacist"
  ),
  updateMedicineBarcode
);

// Update batch QR code
router.patch(
  "/batches/:id",
  authorize(
    "admin",
    "manager",
    "pharmacist"
  ),
  updateBatchQrCode
);

module.exports = router;
