const express = require("express");
const router = express.Router();

const inventoryController = require("../controllers/inventoryController");
const { protect } = require("../middleware/authMiddleware");

router.get("/fefo", protect, inventoryController.fetchFEFOReport);
router.get("/stocks", protect, inventoryController.fetchAllStocks);

module.exports = router;
