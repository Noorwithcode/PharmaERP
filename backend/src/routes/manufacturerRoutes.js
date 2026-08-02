const express = require("express");

const {
  createManufacturer,
  getManufacturers,
  getManufacturerById,
  updateManufacturer,
  deleteManufacturer,
} = require("../controllers/manufacturerController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getManufacturers);
router.get("/:id", getManufacturerById);

router.post(
  "/",
  authorize("admin", "manager"),
  createManufacturer
);

router.put(
  "/:id",
  authorize("admin", "manager"),
  updateManufacturer
);

router.delete(
  "/:id",
  authorize("admin", "manager"),
  deleteManufacturer
);

module.exports = router;
