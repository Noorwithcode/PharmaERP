const db = require("../config/db");

const testDatabase = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        DATABASE() AS databaseName,
        NOW() AS currentTime
    `);

    return res.status(200).json({
      success: true,
      message: "MySQL database connected successfully",
      data: rows[0],
    });
  } catch (error) {
    console.error("Database connection error:", error);

    return res.status(500).json({
      success: false,
      message: "MySQL database connection failed",
      error: error.message,
    });
  }
};

module.exports = {
  testDatabase,
};
