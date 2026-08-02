const {
  getReturnDetails,
} = require(
  "../services/purchaseReturnService"
);

const {
  renderPurchaseReturnDebitNote,
} = require(
  "../pdf/purchaseReturnDebitNotePdf"
);

const parsePositiveId = (
  value
) => {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
};

const sanitizeFileName = (
  value
) => {
  return String(
    value || "purchase-return"
  )
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    ) ||
    "purchase-return";
};

const getPurchaseReturnDebitNotePdf = async (
  req,
  res
) => {
  try {
    const returnId =
      parsePositiveId(
        req.params.id
      );

    if (!returnId) {
      return res.status(400).json({
        success: false,

        message:
          "A valid purchase return ID is required",
      });
    }

    const data =
      await getReturnDetails(
        returnId
      );

    if (!data) {
      return res.status(404).json({
        success: false,

        message:
          "Purchase return was not found",
      });
    }

    const returnNumber =
      data.returnHeader
        ?.returnNumber ||
      `purchase-return-${returnId}`;

    const fileName =
      `${sanitizeFileName(
        returnNumber
      )}-debit-note.pdf`;

    res.status(200);

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${fileName}"`
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    await renderPurchaseReturnDebitNote(
      res,
      data
    );

    return undefined;
  } catch (error) {
    console.error(
      "Unable to generate purchase return debit note:",
      error
    );

    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end();
      }

      return undefined;
    }

    return res.status(
      Number(error.statusCode) ||
      500
    ).json({
      success: false,

      message:
        error.message ||
        "Unable to generate purchase return debit note",
    });
  }
};

module.exports = {
  getPurchaseReturnDebitNotePdf,
};