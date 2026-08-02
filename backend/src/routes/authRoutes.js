const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get token
 */
router.post("/login", authController.login);
router.post("/register", authController.registerTestUser);

module.exports = router;
