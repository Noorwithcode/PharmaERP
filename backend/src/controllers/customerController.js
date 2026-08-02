const customerService = require(
  "../services/customerService"
);

/**
 * @desc    Get all customers
 * @route   GET /api/customers
 * @access  Private
 */
const getCustomers = async (
  req,
  res,
  next
) => {
  try {
    const result =
      await customerService
        .getCustomers({
          page:
            req.query.page,

          limit:
            req.query.limit,

          search:
            req.query.search,

          isActive:
            req.query.isActive
        });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Customer Ledger
 * @route   GET /api/customers/:id/ledger
 * @access  Private
 */
const getCustomerLedger = async (
  req,
  res,
  next
) => {
  try {
    const ledgerData =
      await customerService
        .getCustomerLedger(
          req.params.id,
          req.query.startDate,
          req.query.endDate
        );

    return res.status(200).json({
      success: true,
      data: ledgerData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomerLedger
};