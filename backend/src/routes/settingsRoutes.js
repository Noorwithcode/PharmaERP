const express = require("express");

const settingsController = require(
  "../controllers/settingsController"
);

const {
  protect,
  authorize
} = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

router.use(protect);

// GET /api/settings
router.get(
  "/",
  settingsController.getSettings
);

// PATCH /api/settings
router.patch(
  "/",
  authorize(
    "admin",
    "manager",
    "ADMIN",
    "MANAGER",
    1,
    2,
    "1",
    "2"
  ),
  settingsController.updateSettings
);

/*
 * Router সরাসরি export করতে হবে।
 * module.exports = { router } লিখবেন না।
 */
module.exports = router;