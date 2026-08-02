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

const createManufacturer = async (req, res) => {
  try {
    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      drugLicenseNumber,
      gstin,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Manufacturer name is required",
      });
    }

    const manufacturerName = name.trim();

    const [existingManufacturers] = await db.query(
      `
        SELECT id
        FROM manufacturers
        WHERE LOWER(name) = LOWER(?)
        LIMIT 1
      `,
      [manufacturerName]
    );

    if (existingManufacturers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A manufacturer with this name already exists",
      });
    }

    const normalizedEmail = email?.trim().toLowerCase() || null;
    const normalizedPhone = phone?.trim() || null;
    const normalizedGstin = gstin?.trim().toUpperCase() || null;
    const normalizedLicense =
      drugLicenseNumber?.trim().toUpperCase() || null;

    const [result] = await db.query(
      `
        INSERT INTO manufacturers (
          name,
          contact_person,
          phone,
          email,
          address,
          drug_license_number,
          gstin,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        manufacturerName,
        contactPerson?.trim() || null,
        normalizedPhone,
        normalizedEmail,
        address?.trim() || null,
        normalizedLicense,
        normalizedGstin,
        req.user.userId,
      ]
    );

    const [manufacturers] = await db.query(
      `
        SELECT
          manufacturers.id,
          manufacturers.name,
          manufacturers.contact_person AS contactPerson,
          manufacturers.phone,
          manufacturers.email,
          manufacturers.address,
          manufacturers.drug_license_number AS drugLicenseNumber,
          manufacturers.gstin,
          manufacturers.is_active AS isActive,
          manufacturers.created_at AS createdAt,
          manufacturers.updated_at AS updatedAt,
          users.full_name AS createdBy
        FROM manufacturers
        LEFT JOIN users
          ON users.id = manufacturers.created_by
        WHERE manufacturers.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Manufacturer created successfully",
      data: {
        manufacturer: manufacturers[0],
      },
    });
  } catch (error) {
    console.error("Create manufacturer error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Manufacturer information already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create manufacturer",
      error: error.message,
    });
  }
};

const getManufacturers = async (req, res) => {
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
      conditions.push(`
        (
          manufacturers.name LIKE ?
          OR manufacturers.contact_person LIKE ?
          OR manufacturers.phone LIKE ?
          OR manufacturers.email LIKE ?
          OR manufacturers.drug_license_number LIKE ?
          OR manufacturers.gstin LIKE ?
        )
      `);

      const searchValue = `%${search.trim()}%`;

      values.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    if (status === "active") {
      conditions.push("manufacturers.is_active = 1");
    }

    if (status === "inactive") {
      conditions.push("manufacturers.is_active = 0");
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM manufacturers
        ${whereClause}
      `,
      values
    );

    const [manufacturers] = await db.query(
      `
        SELECT
          manufacturers.id,
          manufacturers.name,
          manufacturers.contact_person AS contactPerson,
          manufacturers.phone,
          manufacturers.email,
          manufacturers.address,
          manufacturers.drug_license_number AS drugLicenseNumber,
          manufacturers.gstin,
          manufacturers.is_active AS isActive,
          manufacturers.created_at AS createdAt,
          manufacturers.updated_at AS updatedAt,
          users.full_name AS createdBy
        FROM manufacturers
        LEFT JOIN users
          ON users.id = manufacturers.created_by
        ${whereClause}
        ORDER BY manufacturers.id DESC
        LIMIT ? OFFSET ?
      `,
      [...values, limitNumber, offset]
    );

    const total = Number(countRows[0].total);
    const totalPages = Math.ceil(total / limitNumber);

    return res.status(200).json({
      success: true,
      data: {
        manufacturers,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Get manufacturers error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve manufacturers",
      error: error.message,
    });
  }
};

const getManufacturerById = async (req, res) => {
  try {
    const manufacturerId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(manufacturerId) || manufacturerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid manufacturer ID is required",
      });
    }

    const [manufacturers] = await db.query(
      `
        SELECT
          manufacturers.id,
          manufacturers.name,
          manufacturers.contact_person AS contactPerson,
          manufacturers.phone,
          manufacturers.email,
          manufacturers.address,
          manufacturers.drug_license_number AS drugLicenseNumber,
          manufacturers.gstin,
          manufacturers.is_active AS isActive,
          manufacturers.created_at AS createdAt,
          manufacturers.updated_at AS updatedAt,
          users.full_name AS createdBy
        FROM manufacturers
        LEFT JOIN users
          ON users.id = manufacturers.created_by
        WHERE manufacturers.id = ?
        LIMIT 1
      `,
      [manufacturerId]
    );

    if (manufacturers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer was not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        manufacturer: manufacturers[0],
      },
    });
  } catch (error) {
    console.error("Get manufacturer error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve manufacturer",
      error: error.message,
    });
  }
};

const updateManufacturer = async (req, res) => {
  try {
    const manufacturerId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(manufacturerId) || manufacturerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid manufacturer ID is required",
      });
    }

    const [existingRows] = await db.query(
      `
        SELECT *
        FROM manufacturers
        WHERE id = ?
        LIMIT 1
      `,
      [manufacturerId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer was not found",
      });
    }

    const existingManufacturer = existingRows[0];

    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      drugLicenseNumber,
      gstin,
      isActive,
    } = req.body;

    const updatedName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : existingManufacturer.name;

    const updatedStatus = parseBoolean(
      isActive,
      Boolean(existingManufacturer.is_active)
    );

    if (updatedStatus === null) {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
    }

    const [duplicateRows] = await db.query(
      `
        SELECT id
        FROM manufacturers
        WHERE LOWER(name) = LOWER(?)
          AND id != ?
        LIMIT 1
      `,
      [updatedName, manufacturerId]
    );

    if (duplicateRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Another manufacturer with this name already exists",
      });
    }

    const updatedContactPerson =
      contactPerson !== undefined
        ? contactPerson?.trim() || null
        : existingManufacturer.contact_person;

    const updatedPhone =
      phone !== undefined
        ? phone?.trim() || null
        : existingManufacturer.phone;

    const updatedEmail =
      email !== undefined
        ? email?.trim().toLowerCase() || null
        : existingManufacturer.email;

    const updatedAddress =
      address !== undefined
        ? address?.trim() || null
        : existingManufacturer.address;

    const updatedLicense =
      drugLicenseNumber !== undefined
        ? drugLicenseNumber?.trim().toUpperCase() || null
        : existingManufacturer.drug_license_number;

    const updatedGstin =
      gstin !== undefined
        ? gstin?.trim().toUpperCase() || null
        : existingManufacturer.gstin;

    await db.query(
      `
        UPDATE manufacturers
        SET
          name = ?,
          contact_person = ?,
          phone = ?,
          email = ?,
          address = ?,
          drug_license_number = ?,
          gstin = ?,
          is_active = ?
        WHERE id = ?
      `,
      [
        updatedName,
        updatedContactPerson,
        updatedPhone,
        updatedEmail,
        updatedAddress,
        updatedLicense,
        updatedGstin,
        updatedStatus ? 1 : 0,
        manufacturerId,
      ]
    );

    const [manufacturers] = await db.query(
      `
        SELECT
          id,
          name,
          contact_person AS contactPerson,
          phone,
          email,
          address,
          drug_license_number AS drugLicenseNumber,
          gstin,
          is_active AS isActive,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM manufacturers
        WHERE id = ?
        LIMIT 1
      `,
      [manufacturerId]
    );

    return res.status(200).json({
      success: true,
      message: "Manufacturer updated successfully",
      data: {
        manufacturer: manufacturers[0],
      },
    });
  } catch (error) {
    console.error("Update manufacturer error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Manufacturer information already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update manufacturer",
      error: error.message,
    });
  }
};

const deleteManufacturer = async (req, res) => {
  try {
    const manufacturerId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(manufacturerId) || manufacturerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid manufacturer ID is required",
      });
    }

    const [result] = await db.query(
      `
        UPDATE manufacturers
        SET is_active = 0
        WHERE id = ?
          AND is_active = 1
      `,
      [manufacturerId]
    );

    if (result.affectedRows === 0) {
      const [manufacturers] = await db.query(
        `
          SELECT id, is_active
          FROM manufacturers
          WHERE id = ?
          LIMIT 1
        `,
        [manufacturerId]
      );

      if (manufacturers.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Manufacturer was not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Manufacturer is already inactive",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Manufacturer deactivated successfully",
    });
  } catch (error) {
    console.error("Delete manufacturer error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to deactivate manufacturer",
      error: error.message,
    });
  }
};

module.exports = {
  createManufacturer,
  getManufacturers,
  getManufacturerById,
  updateManufacturer,
  deleteManufacturer,
};
