const express = require("express");

const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getCategories);
router.get("/:id", getCategoryById);

router.post(
  "/",
  authorize("admin", "manager"),
  createCategory
);

router.put(
  "/:id",
  authorize("admin", "manager"),
  updateCategory
);

router.delete(
  "/:id",
  authorize("admin", "manager"),
  deleteCategory
);

module.exports = router;
