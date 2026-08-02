const express = require("express");

const {
  createMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  deleteMedicine,
} = require("../controllers/medicineController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getMedicines);
router.get("/:id", getMedicineById);

router.post(
  "/",
  authorize("admin", "manager", "pharmacist"),
  createMedicine
);

router.put(
  "/:id",
  authorize("admin", "manager", "pharmacist"),
  updateMedicine
);

router.delete(
  "/:id",
  authorize("admin", "manager"),
  deleteMedicine
);

module.exports = router;
