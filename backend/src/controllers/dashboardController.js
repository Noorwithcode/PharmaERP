const dashboardService = require(
  "../services/dashboardService"
);

/**
 * @desc    Get dashboard KPI summary
 * @route   GET /api/dashboard/summary
 * @access  Private
 */
const fetchDashboardSummary = async (
  req,
  res,
  next
) => {
  try {
    const summary =
      await dashboardService
        .getDashboardSummary();

    return res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  fetchDashboardSummary
};