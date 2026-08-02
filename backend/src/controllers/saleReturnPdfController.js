const {
  getSaleReturnDetails,
} = require(
  "../services/saleReturnService"
);

const {
  renderSaleReturnCreditNote,
} = require(
  "../pdf/saleReturnCreditNotePdf"
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
  return (
    String(
      value || "sale-return"
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
    "sale-return"
  );
};

const getSaleReturnCreditNotePdf = async (
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
          "A valid sale return ID is required",
      });
    }

    const data =
      await getSaleReturnDetails(
        returnId
      );

    if (!data) {
      return res.status(404).json({
        success: false,

        message:
          "Sale return was not found",
      });
    }

    const returnNumber =
      data.returnHeader
        ?.returnNumber ||
      `sale-return-${returnId}`;

    const fileName =
      `${sanitizeFileName(
        returnNumber
      )}-credit-note.pdf`;

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

    await renderSaleReturnCreditNote(
      res,
      data
    );

    return undefined;
  } catch (error) {
    console.error(
      "Unable to generate sale return credit note:",
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
        "Unable to generate sale return credit note",
    });
  }
};

module.exports = {
  getSaleReturnCreditNotePdf,
};