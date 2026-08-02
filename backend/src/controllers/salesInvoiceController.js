const db = require("../config/db");

const settingsService = require(
  "../services/settingsService"
);

const {
  renderSalesInvoice
} = require(
  "../pdf/salesInvoicePdf"
);

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
};

const createSafeFilename = (
  invoiceNumber
) => {
  return String(
    invoiceNumber ||
    "sales-invoice"
  ).replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );
};

/**
 * @desc    Generate professional A4 sales invoice PDF
 * @route   GET /api/sales/:id/invoice-pdf
 * @route   GET /api/sales/:id/pdf
 * @access  Private
 */
const getSalesInvoicePdf = async (
  req,
  res,
  next
) => {
  try {
    const saleId =
      Number(req.params.id);

    if (
      !Number.isInteger(saleId) ||
      saleId <= 0
    ) {
      throw createError(
        "Invalid sale ID."
      );
    }

    /*
     * Get sales invoice header
     */
    const [saleRows] =
      await db.query(
        `
          SELECT
            s.id,

            s.invoice_number
              AS invoiceNumber,

            s.customer_id
              AS customerId,

            COALESCE(
              s.customer_name,
              c.full_name,
              'Cash Customer'
            ) AS customerName,

            COALESCE(
              s.customer_phone,
              c.phone
            ) AS customerPhone,

            COALESCE(
              s.customer_address,
              c.address
            ) AS customerAddress,

            s.sale_date
              AS saleDate,

            s.sale_type
              AS saleType,

            s.total_quantity
              AS totalQuantity,

            s.subtotal,

            s.discount_amount
              AS discountAmount,

            s.taxable_amount
              AS taxableAmount,

            s.tax_amount
              AS taxAmount,

            s.round_off
              AS roundOff,

            s.grand_total
              AS grandTotal,

            s.paid_amount
              AS paidAmount,

            s.due_amount
              AS dueAmount,

            s.payment_status
              AS paymentStatus,

            s.status,

            s.doctor_name
              AS doctorName,

            s.prescription_number
              AS prescriptionNumber,

            s.prescription_date
              AS prescriptionDate,

            s.prescription_notes
              AS prescriptionNotes,

            s.notes,

            s.created_by
              AS createdBy,

            s.created_at
              AS createdAt

          FROM sales s

          LEFT JOIN customers c
            ON c.id =
              s.customer_id

          WHERE s.id = ?
        `,
        [saleId]
      );

    if (
      saleRows.length === 0
    ) {
      throw createError(
        "Sales invoice not found.",
        404
      );
    }

    const sale =
      saleRows[0];

    /*
     * Get sales invoice items
     */
    const [itemRows] =
      await db.query(
        `
          SELECT
            si.id,

            si.sale_id
              AS saleId,

            si.medicine_id
              AS medicineId,

            si.batch_id
              AS batchId,

            si.medicine_name
              AS medicineName,

            si.medicine_name
              AS brandName,

            si.generic_name
              AS genericName,

            si.batch_number
              AS batchNumber,

            si.expiry_date
              AS expiryDate,

            si.quantity,

            si.returned_quantity
              AS returnedQuantity,

            si.purchase_price
              AS purchasePrice,

            si.mrp,

            si.selling_price
              AS sellingPrice,

            si.discount_percent
              AS discountPercent,

            si.discount_amount
              AS discountAmount,

            si.gst_percent
              AS gstPercent,

            si.taxable_amount
              AS taxableAmount,

            si.tax_amount
              AS taxAmount,

            si.line_total
              AS lineTotal,

            m.strength,

            m.dosage_form
              AS dosageForm,

            m.unit,

            m.hsn_code
              AS hsnCode

          FROM sale_items si

          INNER JOIN medicines m
            ON m.id =
              si.medicine_id

          WHERE si.sale_id = ?

          ORDER BY
            si.id ASC
        `,
        [saleId]
      );

    if (
      itemRows.length === 0
    ) {
      throw createError(
        "No items found for this sales invoice.",
        404
      );
    }

    /*
     * Convert item numeric values
     */
    const items =
      itemRows.map((item) => ({
        ...item,

        id:
          Number(item.id),

        saleId:
          Number(item.saleId),

        medicineId:
          Number(
            item.medicineId
          ),

        batchId:
          Number(item.batchId),

        quantity:
          Number(item.quantity),

        returnedQuantity:
          Number(
            item.returnedQuantity || 0
          ),

        purchasePrice:
          Number(
            item.purchasePrice || 0
          ),

        mrp:
          Number(item.mrp || 0),

        sellingPrice:
          Number(
            item.sellingPrice || 0
          ),

        discountPercent:
          Number(
            item.discountPercent || 0
          ),

        discountAmount:
          Number(
            item.discountAmount || 0
          ),

        gstPercent:
          Number(
            item.gstPercent || 0
          ),

        taxableAmount:
          Number(
            item.taxableAmount || 0
          ),

        taxAmount:
          Number(
            item.taxAmount || 0
          ),

        lineTotal:
          Number(
            item.lineTotal || 0
          )
      }));

    /*
     * Convert sales numeric values
     */
    const formattedSale = {
      ...sale,

      id:
        Number(sale.id),

      customerId:
        sale.customerId === null
          ? null
          : Number(
              sale.customerId
            ),

      totalQuantity:
        Number(
          sale.totalQuantity || 0
        ),

      subtotal:
        Number(
          sale.subtotal || 0
        ),

      discountAmount:
        Number(
          sale.discountAmount || 0
        ),

      taxableAmount:
        Number(
          sale.taxableAmount || 0
        ),

      taxAmount:
        Number(
          sale.taxAmount || 0
        ),

      roundOff:
        Number(
          sale.roundOff || 0
        ),

      grandTotal:
        Number(
          sale.grandTotal || 0
        ),

      paidAmount:
        Number(
          sale.paidAmount || 0
        ),

      dueAmount:
        Number(
          sale.dueAmount || 0
        )
    };

    /*
     * Load latest pharmacy information
     * from pharmacy_settings table.
     */
    const pharmacySettings =
      await settingsService
        .getSettings();

    if (!pharmacySettings) {
      throw createError(
        "Pharmacy settings were not found.",
        500
      );
    }

    const filename =
      createSafeFilename(
        formattedSale
          .invoiceNumber
      );

    /*
     * Set response headers before
     * PDF streaming begins.
     */
    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filename}.pdf"`
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    /*
     * Send sale, items and database
     * pharmacy settings to renderer.
     */
    await renderSalesInvoice({
      sale:
        formattedSale,

      items,

      pharmacy:
        pharmacySettings,

      res
    });
  } catch (error) {
    console.error(
      "Error generating sales invoice PDF:",
      error
    );

    /*
     * JSON response cannot be sent after
     * PDF streaming has started.
     */
    if (res.headersSent) {
      return res.end();
    }

    next(error);
  }
};

module.exports = {
  getSalesInvoicePdf
};