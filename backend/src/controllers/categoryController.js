const db = require("../config/db");

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const categoryName = name.trim();

    const [existingCategories] = await db.query(
      `
        SELECT id
        FROM medicine_categories
        WHERE LOWER(name) = LOWER(?)
        LIMIT 1
      `,
      [categoryName]
    );

    if (existingCategories.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists",
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO medicine_categories (
          name,
          description,
          created_by
        )
        VALUES (?, ?, ?)
      `,
      [
        categoryName,
        description?.trim() || null,
        req.user.userId,
      ]
    );

    const [categories] = await db.query(
      `
        SELECT
          medicine_categories.id,
          medicine_categories.name,
          medicine_categories.description,
          medicine_categories.is_active AS isActive,
          medicine_categories.created_at AS createdAt,
          users.full_name AS createdBy
        FROM medicine_categories
        LEFT JOIN users
          ON users.id = medicine_categories.created_by
        WHERE medicine_categories.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Medicine category created successfully",
      data: {
        category: categories[0],
      },
    });
  } catch (error) {
    console.error("Create category error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create medicine category",
      error: error.message,
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const {
      search = "",
      status = "all",
      page = "1",
      limit = "10",
    } = req.query;

    const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number.parseInt(limit, 10) || 10, 1),
      100
    );

    const offset = (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (search.trim()) {
      conditions.push(
        "(medicine_categories.name LIKE ? OR medicine_categories.description LIKE ?)"
      );

      const searchValue = `%${search.trim()}%`;
      values.push(searchValue, searchValue);
    }

    if (status === "active") {
      conditions.push("medicine_categories.is_active = 1");
    }

    if (status === "inactive") {
      conditions.push("medicine_categories.is_active = 0");
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM medicine_categories
        ${whereClause}
      `,
      values
    );

    const [categories] = await db.query(
      `
        SELECT
          medicine_categories.id,
          medicine_categories.name,
          medicine_categories.description,
          medicine_categories.is_active AS isActive,
          medicine_categories.created_at AS createdAt,
          medicine_categories.updated_at AS updatedAt,
          users.full_name AS createdBy
        FROM medicine_categories
        LEFT JOIN users
          ON users.id = medicine_categories.created_by
        ${whereClause}
        ORDER BY medicine_categories.id DESC
        LIMIT ? OFFSET ?
      `,
      [...values, limitNumber, offset]
    );

    const total = Number(countRows[0].total);
    const totalPages = Math.ceil(total / limitNumber);

    return res.status(200).json({
      success: true,
      data: {
        categories,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve medicine categories",
      error: error.message,
    });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const categoryId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid category ID is required",
      });
    }

    const [categories] = await db.query(
      `
        SELECT
          medicine_categories.id,
          medicine_categories.name,
          medicine_categories.description,
          medicine_categories.is_active AS isActive,
          medicine_categories.created_at AS createdAt,
          medicine_categories.updated_at AS updatedAt,
          users.full_name AS createdBy
        FROM medicine_categories
        LEFT JOIN users
          ON users.id = medicine_categories.created_by
        WHERE medicine_categories.id = ?
        LIMIT 1
      `,
      [categoryId]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Medicine category was not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        category: categories[0],
      },
    });
  } catch (error) {
    console.error("Get category error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve medicine category",
      error: error.message,
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const categoryId = Number.parseInt(req.params.id, 10);
    const { name, description, isActive } = req.body;

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid category ID is required",
      });
    }

    const [existingCategories] = await db.query(
      `
        SELECT id, name, description, is_active
        FROM medicine_categories
        WHERE id = ?
        LIMIT 1
      `,
      [categoryId]
    );

    if (existingCategories.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Medicine category was not found",
      });
    }

    const existingCategory = existingCategories[0];

    const updatedName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : existingCategory.name;

    const updatedDescription =
      description !== undefined
        ? description?.trim() || null
        : existingCategory.description;

    let updatedStatus = Boolean(existingCategory.is_active);

    if (isActive !== undefined) {
      if (
        isActive === true ||
        isActive === 1 ||
        isActive === "1" ||
        isActive === "true"
      ) {
        updatedStatus = true;
      } else if (
        isActive === false ||
        isActive === 0 ||
        isActive === "0" ||
        isActive === "false"
      ) {
        updatedStatus = false;
      } else {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false",
        });
      }
    }

    const [duplicateCategories] = await db.query(
      `
        SELECT id
        FROM medicine_categories
        WHERE LOWER(name) = LOWER(?)
          AND id != ?
        LIMIT 1
      `,
      [updatedName, categoryId]
    );

    if (duplicateCategories.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Another category with this name already exists",
      });
    }

    await db.query(
      `
    UPDATE medicine_categories
    SET
      name = ?,
      description = ?,
      is_active = ?
    WHERE id = ?
  `,
      [
        updatedName,
        updatedDescription,
        updatedStatus ? 1 : 0,
        categoryId,
      ]
    );

    const [categories] = await db.query(
      `
        SELECT
          id,
          name,
          description,
          is_active AS isActive,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM medicine_categories
        WHERE id = ?
        LIMIT 1
      `,
      [categoryId]
    );

    return res.status(200).json({
      success: true,
      message: "Medicine category updated successfully",
      data: {
        category: categories[0],
      },
    });
  } catch (error) {
    console.error("Update category error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Another category with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update medicine category",
      error: error.message,
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const categoryId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid category ID is required",
      });
    }

    const [result] = await db.query(
      `
        UPDATE medicine_categories
        SET is_active = 0
        WHERE id = ?
          AND is_active = 1
      `,
      [categoryId]
    );

    if (result.affectedRows === 0) {
      const [categories] = await db.query(
        `
          SELECT id
          FROM medicine_categories
          WHERE id = ?
          LIMIT 1
        `,
        [categoryId]
      );

      if (categories.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Medicine category was not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Medicine category is already inactive",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Medicine category deactivated successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to deactivate medicine category",
      error: error.message,
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
