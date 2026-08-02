const settingsService = require(
  "../services/settingsService"
);

/**
 * @desc    Get pharmacy settings
 * @route   GET /api/settings
 * @access  Private
 */
const getSettings = async (
  req,
  res,
  next
) => {
  try {
    const settings =
      await settingsService
        .getSettings();

    return res.status(200).json({
      success: true,
      message:
        "Pharmacy settings retrieved successfully.",
      data: {
        settings
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update pharmacy settings
 * @route   PATCH /api/settings
 * @access  Admin, Manager
 */
const updateSettings = async (
  req,
  res,
  next
) => {
  try {
    /*
     * JWT payload project ভেদে id অথবা
     * userId ব্যবহার করতে পারে।
     */
    const userId =
      req.user?.id ||
      req.user?.userId;

    if (!userId) {
      const error = new Error(
        "Authenticated user ID was not found."
      );

      error.statusCode = 401;

      throw error;
    }

    const settings =
      await settingsService
        .updateSettings(
          req.body,
          userId
        );

    return res.status(200).json({
      success: true,
      message:
        "Pharmacy settings updated successfully.",
      data: {
        settings
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings
};