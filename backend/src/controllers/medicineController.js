const crypto = require("crypto");
const db = require("../config/db");

const parseBoolean = (value, fallback) => {
  if (value === undefined) return fallback;

  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false"
  ) {
    return false;
  }

  return null;
};

const parsePositiveId = (value) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const parseNonNegativeInteger = (value, fallback = 0) => {
  if (value === undefined) return fallback;

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
};

const parseGstPercent = (value, fallback = 0) => {
  if (value === undefined) return fallback;

  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0 ||
    parsedValue > 100
  ) {
    return null;
  }

  return Number(parsedValue.toFixed(2));
};

const generateSku = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();

  return `MED-${timestamp}-${randomPart}`;
};

const getMedicineRecord = async (medicineId) => {
  const [medicines] = await db.query(
    `
      SELECT
        medicines.id,
        medicines.sku,
        medicines.brand_name AS brandName,
        medicines.generic_name AS genericName,
        medicines.category_id AS categoryId,
        medicine_categories.name AS categoryName,
        medicines.manufacturer_id AS manufacturerId,
        manufacturers.name AS manufacturerName,
        medicines.strength,
        medicines.dosage_form AS dosageForm,
        medicines.unit,
        medicines.pack_size AS packSize,
        medicines.barcode,
        medicines.hsn_code AS hsnCode,
        medicines.gst_percent AS gstPercent,
        medicines.prescription_required AS prescriptionRequired,
        medicines.reorder_level AS reorderLevel,
        medicines.storage_instructions AS storageInstructions,
        medicines.description,
        medicines.is_active AS isActive,
        medicines.created_at AS createdAt,
        medicines.updated_at AS updatedAt,
        users.full_name AS createdBy
      FROM medicines
      INNER JOIN medicine_categories
        ON medicine_categories.id = medicines.category_id
      INNER JOIN manufacturers
        ON manufacturers.id = medicines.manufacturer_id
      LEFT JOIN users
        ON users.id = medicines.created_by
      WHERE medicines.id = ?
      LIMIT 1
    `,
    [medicineId]
  );

  return medicines[0] || null;
};

const createMedicine = async (req, res) => {
  try {
    const {
      sku,
      brandName,
      genericName,
      categoryId,
      manufacturerId,
      strength,
      dosageForm,
      unit,
      packSize,
      barcode,
      hsnCode,
      gstPercent,
      prescriptionRequired,
      reorderLevel,
      storageInstructions,
      description,
    } = req.body;

    if (!brandName?.trim() || !genericName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Brand name and generic name are required",
      });
    }

    const parsedCategoryId = parsePositiveId(categoryId);
    const parsedManufacturerId = parsePositiveId(manufacturerId);

    if (!parsedCategoryId) {
      return res.status(400).json({
        success: false,
        message: "A valid category ID is required",
      });
    }

    if (!parsedManufacturerId) {
      return res.status(400).json({
        success: false,
        message: "A valid manufacturer ID is required",
      });
    }

    const parsedGstPercent = parseGstPercent(gstPercent, 0);

    if (parsedGstPercent === null) {
      return res.status(400).json({
        success: false,
        message: "GST percentage must be between 0 and 100",
      });
    }

    const parsedReorderLevel = parseNonNegativeInteger(reorderLevel, 10);

    if (parsedReorderLevel === null) {
      return res.status(400).json({
        success: false,
        message: "Reorder level must be a non-negative whole number",
      });
    }

    const parsedPrescriptionRequired = parseBoolean(
      prescriptionRequired,
      false
    );

    if (parsedPrescriptionRequired === null) {
      return res.status(400).json({
        success: false,
        message: "prescriptionRequired must be true or false",
      });
    }

    const [categories] = await db.query(
      `
        SELECT id
        FROM medicine_categories
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
      `,
      [parsedCategoryId]
    );

    if (categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Active medicine category was not found",
      });
    }

    const [manufacturers] = await db.query(
      `
        SELECT id
        FROM manufacturers
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
      `,
      [parsedManufacturerId]
    );

    if (manufacturers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Active manufacturer was not found",
      });
    }

    const finalSku = sku?.trim().toUpperCase() || generateSku();
    const normalizedBarcode = barcode?.trim() || null;

    const [existingRows] = await db.query(
      `
        SELECT id
        FROM medicines
        WHERE sku = ?
          OR (? IS NOT NULL AND barcode = ?)
        LIMIT 1
      `,
      [finalSku, normalizedBarcode, normalizedBarcode]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Medicine SKU or barcode already exists",
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO medicines (
          sku,
          brand_name,
          generic_name,
          category_id,
          manufacturer_id,
          strength,
          dosage_form,
          unit,
          pack_size,
          barcode,
          hsn_code,
          gst_percent,
          prescription_required,
          reorder_level,
          storage_instructions,
          description,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalSku,
        brandName.trim(),
        genericName.trim(),
        parsedCategoryId,
        parsedManufacturerId,
        strength?.trim() || null,
        dosageForm?.trim() || null,
        unit?.trim() || "piece",
        packSize?.trim() || null,
        normalizedBarcode,
        hsnCode?.trim().toUpperCase() || null,
        parsedGstPercent,
        parsedPrescriptionRequired ? 1 : 0,
        parsedReorderLevel,
        storageInstructions?.trim() || null,
        description?.trim() || null,
        req.user.userId,
      ]
    );

    const medicine = await getMedicineRecord(result.insertId);

    return res.status(201).json({
      success: true,
      message: "Medicine created successfully",
      data: {
        medicine,
      },
    });
  } catch (error) {
    console.error("Create medicine error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Medicine SKU or barcode already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create medicine",
      error: error.message,
    });
  }
};

const getMedicines = async (req, res) => {
  try {
    const {
      search = "",
      status = "all",
      categoryId,
      manufacturerId,
      prescriptionRequired,
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
      conditions.push(`
        (
          medicines.sku LIKE ?
          OR medicines.brand_name LIKE ?
          OR medicines.generic_name LIKE ?
          OR medicines.barcode LIKE ?
          OR medicines.hsn_code LIKE ?
          OR medicine_categories.name LIKE ?
          OR manufacturers.name LIKE ?
        )
      `);

      const searchValue = `%${search.trim()}%`;

      values.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    if (status === "active") {
      conditions.push("medicines.is_active = 1");
    }

    if (status === "inactive") {
      conditions.push("medicines.is_active = 0");
    }

    if (categoryId !== undefined) {
      const parsedCategoryId = parsePositiveId(categoryId);

      if (!parsedCategoryId) {
        return res.status(400).json({
          success: false,
          message: "A valid category ID is required",
        });
      }

      conditions.push("medicines.category_id = ?");
      values.push(parsedCategoryId);
    }

    if (manufacturerId !== undefined) {
      const parsedManufacturerId = parsePositiveId(manufacturerId);

      if (!parsedManufacturerId) {
        return res.status(400).json({
          success: false,
          message: "A valid manufacturer ID is required",
        });
      }

      conditions.push("medicines.manufacturer_id = ?");
      values.push(parsedManufacturerId);
    }

    if (prescriptionRequired !== undefined) {
      const parsedPrescriptionRequired = parseBoolean(
        prescriptionRequired,
        null
      );

      if (parsedPrescriptionRequired === null) {
        return res.status(400).json({
          success: false,
          message: "prescriptionRequired must be true or false",
        });
      }

      conditions.push("medicines.prescription_required = ?");
      values.push(parsedPrescriptionRequired ? 1 : 0);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM medicines
        INNER JOIN medicine_categories
          ON medicine_categories.id = medicines.category_id
        INNER JOIN manufacturers
          ON manufacturers.id = medicines.manufacturer_id
        ${whereClause}
      `,
      values
    );

    const [medicines] = await db.query(
      `
        SELECT
          medicines.id,
          medicines.sku,
          medicines.brand_name AS brandName,
          medicines.generic_name AS genericName,
          medicines.category_id AS categoryId,
          medicine_categories.name AS categoryName,
          medicines.manufacturer_id AS manufacturerId,
          manufacturers.name AS manufacturerName,
          medicines.strength,
          medicines.dosage_form AS dosageForm,
          medicines.unit,
          medicines.pack_size AS packSize,
          medicines.barcode,
          medicines.hsn_code AS hsnCode,
          medicines.gst_percent AS gstPercent,
          medicines.prescription_required AS prescriptionRequired,
          medicines.reorder_level AS reorderLevel,
          medicines.is_active AS isActive,
          medicines.created_at AS createdAt,
          medicines.updated_at AS updatedAt
        FROM medicines
        INNER JOIN medicine_categories
          ON medicine_categories.id = medicines.category_id
        INNER JOIN manufacturers
          ON manufacturers.id = medicines.manufacturer_id
        ${whereClause}
        ORDER BY medicines.id DESC
        LIMIT ? OFFSET ?
      `,
      [...values, limitNumber, offset]
    );

    const total = Number(countRows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        medicines,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber),
        },
      },
    });
  } catch (error) {
    console.error("Get medicines error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve medicines",
      error: error.message,
    });
  }
};

const getMedicineById = async (req, res) => {
  try {
    const medicineId = parsePositiveId(req.params.id);

    if (!medicineId) {
      return res.status(400).json({
        success: false,
        message: "A valid medicine ID is required",
      });
    }

    const medicine = await getMedicineRecord(medicineId);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine was not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        medicine,
      },
    });
  } catch (error) {
    console.error("Get medicine error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve medicine",
      error: error.message,
    });
  }
};

const updateMedicine = async (req, res) => {
  try {
    const medicineId = parsePositiveId(req.params.id);

    if (!medicineId) {
      return res.status(400).json({
        success: false,
        message: "A valid medicine ID is required",
      });
    }

    const [existingRows] = await db.query(
      `
        SELECT *
        FROM medicines
        WHERE id = ?
        LIMIT 1
      `,
      [medicineId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Medicine was not found",
      });
    }

    const existingMedicine = existingRows[0];

    const {
      sku,
      brandName,
      genericName,
      categoryId,
      manufacturerId,
      strength,
      dosageForm,
      unit,
      packSize,
      barcode,
      hsnCode,
      gstPercent,
      prescriptionRequired,
      reorderLevel,
      storageInstructions,
      description,
      isActive,
    } = req.body;

    const updatedCategoryId =
      categoryId !== undefined
        ? parsePositiveId(categoryId)
        : existingMedicine.category_id;

    const updatedManufacturerId =
      manufacturerId !== undefined
        ? parsePositiveId(manufacturerId)
        : existingMedicine.manufacturer_id;

    if (!updatedCategoryId || !updatedManufacturerId) {
      return res.status(400).json({
        success: false,
        message: "Valid category and manufacturer IDs are required",
      });
    }

    const updatedGstPercent = parseGstPercent(
      gstPercent,
      Number(existingMedicine.gst_percent)
    );

    if (updatedGstPercent === null) {
      return res.status(400).json({
        success: false,
        message: "GST percentage must be between 0 and 100",
      });
    }

    const updatedReorderLevel = parseNonNegativeInteger(
      reorderLevel,
      existingMedicine.reorder_level
    );

    if (updatedReorderLevel === null) {
      return res.status(400).json({
        success: false,
        message: "Reorder level must be a non-negative whole number",
      });
    }

    const updatedPrescriptionRequired = parseBoolean(
      prescriptionRequired,
      Boolean(existingMedicine.prescription_required)
    );

    const updatedStatus = parseBoolean(
      isActive,
      Boolean(existingMedicine.is_active)
    );

    if (
      updatedPrescriptionRequired === null ||
      updatedStatus === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Boolean values must be true or false",
      });
    }

    const updatedSku =
      typeof sku === "string" && sku.trim()
        ? sku.trim().toUpperCase()
        : existingMedicine.sku;

    const updatedBarcode =
      barcode !== undefined
        ? barcode?.trim() || null
        : existingMedicine.barcode;

    const [duplicateRows] = await db.query(
      `
        SELECT id
        FROM medicines
        WHERE id != ?
          AND (
            sku = ?
            OR (? IS NOT NULL AND barcode = ?)
          )
        LIMIT 1
      `,
      [
        medicineId,
        updatedSku,
        updatedBarcode,
        updatedBarcode,
      ]
    );

    if (duplicateRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Another medicine has the same SKU or barcode",
      });
    }

    await db.query(
      `
        UPDATE medicines
        SET
          sku = ?,
          brand_name = ?,
          generic_name = ?,
          category_id = ?,
          manufacturer_id = ?,
          strength = ?,
          dosage_form = ?,
          unit = ?,
          pack_size = ?,
          barcode = ?,
          hsn_code = ?,
          gst_percent = ?,
          prescription_required = ?,
          reorder_level = ?,
          storage_instructions = ?,
          description = ?,
          is_active = ?
        WHERE id = ?
      `,
      [
        updatedSku,
        brandName !== undefined
          ? brandName?.trim() || existingMedicine.brand_name
          : existingMedicine.brand_name,
        genericName !== undefined
          ? genericName?.trim() || existingMedicine.generic_name
          : existingMedicine.generic_name,
        updatedCategoryId,
        updatedManufacturerId,
        strength !== undefined
          ? strength?.trim() || null
          : existingMedicine.strength,
        dosageForm !== undefined
          ? dosageForm?.trim() || null
          : existingMedicine.dosage_form,
        unit !== undefined
          ? unit?.trim() || "piece"
          : existingMedicine.unit,
        packSize !== undefined
          ? packSize?.trim() || null
          : existingMedicine.pack_size,
        updatedBarcode,
        hsnCode !== undefined
          ? hsnCode?.trim().toUpperCase() || null
          : existingMedicine.hsn_code,
        updatedGstPercent,
        updatedPrescriptionRequired ? 1 : 0,
        updatedReorderLevel,
        storageInstructions !== undefined
          ? storageInstructions?.trim() || null
          : existingMedicine.storage_instructions,
        description !== undefined
          ? description?.trim() || null
          : existingMedicine.description,
        updatedStatus ? 1 : 0,
        medicineId,
      ]
    );

    const medicine = await getMedicineRecord(medicineId);

    return res.status(200).json({
      success: true,
      message: "Medicine updated successfully",
      data: {
        medicine,
      },
    });
  } catch (error) {
    console.error("Update medicine error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Medicine SKU or barcode already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update medicine",
      error: error.message,
    });
  }
};

const deleteMedicine = async (req, res) => {
  try {
    const medicineId = parsePositiveId(req.params.id);

    if (!medicineId) {
      return res.status(400).json({
        success: false,
        message: "A valid medicine ID is required",
      });
    }

    const [result] = await db.query(
      `
        UPDATE medicines
        SET is_active = 0
        WHERE id = ?
          AND is_active = 1
      `,
      [medicineId]
    );

    if (result.affectedRows === 0) {
      const [medicines] = await db.query(
        `
          SELECT id
          FROM medicines
          WHERE id = ?
          LIMIT 1
        `,
        [medicineId]
      );

      if (medicines.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Medicine was not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Medicine is already inactive",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Medicine deactivated successfully",
    });
  } catch (error) {
    console.error("Delete medicine error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to deactivate medicine",
      error: error.message,
    });
  }
};

module.exports = {
  createMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  deleteMedicine,
};
