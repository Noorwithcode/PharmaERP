const {
  getPurchaseInvoiceData
} = require(
  "../services/purchaseService"
);

const settingsService = require(
  "../services/settingsService"
);

const {
  parsePositiveId,
  sanitizeFileName
} = require(
  "../utils/formatters"
);

const {
  renderPurchaseInvoice
} = require(
  "../pdf/purchaseInvoicePdf"
);

/**
 * @desc    Generate purchase invoice PDF
 * @route   GET /api/purchases/:id/pdf
 * @route   GET /api/purchases/:id/invoice-pdf
 * @access  Private
 */
const getPurchaseInvoicePdf = async (
  req,
  res
) => {
  try {
    const purchaseId =
      parsePositiveId(
        req.params.id
      );

    if (!purchaseId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid purchase ID is required"
      });
    }

    /*
     * Purchase invoice data and pharmacy
     * settings are independent queries,
     * তাই parallel load করা হচ্ছে।
     */
    const [
      invoice,
      pharmacySettings
    ] = await Promise.all([
      getPurchaseInvoiceData(
        purchaseId
      ),

      settingsService.getSettings()
    ]);

    if (
      !invoice ||
      !invoice.purchase
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Purchase was not found"
      });
    }

    if (!pharmacySettings) {
      return res.status(500).json({
        success: false,
        message:
          "Pharmacy settings were not found"
      });
    }

    const download =
      req.query.download === "true" ||
      req.query.download === "1";

    const purchaseNumber =
      invoice.purchase
        .purchaseNumber ||
      `purchase-${purchaseId}`;

    const fileName =
      sanitizeFileName(
        `${purchaseNumber}-purchase-invoice.pdf`
      );

    /*
     * PDF response headers must be set
     * before streaming begins.
     */
    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `${
        download
          ? "attachment"
          : "inline"
      }; filename="${fileName}"`
    );

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "Expires",
      "0"
    );

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    /*
     * Database pharmacy settings are
     * passed to the PDF renderer.
     */
    await renderPurchaseInvoice({
      purchase:
        invoice.purchase,

      items:
        invoice.items || [],

      pharmacy:
        pharmacySettings,

      res
    });
  } catch (error) {
    console.error(
      "Purchase invoice PDF error:",
      error
    );

    /*
     * Once PDF streaming has started,
     * a JSON response cannot be sent.
     */
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end();
      }

      return;
    }

    const statusCode =
      Number(error.statusCode) ||
      500;

    return res
      .status(statusCode)
      .json({
        success: false,

        message:
          error.message ||
          "Unable to generate purchase invoice PDF",

        ...(process.env.NODE_ENV ===
          "development" && {
          error:
            error.message
        })
      });
  }
};

module.exports = {
  getPurchaseInvoicePdf
};